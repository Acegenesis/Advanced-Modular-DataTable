import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { renderSearchInput, getFilteredData } from "../features/searching";
import { sortDataIfEnabled } from "../features/sorting";
import { renderPaginationControls } from "../features/pagination";
import { updateSelectAllCheckboxState } from "../features/selection";
import { renderHeader } from "./headerRenderer";
import { renderStandardBody } from "./bodyRenderer";
import { exportToCSV } from "../features/exporting";

// --- Main Rendering Orchestration ---

/**
 * Main rendering function for the DataTable.
 * Clears the existing content and re-renders the entire table structure.
 * @param instance The DataTable instance.
 */
export function render(instance: DataTable): void {
    // Garder une référence à l'overlay s'il existe
    const existingOverlay = instance.element.querySelector('.dt-loading-overlay') as HTMLElement | null;

    // Vider l'élément principal SAUF l'overlay
    Array.from(instance.element.children).forEach(child => {
        if (!child.classList.contains('dt-loading-overlay')) {
            instance.element.removeChild(child);
        }
    });

    // instance.element.innerHTML = ''; // <-- Ancienne méthode qui supprimait tout
    const mainContainer = document.createElement('div');
    // Optional: Add base classes to mainContainer if needed
    // mainContainer.className = 'datatable-wrapper';

    // --- Barre d'outils supérieure (Recherche, Export, etc.) ---
    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'mb-4 flex justify-between items-center'; // Ajoute un espace en dessous

    // 1. Render Search Input (if enabled)
    let searchElement: HTMLElement | null = null;
    if (instance.options.searching?.enabled) {
        searchElement = renderSearchInput(instance); // La fonction renvoie maintenant l'élément
        toolbarContainer.appendChild(searchElement);
    }

    // Espace flexible si la recherche est activée
    if (searchElement) {
         const spacer = document.createElement('div');
         spacer.className = 'flex-grow'; // Pousse les éléments suivants à droite
         toolbarContainer.appendChild(spacer);
    }

    // Bouton d'export CSV (if enabled)
    let exportButton: HTMLButtonElement | null = null;
    if (instance.options.exporting?.csv) {
        exportButton = document.createElement('button');
        exportButton.textContent = 'Exporter CSV';
        // Ajouter des classes Tailwind pour le style
        exportButton.className = 'ml-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
        exportButton.addEventListener('click', () => exportToCSV(instance));
        toolbarContainer.appendChild(exportButton);
    }

    // Ajouter le conteneur de la barre d'outils seulement s'il contient quelque chose
    if (searchElement || exportButton) {
        mainContainer.appendChild(toolbarContainer);
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
    // Enlever la marge supérieure ici car la barre d'outils a maintenant une marge inférieure
    tableContainer.className = 'shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg';

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

    // 7. S'assurer que l'overlay est le dernier élément (pour le z-index)
    if (existingOverlay) {
        instance.element.appendChild(existingOverlay);
    }
} 