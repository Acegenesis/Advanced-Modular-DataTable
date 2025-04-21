import { DataTable } from "../core/DataTable";
import { getCurrentPageData } from "../features/pagination";
import { handleRowCheckboxClick, updateSelectAllCheckboxState } from "../features/selection";
import { appendRenderedContent, renderCellByType } from "./cellRenderer";
import { renderActionButtons } from './uiComponents';
import { ColumnDefinition } from "../core/types";
import { dispatchActionClickEvent, dispatchEvent, dispatchSelectionChangeEvent } from "../events/dispatcher";
import { formatCellValue } from "../utils/formatting";
import { getRowId } from "../utils/dom";

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
 */
export function renderStandardBody(instance: DataTable, table: HTMLTableElement, data: any[][]): void {
    const state = instance.stateManager;
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

    const columnOrder = state.getColumnOrder(); 
    const selectedRowIds = state.getSelectedRowIds();
    const selectionEnabled = state.getSelectionEnabled();
    const uniqueRowIdColumn = instance.options.uniqueRowIdColumn || 0;
    const rowActions = instance.options.rowActions;
    const visibleColumns = state.getVisibleColumns();

    // Stocker les données de la page actuelle pour les retrouver lors du clic
    const currentPagedDataMap = new Map<string, any[]>();
    const currentPagedRowIndexMap = new Map<string, number>();
    if (rowActions && rowActions.length > 0) {
        data.forEach((row, index) => {
            const rowId = row[uniqueRowIdColumn as number];
            if (rowId !== undefined && rowId !== null) {
                const rowIdStr = String(rowId);
                currentPagedDataMap.set(rowIdStr, row);
                currentPagedRowIndexMap.set(rowIdStr, index);
            }
        });
    }

    if (data.length === 0) {
        renderEmptyState(instance, tbody);
        return;
    }

    const fragment = document.createDocumentFragment();

    data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'row');
        tr.className = 'transition-colors duration-150 ease-in-out hover:bg-gray-50';
        
        const rowId = row[uniqueRowIdColumn as number];
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
            checkbox.name = state.getSelectionMode() === 'single' ? `dt-select-${instance.element.id}` : ''; 
            checkbox.checked = selectedRowIds.has(rowId);
            checkbox.setAttribute('aria-label', `Select row ${rowIndex + 1}`);
            checkbox.addEventListener('change', () => {
                state.toggleRowSelection(rowId);
                instance.render(); 
                instance.element.dispatchEvent(new CustomEvent('dt:selectionChange', { 
                    detail: { selectedIds: Array.from(state.getSelectedRowIds()) }
                }));
            });
            tdCheckbox.appendChild(checkbox);
            tr.appendChild(tdCheckbox);
        }

        columnOrder.forEach(originalIndex => {
            if (!visibleColumns.has(originalIndex)) {
                return;
            }
            const columnDef = instance.options.columns[originalIndex];
            const cellData = row[originalIndex]; 
            const td = document.createElement('td'); 
            td.setAttribute('role', 'cell');
            td.className = 'dt-td px-4 py-2 text-sm text-gray-700 border-b border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis';
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
}

/**
 * Renders the empty state message in the table body.
 * @param instance The DataTable instance.
 * @param tbody The TBODY element.
 */
function renderEmptyState(instance: DataTable, tbody: HTMLTableSectionElement): void {
    const state = instance.stateManager; 
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

    if (!instance.stateManager.getSelectionEnabled()) return;

    // Gérer la sélection
    instance.stateManager.toggleRowSelection(rowId);
    updateSelectAllCheckboxState(instance);
    dispatchSelectionChangeEvent(instance);
    instance.render(); // Re-render pour mettre à jour le style de la ligne
}

function updateSelectAllCheckboxState(instance: DataTable) {
    const state = instance.stateManager;
    const selectedRowIds = state.getSelectedRowIds();
    const selectionEnabled = state.getSelectionEnabled();
    const selectAllCheckbox = document.querySelector(`#${instance.element.id}-select-all`) as HTMLInputElement;

    if (selectionEnabled) {
        selectAllCheckbox.checked = selectedRowIds.size === state.getTotalRowCount();
    } else {
        selectAllCheckbox.checked = false;
    }
} 