import { SortDirection, DataTableOptions, ColumnFilterState } from './types';

// Type pour l'état sauvegardé dans localStorage
interface SavedState {
    currentPage?: number;
    rowsPerPage?: number;
    sortColumnIndex?: number | null;
    sortDirection?: SortDirection;
    filterTerm?: string;
    columnFilters?: { [key: number]: ColumnFilterState }; // Sauvegarder Map comme objet
    columnWidths?: { [key: number]: number }; // Sauvegarder Map comme objet { index: largeurPx }
    columnOrder?: number[]; // Sauvegarder le tableau d'index directement
}

export class StateManager {
    public currentPage: number = 1;
    public rowsPerPage: number = 10;
    public totalRows: number = 0;
    public sortColumnIndex: number | null = null;
    public sortDirection: SortDirection = 'none';
    public originalData: any[][] = [];
    public displayedData: any[][] = [];
    public filterTerm: string = '';
    public isServerSide: boolean = false;
    public selectionEnabled: boolean = false;
    public selectionMode: 'single' | 'multiple' = 'multiple';
    public selectedRowIds: Set<any> = new Set();
    private isLoading: boolean = false;
    public columnFilters: Map<number, ColumnFilterState> = new Map();
    public columnWidths: Map<number, number> = new Map();
    public columnOrder: number[] = [];

    private options: DataTableOptions;
    private storageKey: string | null = null;
    private persistStateOptions: { persist?: boolean; prefix?: string };

    constructor(options: DataTableOptions, initialData?: any[][], elementId?: string) {
        this.options = options;
        this.persistStateOptions = options.stateManagement || {};

        // Initialiser storageKey si la persistance est activée et elementId est fourni
        if (this.persistStateOptions.persist && elementId) {
            const prefix = this.persistStateOptions.prefix || 'datatableState';
            this.storageKey = `${prefix}-${elementId}`;
        }

        // --- État Initial (avant chargement potentiel) ---
        this.isServerSide = options.processingMode === 'server';
        this.originalData = initialData ? JSON.parse(JSON.stringify(initialData)) : [];
        if (this.isServerSide) {
            this.totalRows = options.serverSideTotalRows ?? 0;
            this.displayedData = this.originalData;
        } else {
            this.totalRows = this.originalData.length;
            this.displayedData = [...this.originalData];
        }

        // --- Pagination ---
        if (options.pagination?.enabled) {
            this.rowsPerPage = options.pagination.rowsPerPage ?? 10;
        }
        this.currentPage = 1;

        // --- Tri Initial ---
        this.sortColumnIndex = null;
        this.sortDirection = 'none';

        // --- Recherche Globale ---
        this.filterTerm = '';

        // --- Filtres Colonne ---
        this.columnFilters = options.columnFiltering?.enabled ? new Map() : new Map();
        if (options.columnFiltering?.enabled) {
            this.columnFilters = new Map();
        }

        // --- Sélection ---
        if (options.selection?.enabled) {
            this.selectionEnabled = true;
            this.selectionMode = options.selection.mode ?? 'multiple';
            if (options.selection.initialSelectedIds) {
                this.selectedRowIds = new Set(options.selection.initialSelectedIds);
            }
        }

        // --- État Initial ---
        this.isLoading = false;

        // Initialiser l'ordre par défaut
        this.columnOrder = options.columns.map((_, index) => index);

        // --- Charger l'état sauvegardé (écrase certaines valeurs initiales) ---
        this._loadState();

        // --- Données (après chargement état pour pagination/tri initial) ---
        if (this.isServerSide) {
            this.totalRows = options.serverSideTotalRows ?? 0;
            this.displayedData = this.originalData;
        } else {
            this.totalRows = this.originalData.length;
        }

        // Si l'état chargé n'avait pas d'ordre (ancienne version), s'assurer qu'il est initialisé
        if (this.columnOrder.length !== options.columns.length) {
             this.columnOrder = options.columns.map((_, index) => index);
             // Optionnel: sauvegarder immédiatement ce nouvel ordre par défaut?
             // this._saveState(); 
        }

        // Initialiser les largeurs depuis les options si présentes (en pixels)
        options.columns.forEach((col, index) => {
            if (col.width) {
                // Tenter de convertir la largeur initiale en pixels
                // Note: Ceci est basique, ne gère pas %, em, etc.
                // Idéalement, on lirait la largeur calculée après le premier rendu.
                const widthPx = parseInt(col.width, 10);
                if (!isNaN(widthPx)) {
                     this.columnWidths.set(index, widthPx);
                }
            }
        });
    }

