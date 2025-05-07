import { DataTable } from "../core/DataTable";
import { handleSortClick } from "../features/sorting";
import { handleSelectAllClick, updateSelectAllCheckboxState } from "../features/selection";
import { ColumnDefinition, ColumnFilterState, TextFilterOperator, NumberFilterOperator, DateFilterOperator, MultiSelectFilterOperator } from "../core/types";

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

    // ** Ajouter listener Keydown pour Entrée **
    valueInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !valueInput.disabled) {
            event.preventDefault();
            applyButton.click(); // Simuler le clic sur Appliquer
        }
    });

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
        instance.state.setColumnFilter(columnIndex, null);
        closeActivePopup();
        instance.goToPage(1);
    });
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    applyButton.addEventListener('click', () => {
        const selectedOperator = operatorSelect.value as TextFilterOperator;
        const enteredValue = (selectedOperator !== 'isEmpty' && selectedOperator !== 'isNotEmpty') ? valueInput.value : '';
        instance.state.setColumnFilter(columnIndex, { value: enteredValue, operator: selectedOperator });
        closeActivePopup();
        instance.goToPage(1);
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

    // ** Ajouter listener Keydown pour Entrée **
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            const activeElement = document.activeElement as HTMLInputElement;
             if (activeElement && !activeElement.disabled) {
                 event.preventDefault();
                 applyButton.click();
            }
        }
    };
    valueInput.addEventListener('keydown', handleKeyDown);
    valueInputTo.addEventListener('keydown', handleKeyDown);

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
        instance.state.setColumnFilter(columnIndex, null);
        closeActivePopup();
        instance.goToPage(1);
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

        instance.state.setColumnFilter(columnIndex, { value: filterValue, operator: selectedOperator });
        closeActivePopup();
        instance.goToPage(1);
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

    // ** Ajouter listener Keydown pour Entrée **
    const handleDateKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            const activeElement = document.activeElement as HTMLInputElement;
             if (activeElement && !activeElement.disabled) {
                 event.preventDefault();
                 applyButton.click();
            }
        }
    };
    valueInput.addEventListener('keydown', handleDateKeyDown);
    valueInputTo.addEventListener('keydown', handleDateKeyDown);

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
        instance.state.setColumnFilter(columnIndex, null);
        closeActivePopup();
        instance.goToPage(1);
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

        instance.state.setColumnFilter(columnIndex, { value: filterValue, operator: selectedOperator });
        closeActivePopup();
        instance.goToPage(1);
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

// --- Nouvelle fonction pour les filtres Multi-Select (Checkbox) ---
/**
 * Crée et affiche la popup de filtre multi-sélection avec checkboxes.
 */
