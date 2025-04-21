import { DataTableOptions, ColumnFilterState, ServerSideParams, SortDirection } from './types';
import { StateManager } from './StateManager';
import { dispatchEvent, dispatchSelectionChangeEvent, dispatchPageChangeEvent } from '../events/dispatcher';
import { setData, addRow, deleteRowById, updateRowById, clearDataInternal, getRowByIdInternal } from '../data/dataManager';
import { getSelectedRowData, setSelectedRowIds, updateSelectAllCheckboxState } from '../features/selection';
import { render } from '../rendering/mainRenderer';
import { applyFilters } from '../features/filtering';
import { sortDataIfEnabled } from '../features/sorting';
import { renderStandardBody } from '../rendering/bodyRenderer';
import { renderPaginationControls } from '../features/pagination';

export class DataTable {
    public element: HTMLElement;
    public options: DataTableOptions;
    public stateManager: StateManager;
    public selectAllCheckbox: HTMLInputElement | null = null;
    private loadingOverlayElement: HTMLElement | null = null;
    public focusedElementId: string | null = null;
    public debounceTimer: number | null = null;

    // Drapeaux pour savoir si les icônes du sprite sont utilisables
    public useSpriteSortArrow: boolean = false;
    public useSpriteFilter: boolean = false;
    public useSpriteDropdown: boolean = false;
    public useSpritePagePrev: boolean = false;
    public useSpritePageNext: boolean = false;

    // Cache pour les données de la page pré-chargée (client-side)
    private preloadedPageData: Map<number, any[][]> = new Map();

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
        
        // Vérifier la présence des symboles SVG avant de créer le StateManager ou de faire le rendu
        this._checkSvgSprites(); 
        
        // --- StateManager Setup ---
        this.stateManager = new StateManager(this.options, options.data, elementId);
        // --- Initialisation DOM & Rendu ---
        this.debounceTimer = null;
        this.focusedElementId = null;
        render(this); // Appel initial du rendu principal
        this.createLoadingOverlay(); // Créer l'overlay de chargement

