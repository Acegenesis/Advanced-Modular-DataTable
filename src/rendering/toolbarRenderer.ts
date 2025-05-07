import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { exportToCSV, exportToExcelJS, exportToPDFJS } from "../features/exporting";

// Variable globale pour le dropdown d'export
let exportDropdown: HTMLElement | null = null;
let exportButtonRef: HTMLElement | null = null; // Référence au bouton qui ouvre le dropdown
let exportArrowIconRef: SVGSVGElement | null = null; // <-- Référence à l'icône pour l'animation

function closeExportDropdown() {
    if (exportDropdown) {
        // Ajouter les classes pour l'animation de sortie
        exportDropdown.classList.remove('opacity-100', 'scale-100');
        exportDropdown.classList.add('opacity-0', 'scale-95');
        
        // Retirer la classe de rotation de l'icône
        if (exportArrowIconRef) {
            exportArrowIconRef.classList.remove('rotate-180');
            exportArrowIconRef = null;
        }
        
        // Supprimer l'élément APRÈS l'animation
        setTimeout(() => {
            if (exportDropdown) { // Revérifier au cas où il a été fermé entre-temps
                exportDropdown.remove();
                exportDropdown = null; 
                exportButtonRef = null;
            }
        }, 150); // Doit correspondre à la durée de l'animation de sortie

        document.removeEventListener('click', handleOutsideExportClick, true);
    }
}

function handleOutsideExportClick(event: MouseEvent) {
    if (exportDropdown && exportButtonRef && !exportButtonRef.contains(event.target as Node) && !exportDropdown.contains(event.target as Node)) {
        closeExportDropdown();
    }
}

// Fonction helper pour créer une icône SVG simple
function createExportIcon(type: 'csv' | 'excel' | 'pdf'): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mr-3 h-5 w-5 text-gray-400 group-hover:text-indigo-500 dark:text-gray-500 dark:group-hover:text-indigo-400'); // Style icône
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'currentColor');
    let pathData = '';
    switch (type) {
        case 'csv':
        case 'excel': // Utiliser la même pour Excel simplifié
            pathData = 'M10 3.75a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-3.5v3.5a.75.75 0 01-1.5 0v-3.5h-3.5a.75.75 0 010-1.5h3.5v-3.5a.75.75 0 01.75-.75zM14 10a4 4 0 11-8 0 4 4 0 018 0z'; // Simple placeholder icon (adjust as needed)
            break;
        case 'pdf':
            pathData = 'M3 17.25V2.75A2.75 2.75 0 015.75 0h8.5A2.75 2.75 0 0117 2.75v14.5a.75.75 0 01-1.5 0V2.75a1.25 1.25 0 00-1.25-1.25h-8.5A1.25 1.25 0 004.5 2.75v14.5a.75.75 0 01-1.5 0zM6.25 14a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zM6.25 11a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75zM6.25 8a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75z'; // Placeholder document icon
            break;
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
}

/**
 * Crée et retourne l'élément conteneur de la barre d'outils (.dt-toolbar-container).
 * Ajoute la barre de recherche si l'option est activée.
 * @param instance L'instance DataTable.
 * @returns L'élément HTMLElement de la barre d'outils, ou null si aucune option n'est activée.
 */
