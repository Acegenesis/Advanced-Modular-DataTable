import { DataTable } from "../core/DataTable";
import { dispatchEvent, dispatchSearchEvent, dispatchFilterChangeEvent } from "../events/dispatcher";
import { ColumnFilterState, TextFilterOperator, NumberFilterOperator, DateFilterOperator } from "../core/types";

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

// Helper function pour vérifier si une valeur est considérée comme "vide"
function isValueEmpty(value: any): boolean {
    return value === null || value === undefined || String(value).trim() === '';
}

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
        filteredData = filteredData.filter(row => {
            for (const [columnIndex, filterState] of columnFilters.entries()) {
                if (!filterState || (filterState.operator !== 'isEmpty' && filterState.operator !== 'isNotEmpty' && isValueEmpty(filterState.value))) {
                    continue; // Ne pas filtrer si l'état est invalide ou si la valeur est vide (sauf pour is[Not]Empty)
                }

                const cellData = row[columnIndex];
                const columnDef = instance.options.columns[columnIndex];
                const filterValue = filterState.value;
                const filterOperator = filterState.operator as TextFilterOperator | NumberFilterOperator | DateFilterOperator;
                let match = false;

                switch (columnDef.filterType) {
                    case 'text':
                        const textOp = filterOperator as TextFilterOperator;
                        const cellString = String(cellData);
                        
                        if (textOp === 'isEmpty') {
                            match = isValueEmpty(cellData);
                        } else if (textOp === 'isNotEmpty') {
                            match = !isValueEmpty(cellData);
                        } else {
                            const filterValueString = String(filterValue).toLowerCase();
                            const cellStringLower = cellString.toLowerCase();
                            switch (textOp) {
                                case 'equals': match = cellStringLower === filterValueString; break;
                                case 'startsWith': match = cellStringLower.startsWith(filterValueString); break;
                                case 'endsWith': match = cellStringLower.endsWith(filterValueString); break;
                                case 'notContains': match = !cellStringLower.includes(filterValueString); break;
                                case 'contains': 
                                default: match = cellStringLower.includes(filterValueString); break;
                            }
                        }
                        break;

                    case 'number':
                        const numOp = filterOperator as NumberFilterOperator;
                        const cellValueNum = !isValueEmpty(cellData) ? parseFloat(String(cellData)) : null;
                        
                        if (numOp === 'isEmpty') {
                            match = cellValueNum === null || isNaN(cellValueNum);
                        } else if (numOp === 'isNotEmpty') {
                            match = cellValueNum !== null && !isNaN(cellValueNum);
                        } else if (cellValueNum !== null && !isNaN(cellValueNum)) { // Procéder seulement si la cellule est un nombre valide
                            if (numOp === 'between') {
                                if (typeof filterValue === 'object' && filterValue !== null && 'from' in filterValue && 'to' in filterValue) {
                                    const from = filterValue.from as number;
                                    const to = filterValue.to as number;
                                    match = cellValueNum >= from && cellValueNum <= to;
                                }
                            } else {
                                const filterValueNum = parseFloat(String(filterValue));
                                if (!isNaN(filterValueNum)) {
                                    switch (numOp) {
                                        case 'equals': match = cellValueNum === filterValueNum; break;
                                        case 'notEquals': match = cellValueNum !== filterValueNum; break;
                                        case 'greaterThan': match = cellValueNum > filterValueNum; break;
                                        case 'lessThan': match = cellValueNum < filterValueNum; break;
                                        case 'greaterThanOrEqual': match = cellValueNum >= filterValueNum; break;
                                        case 'lessThanOrEqual': match = cellValueNum <= filterValueNum; break;
                                    }
                                }
                            }
                        }
                        break;

                    case 'date':
                        const dateOp = filterOperator as DateFilterOperator;
                        let cellValueDate: Date | null = null;
                        if (!isValueEmpty(cellData)) {
                            const parsedDate = new Date(String(cellData));
                            if (!isNaN(parsedDate.getTime())) {
                                parsedDate.setHours(0, 0, 0, 0);
                                cellValueDate = parsedDate;
                            }
                        }

                        if (dateOp === 'isEmpty') {
                            match = cellValueDate === null;
                        } else if (dateOp === 'isNotEmpty') {
                            match = cellValueDate !== null;
                        } else if (cellValueDate !== null) {
                            if (dateOp === 'between') {
                                if (typeof filterValue === 'object' && filterValue !== null && 'from' in filterValue && 'to' in filterValue) {
                                    const fromDate = new Date(String(filterValue.from));
                                    const toDate = new Date(String(filterValue.to));
                                    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
                                        fromDate.setHours(0, 0, 0, 0);
                                        toDate.setHours(0, 0, 0, 0);
                                        match = cellValueDate.getTime() >= fromDate.getTime() && cellValueDate.getTime() <= toDate.getTime();
                                    }
                                }
                            } else {
                                const filterValueDate = new Date(String(filterValue));
                                if (!isNaN(filterValueDate.getTime())) {
                                    filterValueDate.setHours(0, 0, 0, 0);
                                    const cellTime = cellValueDate.getTime();
                                    const filterTime = filterValueDate.getTime();
                                    switch (dateOp) {
                                        case 'equals': match = cellTime === filterTime; break;
                                        case 'notEquals': match = cellTime !== filterTime; break;
                                        case 'after': match = cellTime > filterTime; break;
                                        case 'before': match = cellTime < filterTime; break;
                                        case 'afterOrEqual': match = cellTime >= filterTime; break;
                                        case 'beforeOrEqual': match = cellTime <= filterTime; break;
                                    }
                                }
                            }
                        }
                        break;

                    case 'select':
                        const cellDataString = String(cellData).trim().toLowerCase();
                        const selectValueString = String(filterValue).toLowerCase();
                        match = cellDataString === selectValueString;
                        break;
                    default:
                        match = true;
                        break;
                }

                if (!match) {
                    return false;
                }
            }
            return true;
        });
    }

    return filteredData;
}
