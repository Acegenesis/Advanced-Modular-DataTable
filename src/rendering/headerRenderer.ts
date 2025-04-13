import { DataTable } from "../core/DataTable";
import { handleSortClick } from "../features/sorting";
import { handleSelectAllClick, updateSelectAllCheckboxState } from "../features/selection";
import { ColumnDefinition, ColumnFilterState, TextFilterOperator } from "../core/types";

// --- Popup Management ---
let activePopup: HTMLElement | null = null;

function closeActivePopup() {
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
        document.removeEventListener('click', handleOutsideClick, true);
    }
}

function handleOutsideClick(event: MouseEvent) {
    if (activePopup && !activePopup.contains(event.target as Node)) {
        // Vérifier si le clic n'est pas sur un bouton entonnoir pour éviter une fermeture/réouverture immédiate
        const targetElement = event.target as HTMLElement;
        if (!targetElement.closest('.dt-filter-operator-button')) {
            closeActivePopup();
        }
    }
}

/**
 * Crée et affiche la popup de filtre avancé pour une colonne texte.
 */
function createAdvancedTextFilterPopup(instance: DataTable, columnIndex: number, columnDef: ColumnDefinition, currentFilterState: ColumnFilterState | undefined, buttonElement: HTMLElement) {
    closeActivePopup();

    const popup = document.createElement('div');
    activePopup = popup;
    popup.className = 'absolute z-20 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg p-3 space-y-3';
    // Empêcher la fermeture si on clique dans la popup
    popup.addEventListener('click', (e) => e.stopPropagation());

    const operators = columnDef.filterOperators || ['contains', 'equals', 'startsWith', 'endsWith'];
    const currentOperator = currentFilterState?.operator || 'contains';
    const currentValue = (currentFilterState?.value as string) || ''; // Valeur actuelle pour pré-remplir

    // 1. Sélecteur d'opérateur
    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    operatorSelect.setAttribute('aria-label', 'Type de filtre');
    operators.forEach(op => {
        const option = document.createElement('option');
        option.value = op;
        const opTextMap: Record<TextFilterOperator, string> = {
            contains: 'Contient',
            notContains: 'Ne contient pas',
            equals: 'Égal à',
            startsWith: 'Commence par',
            endsWith: 'Finit par',
            isEmpty: 'Est vide',
            isNotEmpty: 'N\'est pas vide'
        };
        option.textContent = opTextMap[op] || op;
        option.selected = op === currentOperator;
        operatorSelect.appendChild(option);
    });
    popup.appendChild(operatorSelect);

    // 2. Champ de saisie de la valeur
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    valueInput.placeholder = 'Valeur...';
    valueInput.value = currentValue;
    valueInput.setAttribute('aria-label', 'Valeur du filtre');
    popup.appendChild(valueInput);

    // Fonction pour gérer la visibilité/état de l'input
    const updateValueInputState = (operator: TextFilterOperator) => {
        const requiresValue = operator !== 'isEmpty' && operator !== 'isNotEmpty';
        valueInput.disabled = !requiresValue;
        valueInput.style.display = requiresValue ? '' : 'none'; // Masquer si pas nécessaire
        if (!requiresValue) {
            valueInput.value = ''; // Effacer la valeur si pas nécessaire
        }
    };

    // Mettre à jour l'état initial
    updateValueInputState(currentOperator);

    // Mettre à jour lors du changement d'opérateur
    operatorSelect.addEventListener('change', () => {
        updateValueInputState(operatorSelect.value as TextFilterOperator);
    });

    // 3. Boutons d'action
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2 pt-2';

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Effacer';
    clearButton.className = 'px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500';
    clearButton.addEventListener('click', () => {
        instance.setColumnFilter(columnIndex, null); // Effacer le filtre
        closeActivePopup();
    });

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    applyButton.addEventListener('click', () => {
        const selectedOperator = operatorSelect.value as TextFilterOperator;
        // Lire la valeur seulement si nécessaire
        const enteredValue = (selectedOperator !== 'isEmpty' && selectedOperator !== 'isNotEmpty') ? valueInput.value : ''; 
        instance.setColumnFilter(columnIndex, { value: enteredValue || null, operator: selectedOperator });
        closeActivePopup();
    });

    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(applyButton);
    popup.appendChild(buttonContainer);

    // Positionnement
    const rect = buttonElement.getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 2}px`;

    document.body.appendChild(popup);

    // Donner le focus au champ de saisie dans la popup
    valueInput.focus();

    // Gestion clic extérieur
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick, true);
    }, 0);
}

// --- Header Rendering Logic ---

/**
 * Renders the table header (THEAD) including column filters.
 * @param instance The DataTable instance.
 * @param table The TABLE element.
 */
export function renderHeader(instance: DataTable, table: HTMLTableElement): void {
    const state = instance.stateManager; // Référence au stateManager
    let thead = table.tHead;
    if (thead) {
        table.removeChild(thead);
    }
    thead = table.createTHead();
    thead.className = 'bg-gray-50';
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.zIndex = '10';

    // --- Row 1: Titles, Sorting, AND Filters ---
    const headerRow = thead.insertRow();
    headerRow.setAttribute('role', 'row');

    // "Select All" Checkbox Column (if needed)
    if (state.getSelectionEnabled() && state.getSelectionMode() === 'multiple') {
        const thCheckbox = document.createElement('th');
        thCheckbox.scope = 'col';
        thCheckbox.setAttribute('role', 'columnheader');
        thCheckbox.className = 'px-4 py-3 text-center w-12 align-middle';
        thCheckbox.style.boxSizing = 'border-box';

        instance.selectAllCheckbox = document.createElement('input');
        instance.selectAllCheckbox.type = 'checkbox';
        instance.selectAllCheckbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
        updateSelectAllCheckboxState(instance);
        instance.selectAllCheckbox.setAttribute('aria-label', 'Sélectionner toutes les lignes visibles');

        instance.selectAllCheckbox.addEventListener('change', (event) => {
            handleSelectAllClick(instance, (event.target as HTMLInputElement).checked);
        });

        thCheckbox.appendChild(instance.selectAllCheckbox);
        headerRow.appendChild(thCheckbox);
    }

    // Data Columns Titles & Filters
    instance.options.columns.forEach((columnDef: ColumnDefinition, index: number) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.setAttribute('role', 'columnheader');
        th.className = 'px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis';
        th.style.boxSizing = 'border-box';

        if (columnDef.width) {
            th.style.width = columnDef.width;
        }

        // Conteneur principal pour titre et (tri + filtre)
        const cellContentContainer = document.createElement('div');
        cellContentContainer.className = 'flex items-center justify-between';

        // Conteneur pour titre (gauche)
        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = columnDef.title || '';
        titleContainer.appendChild(titleSpan);

        cellContentContainer.appendChild(titleContainer); // Ajouter le titre à gauche

        // Conteneur pour Tri et Filtre (droite)
        const sortFilterContainer = document.createElement('div');
        sortFilterContainer.className = 'flex items-center space-x-1'; // space-x-1 pour espacer tri et filtre

        // Sorting UI (indicateur seulement)
        const isSortable = instance.options.sorting?.enabled && columnDef.sortable !== false;
        if (isSortable) {
            // Configurer le TH pour le clic/focus
            th.classList.add('cursor-pointer', 'hover:bg-gray-100', 'transition-colors', 'duration-150');
            th.tabIndex = 0;
            th.setAttribute('aria-roledescription', 'sortable column header');
            th.addEventListener('click', (e) => {
                if (!(e.target as HTMLElement).closest('.dt-filter-control')) {
                    handleSortClick(instance, index);
                }
            });
            th.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSortClick(instance, index);
                }
            });

            // Définir les SVGs
            const svgUnsorted = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block text-gray-400 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 12L3 8m4 4l4-4m6 8v12m0-12l4 4m-4-4l-4 4" /></svg>`;
            const svgAsc = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>`;
            const svgDesc = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;

            let indicatorSvg = svgUnsorted;
            let ariaSortValue: "ascending" | "descending" | "none" = "none";

            // Utilisation de stateManager pour sortColumnIndex et sortDirection
            const currentSortIndex = state.getSortColumnIndex();
            const currentSortDirection = state.getSortDirection();

            if (currentSortIndex === index && currentSortDirection !== 'none') {
                indicatorSvg = currentSortDirection === 'asc' ? svgAsc : svgDesc;
                ariaSortValue = currentSortDirection === 'asc' ? 'ascending' : 'descending';
                th.classList.add('bg-gray-100');
            }
            th.setAttribute('aria-sort', ariaSortValue);

            // Créer le span pour l'indicateur
            const indicatorSpan = document.createElement('span');
            indicatorSpan.className = 'sort-indicator ml-1'; // Ajouter ml-1 pour espace
            indicatorSpan.setAttribute('aria-hidden', 'true');
            indicatorSpan.innerHTML = indicatorSvg;
            sortFilterContainer.appendChild(indicatorSpan); // Ajouter au conteneur droite
        }

        // Filtering UI (si activé globalement et pour cette colonne)
        const isGloballyFilterable = instance.options.columnFiltering?.enabled;
        const filterType = columnDef.filterType;
        if (isGloballyFilterable && filterType) {
            // Utilisation de stateManager pour récupérer l'état du filtre de colonne
            const currentFilter = state.getColumnFilters().get(index);
            const filterContainer = document.createElement('div');
            filterContainer.className = 'dt-filter-control'; // Classe pour empêcher le tri au clic

            switch (filterType) {
                case 'text':
                    // Bouton pour popup avancée
                    const filterButton = document.createElement('button');
                    filterButton.type = 'button';
                    filterButton.className = 'dt-filter-operator-button p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded';
                    // Utiliser un entonnoir plein si le filtre est actif
                    filterButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="${currentFilter ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${currentFilter ? 0 : 1.5}"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" /></svg>`;
                    filterButton.setAttribute('aria-label', `Options de filtre pour ${columnDef.title}`)
                    filterButton.setAttribute('aria-haspopup', 'true');
                    filterButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Empêcher le tri
                        createAdvancedTextFilterPopup(instance, index, columnDef, currentFilter, filterButton);
                    });
                    filterContainer.appendChild(filterButton);
                    break;

                case 'select':
                    const selectFilter = document.createElement('select');
                    selectFilter.className = 'ml-2 dt-column-filter-input w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-xs py-1'; // Adapté pour être petit
                    selectFilter.id = `${instance.element.id}-col-filter-${index}`;
                    selectFilter.setAttribute('aria-label', `Filtrer ${columnDef.title}`);
                    selectFilter.addEventListener('click', e => e.stopPropagation()); // Empêcher tri

                    // Option vide par défaut
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = columnDef.filterPlaceholder || 'Tout';
                    selectFilter.appendChild(defaultOption);

                    // Remplir les options
                    columnDef.filterOptions?.forEach(option => {
                        const opt = document.createElement('option');
                        if (typeof option === 'string') {
                            opt.value = option;
                            opt.textContent = option;
                        } else {
                            opt.value = String(option.value);
                            opt.textContent = option.label;
                        }
                        // Sélectionner l'option actuelle si un filtre est appliqué
                        if (currentFilter && String(currentFilter.value) === opt.value) {
                            opt.selected = true;
                        }
                        selectFilter.appendChild(opt);
                    });

                    selectFilter.addEventListener('change', (event) => {
                        const selectedValue = (event.target as HTMLSelectElement).value;
                        if (selectedValue) {
                            instance.setColumnFilter(index, { value: selectedValue, operator: 'equals' });
                        } else {
                            instance.setColumnFilter(index, null); // Effacer le filtre
                        }
                    });
                    filterContainer.appendChild(selectFilter);
                    break;

                // Ajouter d'autres types de filtres ici (range, date...)
            }
            sortFilterContainer.appendChild(filterContainer);
        }

        // Ajouter le conteneur droite (Tri + Filtre) s'il contient quelque chose
        if (sortFilterContainer.hasChildNodes()) {
            cellContentContainer.appendChild(sortFilterContainer);
        }

        th.appendChild(cellContentContainer);
        headerRow.appendChild(th);
    });

    // Action Column Header (if needed)
    if (instance.options.rowActions && instance.options.rowActions.length > 0) {
        const thActions = document.createElement('th');
        thActions.scope = 'col';
        thActions.className = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24'; // Largeur fixe?
        thActions.textContent = 'Actions';
        headerRow.appendChild(thActions);
    }
} 