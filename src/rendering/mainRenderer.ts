import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { renderSearchInput, applyFilters } from "../features/filtering";
import { sortDataIfEnabled } from "../features/sorting";
import { renderPaginationControls, getCurrentPageData } from "../features/pagination";
import { updateSelectAllCheckboxState } from "../features/selection";
import { renderHeader } from "./headerRenderer";
import { renderStandardBody } from "./bodyRenderer";
import { exportToCSV, exportToExcel, exportToPDF } from "../features/exporting";
import { ColumnDefinition, ColumnFilterState } from "../core/types";

// --- Helper pour formater la valeur d'un filtre pour affichage ---
function formatFilterValueForDisplay(value: any, columnDef?: ColumnDefinition): string {
    if (Array.isArray(value)) {
        return `[${value.map(v => `"${v}"`).join(', ')}]`; // Ex: ["Alice", "Bob"]
    } else if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
        return `${formatFilterValueForDisplay(value.from)} - ${formatFilterValueForDisplay(value.to)}`; // Ex: 100 - 500
    } else if (columnDef?.type === 'date' && value) {
        // Essayer de formater la date (simple pour l'instant)
        try {
            return new Date(String(value)).toLocaleDateString();
        } catch { return String(value); }
    } else if (columnDef?.type === 'money' && typeof value === 'number') {
        try {
            return value.toLocaleString(columnDef.locale || undefined, { style: 'currency', currency: columnDef.currency || 'USD' });
        } catch { return String(value); }
    }
    // Pour les autres cas (string, number simple)
    return String(value);
}

// --- Fonction pour rendre les indicateurs de filtres actifs ---
function renderActiveFilters(instance: DataTable, container: HTMLElement): void {
    const state = instance.stateManager;
    container.innerHTML = '';
    let hasActiveFilters = false;

    // 1. Filtre global
    const globalFilterTerm = state.getFilterTerm();
    if (globalFilterTerm) {
        hasActiveFilters = true;
        const badge = createFilterBadge(
            `Recherche: "${globalFilterTerm}"`,
            () => { 
                instance.stateManager.setFilterTerm('');
                instance.render();
            } 
        );
        container.appendChild(badge);
    }

    // 2. Filtres de colonne
    const columnFilters = state.getColumnFilters();
    columnFilters.forEach((filterState, columnIndex) => {
        if (filterState && filterState.value !== null && filterState.value !== undefined) {
            hasActiveFilters = true;
            const columnDef = instance.options.columns[columnIndex];
            const operator = filterState.operator || 'équivaut à';
            const displayValue = formatFilterValueForDisplay(filterState.value, columnDef);
            let operatorText = `${operator}`;
            if(filterState.operator === 'in') operatorText = 'est dans';
            if(filterState.operator === 'isEmpty') operatorText = 'est vide';
            if(filterState.operator === 'isNotEmpty') operatorText = 'n\'est pas vide';
            const text = `${columnDef.title} ${operatorText}${filterState.operator !== 'isEmpty' && filterState.operator !== 'isNotEmpty' ? `: ${displayValue}` : ''}`;

            const badge = createFilterBadge(
                text,
                () => {
                    instance.stateManager.setColumnFilter(columnIndex, null);
                    instance.render();
                }
            );
            container.appendChild(badge);
        }
    });

    container.style.display = hasActiveFilters ? 'flex' : 'none';
}

// --- Helper pour créer un badge de filtre ---
function createFilterBadge(text: string, onRemove: () => void): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'inline-flex items-center bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2 mb-2';

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    badge.appendChild(textSpan);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-gray-500 hover:bg-gray-300 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400';
    removeButton.innerHTML = '&times;'; // caractère 'x'
    removeButton.setAttribute('aria-label', `Supprimer le filtre: ${text}`);
    removeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove();
    });
    badge.appendChild(removeButton);

    return badge;
}

// --- Main Rendering Orchestration ---

/**
 * Main rendering function for the DataTable.
 * Updates the existing table structure if possible, otherwise creates it.
 * @param instance The DataTable instance.
 */