function createMultiSelectFilterPopup(instance: DataTable, columnIndex: number, columnDef: ColumnDefinition, currentFilterState: ColumnFilterState | undefined, buttonElement: HTMLElement) {
    closeActivePopup();

    const popup = document.createElement('div');
    activePopup = popup;
    popup.className = 'absolute z-20 mt-1 w-72 bg-white border border-gray-300 rounded-md shadow-lg p-3 space-y-3 flex flex-col'; // flex-col pour structure
    popup.addEventListener('click', (e) => e.stopPropagation());

    // --- Options (fournies ou auto-générées) ---
    let options: { value: string; label: string }[] = [];
    const state = instance.state;
    if (columnDef.filterOptions) {
        options = columnDef.filterOptions.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : { value: String(opt.value), label: opt.label });
    } else {
        const originalData = state.getOriginalData();
        if (originalData) {
            const uniqueValues = new Set<string>();
            originalData.forEach(row => {
                const cellValue = row[columnIndex];
                if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '') {
                    uniqueValues.add(String(cellValue));
                }
            });
            options = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b)).map(val => ({ value: val, label: val }));
        } else {
             console.warn(`Impossible de générer les options pour le filtre multi-select de la colonne ${columnIndex}.`);
        }
    }

    // Valeurs actuellement sélectionnées (si le filtre existe et est de type 'in')
    const currentSelectedValues = new Set<string>(
        (currentFilterState?.operator === 'in' && Array.isArray(currentFilterState.value)) 
        ? currentFilterState.value.map(String) 
        : []
    );

    // --- Champ de recherche pour filtrer les options ---
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Rechercher options...';
    searchInput.className = 'w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 mb-2';
    popup.appendChild(searchInput);

    // --- Conteneur scrollable pour les checkboxes ---
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1'; // Hauteur max + scroll
    popup.appendChild(optionsContainer);

    // Fonction pour afficher/filtrer les options
    const renderOptions = (filterText: string = '') => {
        optionsContainer.innerHTML = ''; // Vider le conteneur
        const filterLower = filterText.trim().toLowerCase();
        
        options.forEach(opt => {
            if (opt.label.toLowerCase().includes(filterLower)) {
                const labelElement = document.createElement('label');
                labelElement.className = 'flex items-center space-x-2 text-sm cursor-pointer px-1 py-0.5 rounded hover:bg-gray-100';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = opt.value;
                checkbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
                checkbox.checked = currentSelectedValues.has(opt.value);

                const textSpan = document.createElement('span');
                textSpan.textContent = opt.label;

                labelElement.appendChild(checkbox);
                labelElement.appendChild(textSpan);
                optionsContainer.appendChild(labelElement);
            }
        });
    };

    // Affichage initial
    renderOptions();

    // Écouteur pour la recherche
    searchInput.addEventListener('input', (e) => {
        renderOptions((e.target as HTMLInputElement).value);
    });

    // --- Boutons d'action ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end space-x-2 pt-2 mt-auto'; // mt-auto pour pousser en bas

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Effacer';
    clearButton.className = 'px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500';
    clearButton.addEventListener('click', () => {
        instance.state.setColumnFilter(columnIndex, null);
        closeActivePopup();
        instance.goToPage(1);
    });

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.textContent = 'Appliquer';
    applyButton.className = 'px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
    applyButton.addEventListener('click', () => {
        const selectedValues: string[] = [];
        optionsContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            selectedValues.push((cb as HTMLInputElement).value);
        });

        if (selectedValues.length > 0) {
            instance.state.setColumnFilter(columnIndex, { value: selectedValues, operator: 'in' });
        } else {
            // Si rien n'est coché, effacer le filtre
            instance.state.setColumnFilter(columnIndex, null);
        }
        closeActivePopup();
        instance.goToPage(1);
    });

    buttonContainer.appendChild(clearButton);
    buttonContainer.appendChild(applyButton);
    popup.appendChild(buttonContainer);

    // --- Positionnement et ajout au body ---
    const rect = buttonElement.getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
    document.body.appendChild(popup);
    searchInput.focus(); // Focus sur le champ de recherche
    setTimeout(() => { document.addEventListener('click', handleOutsideClick, true); }, 0);
}

// --- Variables globales pour le redimensionnement ---
let isResizing = false;
let resizingColumnIndex: number | null = null;
let startX: number = 0;
let startWidth: number = 0;
let currentTh: HTMLTableCellElement | null = null;
let instanceRef: DataTable | null = null; // Référence à l'instance pendant le redim.

// --- Fonctions de gestion du redimensionnement ---
function handleMouseDown(event: MouseEvent, instance: DataTable, columnIndex: number) {
    // *** LOG AJOUTÉ ***
    console.log(`[Resize Mousedown START] Col Index: ${columnIndex}, Target:`, event.currentTarget);
    
    const resizerElement = event.currentTarget as HTMLElement;
    const th = resizerElement.closest('th'); 
    if (!th) { 
        console.error('[Resize Mousedown] ABORT: No TH found');
        return; 
    }
    console.log('[Resize Mousedown] Found TH:', th);

    isResizing = true;
    resizingColumnIndex = columnIndex;
    startX = event.clientX;
    startWidth = th.offsetWidth;
    currentTh = th; 
    instanceRef = instance; 
    console.log(`[Resize Mousedown] State set: startX=${startX}, startWidth=${startWidth}`);

    th.draggable = false; 
    console.log(`[Resize Mousedown] Set th draggable=false`);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    console.log('[Resize Mousedown END] Listeners added.');
}

function handleMouseMove(event: MouseEvent) {
    // *** LOG AJOUTÉ ***
    if (!isResizing) return; // Log seulement si on est en train de redimensionner
    console.log(`[Resize Mousemove] ClientX: ${event.clientX}`);
    
    if (!isResizing || !currentTh) {
        return;
    }
    
    const currentX = event.clientX;
    const widthChange = currentX - startX;
    let newWidth = startWidth + widthChange;
    newWidth = Math.max(newWidth, 30); 
    console.log(`[Resize Mousemove] currentX=${currentX}, startX=${startX}, widthChange=${widthChange}, newWidth=${newWidth}`);

    // *** Mise à jour de width, minWidth et maxWidth pour forcer le changement visuel ***
    currentTh.style.width = `${newWidth}px`;
    currentTh.style.minWidth = `${newWidth}px`; 
    currentTh.style.maxWidth = `${newWidth}px`;
}

