import { DataTable } from "../core/DataTable";
import { dispatchPageChangeEvent } from "../events/dispatcher";

// --- Pagination Feature ---

/**
 * Calculates the data for the current page (client-side only).
 * @param instance The DataTable instance.
 * @param sourceData The full data array (already filtered/sorted).
 * @returns The data array for the current page.
 */
export function getCurrentPageData(instance: DataTable, sourceData: any[][]): any[][] {
    if (!instance.options.pagination?.enabled || instance.isServerSide) {
        // Pagination is handled server-side or disabled
        return sourceData; 
    }
    const startIndex = (instance.currentPage - 1) * instance.rowsPerPage;
    const endIndex = startIndex + instance.rowsPerPage;
    return sourceData.slice(startIndex, endIndex);
}

/**
 * Renders the pagination controls.
 * @param instance The DataTable instance.
 */
export function renderPaginationControls(instance: DataTable): void {
    let paginationContainer = instance.element.querySelector('#dt-pagination-controls');
    if (paginationContainer) { paginationContainer.remove(); } // Remove old controls

    paginationContainer = document.createElement('div');
    paginationContainer.id = 'dt-pagination-controls';
    paginationContainer.className = 'bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-1';
    paginationContainer.setAttribute('role', 'navigation');
    paginationContainer.setAttribute('aria-label', 'Pagination');

    const currentTotalRows = instance.totalRows; 
    const totalPages = Math.ceil(currentTotalRows / instance.rowsPerPage);
    const startItem = currentTotalRows === 0 ? 0 : (instance.currentPage - 1) * instance.rowsPerPage + 1;
    const endItem = Math.min(startItem + instance.rowsPerPage - 1, currentTotalRows);

    const flexContainer = document.createElement('div');
    flexContainer.className = 'flex-1 flex justify-between sm:hidden'; 
    // TODO: Add mobile pagination buttons (Previous/Next text?)
    // Example:
    // const mobilePrev = document.createElement('button'); ...
    // const mobileNext = document.createElement('button'); ...
    // flexContainer.appendChild(mobilePrev);
    // flexContainer.appendChild(mobileNext);

    const hiddenOnMobileContainer = document.createElement('div');
    hiddenOnMobileContainer.className = 'hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'; 

    // Information Text
    const infoContainer = document.createElement('div');
    infoContainer.className = 'text-sm text-gray-700';
    infoContainer.setAttribute('aria-live', 'polite'); 
    const p = document.createElement('p'); 
    if (currentTotalRows > 0) {
        p.innerHTML = `Affichage <span class="font-medium text-gray-900">${startItem}</span> à <span class="font-medium text-gray-900">${endItem}</span> sur <span class="font-medium text-gray-900">${currentTotalRows}</span> résultats`;
    } else {
        p.textContent = 'Aucun résultat';
    }
    infoContainer.appendChild(p);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px'; 

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.disabled = instance.currentPage === 1;
    prevButton.className = 'relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
    prevButton.setAttribute('aria-label', 'Page précédente');
    if (prevButton.disabled) {
        prevButton.setAttribute('aria-disabled', 'true');
    }
    prevButton.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
    prevButton.addEventListener('click', () => {
        if (instance.currentPage > 1) {
            instance.currentPage--;
            dispatchPageChangeEvent(instance);
            if (!instance.isServerSide) {
                instance.render(); 
            }
        }
    });

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.disabled = instance.currentPage === totalPages || currentTotalRows === 0;
    nextButton.className = 'relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
    nextButton.setAttribute('aria-label', 'Page suivante');
    if (nextButton.disabled) {
        nextButton.setAttribute('aria-disabled', 'true');
    }
    nextButton.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
    nextButton.addEventListener('click', () => {
        const totalPages = Math.ceil(instance.totalRows / instance.rowsPerPage); // Recalculate in case totalRows changed
        if (instance.currentPage < totalPages) {
            instance.currentPage++;
            dispatchPageChangeEvent(instance);
            if (!instance.isServerSide) {
                 instance.render(); 
            }
        }
    });

    buttonContainer.appendChild(prevButton);
    buttonContainer.appendChild(nextButton);

    hiddenOnMobileContainer.appendChild(infoContainer);
    hiddenOnMobileContainer.appendChild(buttonContainer);

    paginationContainer.appendChild(flexContainer); 
    paginationContainer.appendChild(hiddenOnMobileContainer);

    instance.element.appendChild(paginationContainer); 
} 