export function render(instance: DataTable): void {
    const state = instance.stateManager;
    console.log('[Render START]');

    const existingTable = instance.element.querySelector('table') as HTMLTableElement | null;
    const existingMainContainer = instance.element.querySelector('.dt-main-container') as HTMLElement | null;
    const existingToolbarContainer = instance.element.querySelector('.dt-toolbar-container') as HTMLElement | null;
    const existingTableContainer = instance.element.querySelector('.dt-table-container') as HTMLElement | null;
    const existingPaginationContainer = instance.element.querySelector('.dt-pagination-container') as HTMLElement | null;
    const existingActiveFiltersContainer = instance.element.querySelector(`#${instance.element.id}-active-filters`) as HTMLElement | null;
    const existingOverlay = instance.element.querySelector('.dt-loading-overlay') as HTMLElement | null;

    // 1. Data Preparation (fait avant le rendu DOM, que ce soit création ou mise à jour)
    let dataForBodyRender: any[][];
    let currentTotalRowsForPagination: number;

    if (state.getIsServerSide()) {
        dataForBodyRender = state.getDisplayedData(); 
        currentTotalRowsForPagination = state.getTotalRows(); 
        console.log(`[Render - ServerSide] Data prepared. totalRows=${currentTotalRowsForPagination}, rowsForPage=${dataForBodyRender.length}`);
    } else {
        const originalClientData = state.getOriginalData();
        const filteredData = applyFilters(instance, originalClientData);
        const sortedData = sortDataIfEnabled(instance, filteredData);
        currentTotalRowsForPagination = sortedData.length;
        dataForBodyRender = getCurrentPageData(instance, sortedData);
        console.log(`[Render - ClientSide] Data prepared. totalFilteredRows=${currentTotalRowsForPagination}, displaying ${dataForBodyRender.length} rows`);
    }

    // --- UPDATE MODE --- 
    if (existingTable && existingMainContainer && existingToolbarContainer && existingTableContainer && existingPaginationContainer && existingActiveFiltersContainer) {
        console.log('[Render] Updating existing elements...');
        
        // Update Header (maintenant, ça peut vraiment faire une mise à jour)
        renderHeader(instance, existingTable);
        
        // Update Body (suppose que renderBody vide et remplit le tbody existant)
        renderStandardBody(instance, existingTable, dataForBodyRender); 

        // Update Toolbar (ex: état disabled du bouton "Effacer Filtres")
        const clearFiltersButton = existingToolbarContainer.querySelector('button.dt-clear-filters-btn') as HTMLButtonElement | null;
        if (clearFiltersButton) {
            clearFiltersButton.disabled = !state.getFilterTerm() && state.getColumnFilters().size === 0;
        }
        // Mettre à jour d'autres éléments de la barre d'outils si nécessaire...

        // Update Active Filters Display
        renderActiveFilters(instance, existingActiveFiltersContainer);

        // Update Pagination
        renderPaginationControls(instance, currentTotalRowsForPagination, existingPaginationContainer!); 

        console.log('[Render UPDATE finished]');
        dispatchEvent(instance, 'dt:renderComplete', { mode: 'update' });
        return; // Fin du mode mise à jour
    }

    // --- CREATION MODE --- 
    console.log('[Render] Creating new elements...');
    
    Array.from(instance.element.children).forEach(child => {
        if (!child.classList.contains('dt-loading-overlay')) {
            instance.element.removeChild(child);
        }
    });

    const mainContainer = document.createElement('div');
    mainContainer.className = 'dt-main-container';

    // Active Filters Container
    const activeFiltersContainer = document.createElement('div');
    activeFiltersContainer.id = `${instance.element.id}-active-filters`;
    activeFiltersContainer.className = 'mb-3 flex flex-wrap items-center';
    renderActiveFilters(instance, activeFiltersContainer);
    mainContainer.appendChild(activeFiltersContainer);

    // Toolbar Container
    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'dt-toolbar-container mb-4 flex justify-between items-center flex-wrap gap-2';
    const leftToolbar = document.createElement('div');
    leftToolbar.className = 'flex-grow';
    if (instance.options.searching?.enabled) {
        leftToolbar.appendChild(renderSearchInput(instance));
    }
    toolbarContainer.appendChild(leftToolbar);
    const rightToolbar = document.createElement('div');
    rightToolbar.className = 'flex items-center flex-shrink-0 gap-2';
    if (instance.options.columnFiltering?.showClearButton) {
        const clearFiltersButton = document.createElement('button');
        clearFiltersButton.textContent = 'Effacer Filtres';
        clearFiltersButton.className = 'dt-clear-filters-btn px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50';
        clearFiltersButton.disabled = !state.getFilterTerm() && state.getColumnFilters().size === 0;
        clearFiltersButton.addEventListener('click', () => instance.clearAllFilters());
        rightToolbar.appendChild(clearFiltersButton);
    }
    // Export Dropdown (code inchangé, mais on l'ajoute à rightToolbar)
    const exportOptions = instance.options.exporting;
    const csvEnabled = exportOptions?.csv === true || (typeof exportOptions?.csv === 'object' && exportOptions.csv.enabled !== false);
    const excelEnabled = exportOptions?.excel === true || (typeof exportOptions?.excel === 'object' && exportOptions.excel.enabled !== false);
    const pdfEnabled = exportOptions?.pdf === true || (typeof exportOptions?.pdf === 'object' && exportOptions.pdf.enabled !== false);
    if (csvEnabled || excelEnabled || pdfEnabled) {
         // ... (code existant pour créer exportDropdownContainer) ...
        const exportDropdownContainer = document.createElement('div');
        exportDropdownContainer.className = 'relative inline-block text-left';
        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.id = `${instance.element.id}-export-button`;
        exportButton.textContent = 'Exporter'; 
        exportButton.innerHTML += ' <svg class="inline-block w-4 h-4 ml-1 -mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';
        exportButton.className = 'inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
        exportButton.setAttribute('aria-haspopup', 'true');
        exportButton.setAttribute('aria-expanded', 'false');
        const exportDropdownMenu = document.createElement('div');
        exportDropdownMenu.id = `${instance.element.id}-export-menu`;
        exportDropdownMenu.className = 'origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none hidden z-20';
        exportDropdownMenu.setAttribute('role', 'menu');
        exportDropdownMenu.setAttribute('aria-orientation', 'vertical');
        exportDropdownMenu.setAttribute('aria-labelledby', exportButton.id);
        const createMenuItem = (text: string, action: () => void): HTMLElement => {
            const menuItem = document.createElement('a');
            menuItem.href = '#';
            menuItem.textContent = text;
            menuItem.className = 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900';
            menuItem.setAttribute('role', 'menuitem');
            menuItem.addEventListener('click', (e) => {
                e.preventDefault();
                action();
                exportDropdownMenu.classList.add('hidden');
                exportButton.setAttribute('aria-expanded', 'false');
            });
            return menuItem;
        };
        if (csvEnabled) exportDropdownMenu.appendChild(createMenuItem('Exporter CSV', () => exportToCSV(instance)));
        if (excelEnabled) exportDropdownMenu.appendChild(createMenuItem('Exporter Excel (.xlsx)', () => exportToExcel(instance)));
        if (pdfEnabled) exportDropdownMenu.appendChild(createMenuItem('Exporter PDF', () => exportToPDF(instance)));
        const handleOutsideExportClick = (event: MouseEvent) => {
            if (!exportDropdownContainer.contains(event.target as Node)) {
                exportDropdownMenu.classList.add('hidden');
                exportButton.setAttribute('aria-expanded', 'false');
                document.removeEventListener('click', handleOutsideExportClick, true);
            }
        };
        exportButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = exportButton.getAttribute('aria-expanded') === 'true';
            exportDropdownMenu.classList.toggle('hidden', isExpanded);
            exportButton.setAttribute('aria-expanded', String(!isExpanded));
            if (!isExpanded) {
                setTimeout(() => { document.addEventListener('click', handleOutsideExportClick, true); }, 0);
            } else {
                document.removeEventListener('click', handleOutsideExportClick, true);
            }
        });
        exportDropdownContainer.appendChild(exportButton);
        exportDropdownContainer.appendChild(exportDropdownMenu);
        rightToolbar.appendChild(exportDropdownContainer); 
    }
    if (rightToolbar.hasChildNodes()) {
        toolbarContainer.appendChild(rightToolbar);
    }
    if (leftToolbar.hasChildNodes() || rightToolbar.hasChildNodes()) {
        mainContainer.appendChild(toolbarContainer);
    }

    // Table Container & Table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'dt-table-container shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg';
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    table.setAttribute('role', 'grid');

    // Render Header (mode création forcé ici car la table est nouvelle)
    renderHeader(instance, table);

    // Render Body
    renderStandardBody(instance, table, dataForBodyRender);

    tableContainer.appendChild(table);
    mainContainer.appendChild(tableContainer);

    // Créer le conteneur de pagination
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'dt-pagination-container bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-1';
    paginationContainer.setAttribute('role', 'navigation');
    paginationContainer.setAttribute('aria-label', 'Pagination');
    
    // CORRIGER L'APPEL ICI : Passer le nouveau paginationContainer
    renderPaginationControls(instance, currentTotalRowsForPagination, paginationContainer);
    
    mainContainer.appendChild(paginationContainer); // Ajouter le conteneur rempli au bon endroit

    instance.element.appendChild(mainContainer);
    
    // Re-append overlay if it existed
    if (existingOverlay) {
         instance.element.appendChild(existingOverlay);
    }

    console.log('[Render CREATE finished]');
    dispatchEvent(instance, 'dt:renderComplete', { mode: 'create' });
} 