function handleMouseUp(event: MouseEvent) {
    // *** LOG AJOUTÉ ***
    console.log(`[Resize Mouseup START] IsResizing: ${isResizing}, Target:`, event.target);
    
    if (!isResizing || !currentTh || !instanceRef) {
        console.warn('[Resize Mouseup] ABORT: Inconsistent state on mouse up.');
        // Nettoyage minimal si état incohérent
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        return;
    }
    
    const thElement = currentTh;
    const savedInstance = instanceRef as DataTable;
    const savedIndex = resizingColumnIndex as number; 
    console.log(`[Resize Mouseup] Processing for colIndex: ${savedIndex}`);

    const finalWidth = thElement.offsetWidth;
    savedInstance.state.setColumnWidth(savedIndex, finalWidth);
    console.log(`[Resize Mouseup] Saved finalWidth=${finalWidth} for colIndex ${savedIndex}`);

    // Émettre l'événement de redimensionnement de colonne
    const resizeEvent = new CustomEvent('dt:columnResize', {
        detail: {
            columnIndex: savedIndex,
            newWidth: finalWidth
        },
        bubbles: true, // Permet à l'événement de remonter dans le DOM
        composed: true // Permet à l'événement de traverser les limites du Shadow DOM si nécessaire
    });
    thElement.dispatchEvent(resizeEvent);
    console.log(`[Resize Mouseup] Dispatched dt:columnResize event for colIndex ${savedIndex}`);

    // Nettoyage des variables globales
    console.log('[Resize Mouseup] Cleaning up state...');
    isResizing = false;
    resizingColumnIndex = null;
    startX = 0;
    startWidth = 0;
    currentTh = null; 
    instanceRef = null;

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // --- Réactiver le drag sur le TH ---
    thElement.draggable = true;
    console.log(`[Resize Mouseup] Set th draggable=true for index ${savedIndex}`);
    console.log('[Resize Mouseup END]');
}