    // --- Getters ---
    getCurrentPage(): number { return this.currentPage; }
    getRowsPerPage(): number { return this.rowsPerPage; }
    getTotalRows(): number { return this.totalRows; }
    getSortColumnIndex(): number | null { return this.sortColumnIndex; }
    getSortDirection(): SortDirection { return this.sortDirection; }
    getOriginalData(): any[][] { return this.originalData; }
    getDisplayedData(): any[][] { return this.displayedData; }
    getFilterTerm(): string { return this.filterTerm; }
    getIsServerSide(): boolean { return this.isServerSide; }
    getSelectionEnabled(): boolean { return this.selectionEnabled; }
    getSelectionMode(): 'single' | 'multiple' { return this.selectionMode; }
    getSelectedRowIds(): Set<any> { return new Set(this.selectedRowIds); }
    getIsLoading(): boolean { return this.isLoading; }
    getColumnFilters(): Map<number, ColumnFilterState> { return this.columnFilters; }
    getColumnWidths(): Map<number, number> { return new Map(this.columnWidths); }
    getColumnOrder(): number[] { return [...this.columnOrder]; }

    // --- Setters / Mutators ---
    setCurrentPage(page: number): void {
        this.currentPage = page;
        this._saveState();
    }

    setRowsPerPage(rows: number): void {
        // Log ici
        console.log(`[StateManager.setRowsPerPage] Setting rowsPerPage from ${this.rowsPerPage} to ${rows}`);
        const oldRowsPerPage = this.rowsPerPage;
        this.rowsPerPage = rows;
        
        // Réinitialiser la page actuelle seulement si la limite change réellement
        // Et s'assurer que la page 1 existe toujours
        if (oldRowsPerPage !== rows) {
             this.currentPage = 1;
             console.log(`[StateManager.setRowsPerPage] Resetting currentPage to 1`);
        }
        this._saveState();
    }

    setTotalRows(total: number): void {
        this.totalRows = total;
    }

    setSort(columnIndex: number | null, direction: SortDirection): void {
        this.sortColumnIndex = columnIndex;
        this.sortDirection = direction;
        this.currentPage = 1;
        this._saveState();
    }

    // Met à jour les données affichées (utilisé après tri/filtrage côté client)
    setDisplayedData(data: any[][]): void {
         if (this.isServerSide) {
             console.warn("StateManager: setDisplayedData a un effet limité en mode serveur. Utiliser setData.");
             this.originalData = data;
         }
         this.displayedData = data;
    }

    // Remplace complètement les données originales (et potentiellement affichées)
    setData(newData: any[][]): void {
        this.originalData = JSON.parse(JSON.stringify(newData));
        if (this.isServerSide) {
            this.displayedData = this.originalData;
             this.displayedData = this.originalData;
             this.totalRows = this.originalData.length;
        } else {
            this.displayedData = [...this.originalData];
            this.totalRows = this.originalData.length;
            this.currentPage = 1;
            this.selectedRowIds.clear();
        }
        this.filterTerm = '';
        this.columnFilters.clear();
        this.sortColumnIndex = null;
        this.sortDirection = 'none';
        this._saveState();
    }

    setFilterTerm(term: string): void {
        this.filterTerm = term;
        this.currentPage = 1;
        this._saveState();
    }

    setSelectedRowIds(ids: Set<any>): void {
        if (this.selectionMode === 'single' && ids.size > 1) {
            console.warn("StateManager: Tentative de sélectionner plusieurs lignes en mode 'single'.");
            const firstId = ids.values().next().value;
            this.selectedRowIds = new Set(firstId !== undefined ? [firstId] : []);
        } else {
             this.selectedRowIds = new Set(ids);
        }
    }

    toggleRowSelection(id: any): void {
        if (this.selectionMode === 'single') {
            if (this.selectedRowIds.has(id)) {
                this.selectedRowIds.clear();
            } else {
                this.selectedRowIds.clear();
                this.selectedRowIds.add(id);
            }
        } else {
            if (this.selectedRowIds.has(id)) {
                this.selectedRowIds.delete(id);
            } else {
                this.selectedRowIds.add(id);
            }
        }
    }

