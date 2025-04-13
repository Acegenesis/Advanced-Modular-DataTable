import { ColumnDefinition, DataTableOptions, RowAction, SortDirection, ColumnFilterState, TextFilterOperator } from './types';
import { dispatchEvent, dispatchPageChangeEvent, dispatchSelectionChangeEvent } from '../events/dispatcher';
import { setData, addRow, deleteRowById, updateRowById } from '../data/dataManager';
import { sortDataIfEnabled, handleSortClick } from '../features/sorting';
import { getCurrentPageData, renderPaginationControls } from '../features/pagination';
import { 
    handleSelectAllClick,
    handleRowCheckboxClick,
    updateSelectAllCheckboxState,
    getCurrentFilteredSortedData,
    getSelectedRowData,
    getSelectedRowIds,
    setSelectedRowIds
} from '../features/selection';
import { appendRenderedContent, renderCellByType } from '../rendering/cellRenderer';
import { renderActionButtons } from '../rendering/uiComponents';
import { renderHeader } from '../rendering/headerRenderer';
import { renderStandardBody } from '../rendering/bodyRenderer';
import { render } from '../rendering/mainRenderer';

export class DataTable {
    public element: HTMLElement;
    public options: DataTableOptions;
    public currentPage: number = 1;
    public rowsPerPage: number = 10; 
    public totalRows: number = 0;
    public sortColumnIndex: number | null = null;
    public sortDirection: SortDirection = 'none';
    public originalData: any[][]; // Holds original data in client mode, or current page data in server mode
    public filterTerm: string = '';
    public debounceTimer: number | null = null;
    public isServerSide: boolean = false;
    public selectionEnabled: boolean = false;
    public selectionMode: 'single' | 'multiple' = 'multiple';
    public selectedRowIds: Set<any> = new Set();
    public selectAllCheckbox: HTMLInputElement | null = null;
    private isLoading: boolean = false;
    private loadingOverlayElement: HTMLElement | null = null;
    public columnFilters: Map<number, ColumnFilterState> = new Map();
    public focusedElementId: string | null = null;

    constructor(elementId: string, options: DataTableOptions) {
        const targetElement = document.getElementById(elementId);
        if (!targetElement) {
            throw new Error(`Element with ID "${elementId}" not found.`);
        }
        this.element = targetElement;
        this.element.style.position = 'relative';

        // --- Options Setup --- 
        this.options = { ...options }; 
        // Deep copy sensitive options
        if (options.columns) {
            this.options.columns = options.columns.map(col => ({ ...col }));
        }
        if (options.pagination) {
            this.options.pagination = { ...options.pagination };
        }
         if (options.sorting) {
            this.options.sorting = { ...options.sorting };
        }
         if (options.searching) {
            this.options.searching = { ...options.searching };
        }
        if (options.rowActions) {
            this.options.rowActions = options.rowActions.map(action => ({ ...action }));
        }
        
        // --- Mode Setup --- 
        this.isServerSide = options.processingMode === 'server';
        
        // --- Data Setup --- 
        this.originalData = options.data ? JSON.parse(JSON.stringify(options.data)) : [];
        if (this.isServerSide) {
            this.totalRows = options.serverSideTotalRows ?? 0;
        } else {
        this.totalRows = this.originalData.length;
        }

        // --- Pagination Setup --- 
        if (this.options.pagination?.enabled) {
            this.rowsPerPage = this.options.pagination.rowsPerPage ?? 10;
        }
        this.currentPage = 1;

        // --- Initial State --- 
        this.sortColumnIndex = null;
        this.sortDirection = 'none';
        this.filterTerm = '';
        this.debounceTimer = null;

        // --- Initialisation Filtres Colonne ---
        if (options.columnFiltering?.enabled) {
            this.columnFilters = new Map();
            // Pré-initialiser avec null pour chaque colonne potentiellement filtrable?
            // Ou laisser vide et remplir au fur et à mesure?
        }

        // --- Initialisation Sélection --- 
        if (options.selection?.enabled) {
            this.selectionEnabled = true;
            this.selectionMode = options.selection.mode ?? 'multiple';
            if (options.selection.initialSelectedIds) {
                this.selectedRowIds = new Set(options.selection.initialSelectedIds);
            }
            console.log(`DataTable: Sélection ${this.selectionMode} activée.`);
        }
        // ------------------------------

        // Initial Render
        render(this);
        this.createLoadingOverlay();
        dispatchSelectionChangeEvent(this);
    }

    // --- Public API Method: Destroy --- 
    public destroy(): void {
        this.element.innerHTML = '';
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        // Remove other listeners if any were added directly to document/window
        console.log("DataTable instance destroyed");
    }

