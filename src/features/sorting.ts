import { DataTable } from "../core/DataTable";
import { SortDirection } from "../core/types";
import { dispatchEvent, dispatchSortChangeEvent } from "../events/dispatcher";
import { renderStandardBody } from "../rendering/bodyRenderer";
import { renderPaginationControls, getCurrentPageData } from "./pagination";
import { applyFilters } from "./filtering";
import { updateSortIndicatorSVG } from "../rendering/headerRenderer";

// --- Sorting Feature ---

/**
 * Sorts the data array based on the current sort settings (client-side only).
 * @param instance The DataTable instance.
 * @param dataToSort The data array to sort.
 * @returns The sorted data array.
 */
export function sortDataIfEnabled(instance: DataTable, dataToSort: any[][]): any[][] {
    const state = instance.state;
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
    const state = instance.state;
    const columnDef = instance.options.columns[columnIndex];
    const table = instance.el.querySelector('table');
    if (!instance.options.sorting?.enabled || !columnDef || columnDef.sortable === false || !table?.tHead) {
         return;
    }

    const previousSortColumnIndex = state.getSortColumnIndex();
    const previousSortDirection = state.getSortDirection();

    let newDirection: SortDirection;
    if (previousSortColumnIndex === columnIndex) {
        newDirection = previousSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        newDirection = 'asc';
    }
    
    const newSortColumnIndex = columnIndex;

    console.log(`[handleSortClick] Col ${columnIndex}: Prev=${previousSortDirection}, New=${newDirection}`);

    state.setSort(newSortColumnIndex, newDirection);
    state.setCurrentPage(1);

    const headerRow = table.tHead.rows[0];
    if (headerRow) {
        headerRow.querySelectorAll('th[data-original-index]').forEach(thElement => {
            const th = thElement as HTMLTableCellElement;
            const thOriginalIndex = parseInt(th.dataset.originalIndex || '-1', 10);
            if (thOriginalIndex === -1) return;

            const svgElement = th.querySelector('.dt-sort-indicator svg') as SVGSVGElement | null;
            let indicatorState: 'ascending' | 'descending' | 'none' = 'none';

            if (thOriginalIndex === newSortColumnIndex) {
                indicatorState = newDirection === 'asc' ? 'ascending' : 'descending';
            }
            
            updateSortIndicatorSVG(svgElement, th, indicatorState);
        });
    }

    dispatchSortChangeEvent(instance);

    if (!state.getIsServerSide()) {
        console.log('[handleSortClick] Updating body & pagination (client-side)');
        const originalClientData = state.getOriginalData();
        const filteredData = applyFilters(instance, originalClientData);
        const sortedData = sortDataIfEnabled(instance, filteredData);
        const totalRows = sortedData.length;
        const dataForBodyRender = getCurrentPageData(instance, sortedData);

        renderStandardBody(instance, table, dataForBodyRender);
        if (instance.paginationContainer) {
            renderPaginationControls(instance, totalRows, instance.paginationContainer);
        } else {
            console.warn(`[handleSortClick] Pagination container not found for table ${instance.el.id}. Cannot update pagination.`);
        }
    } else {
        console.log('[handleSortClick] Server-side: State updated. Waiting for new data.');
    }
} 