    selectAll(allIds: Set<any>): void {
        if (this.selectionMode === 'multiple') {
             allIds.forEach(id => this.selectedRowIds.add(id));
        }
    }

    deselectAll(idsToDeselect?: Set<any>): void {
         if (idsToDeselect) {
             idsToDeselect.forEach(id => this.selectedRowIds.delete(id));
         } else {
             this.selectedRowIds.clear();
         }
    }

    setLoading(loading: boolean): void {
        this.isLoading = loading;
    }

    setColumnFilter(columnIndex: number, filterState: ColumnFilterState): void {
        if (filterState === null) {
            this.columnFilters.delete(columnIndex);
        } else {
             this.columnFilters.set(columnIndex, filterState);
        }
        this.currentPage = 1;
        this._saveState();
    }

    clearColumnFilter(columnIndex: number): void {
        this.columnFilters.delete(columnIndex);
        this.currentPage = 1;
        this._saveState();
    }

     clearAllColumnFilters(): void {
        this.columnFilters.clear();
        this.currentPage = 1;
        this._saveState();
     }

    // Méthode utilitaire pour obtenir l'état actuel complet (utile pour le débogage ou la sauvegarde)
    getFullState() {
        return {
            currentPage: this.currentPage,
            rowsPerPage: this.rowsPerPage,
            totalRows: this.totalRows,
            sortColumnIndex: this.sortColumnIndex,
            sortDirection: this.sortDirection,
            originalData: this.originalData,
            displayedData: this.displayedData,
            filterTerm: this.filterTerm,
            isServerSide: this.isServerSide,
            selectionEnabled: this.selectionEnabled,
            selectionMode: this.selectionMode,
            selectedRowIds: Array.from(this.selectedRowIds),
            isLoading: this.isLoading,
            columnFilters: Object.fromEntries(this.columnFilters),
            columnWidths: Object.fromEntries(this.columnWidths),
            columnOrder: this.columnOrder
        };
    }

