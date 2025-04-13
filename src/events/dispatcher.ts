import { DataTable } from "../core/DataTable";

// Helper pour dispatcher les événements
export function dispatchEvent<T>(instance: DataTable, eventName: string, detail?: T): void {
    const event = new CustomEvent<T>(eventName, { 
        detail: detail,
        bubbles: true,
        cancelable: true
    });
    instance.element.dispatchEvent(event);
}

// Événement spécifique pour le changement de page
export function dispatchPageChangeEvent(instance: DataTable): void {
     dispatchEvent(instance, 'dt:pageChange', { 
        currentPage: instance.currentPage,
        rowsPerPage: instance.rowsPerPage,
        totalRows: instance.totalRows
    });
}

// Événement spécifique pour le changement de sélection
export function dispatchSelectionChangeEvent(instance: DataTable): void {
    dispatchEvent(instance, 'dt:selectionChange', { 
        selectedIds: instance.getSelectedRowIds(),
        selectedData: instance.getSelectedRowData() // Attention: peut être limité en server-side
    });
} 