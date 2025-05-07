import { DataTable } from "../core/DataTable";
import { handleRowCheckboxClick, updateSelectAllCheckboxState } from "../features/selection";
import { renderActionButtons } from './uiComponents';
import { ColumnDefinition } from "../core/types";
import { dispatchActionClickEvent, dispatchSelectionChangeEvent } from "../events/dispatcher";

// --- Body Rendering Logic ---

// Cache pour les formateurs Intl (améliore la performance)
const intlFormattersCache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function getCachedNumberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const cacheKey = `number-${locale}-${JSON.stringify(options)}`;
    if (!intlFormattersCache.has(cacheKey)) {
        intlFormattersCache.set(cacheKey, new Intl.NumberFormat(locale, options));
    }
    return intlFormattersCache.get(cacheKey) as Intl.NumberFormat;
}

function getCachedDateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const cacheKey = `datetime-${locale}-${JSON.stringify(options)}`;
    if (!intlFormattersCache.has(cacheKey)) {
        intlFormattersCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
    }
    return intlFormattersCache.get(cacheKey) as Intl.DateTimeFormat;
}

/**
 * Gets the unique ID for a given row based on the configured unique ID column index.
 * @param row The row data array.
 * @param uniqueIdColumnIndex The index of the column containing the unique ID.
 * @returns The row ID, or undefined if the index is out of bounds.
 */
function getRowId(row: any[], uniqueIdColumnIndex: number): any {
    // Basic check to prevent errors if the index is invalid for the row
    if (uniqueIdColumnIndex >= 0 && uniqueIdColumnIndex < row.length) {
        return row[uniqueIdColumnIndex];
    }
    console.warn(`[getRowId] Invalid uniqueIdColumnIndex (${uniqueIdColumnIndex}) for row:`, row);
    return undefined; // Return undefined if index is invalid
}

/**
 * Formate une valeur de cellule basée sur la définition de colonne (type, locale, currency, etc.).
 * Appelé lorsque `columnDef.render` n'est pas fourni.
 */