// Nouvelle fonction pour l'autosize au double-clic
function handleDoubleClickResize(event: MouseEvent, instance: DataTable, columnIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    console.log(`[DblClickResize v6 START] Triggered for originalIndex: ${columnIndex}`);

    const state = instance.state;
    const table = instance.el.querySelector('table');
    const thead = table?.tHead;
    const tbody = table?.tBodies[0];
    const headerRow = thead?.rows[0];

    if (!table || !thead || !tbody || !headerRow) {
        console.error("[DblClickResize v6] ABORT: Table structure not found.");
        return;
    }

    // 1. Trouver TH et index visuel
    const th = headerRow.querySelector(`th[data-original-index="${columnIndex}"]`) as HTMLTableCellElement;
    if (!th) {
        console.error(`[DblClickResize v6] ABORT: TH with originalIndex ${columnIndex} not found.`);
        return;
    }
    const thVisualIndex = Array.from(headerRow.cells).indexOf(th);
    if (thVisualIndex === -1) {
         console.error(`[DblClickResize v6] ABORT: Could not determine visual index for TH originalIndex ${columnIndex}.`);
        return;
    }
    console.log(`[DblClickResize v6] Found TH at visual index ${thVisualIndex}`);

    // --- 1. Mesure contenu corps ---
    let longestBodyText = '';
    const bodyCellVisualIndex = thVisualIndex;
    const rows = tbody.rows;
    for (let i = 0; i < rows.length; i++) {
        const cell = rows[i].cells[bodyCellVisualIndex]; 
        const cellText = cell?.textContent?.trim() || '';
        if (cellText.length > longestBodyText.length) {
            longestBodyText = cellText;
        }
    }
    console.log(`[DblClickResize v6] Longest body text: "${longestBodyText}"`);

    const measureSpan = document.createElement('span');
    measureSpan.style.position = 'absolute';
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.whiteSpace = 'nowrap';
    measureSpan.style.height = 'auto';
    measureSpan.style.width = 'auto';
    measureSpan.style.padding = '0';
    measureSpan.style.border = 'none';
    measureSpan.style.fontSize = window.getComputedStyle(th).fontSize;
    measureSpan.style.fontFamily = window.getComputedStyle(th).fontFamily;
    measureSpan.textContent = longestBodyText;
    document.body.appendChild(measureSpan);
    const maxBodyContentWidth = measureSpan.offsetWidth;
    // Ne pas supprimer le span tout de suite, on en a besoin pour le titre
    console.log(`[DblClickResize v6] Measured width of longest body text: ${maxBodyContentWidth}`);

    // --- 2. Mesure contenu header séparément ---
    let headerTitleWidth = 0;
    let headerIconsWidth = 0;
    // Chercher le conteneur flex principal dans le TH
    const headerContentContainer = th.querySelector('.flex.items-center.justify-between') as HTMLElement;
    // Chercher le span de titre à l'intérieur (souvent le premier span)
    const headerTitleSpan = headerContentContainer?.querySelector('span'); 
    // Chercher le conteneur des icônes (celui avec space-x-1)
    const headerIconsContainer = headerContentContainer?.querySelector('.flex.items-center.space-x-1') as HTMLElement; 

    // 2.1 Mesurer le titre
    if (headerTitleSpan?.textContent) {
        measureSpan.textContent = headerTitleSpan.textContent; // Réutiliser le span
        headerTitleWidth = measureSpan.offsetWidth;
        console.log(`[DblClickResize v6] Measured header title width: ${headerTitleWidth}`);
    }
    // Supprimer le span de mesure maintenant
    document.body.removeChild(measureSpan); 

    // 2.2 Mesurer le conteneur des icônes
    if (headerIconsContainer) {
        headerIconsWidth = headerIconsContainer.offsetWidth;
        console.log(`[DblClickResize v6] Measured header icons container width: ${headerIconsWidth}`);
    }
    
    // --- 3. Calcul largeurs requises --- 
    let horizontalPadding = 16; // Padding interne du TH
    let spaceBetweenTitleAndIcons = 4; // Estimation de space-x-1 (4px)
    try {
        const thStyle = window.getComputedStyle(th);
        const paddingLeft = parseFloat(thStyle.paddingLeft);
        const paddingRight = parseFloat(thStyle.paddingRight);
        if (!isNaN(paddingLeft) && !isNaN(paddingRight)) {
             horizontalPadding = paddingLeft + paddingRight;
        }
        // Essayer d'obtenir le gap/margin réel si possible (plus complexe)
    } catch {} 
    const extraPadding = 5; // Petit buffer final

    // Largeur requise pour afficher l'en-tête complet
    // Si pas d'icônes, iconsWidth est 0, spaceBetween est aussi 0
    const headerRequiredWidth = headerTitleWidth + (headerIconsWidth > 0 ? spaceBetweenTitleAndIcons : 0) + headerIconsWidth + horizontalPadding + extraPadding;
    
    // Largeur requise pour le contenu du corps + padding
    const bodyRequiredWidth = maxBodyContentWidth + horizontalPadding + extraPadding;
    
    // La largeur finale est le MAX des deux, + min width
    const requiredWidth = Math.max(headerRequiredWidth, bodyRequiredWidth, 60); 

    console.log(`[DblClickResize v6] BodyRequired: ${bodyRequiredWidth}, HeaderRequired: ${headerRequiredWidth}`);
    console.log(`[DblClickResize v6] Final requiredWidth (max): ${requiredWidth}`);

    // --- 4. Comparer et appliquer --- (inchangé)
    const currentWidth = th.offsetWidth;
    const tolerance = 2;
    console.log(`[DblClickResize v6] Comparing - Current width: ${currentWidth}, Required width: ${requiredWidth}`);

    if (currentWidth > requiredWidth + tolerance) {
        const finalWidth = requiredWidth;
        console.log(`[DblClickResize v6] ACTION: Reducing column ${columnIndex} (visual ${thVisualIndex}) to ${finalWidth}px`);
        th.style.width = `${finalWidth}px`;
        th.style.minWidth = `${finalWidth}px`;
        th.style.maxWidth = `${finalWidth}px`;
        th.style.flexGrow = '0';
        th.style.flexShrink = '0';
        instance.state.setColumnWidth(columnIndex, finalWidth);
    } else {
        console.log(`[DblClickResize v6] NO ACTION: Column ${columnIndex} is already at or below required width.`);
    }
    console.log("[DblClickResize v6 END]");
}

// --- Variables globales pour le Drag & Drop ---
let draggedColumnIndex: number | null = null;

