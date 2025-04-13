import { SortDirection, DataTableOptions, ColumnFilterState } from './types';

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

    private options: DataTableOptions;

    constructor(options: DataTableOptions, initialData?: any[][]) {
        this.options = options;

        // --- Mode ---
        this.isServerSide = options.processingMode === 'server';

        // --- Données Initiales ---
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
        this.columnFilters = new Map();
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

    // --- Setters / Mutators ---
    setCurrentPage(page: number): void {
        this.currentPage = page;
    }

    setRowsPerPage(rows: number): void {
        this.rowsPerPage = rows;
        this.currentPage = 1;
    }

    setTotalRows(total: number): void {
        this.totalRows = total;
    }

    setSort(columnIndex: number | null, direction: SortDirection): void {
        this.sortColumnIndex = columnIndex;
        this.sortDirection = direction;
        this.currentPage = 1;
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
    }


    setFilterTerm(term: string): void {
        this.filterTerm = term;
        this.currentPage = 1;
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
        this.columnFilters.set(columnIndex, filterState);
        this.currentPage = 1;
    }

    clearColumnFilter(columnIndex: number): void {
        this.columnFilters.delete(columnIndex);
        this.currentPage = 1;
    }

     clearAllColumnFilters(): void {
        this.columnFilters.clear();
        this.currentPage = 1;
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
            columnFilters: Object.fromEntries(this.columnFilters)
        };
    }
} 