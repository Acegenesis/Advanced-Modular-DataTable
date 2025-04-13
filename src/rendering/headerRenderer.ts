import { DataTable } from "../core/DataTable";
import { handleSortClick } from "../features/sorting";
import { handleSelectAllClick, updateSelectAllCheckboxState } from "../features/selection";
import { ColumnDefinition, ColumnFilterState, TextFilterOperator, NumberFilterOperator, DateFilterOperator } from "../core/types";

// Helper type pour accéder aux propriétés de l'objet ColumnFilterState non-null
type FilterStateObject = Exclude<ColumnFilterState, null>;

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
    popup.addEventListener('click', (e) => e.stopPropagation());

    // Assurer que seuls les opérateurs Text sont utilisés, et fournir des défauts corrects
    const defaultTextOperators: TextFilterOperator[] = ['contains', 'notContains', 'equals', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
    const operators = (columnDef.filterOperators as TextFilterOperator[])?.filter(op => defaultTextOperators.includes(op)) || defaultTextOperators;
    const currentOperator: TextFilterOperator = (currentFilterState?.operator as TextFilterOperator) || 'contains';
    const currentValue = (currentFilterState?.value as string) || '';

    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    operatorSelect.setAttribute('aria-label', 'Type de filtre');
    const opTextMap: Record<TextFilterOperator, string> = {
        contains: 'Contient',
        notContains: 'Ne contient pas',
        equals: 'Égal à',
        startsWith: 'Commence par',
        endsWith: 'Finit par',
        isEmpty: 'Est vide',
        isNotEmpty: 'N\'est pas vide'
    };
    operators.forEach(op => {
        const option = document.createElement('option');
        option.value = op;
        option.textContent = opTextMap[op] || op;
        option.selected = op === currentOperator;
        operatorSelect.appendChild(option);
    });
    popup.appendChild(operatorSelect);

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    valueInput.placeholder = 'Valeur...';
    valueInput.value = currentValue;
    valueInput.setAttribute('aria-label', 'Valeur du filtre');
    popup.appendChild(valueInput);

    const updateValueInputState = (operator: TextFilterOperator) => {
        const requiresValue = operator !== 'isEmpty' && operator !== 'isNotEmpty';
        valueInput.disabled = !requiresValue;
        valueInput.style.display = requiresValue ? '' : 'none';
        if (!requiresValue) {
            valueInput.value = '';
        }
    };

    updateValueInputState(currentOperator);
    operatorSelect.addEventListener('change', () => {
        // Assurer que la valeur passée est bien un TextOperator valide
        updateValueInputState(operatorSelect.value as TextFilterOperator);
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2 pt-2';
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Effacer';
    clearButton.className = 'px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500';
    clearButton.addEventListener('click', () => {
        instance.setColumnFilter(columnIndex, null);
        closeActivePopup();
    });
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    applyButton.addEventListener('click', () => {
        const selectedOperator = operatorSelect.value as TextFilterOperator;
        const enteredValue = (selectedOperator !== 'isEmpty' && selectedOperator !== 'isNotEmpty') ? valueInput.value : '';
        instance.setColumnFilter(columnIndex, { value: enteredValue, operator: selectedOperator });
        closeActivePopup();
    });
    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(applyButton);
    popup.appendChild(buttonContainer);

    const rect = buttonElement.getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
    document.body.appendChild(popup);
    valueInput.focus();
    setTimeout(() => { document.addEventListener('click', handleOutsideClick, true); }, 0);
}

// --- Nouvelle fonction pour les filtres Nombre ---
/**
 * Crée et affiche la popup de filtre avancé pour une colonne nombre.
 */
function createAdvancedNumberFilterPopup(instance: DataTable, columnIndex: number, columnDef: ColumnDefinition, currentFilterState: ColumnFilterState | undefined, buttonElement: HTMLElement) {
    closeActivePopup();

    const popup = document.createElement('div');
    activePopup = popup;
    popup.className = 'absolute z-20 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg p-3 space-y-3';
    popup.addEventListener('click', (e) => e.stopPropagation());

    const defaultNumberOperators: NumberFilterOperator[] = ['equals', 'notEquals', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'between', 'isEmpty', 'isNotEmpty'];
    const operators = (columnDef.filterOperators as NumberFilterOperator[])?.filter(op => defaultNumberOperators.includes(op)) || defaultNumberOperators;
    const currentOperator: NumberFilterOperator = (currentFilterState?.operator as NumberFilterOperator) || 'equals';

    let currentValue: number | string = '';
    let currentValueTo: number | string = '';
    if (currentFilterState?.value !== null && currentFilterState?.value !== undefined) {
        const stateValue = currentFilterState.value;
        if (typeof stateValue === 'object' && stateValue !== null && 'from' in stateValue && 'to' in stateValue) {
             currentValue = stateValue.from as number | string;
             currentValueTo = stateValue.to as number | string;
        } else {
            currentValue = stateValue as number | string;
        }
    }

    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    operatorSelect.setAttribute('aria-label', 'Type de filtre numérique');
    const opNumberTextMap: Record<NumberFilterOperator, string> = {
        equals: 'Égal à',
        notEquals: 'Différent de',
        greaterThan: 'Supérieur à',
        lessThan: 'Inférieur à',
        greaterThanOrEqual: 'Supérieur ou égal à',
        lessThanOrEqual: 'Inférieur ou égal à',
        between: 'Entre',
        isEmpty: 'Est vide',
        isNotEmpty: 'N\'est pas vide'
    };
    operators.forEach(op => {
        const option = document.createElement('option');
        option.value = op;
        option.textContent = opNumberTextMap[op] || op;
        option.selected = op === currentOperator;
        operatorSelect.appendChild(option);
    });
    popup.appendChild(operatorSelect);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'space-y-2';
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.step = 'any';
    valueInput.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    valueInput.placeholder = 'Valeur...';
    valueInput.value = String(currentValue);
    valueInput.setAttribute('aria-label', 'Valeur du filtre');
    inputContainer.appendChild(valueInput);
    const valueInputTo = document.createElement('input');
    valueInputTo.type = 'number';
    valueInputTo.step = 'any';
    valueInputTo.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    valueInputTo.placeholder = 'Valeur (fin)...';
    valueInputTo.value = String(currentValueTo);
    valueInputTo.setAttribute('aria-label', 'Valeur de fin du filtre (Entre)');
    inputContainer.appendChild(valueInputTo);
    popup.appendChild(inputContainer);

    const updateValueInputState = (operator: NumberFilterOperator) => {
        const requiresValue = operator !== 'isEmpty' && operator !== 'isNotEmpty';
        const requiresRange = operator === 'between';
        valueInput.disabled = !requiresValue;
        valueInput.style.display = requiresValue ? '' : 'none';
        valueInputTo.style.display = requiresRange ? '' : 'none';
        valueInputTo.disabled = !requiresRange;
        if (!requiresValue) valueInput.value = '';
        if (!requiresRange) valueInputTo.value = '';
    };

    updateValueInputState(currentOperator);
    operatorSelect.addEventListener('change', () => {
        updateValueInputState(operatorSelect.value as NumberFilterOperator);
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2 pt-2';
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Effacer';
    clearButton.className = 'px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500';
    clearButton.addEventListener('click', () => {
        instance.setColumnFilter(columnIndex, null);
        closeActivePopup();
    });
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    applyButton.addEventListener('click', () => {
        const selectedOperator = operatorSelect.value as NumberFilterOperator;
        let filterValue: FilterStateObject['value'] = null;

        if (selectedOperator === 'isEmpty' || selectedOperator === 'isNotEmpty') {
            filterValue = '';
        } else if (selectedOperator === 'between') {
            const fromVal = valueInput.value !== '' ? parseFloat(valueInput.value) : null;
            const toVal = valueInputTo.value !== '' ? parseFloat(valueInputTo.value) : null;
            if (fromVal !== null && !isNaN(fromVal) && toVal !== null && !isNaN(toVal)) {
                filterValue = { from: fromVal, to: toVal };
            } else {
                console.warn("Filtre 'Entre' nécessite deux nombres valides.");
                return;
            }
        } else {
            const singleVal = valueInput.value !== '' ? parseFloat(valueInput.value) : null;
            if (singleVal !== null && !isNaN(singleVal)) {
                filterValue = singleVal;
            } else {
                 console.warn("Valeur numérique invalide ou manquante pour cet opérateur.");
                 return;
            }
        }

        instance.setColumnFilter(columnIndex, { value: filterValue, operator: selectedOperator });
        closeActivePopup();
    });
    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(applyButton);
    popup.appendChild(buttonContainer);

    const rect = buttonElement.getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
    document.body.appendChild(popup);
    valueInput.focus();
    setTimeout(() => { document.addEventListener('click', handleOutsideClick, true); }, 0);
}

// --- Nouvelle fonction pour les filtres Date ---
/**
 * Crée et affiche la popup de filtre avancé pour une colonne date.
 */
function createAdvancedDateFilterPopup(instance: DataTable, columnIndex: number, columnDef: ColumnDefinition, currentFilterState: ColumnFilterState | undefined, buttonElement: HTMLElement) {
    closeActivePopup();

    const popup = document.createElement('div');
    activePopup = popup;
    popup.className = 'absolute z-20 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg p-3 space-y-3';
    popup.addEventListener('click', (e) => e.stopPropagation());

    const defaultDateOperators: DateFilterOperator[] = ['equals', 'notEquals', 'after', 'before', 'afterOrEqual', 'beforeOrEqual', 'between', 'isEmpty', 'isNotEmpty'];
    const operators = (columnDef.filterOperators as DateFilterOperator[])?.filter(op => defaultDateOperators.includes(op)) || defaultDateOperators;
    const currentOperator: DateFilterOperator = (currentFilterState?.operator as DateFilterOperator) || 'equals';

    let currentValue: string = '';
    let currentValueTo: string = '';
    if (currentFilterState?.value !== null && currentFilterState?.value !== undefined) {
        const stateValue = currentFilterState.value;
        if (typeof stateValue === 'object' && stateValue !== null && 'from' in stateValue && 'to' in stateValue) {
             currentValue = stateValue.from as string;
             currentValueTo = stateValue.to as string;
        } else {
            currentValue = stateValue as string;
        }
    }

    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    operatorSelect.setAttribute('aria-label', 'Type de filtre de date');
    const opDateTextMap: Record<DateFilterOperator, string> = {
        equals: 'Égal à',
        notEquals: 'Différent de',
        after: 'Après le',
        before: 'Avant le',
        afterOrEqual: 'Après ou égal au',
        beforeOrEqual: 'Avant ou égal au',
        between: 'Entre',
        isEmpty: 'Est vide',
        isNotEmpty: 'N\'est pas vide'
    };
    operators.forEach(op => {
        const option = document.createElement('option');
        option.value = op;
        option.textContent = opDateTextMap[op] || op;
        option.selected = op === currentOperator;
        operatorSelect.appendChild(option);
    });
    popup.appendChild(operatorSelect);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'space-y-2';
    const valueInput = document.createElement('input');
    valueInput.type = 'date';
    valueInput.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    valueInput.value = currentValue;
    valueInput.setAttribute('aria-label', 'Date du filtre');
    inputContainer.appendChild(valueInput);
    const valueInputTo = document.createElement('input');
    valueInputTo.type = 'date';
    valueInputTo.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
    valueInputTo.value = currentValueTo;
    valueInputTo.setAttribute('aria-label', 'Date de fin du filtre (Entre)');
    inputContainer.appendChild(valueInputTo);
    popup.appendChild(inputContainer);

    const updateValueInputState = (operator: DateFilterOperator) => {
        const requiresValue = operator !== 'isEmpty' && operator !== 'isNotEmpty';
        const requiresRange = operator === 'between';
        valueInput.disabled = !requiresValue;
        valueInput.style.display = requiresValue ? '' : 'none';
        valueInputTo.style.display = requiresRange ? '' : 'none';
        valueInputTo.disabled = !requiresRange;
        if (!requiresValue) valueInput.value = '';
        if (!requiresRange) valueInputTo.value = '';
    };

    updateValueInputState(currentOperator);
    operatorSelect.addEventListener('change', () => {
        updateValueInputState(operatorSelect.value as DateFilterOperator);
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2 pt-2';
    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Effacer';
    clearButton.className = 'px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500';
    clearButton.addEventListener('click', () => {
        instance.setColumnFilter(columnIndex, null);
        closeActivePopup();
    });
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    applyButton.addEventListener('click', () => {
        const selectedOperator = operatorSelect.value as DateFilterOperator;
        let filterValue: FilterStateObject['value'] = null;

        if (selectedOperator === 'isEmpty' || selectedOperator === 'isNotEmpty') {
            filterValue = '';
        } else if (selectedOperator === 'between') {
            const fromVal = valueInput.value;
            const toVal = valueInputTo.value;
            if (fromVal && toVal) {
                filterValue = { from: fromVal, to: toVal };
            } else {
                console.warn("Filtre 'Entre' nécessite deux dates valides.");
                return;
            }
        } else {
            const singleVal = valueInput.value;
            if (singleVal) {
                filterValue = singleVal;
            } else {
                 console.warn("Opérateur de date nécessite une valeur.");
                 return;
            }
        }

        instance.setColumnFilter(columnIndex, { value: filterValue, operator: selectedOperator });
        closeActivePopup();
    });
    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(applyButton);
    popup.appendChild(buttonContainer);

    const rect = buttonElement.getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
    document.body.appendChild(popup);
    valueInput.focus();
    setTimeout(() => { document.addEventListener('click', handleOutsideClick, true); }, 0);
}


// --- Header Rendering Logic ---

/**
 * Renders the table header (THEAD) including column filters.
 * @param instance The DataTable instance.
 * @param table The TABLE element.
 */
export function renderHeader(instance: DataTable, table: HTMLTableElement): void {
    const state = instance.stateManager;
    let thead = table.tHead;
    if (thead) {
        table.removeChild(thead);
    }
    thead = table.createTHead();
    thead.className = 'bg-gray-50';
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.zIndex = '10';

    const headerRow = thead.insertRow();
    headerRow.setAttribute('role', 'row');

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

    instance.options.columns.forEach((columnDef: ColumnDefinition, index: number) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.setAttribute('role', 'columnheader');
        th.className = 'px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis';
        th.style.boxSizing = 'border-box';
        if (columnDef.width) {
            th.style.width = columnDef.width;
        }

        const cellContentContainer = document.createElement('div');
        cellContentContainer.className = 'flex items-center justify-between';
        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = columnDef.title || '';
        titleContainer.appendChild(titleSpan);
        cellContentContainer.appendChild(titleContainer);

        const sortFilterContainer = document.createElement('div');
        sortFilterContainer.className = 'flex items-center space-x-1';

        const isSortable = instance.options.sorting?.enabled && columnDef.sortable !== false;
        if (isSortable) {
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
            const svgUnsorted = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block text-gray-400 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 12L3 8m4 4l4-4m6 8v12m0-12l4 4m-4-4l-4 4" /></svg>`;
            const svgAsc = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>`;
            const svgDesc = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`;
            let indicatorSvg = svgUnsorted;
            let ariaSortValue: "ascending" | "descending" | "none" = "none";
            const currentSortIndex = state.getSortColumnIndex();
            const currentSortDirection = state.getSortDirection();
            if (currentSortIndex === index && currentSortDirection !== 'none') {
                indicatorSvg = currentSortDirection === 'asc' ? svgAsc : svgDesc;
                ariaSortValue = currentSortDirection === 'asc' ? 'ascending' : 'descending';
                th.classList.add('bg-gray-100');
            }
            th.setAttribute('aria-sort', ariaSortValue);
            const sortIndicatorSpan = document.createElement('span');
            sortIndicatorSpan.className = 'ml-1 dt-sort-indicator'; // Classe pour ne pas déclencher le tri
            sortIndicatorSpan.innerHTML = indicatorSvg;
            sortFilterContainer.appendChild(sortIndicatorSpan);
        }

        const isGloballyFilterable = instance.options.columnFiltering?.enabled;
        const filterType = columnDef.filterType;
        if (isGloballyFilterable && filterType && filterType !== 'select') {
            const currentFilter = state.getColumnFilters().get(index);
            const filterControlContainer = document.createElement('div');
            filterControlContainer.className = 'dt-filter-control';
            const filterButton = document.createElement('button');
            filterButton.type = 'button';
            filterButton.className = 'p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded';
            filterButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="${currentFilter ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${currentFilter ? 0 : 1.5}"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" /></svg>`;
            filterButton.setAttribute('aria-label', `Options de filtre pour ${columnDef.title}`);
            filterButton.setAttribute('aria-haspopup', 'true');
            filterButton.addEventListener('click', (e) => {
                e.stopPropagation();
                switch (filterType) {
                    case 'text':
                        createAdvancedTextFilterPopup(instance, index, columnDef, currentFilter, filterButton);
                        break;
                    case 'number':
                        createAdvancedNumberFilterPopup(instance, index, columnDef, currentFilter, filterButton);
                        break;
                    case 'date':
                        createAdvancedDateFilterPopup(instance, index, columnDef, currentFilter, filterButton);
                        break;
                    default:
                         console.warn(`Type de filtre non supporté pour la popup: ${filterType}`);
                }
            });
            filterControlContainer.appendChild(filterButton);
            sortFilterContainer.appendChild(filterControlContainer);
        }

        cellContentContainer.appendChild(sortFilterContainer);
        th.appendChild(cellContentContainer);
        headerRow.appendChild(th);
    });

    if (instance.options.rowActions && instance.options.rowActions.length > 0) {
        const thActions = document.createElement('th');
        thActions.scope = 'col';
        thActions.className = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider';
        thActions.textContent = 'Actions';
        headerRow.appendChild(thActions);
    }
} 