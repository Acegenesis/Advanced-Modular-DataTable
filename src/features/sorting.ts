import { DataTable } from "../core/DataTable";
import { SortDirection } from "../core/types";
import { dispatchEvent, dispatchSortChangeEvent } from "../events/dispatcher";

// --- Sorting Feature ---

/**
 * Sorts the data array based on the current sort settings (client-side only).
 * @param instance The DataTable instance.
 * @param dataToSort The data array to sort.
 * @returns The sorted data array.
 */
export function sortDataIfEnabled(instance: DataTable, dataToSort: any[][]): any[][] {
    const state = instance.stateManager;
    if (!instance.options.sorting?.enabled || state.getSortColumnIndex() === null || state.getSortDirection() === 'none') {
        return dataToSort;
    }
    const sortedData = [...dataToSort];
    const columnIndex = state.getSortColumnIndex()!;
    const direction = state.getSortDirection();

    sortedData.sort((a, b) => {
        const valA = a[columnIndex];
        const valB = b[columnIndex];
        
        // Basic numeric sort
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
            return direction === 'asc' ? numA - numB : numB - numA;
        }
        
        // Basic string sort (case-insensitive)
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return direction === 'asc' ? -1 : 1;
        if (strA > strB) return direction === 'asc' ? 1 : -1;
        return 0;
        
        // TODO: Add more sophisticated sorting based on column type (date, etc.)?
        // Consider using Intl.Collator for locale-aware string sorting.
    });
    return sortedData;
}

/**
 * Handles the click event on a sortable column header.
 * @param instance The DataTable instance.
 * @param columnIndex The index of the clicked column.
 */
export function handleSortClick(instance: DataTable, columnIndex: number): void {
    const state = instance.stateManager;
    const columnDef = instance.options.columns[columnIndex];
    if (!instance.options.sorting?.enabled || !columnDef || columnDef.sortable === false) {
         return;
    }

    let newDirection: SortDirection;
    if (state.getSortColumnIndex() === columnIndex) {
        newDirection = state.getSortDirection() === 'asc' ? 'desc' : 'asc';
    } else {
        newDirection = 'asc';
    }

    state.setSort(columnIndex, newDirection);
    state.setCurrentPage(1);

    dispatchSortChangeEvent(instance);

    if (!state.getIsServerSide()) {
         instance.render();
    }
} 