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
        console.log(`[DataTable.setColumnFilter] Received for index ${columnIndex}:`, filterState);
        if (!this.options.columnFiltering?.enabled) return;

        const currentFilter = this.columnFilters.get(columnIndex);

        // Déterminer si l'intention est de supprimer le filtre
        const isValueEffectivelyEmpty = !filterState || filterState.value === null || filterState.value === '';
        const isOperatorValueIndependent = filterState?.operator === 'isEmpty' || filterState?.operator === 'isNotEmpty';
        const shouldDelete = !filterState || (isValueEffectivelyEmpty && !isOperatorValueIndependent);

        if (shouldDelete) {
            // Supprimer si l'état est null ou si la valeur est vide ET que l'opérateur en a besoin
            if (this.columnFilters.has(columnIndex)) {
                console.log(`[DataTable.setColumnFilter] Deleting filter for index ${columnIndex}.`);
                this.columnFilters.delete(columnIndex);
            } else {
                console.log(`[DataTable.setColumnFilter] No filter to delete for index ${columnIndex}. No change.`);
                return; // Pas de changement si déjà vide
            }
        } else if (filterState) {
            // Mettre à jour ou ajouter le filtre (y compris pour isEmpty/isNotEmpty)
            const newOperator = filterState.operator || 'contains';
            const newValue = filterState.value; // Peut être null/vide pour isEmpty/isNotEmpty

            const newFilterState: ColumnFilterState = {
                value: newValue,
                operator: newOperator
            };

            console.log(`[DataTable.setColumnFilter] Setting filter for index ${columnIndex}:`, newFilterState);
            this.columnFilters.set(columnIndex, newFilterState);
        }

        // --- Trigger update (si un changement a eu lieu OU si on a supprimé un filtre) ---
        this.currentPage = 1;

        const finalFilterState = this.columnFilters.get(columnIndex); // Lire l'état après modification
        const allFiltersState: { [key: number]: ColumnFilterState } = {};
        this.columnFilters.forEach((value, key) => {
            allFiltersState[key] = value;
        });
        // Dispatch avec l'état *final*
        dispatchEvent(this, 'dt:filterChange', {
            columnIndex,
            value: finalFilterState?.value ?? null,
            operator: finalFilterState?.operator,
            allFilters: allFiltersState
         });

        if (!this.isServerSide) {
            this.render();
        }
    }

    /**
     * Efface tous les filtres actifs (colonnes et recherche globale) et redessine.
     */
    public clearAllFilters(): void {
        let filtersCleared = false;
        if (this.filterTerm) {
            this.filterTerm = '';
            filtersCleared = true;
            // Mettre à jour l'input de recherche globale si possible
            const searchInput = this.element.querySelector('.dt-global-search-input') as HTMLInputElement | null;
            if (searchInput) searchInput.value = '';
        }
        if (this.columnFilters.size > 0) {
            this.columnFilters.clear();
            filtersCleared = true;
        }

        if (filtersCleared) {
            this.currentPage = 1; // Revenir à la page 1
            console.log('Tous les filtres ont été effacés.');
            dispatchEvent(this, 'dt:filtersCleared'); // Nouvel événement optionnel
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