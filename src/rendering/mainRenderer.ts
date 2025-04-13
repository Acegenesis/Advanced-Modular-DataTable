import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { renderSearchInput, getFilteredData } from "../features/searching";
import { sortDataIfEnabled } from "../features/sorting";
import { renderPaginationControls } from "../features/pagination";
import { updateSelectAllCheckboxState } from "../features/selection";
import { renderHeader } from "./headerRenderer";
import { renderStandardBody } from "./bodyRenderer";

// --- Main Rendering Orchestration ---

/**
 * Main rendering function for the DataTable.
 * Clears the existing content and re-renders the entire table structure.
 * @param instance The DataTable instance.
 */
export function render(instance: DataTable): void {
    instance.element.innerHTML = ''; 
    const mainContainer = document.createElement('div'); 
    // Optional: Add base classes to mainContainer if needed
    // mainContainer.className = 'datatable-wrapper';

    // 1. Render Search Input (if enabled)
    if (instance.options.searching?.enabled) {
        renderSearchInput(instance, mainContainer);
    }

    // 2. Data Preparation (Client-side only)
    let dataToDisplay = instance.isServerSide 
        ? [...instance.originalData] // Use current page data in server mode
        : [...instance.originalData]; // Start with full data in client mode

    if (!instance.isServerSide) {
        const filteredData = getFilteredData(instance, dataToDisplay);
        const sortedData = sortDataIfEnabled(instance, filteredData);
        dataToDisplay = sortedData; 
        instance.totalRows = dataToDisplay.length; // Update total based on filtered/sorted data
    } 
    // In server mode, totalRows is already set from options or previous fetch

    // 3. Render Table Structure
    const tableContainer = document.createElement('div');
    tableContainer.className = 'mt-6 shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg'; 

    const table = document.createElement('table');
    table.className = 'min-w-full border-collapse table-fixed'; 
    table.style.width = '100%';
    table.setAttribute('role', 'grid');
    // Optional: Add aria-label or aria-labelledby for the table itself
    // table.setAttribute('aria-label', 'Tableau de données'); 

    // 4. Render Header & Body
    renderHeader(instance, table);
    renderStandardBody(instance, table, dataToDisplay); // Pass processed data
    updateSelectAllCheckboxState(instance); // Update after body render
   
    tableContainer.appendChild(table);
    mainContainer.appendChild(tableContainer);
    instance.element.appendChild(mainContainer);

    // 5. Render Pagination Controls (if applicable)
    // Pagination logic now considers totalRows which is correctly updated for client/server
    if (instance.options.pagination?.enabled && instance.totalRows > instance.rowsPerPage) {
        renderPaginationControls(instance); 
    }

    // 6. Dispatch Render Complete Event
    dispatchEvent(instance, 'dt:renderComplete');
} 