// --- Fonctions de gestion du Drag & Drop ---
function handleDragStart(event: DragEvent, originalIndex: number) {
    // Vérifier si le clic provient de la poignée de redimensionnement
    const target = event.target as HTMLElement;
    if (target.classList.contains('dt-resizer')) {
         console.log('[DragStart] Event on resizer, preventing drag.');
         event.preventDefault(); // Empêcher le drag si on clique sur le resizer
         return;
    }

    // Si ce n'est pas le resizer, continuer le drag normal
    const th = target.closest('th');
    if (!th) return; 

    draggedColumnIndex = originalIndex;
    event.dataTransfer?.setData('application/x-datatable-column-index', String(originalIndex));
    event.dataTransfer!.effectAllowed = 'move';

    setTimeout(() => {
        th.classList.add('opacity-50', 'bg-gray-200');
    }, 0);

    console.log(`[DragStart] Column index: ${originalIndex}`);
}

function handleDragOver(event: DragEvent) {
    event.preventDefault(); // Nécessaire pour autoriser le drop
    event.dataTransfer!.dropEffect = 'move';
    const th = (event.currentTarget as HTMLElement).closest('th');
    if (th) {
        th.classList.add('bg-yellow-100'); // Indicateur visuel de la zone de drop
    }
}

function handleDragLeave(event: DragEvent) {
    const th = (event.currentTarget as HTMLElement).closest('th');
    if (th) {
        th.classList.remove('bg-yellow-100');
    }
}

function handleDrop(event: DragEvent, instance: DataTable, targetOriginalIndex: number) {
    event.preventDefault();
    // Nettoyer le style de la cible
    const th = (event.currentTarget as HTMLElement).closest('th');
    if (th) {
        th.classList.remove('bg-yellow-100');
    }

    if (draggedColumnIndex === null) {
        console.log('[Drop] No dragged column index found');
        return; 
    }
    // Vérifier si on drop sur soi-même
    if (draggedColumnIndex === targetOriginalIndex) {
        console.log('[Drop] Dropped on self, no change');
        return; 
    }

    const currentOrder = instance.state.getColumnOrder();
    // Index dans le tableau `currentOrder`
    const fromIndex = currentOrder.indexOf(draggedColumnIndex);
    const toIndex = currentOrder.indexOf(targetOriginalIndex);

    if (fromIndex === -1 || toIndex === -1) {
        console.error('[Drop] Dragged or target index not found in current order:', currentOrder, `Dragged: ${draggedColumnIndex}`, `Target: ${targetOriginalIndex}`);
        // Potentiellement appeler handleDragEndCleanup() ici pour nettoyer le style de l'élément glissé si une erreur se produit.
        return;
    }
    
    console.log(`[Drop] Moving item from order index ${fromIndex} (value ${draggedColumnIndex}) to order index ${toIndex} (value ${targetOriginalIndex})`);

    // --- Logique de réorganisation simplifiée ---
    const newOrder = [...currentOrder];
    // 1. Retirer l'élément de sa position d'origine
    const [movedItem] = newOrder.splice(fromIndex, 1);
    // 2. Insérer l'élément à la position cible
    newOrder.splice(toIndex, 0, movedItem);
    // -------------
    
    console.log('[Drop] Calculated New Order:', newOrder);
    instance.state.setColumnOrder(newOrder);

    // Émettre l'événement de réorganisation de colonne
    const reorderEvent = new CustomEvent('dt:columnReorder', {
        detail: { columnOrder: newOrder },
        bubbles: true,
        composed: true
    });
    instance.el.dispatchEvent(reorderEvent);
    console.log(`[Drop] Dispatched dt:columnReorder event with order:`, newOrder);

    instance.render(newOrder); // <--- Passer le nouvel ordre explicitement

    // handleDragEnd sera appelé automatiquement par le navigateur pour nettoyer le style de l'élément glissé
}

function handleDragEnd(event: DragEvent) {
    if (!(event.target instanceof HTMLElement)) return;
    // Nettoyer les styles
    event.target.classList.remove('opacity-50', 'bg-gray-200');
    // Nettoyer les indicateurs de drop potentiels
    document.querySelectorAll('th.bg-yellow-100').forEach(el => el.classList.remove('bg-yellow-100'));
    draggedColumnIndex = null;
    console.log('[DragEnd]');
}