function formatCellData(cellData: any, columnDef: Readonly<ColumnDefinition>): string {
    if (cellData === null || cellData === undefined) {
        return ''; // Retourner une chaîne vide pour null/undefined
    }

    const { type, locale = 'default', currency, dateFormatOptions } = columnDef;

    try {
        switch (type) {
            case 'number':
                if (typeof cellData === 'number') {
                    const formatter = getCachedNumberFormatter(locale, { style: 'decimal' });
                    return formatter.format(cellData);
                } break;
            case 'money':
                if (typeof cellData === 'number') {
                    const options: Intl.NumberFormatOptions = { style: 'currency', currency: currency || 'USD' }; // USD par défaut si non spécifié
                    const formatter = getCachedNumberFormatter(locale, options);
                    return formatter.format(cellData);
                } break;
            case 'date':
                try {
                    const date = new Date(cellData);
                    if (!isNaN(date.getTime())) {
                        const options = dateFormatOptions || { year: 'numeric', month: 'numeric', day: 'numeric' };
                        const formatter = getCachedDateTimeFormatter(locale, options);
                        return formatter.format(date);
                    } 
                } catch (e) { /* Ignorer l'erreur si la date n'est pas valide */ }
                break;
             case 'datetime':
                try {
                    const date = new Date(cellData);
                    if (!isNaN(date.getTime())) {
                        const options = dateFormatOptions || { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' };
                        const formatter = getCachedDateTimeFormatter(locale, options);
                        return formatter.format(date);
                    }
                } catch (e) { /* Ignorer l'erreur si la date n'est pas valide */ }
                break;
             case 'boolean':
                return cellData ? '✅' : '❌'; // Ou utilisez des icônes/badges
        }
    } catch (error) {
        console.error(`[formatCellData] Error formatting data for column ${columnDef.title}:`, error);
        // Retourner la valeur brute en cas d'erreur de formatage
    }

    // Retourner la valeur brute si pas de formatage spécifique ou si le type/valeur ne correspond pas
    return String(cellData);
}

/**
 * Renders the table body (TBODY) for standard mode.
 * @param instance The DataTable instance.
 * @param table The TABLE element.
 * @param data The data to render in the body.
 * @param columnOrderOverride Optional column order to use instead of state.
 */
export function renderStandardBody(instance: DataTable, table: HTMLTableElement, data: any[][], columnOrderOverride?: number[]): void {
    console.log(`[renderStandardBody START] Called. Order override: ${JSON.stringify(columnOrderOverride)}`);

    // Log 1: Début de renderStandardBody
    console.log(`[renderStandardBody START] Called for table ${instance.el.id}. Data length: ${data.length}`);

    // Log 2: Vérifier existence instance.state
    if (!instance.state) {
        console.error("[renderStandardBody CRITICAL ERROR] instance.state is UNDEFINED or NULL!");
        return; // Stop rendering if state is not available
    }
    console.log("[renderStandardBody] instance.state exists. Proceeding...");

    const state = instance.state;
    let tbody = table.tBodies[0];
    if (!tbody) {
        tbody = table.createTBody();
    } else {
        // Vider le tbody précédent et retirer l'ancien listener (s'il existe)
        const oldListener = (tbody as any)._dtActionClickListener;
        if (oldListener) {
            tbody.removeEventListener('click', oldListener);
        }
        tbody.innerHTML = '';
    }

    // Log 3: Vérifier si state.getColumnOrder est une fonction AVANT l'appel
    if (typeof state.getColumnOrder !== 'function') {
        console.error("[renderStandardBody CRITICAL ERROR] state.getColumnOrder is NOT a function! State object:", state);
        return;
    }
    console.log("[renderStandardBody] state.getColumnOrder is a function. About to call it...");

    // Utiliser l'override s'il est fourni, sinon prendre celui de l'état
    const columnOrder = columnOrderOverride ?? state.getColumnOrder();
    console.log(`[renderStandardBody] Using column order: ${JSON.stringify(columnOrder)}`);

    const selectedRowIds = state.getSelectedRowIds();
    const selectionEnabled = state.getSelectionEnabled();
    const uniqueRowIdColumn = instance.idColumn;
    const rowActions = instance.options.rowActions;
    const visibleColumns = state.getVisibleColumns();

    // Stocker les données de la page actuelle pour les retrouver lors du clic
    const currentPagedDataMap = new Map<string, any[]>();
    const currentPagedRowIndexMap = new Map<string, number>();

    if (rowActions && rowActions.length > 0) {
        data.forEach((row, index) => {
            const rowId = getRowId(row, uniqueRowIdColumn);
            if (rowId !== undefined && rowId !== null) {
                const rowIdStr = String(rowId);
                currentPagedDataMap.set(rowIdStr, row);
                currentPagedRowIndexMap.set(rowIdStr, index);
            }
        });
    }

    if (data.length === 0) {
        renderEmptyState(instance, tbody);
        updateSelectAllCheckboxState(instance);
        return;
    }

    const fragment = document.createDocumentFragment();

    data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'row');
        tr.className = 'transition-colors duration-150 ease-in-out hover:bg-gray-50';
        
        const rowId = getRowId(row, uniqueRowIdColumn);
        if (selectionEnabled && selectedRowIds.has(rowId)) {
            tr.classList.remove('hover:bg-gray-50');
            tr.classList.add('bg-blue-100'); 
        }
        // Stocker l'ID sur le TR peut aussi être utile
        if (rowId !== undefined && rowId !== null) {
             tr.dataset.rowId = String(rowId);
        }

        if (selectionEnabled) {
            const tdCheckbox = document.createElement('td'); 
            tdCheckbox.setAttribute('role', 'cell');
            tdCheckbox.className = 'dt-td dt-td-checkbox px-4 py-2 text-center align-middle sticky left-0 z-5'; 
            if (selectedRowIds.has(rowId)) {
                tdCheckbox.classList.add('bg-blue-100'); 
            } else {
                 tdCheckbox.classList.add('bg-white');
            }
            tdCheckbox.style.width = '50px'; 
            const checkbox = document.createElement('input');
            checkbox.type = state.getSelectionMode() === 'single' ? 'radio' : 'checkbox';
            checkbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
            checkbox.name = state.getSelectionMode() === 'single' ? `dt-select-${instance.el.id}` : '';
            checkbox.checked = selectedRowIds.has(rowId);
            checkbox.setAttribute('aria-label', `Select row ${rowIndex + 1}`);
            checkbox.addEventListener('change', (event) => {
                 const target = event.target as HTMLInputElement;
                 handleRowCheckboxClick(instance, rowId, target.checked);
            });
            tdCheckbox.appendChild(checkbox);
            tr.appendChild(tdCheckbox);
        }

        columnOrder.forEach((originalIndex: number) => {
            if (!visibleColumns.has(originalIndex)) {
                return;
            }
            const columnDef = instance.options.columns[originalIndex];
            const cellData = row[originalIndex]; 
            const td = document.createElement('td'); 
            td.setAttribute('role', 'cell');
            td.className = 'dt-td px-4 py-2 text-sm text-gray-700 border-b border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis';
            
            // *** AJOUT: Appliquer la largeur de la colonne si définie ***
            if (columnDef.width) {
                td.style.width = columnDef.width;
            }

            if (columnDef?.render) {
                try {
                    const renderResult = columnDef.render(cellData, row, columnDef, td);
                    if (typeof renderResult === 'string') {
                        if (columnDef.unsafeRenderHtml === true) {
                            td.innerHTML = renderResult;
                        } else {
                            td.textContent = renderResult;
                        }
                    } else if (renderResult instanceof Node) {
                        td.innerHTML = ''; 
                        td.appendChild(renderResult);
                    } 
                } catch (error) {
                    console.error(`[renderStandardBody] Error in custom render function for column ${columnDef.title}:`, error);
                    td.textContent = '#RENDER_ERROR#'; 
                    td.style.color = 'red';
                    td.style.fontWeight = 'bold';
                }
            } else {
                // --- Rendu par défaut --- 
                const cellDataFormatted = formatCellData(cellData, columnDef);
                
                // Cas spécial pour boolean pour l'accessibilité
                if (columnDef.type === 'boolean') {
                    td.innerHTML = ''; // Vider le contenu potentiel
                    const wrapper = document.createElement('span');
                    // L'emoji lui-même
                    const icon = document.createElement('span');
                    icon.setAttribute('aria-hidden', 'true'); // Cacher l'emoji aux lecteurs d'écran
                    icon.textContent = cellData ? '✅' : '❌';
                    wrapper.appendChild(icon);
                    // Texte pour lecteur d'écran
                    const srText = document.createElement('span');
                    srText.className = 'sr-only'; // Classe Tailwind pour cacher visuellement
                    srText.textContent = cellData ? ' (Vrai)' : ' (Faux)'; // Ajouter des parenthèses pour la ponctuation vocale
                    wrapper.appendChild(srText);
                    td.appendChild(wrapper);
                } else {
                    // Pour les autres types, utiliser textContent avec les données formatées
                    td.textContent = cellDataFormatted;
                }
            }
            tr.appendChild(td);
        });

        // Appel modifié : passer le TR et les données
        const actionsCell = renderActionButtons(instance, tr, row);
        if (actionsCell) {
            tr.appendChild(actionsCell); // Ajouter la cellule d'actions si elle existe
        }

        // --- Appel du createdRowCallback --- 
        if (instance.options.createdRowCallback) {
            try {
                instance.options.createdRowCallback(tr, row);
            } catch (error) {
                console.error(`[renderStandardBody] Error in createdRowCallback for rowId ${rowId}:`, error);
                // Optionnel: ajouter une classe d'erreur à la ligne
                tr.classList.add('dt-row-callback-error');
            }
        }
        // -----------------------------------

        fragment.appendChild(tr); 
    });

    tbody.appendChild(fragment);

    // Ajouter le listener délégué APRÈS avoir rempli le tbody
    if (rowActions && rowActions.length > 0) {
        const actionClickListener = (event: MouseEvent) => {
            // Caster closest en HTMLElement
            const button = (event.target as HTMLElement).closest('button.dt-action-button[data-action-id]') as HTMLElement | null;
            if (!button) return;

            // Utiliser button.dataset
            const actionId = button.dataset.actionId;
            const rowIdStr = button.dataset.rowId;
            
            if (!actionId || rowIdStr === undefined) return;
            
            // Récupérer données et index depuis les Maps
            const clickedRowData = currentPagedDataMap.get(rowIdStr);
            const clickedRowIndex = currentPagedRowIndexMap.get(rowIdStr);

            if (clickedRowData && clickedRowIndex !== undefined) {
                event.stopPropagation();
                dispatchActionClickEvent(instance, { 
                    actionId: actionId,
                    rowData: clickedRowData,
                    rowId: rowIdStr,
                    rowIndex: clickedRowIndex 
                }); 
            } else {
                console.warn(`[Action Click] Could not find data or index for rowId: ${rowIdStr}`);
            }
        };
        tbody.addEventListener('click', actionClickListener);
        // Stocker la référence au listener pour pouvoir le retirer plus tard
        (tbody as any)._dtActionClickListener = actionClickListener;
    }
    console.log(`[renderStandardBody END] Body rendered for table ${instance.el.id}`); // Log 5
}