        // --- Événements initiaux ---
        // Dispatch l'état initial de la sélection
        dispatchEvent(this, 'selectionChange', { selectedIds: this.stateManager.getSelectedRowIds(), selectedData: [] });
        console.log("DataTable initialized.");
        // Pré-charger la page 2 initialement après le premier rendu
        this._preloadNextPageData(); 
    }

    // Fonction privée pour vérifier l'existence des symboles SVG par défaut
    private _checkSvgSprites(): void {
        // Fonction interne pour vérifier un ID
        const checkSymbol = (id: string): boolean => {
            // Essayer de trouver le symbole dans n'importe quel SVG caché dans le document
            const symbolElement = document.querySelector(`svg[style*="display: none"] symbol#${id}`);
            return symbolElement !== null;
        };

        // Vérifier chaque icône par défaut
        this.useSpriteSortArrow = checkSymbol(this.options.icons?.sortArrow || 'icon-sort-arrow');
        this.useSpriteFilter    = checkSymbol(this.options.icons?.filter || 'icon-filter');
        this.useSpriteDropdown  = checkSymbol(this.options.icons?.dropdown || 'icon-chevron-down');
        this.useSpritePagePrev  = checkSymbol(this.options.icons?.pagePrev || 'icon-page-prev');
        this.useSpritePageNext  = checkSymbol(this.options.icons?.pageNext || 'icon-page-next');

        // Log optionnel pour le débogage
        // console.log('[SVG Sprite Check]', { 
        //     sort: this.useSpriteSortArrow, 
        //     filter: this.useSpriteFilter, 
        //     dropdown: this.useSpriteDropdown, 
        //     prev: this.useSpritePagePrev, 
        //     next: this.useSpritePageNext 
        // });
    }

    // --- Public API Method: Destroy --- 
    public destroy(): void {
        console.log("[DataTable destroy] Cleaning up...");
        // Supprimer les écouteurs d'événements globaux (ex: resize, clic extérieur popups)
        // Note: la gestion des écouteurs doit être plus robuste pour un destroy complet.
        // Exemple basique:
        // window.removeEventListener('resize', this.resizeObserverCallback); 
        // document.removeEventListener('click', handleOutsideClick, true); // Assumer une référence accessible

        // Vider le conteneur
        this.element.innerHTML = '';

        // Supprimer les références (aide le garbage collector)
        // (this as any).stateManager = null;
        // (this as any).options = null;
        // ... autres références internes ...

        // Supprimer l'instance du cache global si utilisé
        const instanceIndex = (window as any).DataTableInstances?.indexOf(this);
        if (instanceIndex > -1) {
            (window as any).DataTableInstances.splice(instanceIndex, 1);
        }
        console.log("[DataTable destroy] Cleanup complete.");
    }

    // --- Core Rendering Logic --- 
    public render(): void {
        this._saveFocus();
        render(this); // Appel rendu principal
        this._restoreFocus();
        // Pré-charger la page suivante après chaque rendu
        this._preloadNextPageData(); 
    }

    // --- Event Helpers --- 

    // --- Public API Methods --- 
    public setData(newData: any[][]): void {
        this._invalidatePreloadCache();
        setData(this, newData);
        this.render();
        dispatchEvent(this, 'dataLoad', { data: newData });
        dispatchSelectionChangeEvent(this);
    }
    public addRow(newRowData: any[]): void {
        this._invalidatePreloadCache();
        if (this.stateManager.getIsServerSide()) {
            console.warn("addRow() has limited effect in server-side mode. Data should be managed server-side.");
        }
        this.stateManager._addRow(newRowData);
        this.render(); 
    }
    public deleteRowById(rowId: string | number): boolean {
        this._invalidatePreloadCache();
        if (this.stateManager.getIsServerSide()) {
            console.warn("deleteRowById() has limited effect in server-side mode. Data should be managed server-side.");
        }
        const uniqueColOption = this.options.uniqueRowIdColumn;
        let uniqueColIndex = 0; 
        if (typeof uniqueColOption === 'number') {
            uniqueColIndex = uniqueColOption;
        } else if (typeof uniqueColOption === 'string') {
            const foundIndex = this.options.columns.findIndex(col => col.field === uniqueColOption);
            if (foundIndex !== -1) {
                 uniqueColIndex = foundIndex;
            } else {
                 console.error(`deleteRowById: Unique ID column field "${uniqueColOption}" not found.`);
                 return false;
            }
        }
        const success = this.stateManager._deleteRowById(rowId, uniqueColIndex);
        if (success) {
            this.render(); 
        }
        return success;
    }
    public updateRowById(rowId: string | number, updatedRowData: any[]): boolean {
        this._invalidatePreloadCache();
        if (this.stateManager.getIsServerSide()) {
            console.warn("updateRowById() has limited effect in server-side mode. Data should be managed server-side.");
        }
        const uniqueColOption = this.options.uniqueRowIdColumn;
        let uniqueColIndex = 0; 
        if (typeof uniqueColOption === 'number') {
            uniqueColIndex = uniqueColOption;
        } else if (typeof uniqueColOption === 'string') {
            const foundIndex = this.options.columns.findIndex(col => col.field === uniqueColOption);
            if (foundIndex !== -1) {
                 uniqueColIndex = foundIndex;
            } else {
                 console.error(`updateRowById: Unique ID column field "${uniqueColOption}" not found.`);
                 return false;
            }
        }
        const success = this.stateManager._updateRowById(rowId, updatedRowData, uniqueColIndex);
        if (success) {
            this.render(); 
        }
        return success;
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
        this._invalidatePreloadCache();
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
        let filterTermCleared = false;
        let columnFiltersCleared = false;
        if (this.stateManager.getFilterTerm()) {
            this.stateManager.setFilterTerm('');
            filterTermCleared = true;
            const searchInput = this.element.querySelector('.dt-global-search-input') as HTMLInputElement | null;
            if (searchInput) searchInput.value = '';
        }
        if (this.stateManager.getColumnFilters().size > 0) {
            this.stateManager.clearAllColumnFilters();
            columnFiltersCleared = true;
            this.element.querySelectorAll('.dt-column-filter-input').forEach(input => {
                (input as HTMLInputElement).value = '';
            });
        }

        if (filterTermCleared || columnFiltersCleared) {
            this._invalidatePreloadCache(); // Invalider si des filtres ont été effacés
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
            console.warn("DataTable: fetchData called but not configured for server-side mode.");
            return;
        }

        this.setLoading(true);

        try {
            // Construire les paramètres comme avant (cette partie peut encore avoir des erreurs
            // si les types ServerSideParams/ColumnDefinition ont divergé, mais on corrige seulement le linter immédiat)
             const params: ServerSideParams = {
                 draw: Date.now(), // Simple draw counter for example
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
                     data: col.field, // << Correction principale : Utiliser field
                     name: col.field || '', // << Correction principale : Utiliser field
                     searchable: col.searchable ?? true,
                     orderable: col.sortable ?? true,
                     search: {
                         // Filtre colonne spécifique (simplifié pour l'instant)
                         value: String(this.stateManager.getColumnFilters().get(index)?.value ?? ''),
                         regex: false
                     }
                 })) || []
             };

            // Utiliser la signature de fonction correcte attendue par l'option
            const response = await this.options.serverSide.fetchData(params);

            // Mettre à jour l'état avec la réponse (suppose l'ancienne structure de réponse)
            this.stateManager.setTotalRows(response.totalRecords);
            this.stateManager.setData(response.data);

        } catch (error) {
            console.error("DataTable: Error fetching server-side data:", error);
            dispatchEvent(this, 'error', { message: "Error loading server data", error });
             this.stateManager.setTotalRows(0);
             this.stateManager.setData([]); 
        } finally {
            this.setLoading(false);
            this.render(); // Re-render après récupération (succès ou échec)
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
        this.goToPage(pageNumber);
    }

    // --- Sorting API ---
    /**
     * Définit le tri actuel de la table.
     * @param columnIndex Index de la colonne à trier (ou null pour annuler).
     * @param direction Direction du tri ('asc', 'desc', ou 'none').
     */
    public setSort(columnIndex: number | null, direction: SortDirection): void {
        if (columnIndex !== this.stateManager.getSortColumnIndex() || direction !== this.stateManager.getSortDirection()) {
            this._invalidatePreloadCache(); // Invalider si le tri change
            console.log(`[DataTable API] setSort called: column=${columnIndex}, direction=${direction}`);
            this.stateManager.setSort(columnIndex, direction);
             if (this.stateManager.getIsServerSide()) {
                this.fetchData();
            } else {
                this.render();
            }
             dispatchEvent(this, 'sortChange', { 
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

    // --- Méthode privée pour pré-charger les données --- 
    private _preloadNextPageData(): void {
        if (this.stateManager.getIsServerSide() || !this.options.pagination?.enabled) {
            this.preloadedPageData.clear();
            return;
        }
        const currentPage = this.stateManager.getCurrentPage();
        const rowsPerPage = this.stateManager.getRowsPerPage();
        const nextPage = currentPage + 1;
        if (this.preloadedPageData.has(nextPage)) {
            return; 
        }
        // Utiliser les fonctions importées
        const originalClientData = this.stateManager.getOriginalData();
        const filteredData = applyFilters(this, originalClientData); 
        const sortedData = sortDataIfEnabled(this, filteredData); 
        const totalFilteredRows = sortedData.length;
        const totalPages = Math.ceil(totalFilteredRows / rowsPerPage);
        if (nextPage <= totalPages) {
            console.log(`[Preload] Pré-chargement de la page ${nextPage}...`);
            const startIndex = (nextPage - 1) * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const nextPageData = sortedData.slice(startIndex, endIndex);
            this.preloadedPageData.set(nextPage, nextPageData);
            this.preloadedPageData.forEach((_, pageNum) => {
                if (pageNum !== nextPage) {
                    this.preloadedPageData.delete(pageNum);
                }
            });
        } else {
            this.preloadedPageData.clear();
        }
    }
    
    // Méthode pour invalider le cache (à appeler quand les données/filtres/tri changent)
    private _invalidatePreloadCache(): void {
        this.preloadedPageData.clear();
        // console.log("[Preload] Cache invalidé.");
    }

    // Méthode goToPage pour centraliser la logique de pagination
    public goToPage(pageNumber: number): void {
        // Recalculer totalPages basé sur données filtrées/triées actuelles pour client-side
        let totalRowsForPagination: number;
        let sortedData: any[][] = []; // Garder les données triées/filtrées pour le rendu partiel
        if(this.stateManager.getIsServerSide()){
            totalRowsForPagination = this.stateManager.getTotalRows();
        } else {
            const originalClientData = this.stateManager.getOriginalData();
            const filteredData = applyFilters(this, originalClientData);
            sortedData = sortDataIfEnabled(this, filteredData);
            totalRowsForPagination = sortedData.length;
        }
        
        const totalPages = Math.max(1, Math.ceil(totalRowsForPagination / this.stateManager.getRowsPerPage()));
        const targetPage = Math.max(1, Math.min(pageNumber, totalPages));
        const currentPage = this.stateManager.getCurrentPage();

        console.log(`[DataTable API] goToPage called: targetPage=${targetPage}`);

        if (!this.stateManager.getIsServerSide() && targetPage === currentPage + 1 && this.preloadedPageData.has(targetPage)) {
            console.log(`[Pagination] Using preloaded data for page ${targetPage}`);
            const cachedData = this.preloadedPageData.get(targetPage)!;
            this._invalidatePreloadCache();
            
            this.stateManager.setCurrentPage(targetPage);
            
            this._saveFocus();
            const table = this.element.querySelector('table') as HTMLTableElement | null;
            const paginationContainer = this.element.querySelector('.dt-pagination-container') as HTMLElement | null;
            if(table && paginationContainer){
                renderStandardBody(this, table, cachedData);
                renderPaginationControls(this, totalRowsForPagination, paginationContainer);
            } else {
                 console.warn("[Pagination] Could not find table or pagination container for partial render.");
                 this.render();
            }
             this._restoreFocus();

            dispatchPageChangeEvent(this);
            this._preloadNextPageData();
        
        } else {
             console.log(`[Pagination] Cache non utilisé pour page ${targetPage}. Using full render.`);
             this._invalidatePreloadCache();
             
             const pageActuallyChanged = targetPage !== currentPage;
             this.stateManager.setCurrentPage(targetPage);
             
             if (this.stateManager.getIsServerSide()) {
                 this.fetchData();
             } else {
                 this.render(); 
             }
             dispatchPageChangeEvent(this);
        }
    }
} 