// Helper function to update SVG state
export function updateSortIndicatorSVG(svgElement: SVGSVGElement | null, parentTh: HTMLElement, sortState: 'ascending' | 'descending' | 'none') {
    if (!svgElement) return;

    // Retirer les anciennes classes Tailwind (au cas où)
    svgElement.classList.remove('rotate-0', 'rotate-180', 'opacity-40', 'opacity-100', 'text-gray-400', 'text-gray-600');
    parentTh.classList.remove('bg-gray-100');

    // Nos nouvelles classes CSS
    const activeSortClass = 'dt-sort-icon--active';
    const descendingSortClass = 'dt-sort-icon--descending';
    const activeThClass = 'dt-sort-active';

    // Reset: enlever les classes spécifiques au tri
    svgElement.classList.remove(activeSortClass, descendingSortClass);
    parentTh.classList.remove(activeThClass);

    // Appliquer les classes selon l'état
    if (sortState === 'ascending') {
        svgElement.classList.add(activeSortClass);
        // Pas besoin de classe pour asc, c'est l'état par défaut (rotate(0))
        parentTh.classList.add(activeThClass);
    } else if (sortState === 'descending') {
        svgElement.classList.add(activeSortClass);
        svgElement.classList.add(descendingSortClass); // Ajoute la rotation
        parentTh.classList.add(activeThClass);
    } else { // sortState === 'none'
        // Aucune classe spécifique à ajouter au SVG ou au TH
    }

    // Mettre à jour les attributs ARIA (gardé)
    parentTh.setAttribute('aria-sort', sortState);
    parentTh.dataset.sort = sortState;
}

/**
 * Renders the table header (THEAD) including column filters.
 * Updates the existing THEAD if possible, otherwise creates a new one.
 * @param instance The DataTable instance.
 * @param table The TABLE element.
 * @param columnOrderOverride Optional column order to use instead of state.
 */