    // --- Méthodes pour la persistance --- 
    private _saveState(): void {
        if (!this.storageKey) return;
        // !! AJOUT LOG POUR DEBUG !!
        console.log('[StateManager._saveState] Saving widths:', Object.fromEntries(this.columnWidths));

        const stateToSave: SavedState = {
            currentPage: this.currentPage,
            rowsPerPage: this.rowsPerPage,
            sortColumnIndex: this.sortColumnIndex,
            sortDirection: this.sortDirection,
            filterTerm: this.filterTerm,
            columnFilters: Object.fromEntries(this.columnFilters),
            columnWidths: Object.fromEntries(this.columnWidths),
            columnOrder: this.columnOrder
        };
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
        } catch (error) {
            console.error("[StateManager] Failed to save state to localStorage:", error);
        }
    }

    private _loadState(): void {
        if (!this.storageKey) return; // Ne rien faire si la persistance n'est pas activée

        try {
            const savedStateString = localStorage.getItem(this.storageKey);
            if (savedStateString) {
                const savedState: SavedState = JSON.parse(savedStateString);
                // console.log(`[StateManager] Loading state from ${this.storageKey}:`, savedState);

                // Appliquer l'état sauvegardé (avec vérifications)
                if (savedState.currentPage !== undefined) this.currentPage = savedState.currentPage;
                if (savedState.rowsPerPage !== undefined) this.rowsPerPage = savedState.rowsPerPage;
                if (savedState.sortColumnIndex !== undefined) this.sortColumnIndex = savedState.sortColumnIndex;
                if (savedState.sortDirection !== undefined) this.sortDirection = savedState.sortDirection;
                if (savedState.filterTerm !== undefined) this.filterTerm = savedState.filterTerm;
                if (savedState.columnFilters !== undefined) {
                    // Reconvertir l'objet en Map
                    this.columnFilters = new Map(Object.entries(savedState.columnFilters).map(([key, value]) => [parseInt(key, 10), value]));
                }
                if (savedState.columnWidths !== undefined) {
                    this.columnWidths = new Map(Object.entries(savedState.columnWidths).map(([key, value]) => [parseInt(key, 10), value as number]));
                }
                // Charger l'ordre sauvegardé (avec validation)
                if (Array.isArray(savedState.columnOrder) && savedState.columnOrder.length === this.options.columns.length) {
                     // Vérification supplémentaire que tous les index sont présents?
                     // Pour l'instant, on fait confiance à la longueur.
                     this.columnOrder = savedState.columnOrder;
                } else if (savedState.columnOrder !== undefined) {
                    console.warn("[StateManager] Ordre de colonnes sauvegardé invalide, utilisation de l'ordre par défaut.");
                    // L'ordre par défaut sera appliqué après _loadState si nécessaire
                }
            }
        } catch (error) {
            console.error("[StateManager] Failed to load state from localStorage:", error);
            // Optionnel: Supprimer l'état corrompu?
            // localStorage.removeItem(this.storageKey);
        }
    }

    // Nouvelle méthode pour définir la largeur d'une colonne
    setColumnWidth(index: number, width: number): void {
        this.columnWidths.set(index, Math.max(width, 20)); // Largeur minimale de 20px?
        this._saveState(); // Sauvegarder l'état après modification de largeur
    }

    // Nouvelle méthode pour définir l'ordre des colonnes
    setColumnOrder(newOrder: number[]): void {
        // Validation simple: vérifier si le nombre d'éléments correspond
        if (newOrder.length === this.options.columns.length) {
             this.columnOrder = newOrder;
             this._saveState(); // Sauvegarder le nouvel ordre
             // Note: Le changement d'ordre nécessite un re-rendu complet pour être appliqué
        } else {
            console.error("[StateManager] Tentative de définir un ordre de colonnes invalide.", newOrder);
        }
    }

    // --- Méthodes internes de manipulation de données (appelées par DataTable) ---

    /** Ajoute une nouvelle ligne aux données originales. */
    _addRow(newRowData: any[]): void {
        // Valider si la longueur correspond au nombre de colonnes? Non, laisser flexible pour l'instant.
        this.originalData.push(newRowData);
        // En mode client, le total doit être recalculé
        if (!this.isServerSide) {
            this.totalRows = this.originalData.length;
        } else {
            // En mode serveur, on pourrait supposer que le total augmente, mais 
            // il est plus sûr de laisser le serveur renvoyer le nouveau total lors du prochain fetch.
            // this.totalRows++; // Optionnel: mise à jour optimiste
        }
        // Pas de sauvegarde d'état ici, la méthode publique s'en chargera après le render.
        console.log("[StateManager._addRow] Row added. New total (client):", this.totalRows);
    }

    /** Met à jour une ligne existante par son ID. */
    _updateRowById(rowId: string | number, updatedRowData: any[], uniqueColIndex: number): boolean {
        const rowIndex = this.originalData.findIndex(row => row[uniqueColIndex] === rowId);
        if (rowIndex === -1) {
            console.warn(`[StateManager._updateRowById] Row with ID ${rowId} not found.`);
            return false;
        }
        // Valider la longueur des données mises à jour?
        if (updatedRowData.length !== this.options.columns.length) {
             console.warn(`[StateManager._updateRowById] Updated data length (${updatedRowData.length}) does not match column count (${this.options.columns.length}). Updating anyway.`);
        }
        this.originalData[rowIndex] = updatedRowData;
        console.log(`[StateManager._updateRowById] Row with ID ${rowId} updated at index ${rowIndex}.`);
        // La mise à jour peut affecter les données affichées (si tri/filtre) -> le render s'en chargera
        // Pas de sauvegarde d'état ici.
        return true;
    }

    /** Supprime une ligne par son ID. */
    _deleteRowById(rowId: string | number, uniqueColIndex: number): boolean {
        const initialLength = this.originalData.length;
        this.originalData = this.originalData.filter(row => row[uniqueColIndex] !== rowId);
        
        if (this.originalData.length === initialLength) {
            console.warn(`[StateManager._deleteRowById] Row with ID ${rowId} not found.`);
            return false;
        }

        // Supprimer des lignes sélectionnées aussi
        if (this.selectedRowIds.has(rowId)) {
            this.selectedRowIds.delete(rowId);
             console.log(`[StateManager._deleteRowById] Row ID ${rowId} removed from selection.`);
        }

        // Mettre à jour le total en mode client
        if (!this.isServerSide) {
            this.totalRows = this.originalData.length;
        } else {
             // En mode serveur, laisser le serveur gérer le total
             // this.totalRows--; // Optionnel: mise à jour optimiste
        }
        console.log(`[StateManager._deleteRowById] Row with ID ${rowId} deleted. New total (client):`, this.totalRows);
        // Pas de sauvegarde d'état ici.
        return true;
    }
} 