import { DataTable } from "../core/DataTable";
import { dispatchEvent, dispatchSearchEvent, dispatchFilterChangeEvent } from "../events/dispatcher";
import { ColumnFilterState } from "../core/types";

// --- Global Search Feature ---

/**
 * Creates and returns the search input field element.
 */
export function renderSearchInput(instance: DataTable): HTMLInputElement {
    const state = instance.stateManager;
    const inputId = `${instance.element.id}-global-search`;

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Rechercher...';
    searchInput.className = 'dt-global-search-input block w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';
    searchInput.value = state.getFilterTerm();
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
            state.setFilterTerm(searchTerm);
            state.setCurrentPage(1);
            dispatchSearchEvent(instance);
            if (state.getIsServerSide() && instance.options.serverSide?.fetchData) {
                 instance.fetchData();
            } else if (!state.getIsServerSide()) {
                 instance.render();
            }
        }, debounceTime);
    });
    return searchInput;
}

// --- Combined Filtering Logic (Global Search + Column Filters) ---

/**
 * Applies global search and column filters to the data (client-side only).
 * @param instance The DataTable instance.
 * @param data The data array to filter.
 * @returns The filtered data array.
 */
export function applyFilters(instance: DataTable, data: any[][]): any[][] {
    let filteredData = data;
    const state = instance.stateManager;

    // 1. Apply Global Search Filter
    const globalFilterTerm = state.getFilterTerm();
    if (instance.options.searching?.enabled && globalFilterTerm) {
        const searchTermLower = globalFilterTerm.trim().toLowerCase();
        if (searchTermLower) {
            filteredData = filteredData.filter(row => {
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
    }

    // 2. Apply Column Filters
    const columnFilters = state.getColumnFilters();
    if (instance.options.columnFiltering?.enabled && columnFilters.size > 0) {
        console.log("[applyFilters] Applying column filters:", columnFilters);
        filteredData = filteredData.filter(row => {
            // console.log("[applyFilters] Checking row:", row);
            for (const [columnIndex, filterState] of columnFilters.entries()) {
                if (!filterState || filterState.value === null || filterState.value === undefined) continue;

                const cellData = row[columnIndex];
                const columnDef = instance.options.columns[columnIndex];
                // Trim() et toLowerCase() sur les données de la cellule également
                const cellDataString = String(cellData).trim().toLowerCase();
                const filterValue = filterState.value;
                const filterOperator = filterState.operator || 'contains';

                // console.log(`[applyFilters] Col ${columnIndex} (${columnDef.title}) Filter: Op=${filterOperator}, Val='${filterValue}', Cell='${cellData}' (Str='${cellDataString}')`);

                switch (columnDef.filterType) {
                    case 'text':
                        const cellDataForCheck = row[columnIndex]; // Garder la valeur originale pour check null/undefined
                        const cellStringForCheck = String(cellDataForCheck).trim().toLowerCase();

                        // La valeur du filtre n'est utilisée que si l'opérateur en a besoin
                        const filterValueString = (filterOperator !== 'isEmpty' && filterOperator !== 'isNotEmpty') 
                            ? String(filterValue).trim().toLowerCase() 
                            : '';
                        
                        if (filterOperator === 'isEmpty' || filterOperator === 'isNotEmpty' || filterValueString) {
                            let match = false;
                            // console.log(`[applyFilters] Text Filter [Col ${columnIndex}]: Comparing Original='${cellDataForCheck}' (Str='${cellStringForCheck}') ${filterOperator} FilterVal='${filterValueString}'`);
                            switch (filterOperator) {
                                case 'equals':
                                    match = cellStringForCheck === filterValueString;
                                    break;
                                case 'startsWith':
                                    match = cellStringForCheck.startsWith(filterValueString);
                                    break;
                                case 'endsWith':
                                    match = cellStringForCheck.endsWith(filterValueString);
                                    break;
                                case 'notContains':
                                    match = !cellStringForCheck.includes(filterValueString);
                                    break;
                                case 'isEmpty':
                                    // Vrai si null, undefined, ou chaîne vide après trim
                                    match = cellDataForCheck == null || cellStringForCheck === ''; 
                                    break;
                                case 'isNotEmpty':
                                     // Vrai si non null/undefined ET chaîne non vide après trim
                                    match = cellDataForCheck != null && cellStringForCheck !== '';
                                    break;
                                case 'contains':
                                default:
                                    match = cellStringForCheck.includes(filterValueString);
                                    break;
                            }
                            // console.log(`[applyFilters] Text Filter [Col ${columnIndex}]: Match result = ${match}`);
                            if (!match) {
                                return false;
                            }
                        }
                        break;

                    case 'select':
                        const selectValueString = String(filterValue).toLowerCase();
                        // Pour Select, pas de trim() sur la valeur du filtre car elle vient des options
                        console.log(`[applyFilters] Select Filter [Col ${columnIndex}]: Comparing '${cellDataString}' equals '${selectValueString}'`); // Log détaillé
                        if (cellDataString !== selectValueString) {
                            console.log(`[applyFilters] Select Filter [Col ${columnIndex}]: Match result = false`); // Log résultat
                            // console.log(`[applyFilters] Row rejected by column ${columnIndex}`);
                            return false;
                        }
                         console.log(`[applyFilters] Select Filter [Col ${columnIndex}]: Match result = true`); // Log résultat
                        break;
                    // TODO: Add cases for 'number-range', 'date-range' later
                    default:
                        // If filter type is unknown or not handled, don't filter based on it?
                        // Or assume text filter?
                        break;
                }
            }
            // console.log("[applyFilters] Row passed all filters:", row);
            return true;
        });
    }

    return filteredData;
} 