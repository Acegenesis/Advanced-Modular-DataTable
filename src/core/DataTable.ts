import { DataTableOptions, ColumnFilterState, ServerSideParams, SortDirection } from './types';
import { StateManager } from './StateManager';
import { dispatchEvent, dispatchSelectionChangeEvent, dispatchPageChangeEvent } from '../events/dispatcher';
import { setData, addRow, deleteRowById, updateRowById, clearDataInternal, getRowByIdInternal } from '../data/dataManager';
import { getSelectedRowData, setSelectedRowIds, updateSelectAllCheckboxState } from '../features/selection';
import { render } from '../rendering/mainRenderer';

export class DataTable {
    public element: HTMLElement;
    public options: DataTableOptions;
    public stateManager: StateManager;
    public selectAllCheckbox: HTMLInputElement | null = null;
    private loadingOverlayElement: HTMLElement | null = null;
    public focusedElementId: string | null = null;
    public debounceTimer: number | null = null;

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
        
        // --- StateManager Setup ---
        this.stateManager = new StateManager(this.options, options.data, elementId);
        // --- Initialisation DOM & Rendu ---
        this.debounceTimer = null;
        this.focusedElementId = null;
        render(this); // Appel initial du rendu principal
        this.createLoadingOverlay(); // Créer l'overlay de chargement

        // --- Événements initiaux ---
        // Dispatch l'état initial de la sélection
        dispatchEvent(this, 'selectionChange', { selectedIds: this.stateManager.getSelectedRowIds(), selectedData: this.getSelectedRowData() });
        console.log("DataTable initialized."); // Garder un log simple d'initialisation
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
        this._saveFocus(); // Sauvegarder le focus avant le rendu

        // Appeler la fonction de rendu principale
        render(this);