/**
 * Renders the empty state message in the table body.
 * @param instance The DataTable instance.
 * @param tbody The TBODY element.
 */
function renderEmptyState(instance: DataTable, tbody: HTMLTableSectionElement): void {
    const state = instance.state; 
    const row = tbody.insertRow();
    const cell = row.insertCell();
    const totalColumnCount =
        instance.options.columns.length +
        (instance.options.rowActions && instance.options.rowActions.length > 0 ? 1 : 0) +
        (state.getSelectionEnabled() ? 1 : 0);
    cell.colSpan = totalColumnCount;
    cell.className = 'px-6 py-12 text-center text-sm text-gray-500';
    cell.textContent = state.getFilterTerm()
        ? 'Aucun résultat trouvé pour votre recherche.'
        : 'Aucune donnée à afficher.';
} 

// --- Event Handlers for Body Interactions ---

function handleRowClick(event: MouseEvent | KeyboardEvent, instance: DataTable, rowId: any) {
    // Empêcher le clic sur la ligne si on clique sur un input, bouton ou lien dans la ligne
    const target = event.target as HTMLElement;
    if (target.closest('input, button, a, .dt-action-button')) {
        return;
    }

    if (!instance.state.getSelectionEnabled()) return;

    // Gérer la sélection
    instance.state.toggleRowSelection(rowId);
    dispatchSelectionChangeEvent(instance);
    instance.render(); // Re-render pour mettre à jour le style de la ligne
}

