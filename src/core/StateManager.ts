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

        // --- Charger l'état sauvegardé (écrase certaines valeurs initiales) ---
        this._loadState();

        // --- Données (après chargement état pour pagination/tri initial) ---
        if (this.isServerSide) {
            this.totalRows = options.serverSideTotalRows ?? 0;
            this.displayedData = this.originalData;
        } else {
            this.totalRows = this.originalData.length;
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

    // --- Setters / Mutators ---
    setCurrentPage(page: number): void {
        this.currentPage = page;
        this._saveState();
    }

    setRowsPerPage(rows: number): void {
        this.rowsPerPage = rows;
        this.currentPage = 1;
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
            columnWidths: Object.fromEntries(this.columnWidths)
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
            columnWidths: Object.fromEntries(this.columnWidths) 
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
} 