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
    const state = instance.stateManager;
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
        instance.setColumnFilter(columnIndex, null);
        closeActivePopup();
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
            instance.setColumnFilter(columnIndex, { value: selectedValues, operator: 'in' });
        } else {
            // Si rien n'est coché, effacer le filtre
            instance.setColumnFilter(columnIndex, null);
        }
        closeActivePopup();
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
    console.log('[Resize Mouseup START] Event:', event);
    
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
    const savedInstance = instanceRef;
    const savedIndex = resizingColumnIndex; 
    console.log(`[Resize Mouseup] Processing for colIndex: ${savedIndex}`);

    const finalWidth = thElement.offsetWidth;
    savedInstance.stateManager.setColumnWidth(savedIndex as number, finalWidth);
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

    const state = instance.stateManager;
    const table = instance.element.querySelector('table');
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
        instance.stateManager.setColumnWidth(columnIndex, finalWidth);
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

    const currentOrder = instance.stateManager.getColumnOrder();
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
    instance.stateManager.setColumnOrder(newOrder);

    // Émettre l'événement de réorganisation de colonne
    const reorderEvent = new CustomEvent('dt:columnReorder', {
        detail: { columnOrder: newOrder },
        bubbles: true,
        composed: true
    });
    // Émettre depuis l'élément principal de la table
    instance.element.dispatchEvent(reorderEvent); 
    console.log(`[Drop] Dispatched dt:columnReorder event with order:`, newOrder);

    // --- AJOUT : Supprimer l'ancien thead pour forcer la recréation ---
    const table = instance.element.querySelector('table');
    if (table?.tHead) {
        table.removeChild(table.tHead);
        console.log('[Drop] Removed existing thead to force recreation.');
    }
    // ----------------------------------------------------------------

    instance.render(); // Re-rendre pour appliquer le nouvel ordre

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
 */
