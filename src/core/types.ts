// Type pour l'identifiant unique d'une ligne
export type RowId = string | number;

// Type générique pour représenter une ligne de données (tableau où le premier élément est l'ID)
// NOTE: Une structure objet { id: T, ... } serait plus explicite mais demanderait plus de refactoring.
export type RowData<T extends RowId> = [T, ...any[]];

// Types pour définir une colonne
export interface ColumnDefinition {
    title: string;
    data?: string;
    name?: string;
    type?: 'string' | 'number' | 'mail' | 'tel' | 'money';
    render?: (cellData: any, rowData: any[]) => string | HTMLElement | DocumentFragment;
    sortable?: boolean;
    searchable?: boolean;
    locale?: string;
    currency?: string;
    width?: string;
    filterType?: 'text' | 'select';
    filterOptions?: string[] | { value: any; label: string }[];
    filterPlaceholder?: string;
    filterOperators?: TextFilterOperator[];
}

// Interface pour les actions
export interface RowAction {
    label: string;        
    actionId: string;     
    className?: string;   
}

// Options principales - Revenir à non générique
export interface DataTableOptions {
    columns: ColumnDefinition[];
    data?: any[][]; // Revenir à any[][]
    pagination?: {
        enabled: boolean;
        rowsPerPage?: number; 
        style?: PaginationStyle;
        previousButtonContent?: string;
        nextButtonContent?: string;
        jumpButtonText?: string;
    };
    sorting?: {
        enabled: boolean;
    };
    searching?: {
        enabled: boolean;
        debounceTime?: number; 
    };
    rowActions?: RowAction[];
    processingMode?: 'client' | 'server';
    serverSideTotalRows?: number;
    serverSide?: {
        fetchData: (params: ServerSideParams) => Promise<ServerSideResponse>;
    };
    selection?: {
        enabled: boolean;
        mode?: 'single' | 'multiple';
        initialSelectedIds?: any[]; // Revenir à any[]
    };
    loadingMessage?: string;
    exporting?: {
        csv?: CsvExportOptions | boolean;
        // excel?: boolean; // Option future pour Excel
    };
    // Nouvelle option globale pour activer/désactiver les filtres de colonne
    columnFiltering?: {
        enabled: boolean;
        showClearButton?: boolean;
    };
}

// Options spécifiques à l'export CSV
export interface CsvExportOptions {
    enabled?: boolean;
    delimiter?: string;
    encoding?: string;
    filename?: string;
    bom?: boolean;
}

// Opérateurs pour les filtres texte
export type TextFilterOperator = 
    'contains' | 
    'notContains' |
    'equals' | 
    'startsWith' | 
    'endsWith' | 
    'isEmpty' |
    'isNotEmpty';

// État d'un filtre de colonne individuel
export type ColumnFilterState = {
    value: string | number | { value: any; label: string } | null;
    operator?: TextFilterOperator;
} | null;

export type SortDirection = 'asc' | 'desc' | 'none';
export type PaginationStyle = 'simple' | 'numbered' | 'numbered-jump';

// Interface pour les paramètres envoyés au serveur
export interface ServerSideParams {
    draw: number;
    start: number;
    length: number;
    search: { value: string; regex: boolean };
    order: { column: number; dir: SortDirection }[];
    columns: {
        data: string | undefined;
        name: string | undefined;
        searchable: boolean;
        orderable: boolean;
        search: { value: string; regex: boolean };
    }[];
}

// Interface pour la réponse attendue du serveur - Revenir à non générique
export interface ServerSideResponse {
    draw?: number;
    recordsTotal: number;
    recordsFiltered: number;
    data: any[][]; // Revenir à any[][]
    error?: string;
} 