        this._restoreFocus(); // Restaurer le focus après le rendu
    }

    // --- Event Helpers --- 

    // --- Public API Methods --- 
    public setData(newData: any[][]): void {
        setData(this, newData);
        this.render();
        dispatchEvent(this, 'dataLoad', { data: newData });
        dispatchSelectionChangeEvent(this);
    }
    public addRow(rowData: any[]): void {
        addRow(this, rowData);
        this.render();
        dispatchEvent(this, 'rowAdd', { rowData: rowData });
    }
    public deleteRowById(id: any, idColumnIndex: number = 0): boolean {
        const deleted = deleteRowById(this, id, idColumnIndex);
        if (deleted) {
            this.render();
            dispatchEvent(this, 'rowDelete', { rowId: id });
            dispatchSelectionChangeEvent(this);
        }
        return deleted;
    }
    public updateRowById(id: any, newRowData: any[], idColumnIndex: number = 0): boolean {
        const updated = updateRowById(this, id, newRowData, idColumnIndex);
        if (updated) {
            this.render();
            dispatchEvent(this, 'rowUpdate', { rowId: id, rowData: newRowData });
        }
        return updated;
    }

    // Récupère les données complètes des lignes sélectionnées
    public getSelectedRowData(): any[][] {
        return getSelectedRowData(this);
    }

    // Retourne uniquement les IDs des lignes sélectionnées
    public getSelectedRowIds(): any[] {
        return Array.from(this.stateManager.getSelectedRowIds());
    }

    // Permet de définir la sélection programmatiquement
    public setSelectedRowIds(ids: any[]): void {
        setSelectedRowIds(this, ids);
        updateSelectAllCheckboxState(this);
        dispatchSelectionChangeEvent(this);
        this.render();
    }

    /**
     * Affiche ou masque l'indicateur de chargement sur la table.
     * @param isLoading - True pour afficher l'indicateur, false pour le masquer.
     */
    public setLoading(isLoading: boolean): void {
        this.stateManager.setLoading(isLoading);
        if (this.loadingOverlayElement) {
            this.loadingOverlayElement.style.display = isLoading ? 'flex' : 'none';
            dispatchEvent(this, 'loadingStateChange', { isLoading });
        } else if (isLoading) {
             console.warn("DataTable: Impossible d'afficher l'overlay de chargement car il n'a pas été créé.");
        }
    }

    /**
     * Met à jour l'état d'un filtre de colonne.
     * @param columnIndex Index de la colonne
     * @param filterState Nouvel état du filtre (objet { value, operator } ou null)
     */
    public setColumnFilter(columnIndex: number, filterState: ColumnFilterState): void {
        console.log(`[DataTable] Setting filter for column ${columnIndex}:`, filterState);
        this.stateManager.setColumnFilter(columnIndex, filterState);

        if (this.stateManager.getIsServerSide() && this.options.serverSide?.fetchData) {
             this.fetchData();
        } else {
            this.render();
        }
         dispatchEvent(this, 'filterChange', { type: 'column', columnIndex, filterState });
    }

    /**
     * Efface tous les filtres actifs (colonnes et recherche globale) et redessine.
     */
    public clearAllFilters(): void {
        let changed = false;
        if (this.stateManager.getFilterTerm()) {
            this.stateManager.setFilterTerm('');
            changed = true;
            const searchInput = this.element.querySelector('.dt-global-search-input') as HTMLInputElement | null;
            if (searchInput) searchInput.value = '';
        }
        if (this.stateManager.getColumnFilters().size > 0) {
            this.stateManager.clearAllColumnFilters();
            changed = true;
            this.element.querySelectorAll('.dt-column-filter-input').forEach(input => {
                (input as HTMLInputElement).value = '';
            });
        }

        if (changed) {
            console.log("[DataTable] All filters cleared.");
            if (this.stateManager.getIsServerSide() && this.options.serverSide?.fetchData) {
                this.fetchData();
            } else {
                this.render();
            }
             dispatchEvent(this, 'filterChange', { type: 'clearAll' });
        }
    }

    /**
     * Récupère les données du serveur (utilisé en mode server-side).
     */
    public async fetchData(): Promise<void> {
        if (!this.stateManager.getIsServerSide() || !this.options.serverSide?.fetchData) {
            console.warn("DataTable: fetchData appelé mais non configuré pour le mode server-side.");
            return;
        }

        this.setLoading(true);

        try {
            const params: ServerSideParams = {
                 draw: Date.now(),
                 start: (this.stateManager.getCurrentPage() - 1) * this.stateManager.getRowsPerPage(),
                 length: this.stateManager.getRowsPerPage(),
                 search: {
                     value: this.stateManager.getFilterTerm(),
                     regex: false
                 },
                 order: this.stateManager.getSortColumnIndex() !== null
                     ? [{ column: this.stateManager.getSortColumnIndex() as number, dir: this.stateManager.getSortDirection() }]
                     : [],
                 columns: this.options.columns?.map((col, index) => ({
                     data: col.data,
                     name: col.name || '',
                     searchable: col.searchable ?? true,
                     orderable: col.sortable ?? true,
                     search: {
                         // S'assurer que la valeur passée est une chaîne
                         value: String(this.stateManager.getColumnFilters().get(index)?.value ?? ''),
                         regex: false
                     }
                 })) || []
             };

            // Utiliser la signature de fonction correcte
            const response = await this.options.serverSide.fetchData(params);

            // Correction: Utiliser response.totalRecords pour mettre à jour totalRows
            this.stateManager.setTotalRows(response.totalRecords);
            // Correction: Utiliser response.data pour setData
            this.stateManager.setData(response.data);

        } catch (error) {
            console.error("DataTable: Erreur lors de la récupération des données côté serveur:", error);
            dispatchEvent(this, 'error', { message: "Erreur de chargement des données serveur", error });
             // Gérer l'erreur de manière appropriée, peut-être afficher un message
             this.stateManager.setTotalRows(0);
             this.stateManager.setData([]); 
        } finally {
            this.setLoading(false);
            this.render(); // Re-rendre après la récupération des données
        }
    }

    // --- Data Manipulation API ---
    public clearData(): void {
        console.log("[DataTable API] clearData called");
        clearDataInternal(this);
        this.render(); // Re-render l'état vide
        dispatchEvent(this, 'dataClear');
        dispatchSelectionChangeEvent(this); // La sélection est réinitialisée
    }

    /**
     * Récupère les données d'une ligne par son ID.
     * @param id L'ID de la ligne.
     * @param idColumnIndex L'index de la colonne ID (défaut 0).
     * @returns Les données de la ligne ou undefined.
     */
    public getRowById(id: any, idColumnIndex: number = 0): any[] | undefined {
        return getRowByIdInternal(this, id, idColumnIndex);
    }

    // --- Pagination API ---
    /**
     * Navigue vers une page spécifique.
     * @param pageNumber Le numéro de la page (1-indexé).
     */
    public setPage(pageNumber: number): void {
        const totalPages = Math.max(1, Math.ceil(this.stateManager.getTotalRows() / this.stateManager.getRowsPerPage()));
        const targetPage = Math.max(1, Math.min(pageNumber, totalPages)); // Clamp page number
        if (targetPage !== this.stateManager.getCurrentPage()) {
            console.log(`[DataTable API] setPage called with ${pageNumber} (targeting ${targetPage})`);
            this.stateManager.setCurrentPage(targetPage);
            if (this.stateManager.getIsServerSide()) {
                this.fetchData(); // Server-side: fetch new page
            } else {
                this.render(); // Client-side: just re-render
            }
            dispatchPageChangeEvent(this); // Dispatch event
        }
    }

    // --- Sorting API ---
    /**
     * Définit le tri actuel de la table.
     * @param columnIndex Index de la colonne à trier (ou null pour annuler).
     * @param direction Direction du tri ('asc', 'desc', ou 'none').
     */
    public setSort(columnIndex: number | null, direction: SortDirection): void {
        if (columnIndex !== this.stateManager.getSortColumnIndex() || direction !== this.stateManager.getSortDirection()) {
            console.log(`[DataTable API] setSort called: column=${columnIndex}, direction=${direction}`);
            this.stateManager.setSort(columnIndex, direction);
             if (this.stateManager.getIsServerSide()) {
                this.fetchData(); // Server-side: fetch sorted data
            } else {
                this.render(); // Client-side: just re-render
            }
            // Dispatch event (adapter l'event existant?)
             dispatchEvent(this, 'sortChange', { // Utiliser un nom d'event cohérent
                 sortColumnIndex: columnIndex,
                 sortDirection: direction
             });
        }
    }

    // --- General API ---
    /** Recharge les données (utile en mode serveur). */
    public refreshData(): void {
         console.log("[DataTable API] refreshData called");
         if (this.stateManager.getIsServerSide()) {
             this.fetchData();
         } else {
             // En mode client, un simple render suffit généralement
             this.render();
             // Ou si on veut *vraiment* recharger depuis la source initiale?
             // this.setData(this.stateManager.getOriginalData()); // Attention, peut perdre état filtre/tri?
              dispatchEvent(this, 'dataLoad', { source: 'refresh', data: this.stateManager.getDisplayedData() });
         }
    }

    /**
     * Récupère l'état interne actuel de la table (pour débogage ou sauvegarde).
     * @returns Un objet représentant l'état.
     */
    public getState(): object {
        return this.stateManager.getFullState();
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

    // Nouvelle méthode privée pour sauvegarder le focus
    private _saveFocus(): void {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && this.element.contains(activeElement)) {
            const currentFocusId = activeElement.id;
            console.log(`[DataTable._saveFocus] Active element: ${currentFocusId || 'None'}`); // Log précis
            const isFilterElement = currentFocusId?.startsWith('col-filter-');
            const isGlobalSearch = activeElement.classList.contains('dt-global-search-input');

            if (isFilterElement || isGlobalSearch) {
                this.focusedElementId = currentFocusId;
                console.log(`[DataTable._saveFocus] Memorizing focus ID: ${this.focusedElementId}`);
            } else {
                this.focusedElementId = null; // Ne pas mémoriser pour d'autres éléments
            }
        } else {
            console.log('[DataTable._saveFocus] No active element found within table.');
            this.focusedElementId = null;
        }
    }

    // Nouvelle méthode privée pour restaurer le focus
    private _restoreFocus(): void {
        if (this.focusedElementId) {
            const elementToFocus = document.getElementById(this.focusedElementId);
            if (elementToFocus) {
                console.log(`[DataTable._restoreFocus] Restoring focus to: ${this.focusedElementId}`);
                // Tenter de restaurer la position du curseur pour les inputs
                if (elementToFocus instanceof HTMLInputElement) {
                    const originalValue = elementToFocus.value; // Sauvegarder la valeur actuelle
                    elementToFocus.focus();
                    // Restaurer la valeur peut réinitialiser la position du curseur,
                    // essayer de mettre le curseur à la fin
                    try {
                         elementToFocus.value = ''; // Effacer temporairement
                         elementToFocus.value = originalValue; // Remettre la valeur
                         elementToFocus.selectionStart = elementToFocus.selectionEnd = originalValue.length;
                    } catch (e) {
                        console.warn(`[DataTable._restoreFocus] Could not fully restore cursor position for ${this.focusedElementId}:`, e);
                    }

                } else {
                    elementToFocus.focus();
                }
            } else {
                 console.log(`[DataTable._restoreFocus] Element with ID ${this.focusedElementId} not found after render.`);
            }
             this.focusedElementId = null; // Réinitialiser après la tentative de focus
        } else {
            // console.log('[DataTable._restoreFocus] No focus ID was memorized.'); // Optionnel: peut être bruyant
        }
    }
} 