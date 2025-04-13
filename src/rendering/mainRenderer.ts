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
 * Clears the existing content and re-renders the entire table structure.
 * @param instance The DataTable instance.
 */
export function render(instance: DataTable): void {
    const state = instance.stateManager;

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

    // --- NOUVEAU: Barre d'indicateurs de filtres actifs ---
    const activeFiltersContainer = document.createElement('div');
    activeFiltersContainer.id = `${instance.element.id}-active-filters`;
    activeFiltersContainer.className = 'mb-3 flex flex-wrap items-center'; // flex-wrap pour gérer plusieurs badges
    activeFiltersContainer.style.display = 'none'; // Caché par défaut
    mainContainer.appendChild(activeFiltersContainer);

    // --- Barre d'outils supérieure (Recherche, Export, Effacer Filtres, etc.) ---
    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'mb-4 flex justify-between items-center flex-wrap gap-2'; // flex-wrap + gap pour petits écrans

    // Conteneur pour Recherche (gauche)
    const leftToolbar = document.createElement('div');
    leftToolbar.className = 'flex-grow'; // Prend l'espace disponible
    let searchElement: HTMLElement | null = null;
    if (instance.options.searching?.enabled) {
        searchElement = renderSearchInput(instance); // renderSearchInput accèdera à l'état via l'instance
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
        // Utiliser stateManager pour vérifier l'état des filtres
        clearFiltersButton.disabled = !state.getFilterTerm() && state.getColumnFilters().size === 0;
        clearFiltersButton.addEventListener('click', () => instance.clearAllFilters());
        rightToolbar.appendChild(clearFiltersButton);
    }

    // --- Bouton d'Export avec Dropdown --- 
    // Vérifier si exporting est activé et a au moins une option valide
    const exportOptions = instance.options.exporting;
    const csvEnabled = exportOptions?.csv === true || (typeof exportOptions?.csv === 'object' && exportOptions.csv.enabled !== false);
    const excelEnabled = exportOptions?.excel === true || (typeof exportOptions?.excel === 'object' && exportOptions.excel.enabled !== false);
    const pdfEnabled = exportOptions?.pdf === true || (typeof exportOptions?.pdf === 'object' && exportOptions.pdf.enabled !== false);
    
    if (csvEnabled || excelEnabled || pdfEnabled) { // Afficher le bouton seulement si au moins un export est actif
        const exportDropdownContainer = document.createElement('div');
        exportDropdownContainer.className = 'relative inline-block text-left';

        // Bouton principal
        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.id = `${instance.element.id}-export-button`;
        exportButton.textContent = 'Exporter'; 
        exportButton.innerHTML += ' <svg class="inline-block w-4 h-4 ml-1 -mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';
        exportButton.className = 'inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
        exportButton.setAttribute('aria-haspopup', 'true');
        exportButton.setAttribute('aria-expanded', 'false');

        // Menu Dropdown
        const exportDropdownMenu = document.createElement('div');
        exportDropdownMenu.id = `${instance.element.id}-export-menu`;
        exportDropdownMenu.className = 'origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none hidden z-20';
        exportDropdownMenu.setAttribute('role', 'menu');
        exportDropdownMenu.setAttribute('aria-orientation', 'vertical');
        exportDropdownMenu.setAttribute('aria-labelledby', exportButton.id);

        // Helper createMenuItem (inchangé)
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

        // *** Ajouter les options conditionnellement ***
        if (csvEnabled) {
            exportDropdownMenu.appendChild(createMenuItem('Exporter CSV', () => exportToCSV(instance)));
        }
        if (excelEnabled) {
            exportDropdownMenu.appendChild(createMenuItem('Exporter Excel (.xlsx)', () => exportToExcel(instance)));
        }
        if (pdfEnabled) {
            exportDropdownMenu.appendChild(createMenuItem('Exporter PDF', () => exportToPDF(instance)));
        }
        
        // Logique open/close et clic extérieur (inchangée)
        exportButton.addEventListener('click', () => {
            const isHidden = exportDropdownMenu.classList.toggle('hidden');
            exportButton.setAttribute('aria-expanded', String(!isHidden));
        });

        // Fermer si clic extérieur
        const handleOutsideExportClick = (event: MouseEvent) => {
            if (!exportDropdownContainer.contains(event.target as Node)) {
                exportDropdownMenu.classList.add('hidden');
                exportButton.setAttribute('aria-expanded', 'false');
                document.removeEventListener('click', handleOutsideExportClick, true);
            }
        };

        exportButton.addEventListener('click', (e) => {
            // Si on ouvre le menu, ajouter l'écouteur extérieur
            if (!exportDropdownMenu.classList.contains('hidden')) {
                 // Utiliser setTimeout pour s'assurer que l'écouteur est ajouté *après* le cycle d'événement actuel
                 setTimeout(() => { document.addEventListener('click', handleOutsideExportClick, true); }, 0);
            } else {
                // Si on ferme, on le retire (géré aussi dans handleOutsideExportClick)
                document.removeEventListener('click', handleOutsideExportClick, true);
            }
        });
        
        exportDropdownContainer.appendChild(exportButton);
        exportDropdownContainer.appendChild(exportDropdownMenu);
        rightToolbar.appendChild(exportDropdownContainer); 
    }

    // Ajouter le conteneur droit seulement s'il a des boutons
    if (rightToolbar.hasChildNodes()) {
        toolbarContainer.appendChild(rightToolbar);
    }

    // Ajouter le conteneur de la barre d'outils seulement s'il contient quelque chose
    if (leftToolbar.hasChildNodes() || rightToolbar.hasChildNodes()) {
        mainContainer.appendChild(toolbarContainer);
    }

    // 2. Data Preparation
    let dataForPagination: any[][];
    let currentTotalRows: number;
    let finalDataToDisplay: any[][];

    if (state.getIsServerSide()) {
        // En mode serveur, les données sont déjà paginées/triées/filtrées par le serveur
        dataForPagination = state.getDisplayedData(); // Le serveur a renvoyé les données de la page actuelle
        currentTotalRows = state.getTotalRows(); // Le serveur a renvoyé le total filtré
        finalDataToDisplay = dataForPagination; // On affiche directement ce qu'on a reçu
        console.log(`[Render - ServerSide] Using data as received. totalRows=${currentTotalRows}, receivedRows=${finalDataToDisplay.length}`);
    } else {
        // En mode client, on applique tout:
        const originalClientData = state.getOriginalData();
        const filteredData = applyFilters(instance, originalClientData);
        const sortedData = sortDataIfEnabled(instance, filteredData);
        
        // Mettre à jour les données "visibles" après tri/filtre dans l'état
        // state.setDisplayedData(sortedData); // <- On ne le fait plus ici, car on va paginer ensuite
        
        // Nombre total de lignes après filtrage/tri (pour la pagination)
        currentTotalRows = sortedData.length; 
        dataForPagination = sortedData; // Utiliser les données triées/filtrées pour la pagination
        
        // Log avant pagination
        const rppBeforePaging = state.getRowsPerPage();
        const cpBeforePaging = state.getCurrentPage();
        console.log(`[Render - ClientSide] Before pagination: rowsPerPage=${rppBeforePaging}, currentPage=${cpBeforePaging}, totalFilteredRows=${currentTotalRows}`);
        
        // Appliquer la pagination sur les données filtrées/triées
        finalDataToDisplay = getCurrentPageData(instance, dataForPagination);
        console.log(`[Render - ClientSide] After pagination: displaying ${finalDataToDisplay.length} rows`);
    }

    // 3. Render Table Structure
    const tableContainer = document.createElement('div');
    tableContainer.className = 'shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg';

    const table = document.createElement('table');
    table.className = 'min-w-full border-collapse';
    table.style.width = '100%';
    table.setAttribute('role', 'grid');

    // --- NOUVEAU: Mettre à jour les indicateurs de filtres AVANT le rendu du corps ---
    renderActiveFilters(instance, activeFiltersContainer);

    // 4. Render Header & Body
    renderHeader(instance, table);
    renderStandardBody(instance, table, finalDataToDisplay);
    updateSelectAllCheckboxState(instance);

    tableContainer.appendChild(table);
    mainContainer.appendChild(tableContainer);
    instance.element.appendChild(mainContainer);

    // 5. Render Pagination Controls
    // Afficher la pagination si elle est activée dans les options
    const shouldRenderPagination = instance.options.pagination?.enabled;
    
    // Supprimer les anciens contrôles au cas où ils ne devraient plus être affichés
    const existingPaginationControls = instance.element.querySelector('#dt-pagination-controls');
    if (existingPaginationControls) {
        existingPaginationControls.remove();
    }

    // Afficher les contrôles si pagination activée (la fonction interne gère les états désactivés)
    if (shouldRenderPagination) {
        renderPaginationControls(instance, currentTotalRows); 
    }

    // 6. Dispatch Render Complete Event
    dispatchEvent(instance, 'renderComplete');

    // 7. S'assurer que l'overlay est le dernier élément (pour le z-index)
    if (existingOverlay) {
        instance.element.appendChild(existingOverlay);
    }

    // --- Restauration du focus ---
    const elementIdToFocus = instance.focusedElementId;
    if (elementIdToFocus) {
        const elementToFocus = instance.element.querySelector(`#${elementIdToFocus}`) as HTMLElement;
        if (elementToFocus) {
            requestAnimationFrame(() => {
                elementToFocus.focus();
                if (elementToFocus instanceof HTMLInputElement && elementToFocus.type === 'text') {
                    elementToFocus.setSelectionRange(elementToFocus.value.length, elementToFocus.value.length);
                }
            });
        }
        instance.focusedElementId = null; // Réinitialiser après tentative
    }
} 