// --- Body Rendering --- 

/**
 * Renders the rows for virtual scrolling.
 * Calculates visible rows based on scroll position and renders only those.
 * @param instance The DataTable instance.
 * @param contentElement The DIV element where rows will be absolutely positioned.
 * @param viewportElement The scrolling DIV element (viewport).
 * @param allData The complete, filtered, and sorted data array.
 * @param columnOrderOverride Optional column order to use instead of state.
 */
export function renderVirtualBody(
    instance: DataTable, 
    contentElement: HTMLElement, 
    viewportElement: HTMLElement, 
    allData: any[][],
    columnOrderOverride?: number[]
): void {
    console.log(`[renderVirtualBody] Called. Order override: ${JSON.stringify(columnOrderOverride)}`);
    const options = instance.options.virtualScroll;
    if (!options?.enabled) return;

    const { rowHeight, bufferRows = 10 } = options;
    const state = instance.state;
    const columnOrder = columnOrderOverride ?? state.getColumnOrder();
    console.log(`[renderVirtualBody] Using column order: ${JSON.stringify(columnOrder)}`);
    const visibleColumns = state.getVisibleColumns();
    const columns = instance.options.columns;
    const uniqueIdColumnIndex = instance.idColumn;
    const hasRowActions = instance.options.rowActions && instance.options.rowActions.length > 0;
    const selectionEnabled = state.getSelectionEnabled();
    const selectedRowIds = state.getSelectedRowIds();

    const totalRows = allData.length;
    const scrollTop = viewportElement.scrollTop;
    const viewportHeight = viewportElement.clientHeight;

    // Calculer les index des lignes à rendre
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
    const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + bufferRows);

    console.log(`[RenderVirtualBody] ScrollTop: ${scrollTop.toFixed(0)}, ViewportH: ${viewportHeight}, TotalRows: ${totalRows}, StartIdx: ${startIndex}, EndIdx: ${endIndex}`);

    // Obtenir la tranche de données à afficher
    const dataToRender = allData.slice(startIndex, endIndex);
    
    console.log(`[RenderVirtualBody] Rendering ${dataToRender.length} rows (indices ${startIndex} to ${endIndex - 1}) out of ${totalRows} total rows.`);
    
    // Vider le conteneur
    contentElement.innerHTML = '';
    const fragment = document.createDocumentFragment();

    if (totalRows === 0) {
        renderEmptyState(instance, contentElement as unknown as HTMLTableSectionElement);
        return;
    } else {
         contentElement.style.textAlign = '';
         contentElement.style.padding = '';
    }

    // Rendre uniquement les lignes visibles
    dataToRender.forEach((row, indexInSlice) => {
        const absoluteRowIndex = startIndex + indexInSlice;
        const rowId = getRowId(row, uniqueIdColumnIndex);
        
        const tr = document.createElement('tr');
        tr.dataset.rowId = String(rowId);
        tr.setAttribute('role', 'row');
        tr.style.position = 'absolute';
        tr.style.top = `${absoluteRowIndex * rowHeight}px`;
        tr.style.height = `${rowHeight}px`;
        tr.style.width = '100%'; // Important pour la largeur
        tr.style.display = 'flex'; // Utiliser flex pour aligner les cellules
        tr.style.alignItems = 'center'; // Centrer verticalement par défaut

        const isSelected = selectedRowIds.has(rowId);
        tr.className = `dt-row ${isSelected ? 'bg-indigo-50 dt-row-selected' : (absoluteRowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50')}`;
        if (selectionEnabled) {
            tr.classList.add('cursor-pointer');
            tr.tabIndex = -1;
            tr.addEventListener('click', (e) => handleRowClick(e, instance, rowId));
             tr.addEventListener('keydown', (e) => {
                 if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     handleRowClick(e, instance, rowId);
                 }
             });
        }

        // Colonne de sélection
        if (selectionEnabled) {
            const tdSelect = document.createElement('td');
            tdSelect.className = 'dt-td px-6 py-2 whitespace-nowrap text-sm text-gray-500 flex-shrink-0';
            tdSelect.style.width = '50px';
            tdSelect.style.display = 'flex';
            tdSelect.style.alignItems = 'center';
            const checkbox = document.createElement('input');
            checkbox.type = state.getSelectionMode() === 'single' ? 'radio' : 'checkbox';
            checkbox.className = 'dt-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
            checkbox.checked = isSelected;
            checkbox.dataset.rowId = String(rowId);
            checkbox.setAttribute('aria-label', `Sélectionner la ligne ${absoluteRowIndex + 1}`);
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                handleRowCheckboxClick(instance, rowId, target.checked);
            });
            tdSelect.appendChild(checkbox);
            tr.appendChild(tdSelect);
        }

        // Cellules de données (rendues comme des TD)
        columnOrder.forEach((originalIndex: number) => {
            if (!visibleColumns.has(originalIndex)) {
                return;
            }
            
            const col = columns[originalIndex];
            const cellData = row[originalIndex];
            const td = document.createElement('td');
            td.className = 'dt-td px-6 py-2 whitespace-nowrap text-sm text-gray-500 overflow-hidden text-ellipsis flex-shrink-0';
            td.setAttribute('role', 'cell');
            td.style.boxSizing = 'border-box';
            
            // Appliquer la largeur de la colonne (si définie)
            const colWidth = state.getColumnWidths().get(originalIndex) || parseInt(col.width || '0', 10);
            if (colWidth > 0) {
                 td.style.width = `${colWidth}px`;
                 td.style.flexBasis = `${colWidth}px`;
            } else {
                 td.style.flexGrow = '1';
            }
            
            if (col.render) {
                const renderResult = col.render(cellData, row, col, td);
                if (renderResult !== undefined && renderResult !== null) {
                    if (typeof renderResult === 'string') {
                        td.innerHTML = renderResult;
                    } else if (renderResult instanceof Node) {
                        td.appendChild(renderResult);
                    }
                }
            } else {
                td.textContent = formatCellData(cellData, col);
            }
            tr.appendChild(td);
        });

        // Colonne d'actions (rendue comme un TD final)
        if (hasRowActions) {
             const tdActions = renderActionButtons(instance, tr, row);
             if (tdActions) {
                tdActions.style.flexShrink = '0';
                const actionsColWidth = instance.options.actionsColumn?.width;
                 if (actionsColWidth) {
                     tdActions.style.width = actionsColWidth;
                     tdActions.style.flexBasis = actionsColWidth;
                 }
                 tr.appendChild(tdActions);
             }
        }
        
        fragment.appendChild(tr);
    });

    contentElement.appendChild(fragment);
} 