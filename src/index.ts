// Point d'entrée principal du package
import { DataTable } from './core/DataTable';
import { DataTableOptions, ColumnDefinition, RowAction, SortDirection } from './core/types';

// Ré-exporter les types pour l'utilisateur
export { DataTableOptions, ColumnDefinition, RowAction, SortDirection };

// Exporter la classe DataTable
export { DataTable };

// Log pour confirmer le chargement
console.log("DataTable package entry point loaded");

// Optionnel: Attacher au window global (pour utilisation directe via script tag)
if (typeof window !== 'undefined') {
   (window as any).SimpleDataTable = DataTable;
}