import { DataTable } from "../core/DataTable";
import { SortDirection, TextFilterOperator, ColumnFilterState } from "../core/types";

// --- Event Detail Interfaces ---
interface PageChangeDetail {
    currentPage: number;
    rowsPerPage: number;
    totalRows: number;
}

interface SelectionChangeDetail {
    selectedIds: any[];
    selectedData: any[][];
}

interface SortChangeDetail {
    columnIndex: number | null;
    sortDirection: SortDirection;
}

interface SearchDetail {
    searchTerm: string;
}

interface FilterChangeDetail {
    columnIndex: number;
    value: any | null;
    operator?: TextFilterOperator;
    allFilters: { [key: number]: ColumnFilterState };
}

interface ActionClickDetail {
    actionId: string;
    rowData: any[];
    rowIndex: number; // Index dans les données actuellement affichées
}

// --- Generic Dispatcher ---

/**
 * Helper générique pour dispatcher les CustomEvents depuis l'élément DataTable.
 */
export function dispatchEvent<T>(instance: DataTable, eventName: string, detail?: T): void {
    console.log(`Dispatching event: ${eventName}`, detail);
    const event = new CustomEvent<T>(eventName, {
        detail: detail,
        bubbles: true, // Permet à l'événement de remonter le DOM
        cancelable: true // Peut être annulé
    });
    instance.element.dispatchEvent(event);
}

// --- Specific Event Dispatchers ---

/**
 * Dispatch l'événement de changement de page.
 */
export function dispatchPageChangeEvent(instance: DataTable): void {
     dispatchEvent<PageChangeDetail>(instance, 'dt:pageChange', {
        currentPage: instance.currentPage,
        rowsPerPage: instance.rowsPerPage,
        totalRows: instance.totalRows
    });
}

/**
 * Dispatch l'événement de changement de sélection.
 */
export function dispatchSelectionChangeEvent(instance: DataTable): void {
    dispatchEvent<SelectionChangeDetail>(instance, 'dt:selectionChange', {
        selectedIds: instance.getSelectedRowIds(),
        selectedData: instance.getSelectedRowData()
    });
}

/**
 * Dispatch l'événement de changement de tri.
 */
export function dispatchSortChangeEvent(instance: DataTable): void {
    dispatchEvent<SortChangeDetail>(instance, 'dt:sortChange', {
        columnIndex: instance.sortColumnIndex,
        sortDirection: instance.sortDirection
    });
}

/**
 * Dispatch l'événement de recherche globale.
 * (Fonction appelée depuis filtering.ts)
 */
export function dispatchSearchEvent(instance: DataTable, searchTerm: string): void {
     dispatchEvent<SearchDetail>(instance, 'dt:search', { searchTerm });
}

/**
 * Dispatch l'événement de changement de filtre de colonne.
 * (Fonction appelée depuis DataTable.ts)
 */
export function dispatchFilterChangeEvent(instance: DataTable, detail: FilterChangeDetail): void {
    dispatchEvent<FilterChangeDetail>(instance, 'dt:filterChange', detail);
}

/**
 * Dispatch l'événement de clic sur une action de ligne.
 * (Fonction à appeler depuis bodyRenderer.ts lors de la création du bouton d'action)
 */
export function dispatchActionClickEvent(instance: DataTable, detail: ActionClickDetail): void {
    dispatchEvent<ActionClickDetail>(instance, 'dt:actionClick', detail);
}

/**
 * Dispatch l'événement indiquant que le rendu est terminé.
 * (Fonction appelée depuis mainRenderer.ts)
 */
export function dispatchRenderCompleteEvent(instance: DataTable): void {
    dispatchEvent<undefined>(instance, 'dt:renderComplete');
} 