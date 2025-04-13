import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { renderSearchInput, applyFilters } from "../features/filtering";
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
    console.log('--- render() called ---'); // <-- Log
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

    // --- Barre d'outils supérieure (Recherche, Export, Effacer Filtres, etc.) ---
    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'mb-4 flex justify-between items-center flex-wrap gap-2'; // flex-wrap + gap pour petits écrans

    // Conteneur pour Recherche (gauche)
    const leftToolbar = document.createElement('div');
    leftToolbar.className = 'flex-grow'; // Prend l'espace disponible
    let searchElement: HTMLElement | null = null;
    if (instance.options.searching?.enabled) {
        searchElement = renderSearchInput(instance);
        leftToolbar.appendChild(searchElement);
    }
    toolbarContainer.appendChild(leftToolbar);

    // Conteneur pour Boutons (droite)
    const rightToolbar = document.createElement('div');
    rightToolbar.className = 'flex items-center flex-shrink-0 gap-2'; // Empêche de réduire + gap

    // Bouton "Effacer tous les filtres" (si activé)
    let clearFiltersButton: HTMLButtonElement | null = null;
    if (instance.options.columnFiltering?.showClearButton) {
        clearFiltersButton = document.createElement('button');
        clearFiltersButton.textContent = 'Effacer Filtres';
        clearFiltersButton.className = 'px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50';
        // Désactiver si aucun filtre n'est actif
        clearFiltersButton.disabled = !instance.filterTerm && instance.columnFilters.size === 0;
        clearFiltersButton.addEventListener('click', () => instance.clearAllFilters());
        rightToolbar.appendChild(clearFiltersButton);
    }

    // Bouton d'export CSV (if enabled)
    let exportButton: HTMLButtonElement | null = null;
    if (instance.options.exporting?.csv) {
        const csvOptions = instance.options.exporting.csv;
        if (csvOptions === true || (typeof csvOptions === 'object' && csvOptions.enabled !== false)) {
            exportButton = document.createElement('button');
            exportButton.textContent = 'Exporter CSV';
            exportButton.className = 'px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
            exportButton.addEventListener('click', () => exportToCSV(instance));
            rightToolbar.appendChild(exportButton);
        }
    }

    // Ajouter le conteneur droit seulement s'il a des boutons
    if (rightToolbar.hasChildNodes()) {
        toolbarContainer.appendChild(rightToolbar);
    }

    // Ajouter le conteneur de la barre d'outils seulement s'il contient quelque chose
    if (leftToolbar.hasChildNodes() || rightToolbar.hasChildNodes()) {
        mainContainer.appendChild(toolbarContainer);
    }

    // 2. Data Preparation (Client-side only)
    let dataToDisplay = instance.isServerSide
        ? [...instance.originalData]
        : [...instance.originalData];

    if (!instance.isServerSide) {
        const filteredData = applyFilters(instance, dataToDisplay);
        const sortedData = sortDataIfEnabled(instance, filteredData);
        dataToDisplay = sortedData;
        instance.totalRows = dataToDisplay.length;
    }

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

    // --- Restauration du focus ---
    const elementIdToFocus = instance.focusedElementId;
    if (elementIdToFocus) {
        console.log(`[mainRenderer.render] Attempting to restore focus to ID: ${elementIdToFocus}`); // Log
        const elementToFocus = instance.element.querySelector(`#${elementIdToFocus}`) as HTMLElement;
        if (elementToFocus) {
            console.log(`[mainRenderer.render] Element found:`, elementToFocus); // Log
            // Retarder légèrement le focus
            requestAnimationFrame(() => {
                 console.log(`[mainRenderer.render] Calling .focus() on ${elementIdToFocus}`); // Log
                elementToFocus.focus();
                // Si c'est un input texte, placer le curseur à la fin
                if (elementToFocus instanceof HTMLInputElement && elementToFocus.type === 'text') {
                     console.log(`[mainRenderer.render] Setting cursor position for ${elementIdToFocus}`); // Log
                    elementToFocus.setSelectionRange(elementToFocus.value.length, elementToFocus.value.length);
                }
            });
        } else {
             console.log(`[mainRenderer.render] Element with ID ${elementIdToFocus} NOT FOUND after render.`); // Log
        }
        instance.focusedElementId = null; // Réinitialiser après tentative
    } else {
         console.log('[mainRenderer.render] No focus ID was memorized.'); // Log
    }
} 