export function renderHeader(instance: DataTable, table: HTMLTableElement, columnOrderOverride?: number[]): void {
    console.log(`[renderHeader START] Called. Order override: ${JSON.stringify(columnOrderOverride)}`);

    // Log 1b: Check state manager existence
    if (!instance.state) {
        console.error("[renderHeader CRITICAL ERROR] instance.state is UNDEFINED or NULL!");
        // Optional: throw new Error("State manager is not available in renderHeader");
        return; // Stop rendering if state is not available
    }
    console.log("[renderHeader] instance.state exists. Proceeding..."); // Log 2

    try { // Ajout d'un bloc try...finally pour le log de fin
        const state = instance.state;
    let thead = table.tHead;
    let headerRow: HTMLTableRowElement;

        // Log 3: Check if state.getColumnWidths is a function BEFORE calling
        if (typeof state.getColumnWidths !== 'function') {
            console.error("[renderHeader CRITICAL ERROR] state.getColumnWidths is NOT a function! State object:", state);
            return;
        }
        console.log("[renderHeader] state.getColumnWidths is a function. About to call it..."); // Log 4
    const columnWidths = state.getColumnWidths();
        console.log("[renderHeader] state.getColumnWidths() called. Result:", columnWidths); // Log 5

        // Utiliser l'override s'il est fourni, sinon prendre celui de l'état
        const columnOrder = columnOrderOverride ?? state.getColumnOrder(); 
        console.log(`[renderHeader] Using column order: ${JSON.stringify(columnOrder)}`); 
        
        const visibleColumns = state.getVisibleColumns();
    const currentSortIndexState = state.getSortColumnIndex();
    const currentSortDirectionState = state.getSortDirection();

        // Recreate thead and headerRow to ensure clean state
        if (thead) {
            console.log("[renderHeader] Removing existing thead."); // Log
            table.removeChild(thead);
        }
        thead = table.createTHead();
        console.log("[renderHeader] Created new thead."); // Log
        thead.className = 'bg-gray-50';
        thead.style.position = 'sticky';
        thead.style.top = '0';
        thead.style.zIndex = '10';
        headerRow = thead.insertRow();
        headerRow.setAttribute('role', 'row');

        // Add Select All Checkbox header cell if needed
    if (state.getSelectionEnabled() && state.getSelectionMode() === 'multiple') {
            console.log("[renderHeader] Adding select all checkbox column."); // Log
        const thCheckbox = document.createElement('th');
        thCheckbox.scope = 'col';
        thCheckbox.setAttribute('role', 'columnheader');
        thCheckbox.className = 'px-4 py-3 text-center w-12 align-middle border-r border-gray-300';
        thCheckbox.style.boxSizing = 'border-box';
            
        instance.selectAllCheckbox = document.createElement('input');
         instance.selectAllCheckbox.type = 'checkbox';
         instance.selectAllCheckbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
         instance.selectAllCheckbox.setAttribute('aria-label', 'Sélectionner toutes les lignes visibles');
         instance.selectAllCheckbox.addEventListener('change', (event) => {
             handleSelectAllClick(instance, (event.target as HTMLInputElement).checked);
         });
        thCheckbox.appendChild(instance.selectAllCheckbox);
        headerRow.appendChild(thCheckbox);

            // Call updateSelectAllCheckboxState *after* the checkbox is added to the DOM
        updateSelectAllCheckboxState(instance);
            
            // Get width for checkbox column (use a special index like -1?)
            const checkboxColWidth = columnWidths.get(-1); // Assuming -1 is used for checkbox width
        if (checkboxColWidth) {
            thCheckbox.style.width = `${checkboxColWidth}px`;
                thCheckbox.style.flexGrow = '0'; // Prevent growing
                thCheckbox.style.flexShrink = '0'; // Prevent shrinking
        }
    }

        // Add regular column headers
        console.log(`[renderHeader] Looping through ${columnOrder.length} columns in order.`); // Log
    columnOrder.forEach(originalIndex => {
        if (!visibleColumns.has(originalIndex)) {
                return; 
        }
        
        const columnDef = instance.options.columns[originalIndex];
        if (!columnDef) {
            console.warn(`[renderHeader] Column definition not found for originalIndex ${originalIndex}. Skipping.`);
            return;
        }
    
        const th = document.createElement('th');
        th.scope = 'col';
        th.setAttribute('role', 'columnheader');
        th.className = `group px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-300`.trim();
        th.style.boxSizing = 'border-box';
        th.style.position = 'relative';
        th.dataset.originalIndex = String(originalIndex);

        // *** Suppression de la SIMPLIFICATION POUR TEST ***
        // const titleSpan = document.createElement('span');
        // titleSpan.textContent = columnDef.title || ''; 
        // th.appendChild(titleSpan); // Ajout direct du titre
        // --- Fin de la suppression ---
        
        // --- RESTAURATION DRAG & DROP LISTENERS (déjà fait, mais on garde pour être sûr) ---
        th.draggable = true;
        th.addEventListener('dragstart', (e) => handleDragStart(e, originalIndex));
        th.addEventListener('dragover', handleDragOver);
        th.addEventListener('dragleave', handleDragLeave);
        th.addEventListener('drop', (e) => handleDrop(e, instance, originalIndex));
        th.addEventListener('dragend', handleDragEnd);
        // --- FIN RESTAURATION ---

        // --- DÉCOMMENTER LE CODE COMPLEXE --- 
        // Apply width
        const currentWidth = columnWidths.get(originalIndex);
        if (typeof currentWidth === 'number') {
            th.style.width = `${currentWidth}px`;
            th.style.minWidth = `${currentWidth}px`;
            th.style.maxWidth = `${currentWidth}px`;
        } else if (columnDef.width) {
            th.style.width = columnDef.width;
            th.style.minWidth = columnDef.width; 
        } else {
            th.style.minWidth = '50px'; 
        }

        // Cell Content Container (Flexbox for alignment)
        const cellContentContainer = document.createElement('div');
        cellContentContainer.className = 'flex items-center justify-between h-full';

        // Title Container
        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = columnDef.title || '';
        titleContainer.appendChild(titleSpan);
        cellContentContainer.appendChild(titleContainer);

        // Sort & Filter Icons Container
        const sortFilterContainer = document.createElement('div');
        sortFilterContainer.className = 'flex items-center space-x-1';

        // Sort Indicator
        const isSortable = instance.options.sorting?.enabled && columnDef.sortable !== false;
        if (isSortable) {
            th.classList.add('hover:bg-gray-100', 'transition-colors', 'duration-150');
            th.tabIndex = 0; 
            th.setAttribute('aria-roledescription', 'sortable column header');

            const sortIndicatorSpan = document.createElement('span');
            sortIndicatorSpan.className = 'ml-1 dt-sort-indicator inline-block';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'h-4 w-4 transition-transform duration-150 ease-in-out');
            svg.setAttribute('aria-hidden', 'true');

            if (instance.spriteAvailable.sortArrow) { 
                const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                const iconId = instance.options.icons?.sortArrow || 'icon-sort-arrow';
                use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${iconId}`);
                svg.appendChild(use);
            } else {
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '2');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('d', 'M5 15l7-7 7 7'); 
                svg.appendChild(path);
            }
            sortIndicatorSpan.appendChild(svg);
            sortFilterContainer.appendChild(sortIndicatorSpan);

            let initialSortState: 'ascending' | 'descending' | 'none' = 'none';
            if (currentSortIndexState === originalIndex && currentSortDirectionState !== 'none') {
                 initialSortState = currentSortDirectionState === 'asc' ? 'ascending' : 'descending';
            }
            updateSortIndicatorSVG(svg, th, initialSortState);

            th.addEventListener('click', (e) => {
                const targetElement = e.target as HTMLElement;
                if (!targetElement.closest('.resizer-handle') && !targetElement.closest('.dt-filter-control')) {
                    handleSortClick(instance, originalIndex);
                }
            });
            th.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    th.click();
                }
            });
        }

        // Filter Control
        const isGloballyFilterable = instance.options.columnFiltering?.enabled;
        const filterType = columnDef.filterType;
        if (isGloballyFilterable && filterType && ['text', 'number', 'date', 'multi-select'].includes(filterType)) {
            const currentFilter = state.getColumnFilters().get(originalIndex);
            const filterControlContainer = document.createElement('div');
            filterControlContainer.className = 'dt-filter-control ml-1';

            const filterButton = document.createElement('button');
            filterButton.type = 'button';
            filterButton.className = `p-1 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${currentFilter ? 'text-indigo-600 hover:text-indigo-800' : 'text-gray-400 hover:text-gray-600'}`;
            
            const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgFilter.setAttribute('class', 'h-4 w-4');
            svgFilter.setAttribute('fill', 'currentColor');
            svgFilter.setAttribute('aria-hidden', 'true');

            if (instance.spriteAvailable.filter) {
                const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                const iconId = instance.options.icons?.filter || 'icon-filter';
                use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${iconId}`);
                svgFilter.appendChild(use);
            } else {
                svgFilter.setAttribute('viewBox', '0 0 20 20');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('fill-rule', 'evenodd');
                path.setAttribute('d', 'M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-6.586L3.293 6.707A1 1 0 013 6V3z');
                path.setAttribute('clip-rule', 'evenodd');
                svgFilter.appendChild(path);
            }
            filterButton.appendChild(svgFilter);
            filterButton.addEventListener('click', (e) => {
                e.stopPropagation();
                closeActivePopup();
                const buttonElement = e.currentTarget as HTMLElement;
                const currentFilterState = state.getColumnFilters().get(originalIndex);
                switch (filterType) {
                    case 'text': createAdvancedTextFilterPopup(instance, originalIndex, columnDef, currentFilterState, buttonElement); break;
                    case 'number': createAdvancedNumberFilterPopup(instance, originalIndex, columnDef, currentFilterState, buttonElement); break;
                    case 'date': createAdvancedDateFilterPopup(instance, originalIndex, columnDef, currentFilterState, buttonElement); break;
                    case 'multi-select': createMultiSelectFilterPopup(instance, originalIndex, columnDef, currentFilterState, buttonElement); break;
                }
            });
            filterControlContainer.appendChild(filterButton);
            sortFilterContainer.appendChild(filterControlContainer);
        }
        
        cellContentContainer.appendChild(sortFilterContainer);
        th.appendChild(cellContentContainer);

        // Column Resizer
        console.log(`[renderHeader] Checking resizableColumns option: ${instance.options.resizableColumns} (Type: ${typeof instance.options.resizableColumns})`);
        if (instance.options.resizableColumns) {
            const resizer = document.createElement('div');
            resizer.className = 'resizer-handle absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-blue-300 opacity-100 transition-opacity duration-150';
            resizer.style.zIndex = '1';
            resizer.addEventListener('mousedown', (e) => handleMouseDown(e, instance, originalIndex));
            resizer.addEventListener('dblclick', (e) => handleDoubleClickResize(e, instance, originalIndex));
            th.appendChild(resizer);
            // *** LOG AJOUTÉ APRÈS APPENDCHILD ***
            console.log(`[renderHeader] Resizer handle appended for column index ${originalIndex}. TH child count: ${th.children.length}`);
        }
         // --- FIN DU CODE DÉCOMMENTÉ ---
        
        headerRow.appendChild(th);
    });
    
        // Add dummy cell for scrollbar width if needed (usually handled by table-layout: fixed)
        
    } catch (error) {
        console.error("[renderHeader] Uncaught error during header rendering:", error);
        // Optionally display an error message to the user in the UI
    } finally {
        console.log("[renderHeader END]"); // Log de fin
    }
} 