    // --- Core Rendering Logic --- 
    public render(): void {
        const activeElement = document.activeElement as HTMLElement;
        let currentFocusId: string | null = null;
        if (activeElement && this.element.contains(activeElement)) {
            currentFocusId = activeElement.id;
            console.log(`[DataTable.render] Active element BEFORE render: ${currentFocusId || 'None'}`); // Log précis
            const isFilterElement = currentFocusId?.startsWith('col-filter-');
            const isGlobalSearch = activeElement.classList.contains('dt-global-search-input');

            if (isFilterElement || isGlobalSearch) {
                this.focusedElementId = currentFocusId;
                console.log(`[DataTable.render] Memorizing focus ID: ${this.focusedElementId}`);
            } else {
                this.focusedElementId = null;
            }
        } else {
             console.log('[DataTable.render] No active element found within table BEFORE render.');
            this.focusedElementId = null;
        }

        // Appeler la fonction de rendu principale
        render(this);
    }

    // --- Data Handling Methods --- 

    // --- Cell Rendering Helpers --- 

    private appendRenderedContent(cell: HTMLTableCellElement, content: any, isError: boolean = false): void {
        // Clear previous content
        while(cell.firstChild) { cell.removeChild(cell.firstChild); }
        // Append new content
        if (content instanceof HTMLElement || content instanceof DocumentFragment) {
             cell.appendChild(content); 
        } else if (typeof content === 'string') {
             cell.innerHTML = content;
        } else {
            cell.textContent = String(content);
        }
        if (isError) {
            cell.classList.add('text-red-600');
        }
    }

    private renderCellByType(cell: HTMLTableCellElement, data: any, columnDef: ColumnDefinition): void {
        let content: string | HTMLElement = String(data); 
        const dataString = String(data);
        const type = columnDef.type; 

        switch (type) {
            case 'mail':
                const linkMail = document.createElement('a');
                linkMail.href = `mailto:${dataString}`;
                linkMail.textContent = dataString;
                linkMail.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                content = linkMail;
                break;
            case 'tel':
                 const linkTel = document.createElement('a');
                 linkTel.href = `tel:${dataString.replace(/\s+/g, '')}`;
                 linkTel.textContent = dataString;
                 linkTel.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                 content = linkTel;
                break;
            case 'money':
                const amount = parseFloat(dataString);
                if (!isNaN(amount)) {
                    try {
                        const locale = columnDef.locale || 'fr-FR'; 
                        const currency = columnDef.currency || 'EUR'; 
                        content = new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
                    } catch (e) {
                         console.error("Erreur formatage monétaire:", e);
                         content = dataString + " (Err)"; 
                    }
                } else {
                    content = dataString + " (NaN)"; 
                }
                break;
            case 'number':
                 const num = parseFloat(dataString);
                 if (!isNaN(num)) {
                     const locale = columnDef.locale || 'fr-FR'; 
                     content = new Intl.NumberFormat(locale).format(num);
                 } else {
                     content = dataString + " (NaN)";
                 }
                 break;
        }
        this.appendRenderedContent(cell, content);
    }

    // --- Event Helpers --- 

    // --- Public API Methods --- 
    public setData(newData: any[][]): void {
        setData(this, newData);
    }
    public addRow(rowData: any[]): void {
        addRow(this, rowData);
    }
    public deleteRowById(id: any, idColumnIndex: number = 0): boolean {
        return deleteRowById(this, id, idColumnIndex);
    }
    public updateRowById(id: any, newRowData: any[], idColumnIndex: number = 0): boolean {
        return updateRowById(this, id, newRowData, idColumnIndex);
    }

    // --- Nouvelles Méthodes de Gestion de la Sélection --- 

    // private handleSelectAllClick(isChecked: boolean): void {
    //     // Obtenir TOUTES les données filtrées/triées (pertinentes pour la sélection globale)
    //     const allRelevantData = this.getCurrentFilteredSortedData(); 

    //     // Mettre à jour l'état interne pour TOUTES les lignes pertinentes
    //     allRelevantData.forEach(rowData => {
    //         const rowId = rowData[0]; // Assumer ID en colonne 0
    //         if (isChecked) {
    //             this.selectedRowIds.add(rowId);
    //         } else {
    //             this.selectedRowIds.delete(rowId);
    //         }
    //     });

