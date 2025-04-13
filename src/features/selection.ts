import { DataTable } from "../core/DataTable";
import { dispatchSelectionChangeEvent } from "../events/dispatcher";
import { sortDataIfEnabled } from "./sorting";
import { applyFilters } from "./filtering";
import { getCurrentPageData } from "./pagination";

// --- Selection Feature ---

/**
 * Handles the click on the "Select All" checkbox.
 * @param instance The DataTable instance.
 * @param isChecked The new checked state.
 */
export function handleSelectAllClick(instance: DataTable, isChecked: boolean): void {
    const state = instance.stateManager;
    if (!state.getSelectionEnabled() || state.getSelectionMode() !== 'multiple') return;

    const allRelevantData = getCurrentFilteredSortedData(instance);
    const allRelevantIds = new Set(allRelevantData.map(row => row[0]));

    // 1. Update state
    if (isChecked) {
        state.selectAll(allRelevantIds);
    } else {
        state.deselectAll(allRelevantIds);
    }

    // 2. Update UI by re-rendering
    instance.render();

    // 3. Dispatch change event (SelectAll state is updated during render)
    dispatchSelectionChangeEvent(instance);
}

/**
 * Handles the click on a row's checkbox.
 * @param instance The DataTable instance.
 * @param rowId The ID of the clicked row.
 * @param isChecked The new checked state.
 */
export function handleRowCheckboxClick(instance: DataTable, rowId: any, isChecked: boolean): void {
    const state = instance.stateManager;
    if (!state.getSelectionEnabled()) return;

    // 1. Update state
    if (state.getSelectionMode() === 'single') {
        if (isChecked) {
            state.setSelectedRowIds(new Set([rowId]));
        } else {
            // If unchecking the currently selected single item
            if (state.getSelectedRowIds().has(rowId)) {
                state.setSelectedRowIds(new Set());
            }
        }
    } else {
        // Multiple mode: just toggle the state for this row
        state.toggleRowSelection(rowId);
    }

    // 2. Update UI by re-rendering
    instance.render();

    // 3. Dispatch change event (SelectAll state is updated during render if needed)
    dispatchSelectionChangeEvent(instance);
}

/**
 * Updates the state (checked/indeterminate) of the "Select All" checkbox.
 * This is called during the render cycle (specifically by renderHeader).
 * @param instance The DataTable instance.
 */
export function updateSelectAllCheckboxState(instance: DataTable): void {
    const state = instance.stateManager;
    if (!instance.selectAllCheckbox || !state.getSelectionEnabled() || state.getSelectionMode() !== 'multiple') return;

    // Cast l'instance et les données pour l'appel interne si nécessaire
    const relevantData = state.getIsServerSide()
        ? getCurrentPageData(instance as DataTable, state.getDisplayedData() as any[][]) // Cast temporaire
        : getCurrentFilteredSortedData(instance);

    if (relevantData.length === 0) {
        instance.selectAllCheckbox.checked = false;
        instance.selectAllCheckbox.indeterminate = false;
        return;
    }

    let allSelected = true;
    let someSelected = false;
    const currentSelectedIds = state.getSelectedRowIds();

    for (const rowData of relevantData) {
        const rowId = rowData[0];
        if (currentSelectedIds.has(rowId)) {
            someSelected = true;
        } else {
            allSelected = false;
        }
        if (someSelected && !allSelected) break; // Optimization
    }

    // Set checkbox state based on selection status
    instance.selectAllCheckbox.checked = allSelected;
    instance.selectAllCheckbox.indeterminate = !allSelected && someSelected;
}

/**
 * Gets the currently relevant data based on filters and sorting (client-side).
 * Used for select-all logic and potentially external API access.
 */
export function getCurrentFilteredSortedData(instance: DataTable): any[][] {
    const state = instance.stateManager;
    if (state.getIsServerSide()) {
        console.warn('getCurrentFilteredSortedData is client-side oriented and returns only current page data in server-side mode.');
        return state.getDisplayedData();
    }
    const originalData = state.getOriginalData();
    if (!originalData) return [];
    const filteredData = applyFilters(instance, originalData);
    const sortedData = sortDataIfEnabled(instance, filteredData);
    return sortedData;
}

/**
 * Gets the full data objects for the selected rows.
 * Note: In server-side mode, this might only return data for the current page.
 */
export function getSelectedRowData(instance: DataTable): any[][] {
    const state = instance.stateManager;
    const allRelevantData = getCurrentFilteredSortedData(instance);
    const selectedIds = state.getSelectedRowIds();
    return allRelevantData.filter(rowData => selectedIds.has(rowData[0]));
}

/**
 * Gets the IDs of the selected rows.
 * This relies on the public API which uses the state manager.
 */
export function getSelectedRowIds(instance: DataTable): any[] {
     return instance.getSelectedRowIds();
}

/**
 * Sets the selected rows programmatically.
 * Relies on the public API which handles state update, render, and event dispatching.
 */
export function setSelectedRowIds(instance: DataTable, ids: any[]): void {
    instance.setSelectedRowIds(ids);
} 