export function renderHeader(instance: DataTable, table: HTMLTableElement): void {
    const state = instance.stateManager;
    let thead = table.tHead;
    let headerRow: HTMLTableRowElement;

    const columnWidths = state.getColumnWidths();
    const columnOrder = state.getColumnOrder();
    const visibleColumns = state.getVisibleColumns(); // <<< Récupérer les colonnes visibles
    const currentSortIndexState = state.getSortColumnIndex();
    const currentSortDirectionState = state.getSortDirection();

    // --- Mise à jour ou Création de l'en-tête --- 
    if (thead && thead.rows.length > 0) {
        headerRow = thead.rows[0];
        // En mode mise à jour, on pourrait cacher/afficher les TH existants,
        // mais recréer est plus simple pour l'instant.
        thead.innerHTML = ''; // Vider pour recréer
        headerRow = thead.insertRow(); // Recréer la ligne
        headerRow.setAttribute('role', 'row');
    } else {
        if (thead) table.removeChild(thead); // Supprimer l'ancien vide
        thead = table.createTHead();
        thead.className = 'bg-gray-50';
        thead.style.position = 'sticky';
        thead.style.top = '0';
        thead.style.zIndex = '10';
        headerRow = thead.insertRow();
        headerRow.setAttribute('role', 'row');
    }
    // --- Colonne Checkbox (si nécessaire) --- 
    if (state.getSelectionEnabled() && state.getSelectionMode() === 'multiple') {
        const thCheckbox = document.createElement('th');
        thCheckbox.scope = 'col';
        thCheckbox.setAttribute('role', 'columnheader');
        thCheckbox.className = 'px-4 py-3 text-center w-12 align-middle border-r border-gray-300';
        thCheckbox.style.boxSizing = 'border-box';
        instance.selectAllCheckbox = document.createElement('input');
        // ... (configuration selectAllCheckbox et listener) ...
         instance.selectAllCheckbox.type = 'checkbox';
         instance.selectAllCheckbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
         instance.selectAllCheckbox.setAttribute('aria-label', 'Sélectionner toutes les lignes visibles');
         instance.selectAllCheckbox.addEventListener('change', (event) => {
             handleSelectAllClick(instance, (event.target as HTMLInputElement).checked);
         });
        thCheckbox.appendChild(instance.selectAllCheckbox);
        headerRow.appendChild(thCheckbox);
        updateSelectAllCheckboxState(instance);
        // Appliquer largeur si sauvegardée
        const checkboxColWidth = state.getColumnWidths().get(-1); // -1 pour la checkbox
        if (checkboxColWidth) {
            thCheckbox.style.width = `${checkboxColWidth}px`;
            thCheckbox.style.flexGrow = '0'; 
            thCheckbox.style.flexShrink = '0';
        }
    }

    // --- Boucle principale sur l'ORDRE des colonnes --- 
    columnOrder.forEach(originalIndex => {
        // >>> CONDITION DE VISIBILITÉ <<< 
        if (!visibleColumns.has(originalIndex)) {
            return; // Ne pas créer ce TH si la colonne n'est pas visible
        }
        // >>> FIN CONDITION <<<
        
        const columnDef = instance.options.columns[originalIndex];
        if (!columnDef) {
            console.warn(`[renderHeader] Column definition not found for originalIndex ${originalIndex}. Skipping.`);
            return;
        }
    
        const th = document.createElement('th');
        // ... (configuration du th: classes, styles, dataset, draggable, etc.) ...
        th.scope = 'col';
        th.setAttribute('role', 'columnheader');
        th.className = `px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-300`.trim();
        th.style.boxSizing = 'border-box';
        th.style.position = 'relative'; // Pour resizer et potentiellement popups
        th.dataset.originalIndex = String(originalIndex);
        
        // Application de la largeur (comme avant)
        const currentWidth = columnWidths.get(originalIndex);
        if (typeof currentWidth === 'number') {
            th.style.width = `${currentWidth}px`;
            th.style.minWidth = `${currentWidth}px`; 
            th.style.maxWidth = `${currentWidth}px`; 
        } else if (columnDef.width) {
            th.style.width = columnDef.width;
            th.style.minWidth = columnDef.width;
        } else {
             th.style.minWidth = '50px'; // Largeur minimale par défaut
        }

        // Activer Drag & Drop
        th.draggable = true;
        th.addEventListener('dragstart', (e) => handleDragStart(e, originalIndex));
        th.addEventListener('dragover', handleDragOver);
        th.addEventListener('dragleave', handleDragLeave);
        th.addEventListener('drop', (e) => handleDrop(e, instance, originalIndex));
        th.addEventListener('dragend', handleDragEnd);

        // Conteneur interne pour flex layout
        const cellContentContainer = document.createElement('div');
        cellContentContainer.className = 'flex items-center justify-between h-full';

        // Titre
        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = columnDef.title || '';
        titleContainer.appendChild(titleSpan);
        cellContentContainer.appendChild(titleContainer);

        // Conteneur pour les icônes tri/filtre
        const sortFilterContainer = document.createElement('div');
        sortFilterContainer.className = 'flex items-center space-x-1';

        // Indicateur de Tri (si colonne triable)
        const isSortable = instance.options.sorting?.enabled && columnDef.sortable !== false;
        if (isSortable) {
             // ... (création et ajout de l'indicateur de tri SVG + listeners click/keydown)
            th.classList.add('cursor-pointer', 'hover:bg-gray-100', 'transition-colors', 'duration-150');
            th.tabIndex = 0; 
            th.setAttribute('aria-roledescription', 'sortable column header');

            const sortIndicatorSpan = document.createElement('span');
            sortIndicatorSpan.className = 'ml-1 dt-sort-indicator inline-block';
            
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            if (instance.useSpriteSortArrow) {
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

            // Listener pour le tri
            th.addEventListener('click', (e) => {
                const targetElement = e.target as HTMLElement;
                // Empêcher le tri si on clique sur le resizer ou un contrôle de filtre
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

        // Bouton de Filtre (si colonne filtrable)
        const isGloballyFilterable = instance.options.columnFiltering?.enabled;
        const filterType = columnDef.filterType;
        if (isGloballyFilterable && filterType && ['text', 'number', 'date', 'multi-select'].includes(filterType)) {
             // ... (création et ajout du bouton de filtre SVG + listener click pour ouvrir popup) ...
             const currentFilter = state.getColumnFilters().get(originalIndex);
             const filterControlContainer = document.createElement('div');
             filterControlContainer.className = 'dt-filter-control ml-1'; // Classe pour cibler
             const filterButton = document.createElement('button');
             filterButton.type = 'button';
             filterButton.className = `p-1 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${currentFilter ? 'text-indigo-600 hover:text-indigo-800' : 'text-gray-400 hover:text-gray-600'}`;
             
             const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
             svgFilter.setAttribute('class', 'h-4 w-4');
             svgFilter.setAttribute('fill', 'currentColor');
             
             if (instance.useSpriteFilter) {
                 const useFilter = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                 const iconFilterId = instance.options.icons?.filter || 'icon-filter'; 
                 useFilter.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${iconFilterId}`);
                 svgFilter.appendChild(useFilter);
             } else {
                  svgFilter.setAttribute('viewBox', '0 0 20 20');
                  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                  path.setAttribute('fill-rule', 'evenodd');
                  path.setAttribute('d', 'M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6.586L3.293 6.707A1 1 0 013 6V3z');
                  path.setAttribute('clip-rule', 'evenodd');
                  svgFilter.appendChild(path);
             }
             filterButton.appendChild(svgFilter);
             filterButton.setAttribute('aria-label', `Options de filtre pour ${columnDef.title}`);
             filterButton.setAttribute('aria-haspopup', 'true');
             filterButton.addEventListener('click', (e) => {
                 e.stopPropagation(); // Empêcher le tri
                 switch (filterType) {
                     case 'text': createAdvancedTextFilterPopup(instance, originalIndex, columnDef, currentFilter, filterButton); break;
                     case 'number': createAdvancedNumberFilterPopup(instance, originalIndex, columnDef, currentFilter, filterButton); break;
                     case 'date': createAdvancedDateFilterPopup(instance, originalIndex, columnDef, currentFilter, filterButton); break;
                     case 'multi-select': createMultiSelectFilterPopup(instance, originalIndex, columnDef, currentFilter, filterButton); break;
                 }
             });
             filterControlContainer.appendChild(filterButton);
             sortFilterContainer.appendChild(filterControlContainer);
        }

        // Ajouter le conteneur d'icônes s'il contient qqch
        if (sortFilterContainer.hasChildNodes()) {
            cellContentContainer.appendChild(sortFilterContainer);
        }

        th.appendChild(cellContentContainer);

        // Handle de Redimensionnement (si colonne redimensionnable)
        if (columnDef.resizable === true || (columnDef.resizable !== false && instance.options.resizableColumns)) {
            const resizer = document.createElement('div');
            // ... (configuration du resizer + listeners mousedown/dblclick) ...
            resizer.className = 'absolute top-0 right-0 h-full w-4 cursor-col-resize z-30 resizer-handle'; // Classe pour cibler
            resizer.style.userSelect = 'none';
            resizer.style.cursor = 'col-resize';
            resizer.addEventListener('mousedown', (e) => {
                 e.stopPropagation(); // Empêcher tri/drag
                 handleMouseDown(e, instance, originalIndex);
             });
             resizer.addEventListener('dblclick', (e) => {
                 e.stopPropagation(); // Empêcher tri
                 handleDoubleClickResize(e, instance, originalIndex);
             });
            th.appendChild(resizer);
        }

        headerRow.appendChild(th);
    });

    // --- Colonne Actions (si nécessaire) --- 
    if (instance.options.rowActions && instance.options.rowActions.length > 0) {
        const thActions = document.createElement('th');
        // ... (configuration du thActions) ...
         thActions.scope = 'col';
         thActions.setAttribute('role', 'columnheader');
         thActions.className = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider'; // Pas de bordure droite ici
         thActions.textContent = instance.options.actionsColumn?.header || 'Actions';
        headerRow.appendChild(thActions);
        // Appliquer largeur si sauvegardée
        const actionsColWidth = state.getColumnWidths().get(-2); // -2 pour les actions
        if (actionsColWidth) {
            thActions.style.width = `${actionsColWidth}px`;
            thActions.style.flexGrow = '0'; 
            thActions.style.flexShrink = '0';
        }
    }
} 