    //     // --- Mettre à jour l'UI directement --- 
    //     const tbody = this.element.querySelector(`#${this.element.id}-tbody`);
    //     if (tbody) {
    //         const rows = tbody.querySelectorAll('tr[role="row"]');
    //         // On suppose que les lignes visibles dans le DOM correspondent à visibleRowsData
    //         // C'est le cas après un rendu normal. 
    //         rows.forEach((rowElement) => {
    //             const checkbox = rowElement.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    //             // Pour retrouver l'ID, on pourrait le stocker en data-attribute, 
    //             // mais pour 'select all', on applique juste l'état global 'isChecked'.
    //             if (checkbox) {
    //                 checkbox.checked = isChecked;
    //             }
    //             if (isChecked) {
    //                 rowElement.classList.add('dt-row-selected', 'bg-indigo-50');
    //                 rowElement.setAttribute('aria-selected', 'true');
    //             } else {
    //                 rowElement.classList.remove('dt-row-selected', 'bg-indigo-50');
    //                 rowElement.setAttribute('aria-selected', 'false');
    //             }
    //         });
    //     }
    //     // ------------------------------------

    //     this.updateSelectAllCheckboxState(); // Mettre à jour l'état de la checkbox "select all"
    //     dispatchSelectionChangeEvent(this);
    // }

    // private handleRowCheckboxClick(rowId: any, rowData: any[], isChecked: boolean, rowElement: HTMLTableRowElement): void {
    //     if (isChecked) {
    //         if (this.selectionMode === 'single') {
    //             this.selectedRowIds.clear(); // Désélectionner les autres en mode single
    //             // Update UI for previously selected rows if needed (more complex)
    //             const previouslySelected = this.element.querySelectorAll('.dt-row-selected');
    //             previouslySelected.forEach(prevRow => {
    //                 prevRow.classList.remove('dt-row-selected', 'bg-indigo-50');
    //                 prevRow.setAttribute('aria-selected', 'false');
    //                 const prevCheckbox = prevRow.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    //                 if (prevCheckbox) prevCheckbox.checked = false;
    //             });
    //         }
    //         this.selectedRowIds.add(rowId);
    //         rowElement.classList.add('dt-row-selected', 'bg-indigo-50');
    //         rowElement.setAttribute('aria-selected', 'true');
    //     } else {
    //         this.selectedRowIds.delete(rowId);
    //         rowElement.classList.remove('dt-row-selected', 'bg-indigo-50');
    //         rowElement.setAttribute('aria-selected', 'false');
    //     }

    //     if (this.selectionMode === 'multiple') {
    //         this.updateSelectAllCheckboxState(); // Mettre à jour l'état de la checkbox "select all"
    //     }
    //     dispatchSelectionChangeEvent(this);
    // }

    // // Met à jour l'état checked/indeterminate de la checkbox "select all"
    // private updateSelectAllCheckboxState(): void {
    //     if (!this.selectAllCheckbox || this.selectionMode === 'single') return;

    //     // Baser l'état sur TOUTES les données filtrées/triées
    //     const allRelevantData = this.getCurrentFilteredSortedData();

    //     if (allRelevantData.length === 0) {
    //         this.selectAllCheckbox.checked = false;
    //         this.selectAllCheckbox.indeterminate = false;
    //         return;
    //     }

    //     let allVisibleSelected = true; // Renommé conceptuellement mais garde le nom pour moins de diff
    //     let someVisibleSelected = false; // Idem

    //     // Vérifier l'état de sélection sur toutes les données pertinentes
    //     for (const rowData of allRelevantData) { 
    //         const rowId = rowData[0]; // Assumer ID en colonne 0
    //         if (this.selectedRowIds.has(rowId)) {
    //             someVisibleSelected = true;
    //         } else {
    //             allVisibleSelected = false;
    //         }
    //         // Early exit if we know the state
    //         if (someVisibleSelected && !allVisibleSelected) break;
    //     }

    //     if (allVisibleSelected) {
    //         this.selectAllCheckbox.checked = true;
    //         this.selectAllCheckbox.indeterminate = false;
    //     } else if (someVisibleSelected) {
    //         this.selectAllCheckbox.checked = false;
    //         this.selectAllCheckbox.indeterminate = true;
    //     } else {
    //         this.selectAllCheckbox.checked = false;
    //         this.selectAllCheckbox.indeterminate = false;
    //     }
    // }

    // // Récupère les données filtrées/triées courantes (client-side)
    // private getCurrentFilteredSortedData(): any[][] {
    //      if (this.isServerSide) {
    //          // En mode serveur, on ne peut pas connaître toutes les données filtrées/triées
    //          // 'Select All' devrait peut-être sélectionner uniquement la page visible?
    //          // Ou alors on assume que `originalData` contient les données pertinentes pour la sélection ?
    //          // Pour l'instant, on retourne la page actuelle, ce qui limite `Select All` à la page visible en server-side.
    //          // Alternative: Renvoyer un état spécial ou désactiver `Select All` en server-side?
    //          console.warn('getCurrentFilteredSortedData en mode serveur retourne seulement la page actuelle.');
    //           return [...this.originalData]; // Retourne juste la page actuelle
    //      }
    //      const filteredData = getFilteredData(this, [...this.originalData]); 
    //      const sortedData = sortDataIfEnabled(this, filteredData);   
    //      return sortedData;
    // }

