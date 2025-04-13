import { DataTable } from "../core/DataTable";
import { dispatchSelectionChangeEvent } from "../events/dispatcher";
import { getFilteredData } from "./searching";
import { sortDataIfEnabled } from "./sorting";

// --- Selection Feature ---

/**
 * Handles the click on the "Select All" checkbox.
 * @param instance The DataTable instance.
 * @param isChecked The new checked state.
 */
export function handleSelectAllClick(instance: DataTable, isChecked: boolean): void {
    if (!instance.selectionEnabled || instance.selectionMode !== 'multiple') return;

    const allRelevantData = getCurrentFilteredSortedData(instance); 

    allRelevantData.forEach(rowData => {
        const rowId = rowData[0]; 
        if (isChecked) {
            instance.selectedRowIds.add(rowId);
        } else {
            instance.selectedRowIds.delete(rowId);
        }
    });

    // Update UI for visible rows
    const tbody = instance.element.querySelector(`#${instance.element.id}-tbody`);
    if (tbody) {
        const rows = tbody.querySelectorAll('tr[role="row"]');
        rows.forEach((rowElement) => {
            const checkbox = rowElement.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
            if (checkbox) {
                checkbox.checked = isChecked;
            }
            if (isChecked) {
                rowElement.classList.add('dt-row-selected', 'bg-indigo-50');
                rowElement.setAttribute('aria-selected', 'true');
            } else {
                rowElement.classList.remove('dt-row-selected', 'bg-indigo-50');
                rowElement.setAttribute('aria-selected', 'false');
            }
        });
    }

    updateSelectAllCheckboxState(instance); 
    dispatchSelectionChangeEvent(instance);
}

/**
 * Handles the click on a row's checkbox.
 * @param instance The DataTable instance.
 * @param rowId The ID of the clicked row.
 * @param isChecked The new checked state.
 * @param rowElement The HTML row element.
 */
export function handleRowCheckboxClick(instance: DataTable, rowId: any, isChecked: boolean, rowElement: HTMLTableRowElement): void {
    if (!instance.selectionEnabled) return;

    if (isChecked) {
        if (instance.selectionMode === 'single') {
            // Clear previous selection and update UI
            instance.selectedRowIds.forEach(id => {
                const prevRow = instance.element.querySelector(`tr[data-row-id="${id}"]`); // Assumes data-row-id attribute exists
                if (prevRow) {
                    prevRow.classList.remove('dt-row-selected', 'bg-indigo-50');
                    prevRow.setAttribute('aria-selected', 'false');
                    const prevCheckbox = prevRow.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
                    if (prevCheckbox) prevCheckbox.checked = false;
                }
            });
            instance.selectedRowIds.clear();
        }
        instance.selectedRowIds.add(rowId);
        rowElement.classList.add('dt-row-selected', 'bg-indigo-50');
        rowElement.setAttribute('aria-selected', 'true');
    } else {
        instance.selectedRowIds.delete(rowId);
        rowElement.classList.remove('dt-row-selected', 'bg-indigo-50');
        rowElement.setAttribute('aria-selected', 'false');
    }

    if (instance.selectionMode === 'multiple') {
        updateSelectAllCheckboxState(instance); 
    }
    dispatchSelectionChangeEvent(instance);
}

/**
 * Updates the state (checked/indeterminate) of the "Select All" checkbox.
 * @param instance The DataTable instance.
 */
export function updateSelectAllCheckboxState(instance: DataTable): void {
    if (!instance.selectAllCheckbox || instance.selectionMode !== 'multiple') return;

    const allRelevantData = getCurrentFilteredSortedData(instance);

    if (allRelevantData.length === 0) {
        instance.selectAllCheckbox.checked = false;
        instance.selectAllCheckbox.indeterminate = false;
        return;
    }

    let allSelected = true;
    let someSelected = false;

    for (const rowData of allRelevantData) { 
        const rowId = rowData[0]; 
        if (instance.selectedRowIds.has(rowId)) {
            someSelected = true;
        } else {
            allSelected = false;
        }
        if (someSelected && !allSelected) break; // Early exit
    }

    if (allSelected) {
        instance.selectAllCheckbox.checked = true;
        instance.selectAllCheckbox.indeterminate = false;
    } else if (someSelected) {
        instance.selectAllCheckbox.checked = false;
        instance.selectAllCheckbox.indeterminate = true;
    } else {
        instance.selectAllCheckbox.checked = false;
        instance.selectAllCheckbox.indeterminate = false;
    }
}

/**
 * Gets the currently filtered and sorted data (client-side).
 * Used primarily for determining the state of "Select All".
 * @param instance The DataTable instance.
 * @returns The filtered and sorted data array.
 */
export function getCurrentFilteredSortedData(instance: DataTable): any[][] {
     if (instance.isServerSide) {
         console.warn('getCurrentFilteredSortedData en mode serveur retourne seulement la page actuelle.');
          return [...instance.originalData]; // Returns current page data in server mode
     }
     const filteredData = getFilteredData(instance, [...instance.originalData]); 
     const sortedData = sortDataIfEnabled(instance, filteredData);   
     return sortedData;
}

/**
 * Gets the full data objects for the selected rows.
 * Note: In server-side mode, this might only return data for the current page 
 * depending on how `getCurrentFilteredSortedData` is implemented for server-side.
 * @param instance The DataTable instance.
 * @returns An array containing the data of the selected rows.
 */
export function getSelectedRowData(instance: DataTable): any[][] {
    const allRelevantData = getCurrentFilteredSortedData(instance); 
    return allRelevantData.filter(rowData => instance.selectedRowIds.has(rowData[0]));
}

/**
 * Gets the IDs of the selected rows.
 * @param instance The DataTable instance.
 * @returns An array of selected row IDs.
 */
export function getSelectedRowIds(instance: DataTable): any[] {
    return Array.from(instance.selectedRowIds);
}

/**
 * Sets the selected rows programmatically.
 * @param instance The DataTable instance.
 * @param ids An array of row IDs to select.
 */
export function setSelectedRowIds(instance: DataTable, ids: any[]): void {
    if (!instance.selectionEnabled) return;
    
    const newSelectedIds = new Set(ids);
    
    if (instance.selectionMode === 'single' && newSelectedIds.size > 1) {
        const lastId = Array.from(newSelectedIds).pop();
        newSelectedIds.clear();
        if (lastId !== undefined) {
            newSelectedIds.add(lastId);
        }
    }
    
    instance.selectedRowIds = newSelectedIds;
    instance.render(); // Re-render to update UI
    dispatchSelectionChangeEvent(instance);
} 