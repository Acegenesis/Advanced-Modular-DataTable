import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";

// --- Searching Feature ---

/**
 * Renders the search input field.
 */
export function renderSearchInput(instance: DataTable, parentElement: HTMLElement): void {
    const inputId = `datatable-search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const label = document.createElement('label');
    label.htmlFor = inputId;
    label.className = 'sr-only'; 
    label.textContent = instance.isServerSide ? 'Rechercher dans les données' : 'Filtrer le tableau';
    parentElement.appendChild(label);
    
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Rechercher...';
    searchInput.className = 'block w-full md:w-1/2 mb-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';
    searchInput.value = instance.filterTerm;
    searchInput.id = inputId;
    searchInput.setAttribute('role', 'searchbox');
    searchInput.setAttribute('aria-controls', instance.element.id + '-tbody'); 

    searchInput.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        const searchTerm = target.value;
        const debounceTime = instance.options.searching?.debounceTime ?? 300;

        if (instance.debounceTimer) {
            clearTimeout(instance.debounceTimer);
        }

        instance.debounceTimer = window.setTimeout(() => {
            instance.filterTerm = searchTerm;
            instance.currentPage = 1; // Reset to page 1 on search
            dispatchEvent(instance, 'dt:search', { searchTerm: instance.filterTerm });
            if (!instance.isServerSide) {
                 instance.render(); // Re-render only in client mode
            }
        }, debounceTime);
    });
    parentElement.appendChild(searchInput); 
}

/**
 * Filters the data based on the current search term (client-side only).
 * @param instance The DataTable instance.
 * @param data The data array to filter.
 * @returns The filtered data array.
 */
export function getFilteredData(instance: DataTable, data: any[][]): any[][] {
    if (!instance.options.searching?.enabled || !instance.filterTerm) {
        return data; 
    }
    const searchTermLower = instance.filterTerm.toLowerCase();
    return data.filter(row => {
        for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
            const columnDef = instance.options.columns[cellIndex];
            const isSearchable = !columnDef || columnDef.searchable !== false; 
            if (isSearchable) {
                if (String(row[cellIndex]).toLowerCase().includes(searchTermLower)) {
                    return true; 
                }
            } 
        }
        return false; 
    });
} 