export function renderToolbar(instance: DataTable): HTMLElement | null {
    const options = instance.options;
    const searchingEnabled = options.searching?.enabled ?? false;
    const exportOptions = options.exporting ?? {};
    const csvEnabled = exportOptions.csv === true;
    const excelEnabled = exportOptions.excel === true;
    const pdfEnabled = exportOptions.pdf === true;
    const enabledFormats = [ 
        csvEnabled ? 'csv' : null,
        excelEnabled ? 'excel' : null,
        pdfEnabled ? 'pdf' : null
    ].filter(f => f !== null) as ('csv' | 'excel' | 'pdf')[]; // Filtrer les formats actifs
    
    const exportingEnabled = enabledFormats.length > 0;

    // Si aucune fonctionnalité de la toolbar n'est activée, ne rien rendre.
    if (!searchingEnabled && !exportingEnabled) {
        return null;
    }

    const toolbarContainer = document.createElement('div');
    toolbarContainer.className = 'dt-toolbar-container mb-4 flex flex-col md:flex-row justify-between items-center flex-wrap gap-4';

    // --- Barre de Recherche Globale ---
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'flex-grow w-full md:w-auto';
    if (searchingEnabled) {
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Rechercher...';
        searchInput.className = 'dt-global-search-input block w-full md:w-80 lg:w-96 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500';
        searchInput.id = `${instance.el.id}-global-search`;
        searchInput.setAttribute('role', 'searchbox');
        searchInput.setAttribute('aria-controls', `${instance.el.id}-tbody`);
        searchInput.value = instance.state.getFilterTerm();

        const debounceTime = options.searching?.debounceTime ?? 300;
        let debounceTimeout: number | null = null;

        searchInput.addEventListener('input', (event) => {
            console.log(`[GlobalSearch] Input event triggered for term: "${(event.target as HTMLInputElement).value}"`);
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            debounceTimeout = window.setTimeout(() => {
                const searchTerm = (event.target as HTMLInputElement).value;
                console.log(`[GlobalSearch] Debounced search term: "${searchTerm}"`);
                try {
                    instance.state.setFilterTerm(searchTerm);
                    console.log(`[GlobalSearch] State filter term set to: "${instance.state.getFilterTerm()}"`);
                    instance.goToPage(1);
                    console.log(`[GlobalSearch] goToPage(1) called.`);
                    dispatchEvent(instance, 'search', { searchTerm });
                } catch (error) {
                    console.error("[GlobalSearch] Error during debounced update:", error);
                }
            }, debounceTime);
        });
        
        searchWrapper.appendChild(searchInput);
    }

    toolbarContainer.appendChild(searchWrapper);

    // --- Autres éléments (droite) ---
    const rightToolbarWrapper = document.createElement('div');
    rightToolbarWrapper.className = 'flex items-center flex-shrink-0 gap-2 md:gap-3';

    const clearFiltersButton = document.createElement('button');
    clearFiltersButton.textContent = 'Effacer Filtres';
    clearFiltersButton.className = 'dt-clear-filters-btn px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-500 dark:border-gray-500 dark:text-gray-200 dark:focus:ring-offset-gray-800 dark:disabled:opacity-40';
    clearFiltersButton.disabled = true;
    clearFiltersButton.addEventListener('click', () => instance.clearAllFilters());
    instance.el.addEventListener('dt:filterChange', () => {
        const hasActiveFilters = instance.state.getFilterTerm() !== '' || instance.state.getColumnFilters().size > 0;
        clearFiltersButton.disabled = !hasActiveFilters;
    });
    const hasInitialFilters = instance.state.getFilterTerm() !== '' || instance.state.getColumnFilters().size > 0;
    clearFiltersButton.disabled = !hasInitialFilters;
    rightToolbarWrapper.appendChild(clearFiltersButton);

    // *** Bouton Exporter (avec dropdown stylisé) ***
    if (exportingEnabled) {
        const exportButton = document.createElement('button');
        exportButton.className = 'dt-export-btn relative inline-flex items-center justify-center rounded-md border border-gray-300 shadow-sm px-3 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-600 dark:hover:bg-gray-500 dark:border-gray-500 dark:text-gray-200 dark:focus:ring-offset-gray-800';
        
        // Conteneur Flex pour texte + icône
        const buttonContent = document.createElement('span');
        buttonContent.className = 'inline-flex items-center';

        const textSpan = document.createElement('span');
        textSpan.textContent = 'Exporter';
        buttonContent.appendChild(textSpan);

        // Ajouter l'icône dropdown
        const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgIcon.setAttribute('class', 'ml-1.5 h-4 w-4 text-gray-500 transition-transform duration-200 ease-in-out dark:text-gray-400');
        svgIcon.setAttribute('aria-hidden', 'true');

        if (instance.spriteAvailable.dropdown) {
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            const iconId = instance.options.icons?.dropdown || 'icon-dropdown';
            use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${iconId}`);
            svgIcon.appendChild(use);
        } else {
            // Fallback SVG inline (chevron-down)
            svgIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgIcon.setAttribute('viewBox', '0 0 20 20');
            svgIcon.setAttribute('fill', 'currentColor');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('fill-rule', 'evenodd');
            path.setAttribute('d', 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z');
            path.setAttribute('clip-rule', 'evenodd');
            svgIcon.appendChild(path);
        }
        buttonContent.appendChild(svgIcon);
        exportButton.appendChild(buttonContent);

        // *** Listener pour ouvrir/fermer dropdown (version correcte restaurée) ***
        exportButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            if (exportDropdown) {
                closeExportDropdown(); 
                return;
            }
            
            const newDropdown = document.createElement('div'); 
            // Classes dark mode et animation appliquées ici
            newDropdown.className = 'absolute z-30 mt-2 min-w-max origin-top-right rounded-md shadow-xl bg-white ring-1 ring-black ring-opacity-5 focus:outline-none py-1.5 transform opacity-0 scale-95 transition ease-out duration-100 dark:bg-gray-700 dark:ring-gray-600';
            exportDropdown = newDropdown;
            exportButtonRef = exportButton;
            exportArrowIconRef = svgIcon;

            svgIcon.classList.add('rotate-180'); 

            enabledFormats.forEach(format => {
                const itemButton = document.createElement('button');
                // Classes dark mode appliquées ici
                itemButton.className = 'group flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700 focus:outline-none rounded-md transition-colors duration-150 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:bg-gray-600 dark:hover:text-white dark:focus:text-white';
                
                const itemIcon = createExportIcon(format); // Classes dark mode déjà dans createExportIcon
                itemButton.appendChild(itemIcon);
                
                const itemText = document.createElement('span');
                itemText.textContent = 
                    format === 'csv' ? 'Exporter en CSV' :
                    format === 'excel' ? 'Exporter en Excel' :
                    format === 'pdf' ? 'Exporter en PDF' : 'Format inconnu';
                itemButton.appendChild(itemText);
                    
                itemButton.addEventListener('click', () => {
                     console.log(`[Export] Dropdown export to ${format}`);
                     if (format === 'csv') exportToCSV(instance);
                     else if (format === 'excel') exportToExcelJS(instance);
                     else if (format === 'pdf') exportToPDFJS(instance);
                     closeExportDropdown(); 
                });
                newDropdown.appendChild(itemButton);
            });
            
            // Positionnement et ajout au body
            const rect = exportButton.getBoundingClientRect();
            let leftPosition = rect.right + window.scrollX - newDropdown.offsetWidth; 
            const topPosition = rect.bottom + window.scrollY + 2; 
            // Mesurer APRES avoir ajouté le contenu mais AVANT d'ajouter au body principal
            // Pour une mesure plus fiable, on pourrait l'ajouter caché, mesurer, puis positionner et afficher
            // Ajout temporaire pour mesure
            newDropdown.style.visibility = 'hidden';
            document.body.appendChild(newDropdown);
            const dropdownWidth = newDropdown.offsetWidth;
            document.body.removeChild(newDropdown); // Retirer avant ajout final
            
            leftPosition = rect.right + window.scrollX - dropdownWidth; // Recalculer left avec la vraie largeur
            if (leftPosition < 0) { leftPosition = 5; }

            newDropdown.style.left = `${leftPosition}px`;
            newDropdown.style.top = `${topPosition}px`;
            newDropdown.style.visibility = 'visible'; // Rendre visible après positionnement
            document.body.appendChild(newDropdown); // Ajout final

            // Animation d'entrée
            requestAnimationFrame(() => { 
                 if (exportDropdown) { 
                    exportDropdown.classList.remove('opacity-0', 'scale-95');
                    exportDropdown.classList.add('opacity-100', 'scale-100');
                 }
            });
            
            setTimeout(() => document.addEventListener('click', handleOutsideExportClick, true), 0);
        });
        
        rightToolbarWrapper.appendChild(exportButton);
    }

    // Ajouter rightToolbarWrapper seulement s'il contient des éléments
    if (rightToolbarWrapper.hasChildNodes()) {
        toolbarContainer.appendChild(rightToolbarWrapper);
    }

    return toolbarContainer;
} 