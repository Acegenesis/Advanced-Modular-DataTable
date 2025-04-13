// Types pour définir une colonne
export interface ColumnDefinition {
    title: string; 
    type?: 'string' | 'number' | 'mail' | 'tel' | 'money'; 
    render?: (cellData: any, rowData: any[]) => string | HTMLElement | DocumentFragment; 
    sortable?: boolean; 
    searchable?: boolean; 
    locale?: string; 
    currency?: string; 
    width?: string; // Nouvelle propriété optionnelle pour la largeur (ex: '150px', '20%')
}

// Interface pour les actions
export interface RowAction {
    label: string;        
    actionId: string;     
    className?: string;   
}

// Options principales
export interface DataTableOptions {
    columns: ColumnDefinition[]; 
    data: any[][];    
    pagination?: {
        enabled: boolean;
        rowsPerPage?: number; 
        style?: PaginationStyle;
        previousButtonContent?: string; // Contenu HTML/texte pour le bouton Précédent
        nextButtonContent?: string;     // Contenu HTML/texte pour le bouton Suivant
        jumpButtonText?: string;        // Texte pour le bouton "Go" du saut de page
    };
    sorting?: {
        enabled: boolean;
    };
    searching?: {
        enabled: boolean;
        debounceTime?: number; 
    };
    rowActions?: RowAction[];
    processingMode?: 'client' | 'server'; // 'client' (default) or 'server'
    serverSideTotalRows?: number;      // Required if processingMode is 'server'
    selection?: {
        enabled: boolean;
        mode?: 'single' | 'multiple'; // Défaut 'multiple' si activé
        initialSelectedIds?: any[];   // IDs des lignes initialement sélectionnées (basé sur rowData[0])
    };
    loadingMessage?: string; // Message à afficher pendant le chargement
}

export type SortDirection = 'asc' | 'desc' | 'none';
export type PaginationStyle = 'simple' | 'numbered' | 'numbered-jump'; 