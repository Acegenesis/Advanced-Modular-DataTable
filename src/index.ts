// Point d'entrée principal du package
import { DataTable } from './core/DataTable';
import { ColumnVisibilityController } from './controllers/ColumnVisibilityController';

// Exporter la classe principale
export { DataTable };

// Exporter le nouveau contrôleur
export { ColumnVisibilityController };

// Ré-exporter les types nécessaires pour l'utilisateur
export type { 
    DataTableOptions, 
    ColumnDefinition, 
    RowAction, 
    PaginationOptions,
    ServerSideParams,
    ColumnFilterState,
    SortDirection 
} from './core/types';

// Log pour confirmer le chargement
console.log("DataTable package entry point loaded");

// Optionnel: Attacher au window global (pour utilisation directe via script tag)
if (typeof window !== 'undefined') {
   (window as any).SimpleDataTable = DataTable;
}