    // Récupère les données complètes des lignes sélectionnées
    public getSelectedRowData(): any[][] {
        return getSelectedRowData(this);
    }

    // Retourne uniquement les IDs des lignes sélectionnées
    public getSelectedRowIds(): any[] {
        return getSelectedRowIds(this);
    }

    // Permet de définir la sélection programmatiquement
    public setSelectedRowIds(ids: any[]): void {
        setSelectedRowIds(this, ids);
    }

    /**
     * Affiche ou masque l'indicateur de chargement sur la table.
     * @param isLoading - True pour afficher l'indicateur, false pour le masquer.
     */
    public setLoading(isLoading: boolean): void {
        this.isLoading = isLoading;
        if (this.loadingOverlayElement) {
            this.loadingOverlayElement.style.display = this.isLoading ? 'flex' : 'none';
        }
    }

    /**
     * Met à jour l'état d'un filtre de colonne.
     * @param columnIndex Index de la colonne
     * @param filterState Nouvel état du filtre (objet { value, operator } ou null)
     */
    public setColumnFilter(columnIndex: number, filterState: ColumnFilterState): void {
        console.log(`setColumnFilter called for index ${columnIndex}`, filterState);
        if (!this.options.columnFiltering?.enabled) return;

        const currentFilter = this.columnFilters.get(columnIndex);

        if (!filterState || filterState.value === null || filterState.value === '') {
            // Si la nouvelle valeur est vide ou l'état est null, supprimer le filtre
            if (this.columnFilters.has(columnIndex)) {
                this.columnFilters.delete(columnIndex);
            } else {
                return; // Pas de changement si déjà vide
            }
        } else {
            // Mettre à jour ou ajouter le filtre
            // Assurer un opérateur par défaut si non fourni
            const newFilterState: ColumnFilterState = {
                value: filterState.value,
                operator: filterState.operator || 'contains' // Défaut 'contains'
            };

            // Optimisation: vérifier si l'état a réellement changé
            if (currentFilter && 
                currentFilter.value === newFilterState.value && 
                currentFilter.operator === newFilterState.operator) {
                return; // Pas de changement
            }
            this.columnFilters.set(columnIndex, newFilterState);
        }

        this.currentPage = 1; // Retourner à la page 1

        const allFiltersState: { [key: number]: ColumnFilterState } = {};
        this.columnFilters.forEach((value, key) => {
            allFiltersState[key] = value;
        });
        dispatchEvent(this, 'dt:filterChange', { 
            columnIndex,
            value: filterState?.value ?? null, // Envoyer la valeur brute
            operator: filterState?.operator, // Envoyer l'opérateur
            allFilters: allFiltersState 
         });

        if (!this.isServerSide) {
            this.render(); 
        }
    }

    // --- Private Helper Methods ---

    /**
     * Crée l'élément d'overlay de chargement et l'ajoute à l'élément de la table.
     */
    private createLoadingOverlay(): void {
        if (!this.loadingOverlayElement) {
            this.loadingOverlayElement = document.createElement('div');
            this.loadingOverlayElement.className = 'dt-loading-overlay';
            // Styles basiques (peuvent être déplacés dans un CSS)
            this.loadingOverlayElement.style.position = 'absolute';
            this.loadingOverlayElement.style.top = '0';
            this.loadingOverlayElement.style.left = '0';
            this.loadingOverlayElement.style.width = '100%';
            this.loadingOverlayElement.style.height = '100%';
            this.loadingOverlayElement.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'; // Fond blanc semi-transparent
            this.loadingOverlayElement.style.display = 'none'; // Caché par défaut
            this.loadingOverlayElement.style.justifyContent = 'center';
            this.loadingOverlayElement.style.alignItems = 'center';
            this.loadingOverlayElement.style.zIndex = '10'; // Pour être au-dessus du contenu

            // Contenu de l'overlay (peut être personnalisé via les options)
            const loadingContent = document.createElement('div');
            loadingContent.textContent = this.options.loadingMessage || 'Chargement...'; // Utilise message optionnel ou défaut
            loadingContent.style.padding = '1rem';
            loadingContent.style.backgroundColor = 'white';
            loadingContent.style.borderRadius = '0.25rem';
            loadingContent.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

            this.loadingOverlayElement.appendChild(loadingContent);
            this.element.appendChild(this.loadingOverlayElement);
        }
    }
} 