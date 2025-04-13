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
    // !!! AJOUT LOG POUR DEBUG !!!
    console.log(`[handleMouseDown] Triggered for column ${columnIndex}`); 
    
    const th = (event.currentTarget as HTMLElement).closest('th');
    if (!th) {
        console.log('[handleMouseDown] No TH found');
        return;
    }

    isResizing = true;
    resizingColumnIndex = columnIndex;
    startX = event.clientX;
    startWidth = th.offsetWidth;
    currentTh = th;
    instanceRef = instance;

    // Ajouter les écouteurs globaux
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Changer le curseur et empêcher la sélection de texte
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

function handleMouseMove(event: MouseEvent) {
    if (!isResizing || !currentTh) return;

    const currentX = event.clientX;
    const widthChange = currentX - startX;
    let newWidth = startWidth + widthChange;
    newWidth = Math.max(newWidth, 30); // Largeur minimale pendant le déplacement

    // Mettre à jour la largeur visuelle directement
    currentTh.style.width = `${newWidth}px`;
    // Optionnel: Mettre à jour la largeur des cellules du corps en temps réel?
    // Cela peut être coûteux. Mieux vaut le faire après mouseup.
}

function handleMouseUp(event: MouseEvent) {
    if (!isResizing || resizingColumnIndex === null || !currentTh || !instanceRef) return;

    const finalWidth = currentTh.offsetWidth;
    // Enregistrer la largeur finale dans l'état
    instanceRef.stateManager.setColumnWidth(resizingColumnIndex, finalWidth);

    // Nettoyage
    isResizing = false;
    resizingColumnIndex = null;
    startX = 0;
    startWidth = 0;
    currentTh = null;
    instanceRef = null;

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // Restaurer le curseur et la sélection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // On pourrait déclencher un render() ici si nécessaire, mais setColumnWidth sauvegarde déjà l'état
    // et le prochain render complet appliquera la largeur depuis l'état.
}

// Nouvelle fonction pour l'autosize au double-clic
function handleDoubleClickResize(event: MouseEvent, instance: DataTable, columnIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    const state = instance.stateManager;
    const th = instance.element.querySelector(`thead th:nth-child(${columnIndex + 1 + (state.getSelectionEnabled() ? 1: 0)})`) as HTMLTableCellElement; // +1 pour nth-child, +1 si select all
    const table = instance.element.querySelector('table');
    const tbody = table?.tBodies[0];

    if (!th || !tbody) return;

    let maxContentWidth = 0;
    
    // --- Mesure Robuste du Contenu des Cellules --- 
    // Créer un élément temporaire pour mesurer la largeur réelle du texte
    const measureSpan = document.createElement('span');
    measureSpan.style.position = 'absolute';
    measureSpan.style.visibility = 'hidden';
    measureSpan.style.whiteSpace = 'nowrap'; // Empêcher le retour à la ligne
    measureSpan.style.height = 'auto';
    measureSpan.style.width = 'auto';
    measureSpan.style.padding = '0';
    measureSpan.style.border = 'none';
    measureSpan.style.fontSize = window.getComputedStyle(th).fontSize; // Utiliser la même taille de police
    measureSpan.style.fontFamily = window.getComputedStyle(th).fontFamily;
    document.body.appendChild(measureSpan);

    // 1. Mesurer l'en-tête (juste le texte du titre)
    const titleSpan = th.querySelector('span');
    if (titleSpan?.textContent) {
        measureSpan.textContent = titleSpan.textContent;
        maxContentWidth = Math.max(maxContentWidth, measureSpan.offsetWidth);
        console.log(`[DoubleClickResize] Header Text width: ${measureSpan.offsetWidth}`);
    }

    // 2. Mesurer les cellules du corps (texte uniquement)
    const rows = tbody.rows;
    for (let i = 0; i < rows.length; i++) {
        const cell = rows[i].cells[columnIndex + (state.getSelectionEnabled() ? 1 : 0)];
        if (cell?.textContent) {
            measureSpan.textContent = cell.textContent;
            const cellContentWidth = measureSpan.offsetWidth;
            maxContentWidth = Math.max(maxContentWidth, cellContentWidth);
            // Log limité
            if (i < 5) console.log(`[DoubleClickResize] Cell[${i}] Text width: ${cellContentWidth}`);
        }
    }

    // Supprimer l'élément de mesure temporaire
    document.body.removeChild(measureSpan);

    console.log(`[DoubleClickResize] Calculated maxContentWidth (text only): ${maxContentWidth}`);
    
    // 3. Calculer la largeur finale requise (Contenu Texte + Padding Cellules + Padding Final)
    // Recalculer le padding ici car on l'avait enlevé
    let horizontalPadding = 16; // Valeur par défaut
    try {
        const thStyle = window.getComputedStyle(th);
        const thPadding = parseFloat(thStyle.paddingLeft) + parseFloat(thStyle.paddingRight);
        if (!isNaN(thPadding)) horizontalPadding = thPadding;
    } catch {} 
    const extraPadding = 15; // Un peu plus généreux maintenant que la mesure est plus stricte
    const requiredWidth = Math.max(maxContentWidth + horizontalPadding + extraPadding, 60); // Augmenter le min width?

    // 4. Comparer avec la largeur actuelle et appliquer SEULEMENT si réduction
    const currentWidth = th.offsetWidth; 
    const tolerance = 2; 
    console.log(`[DoubleClickResize] Current width: ${currentWidth}, Required width (text + padding): ${requiredWidth}`);

    if (currentWidth > requiredWidth + tolerance) {
        const finalWidth = requiredWidth;
        console.log(`[DoubleClickResize] Reducing column ${columnIndex} to ${finalWidth}px`);

        th.style.width = `${finalWidth}px`;
        th.style.flexGrow = '0';
        th.style.flexShrink = '0';
        instance.stateManager.setColumnWidth(columnIndex, finalWidth);
    } else {
         console.log(`[DoubleClickResize] Column ${columnIndex} is already at or below required width. No change.`);
    }
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
        thCheckbox.className = 'px-4 py-3 text-center w-12 align-middle border-r border-gray-300';
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
        
        // Correction: Appliquer la largeur ICI, à l'intérieur du if
        const checkboxColWidth = state.getColumnWidths().get(-1); 
        if (checkboxColWidth) {
            thCheckbox.style.width = `${checkboxColWidth}px`;
            thCheckbox.style.flexGrow = '0'; // Rendre non-flexible
            thCheckbox.style.flexShrink = '0';
        }
    }

    instance.options.columns.forEach((columnDef: ColumnDefinition, index: number) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.setAttribute('role', 'columnheader');
        th.className = 'px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-300';
        th.style.boxSizing = 'border-box';
        th.style.position = 'relative';

        // Appliquer la largeur sauvegardée/initiale
        const currentWidth = state.getColumnWidths().get(index);
        // !! AJOUT LOG POUR DEBUG !!
        console.log(`[renderHeader] Applying width for column ${index}: ${currentWidth || 'default (' + columnDef.width + ')'}`); 
        
        if (currentWidth) {
            th.style.width = `${currentWidth}px`;
        } else if (columnDef.width) {
            th.style.width = columnDef.width;
        }
        if (currentWidth || columnDef.width) {
             th.style.flexGrow = '0';
             th.style.flexShrink = '0';
        }

        const cellContentContainer = document.createElement('div');
        cellContentContainer.className = 'flex items-center justify-between h-full';
        const titleContainer = document.createElement('div');
        titleContainer.className = 'flex items-center';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = columnDef.title || '';
        titleContainer.appendChild(titleSpan);
        cellContentContainer.appendChild(titleContainer);

        const sortFilterContainer = document.createElement('div');
        sortFilterContainer.className = 'flex items-center space-x-1';

        // --- Sorting UI --- 
        const isSortable = instance.options.sorting?.enabled && columnDef.sortable !== false;
        if (isSortable) {
            th.classList.add('cursor-pointer', 'hover:bg-gray-100', 'transition-colors', 'duration-150');
            th.tabIndex = 0;
            th.setAttribute('aria-roledescription', 'sortable column header');
            th.addEventListener('click', (e) => {
                const targetElement = e.target as HTMLElement;
                const isResizeHandle = targetElement.closest('.resizer-handle'); // Utiliser une classe spécifique
                const isFilterControl = targetElement.closest('.dt-filter-control');

                // !! AJOUT LOG POUR DEBUG !!
                console.log(`[TH Click] Target:`, targetElement, `isResizeHandle: ${!!isResizeHandle}, isFilterControl: ${!!isFilterControl}`);

                if (!isResizeHandle && !isFilterControl) {
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

        // --- Filtering UI --- 
        const isGloballyFilterable = instance.options.columnFiltering?.enabled;
        const filterType = columnDef.filterType;

        // Vérifier si le filtrage est activé et si le type est géré pour une popup
        if (isGloballyFilterable && filterType && (filterType === 'text' || filterType === 'number' || filterType === 'date' || filterType === 'multi-select')) {
            const state = instance.stateManager;
            const currentFilter = state.getColumnFilters().get(index);
            const filterControlContainer = document.createElement('div');
            filterControlContainer.className = 'dt-filter-control ml-1'; // Ajout de ml-1 pour espacer du tri
            
            // Créer le bouton "entonnoir" pour tous ces types
            const filterButton = document.createElement('button');
            filterButton.type = 'button';
            filterButton.className = 'p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded';
            // Mettre à jour l'icône en fonction de si un filtre est actif
            filterButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="${currentFilter ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${currentFilter ? 0 : 1.5}"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" /></svg>`;
            filterButton.setAttribute('aria-label', `Options de filtre pour ${columnDef.title}`);
            filterButton.setAttribute('aria-haspopup', 'true');

            filterButton.addEventListener('click', (e) => {
                e.stopPropagation();
                // Le switch est correct et appelle la bonne fonction
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
                    case 'multi-select':
                         createMultiSelectFilterPopup(instance, index, columnDef, currentFilter, filterButton);
                         break;
                    // default: // Pas nécessaire si la condition if externe est correcte
                    //      console.warn(`Type de filtre non supporté pour la popup: ${filterType}`);
                }
            });
            filterControlContainer.appendChild(filterButton);
            sortFilterContainer.appendChild(filterControlContainer); // Ajouter au conteneur droite
        }

        // Ajouter le conteneur droite (Tri + Filtre) s'il contient quelque chose
        if (sortFilterContainer.hasChildNodes()) {
            cellContentContainer.appendChild(sortFilterContainer);
        }
        th.appendChild(cellContentContainer);

        // --- Ajouter la poignée de redimensionnement AU TH
        if (columnDef.resizable === true) { 
            const resizer = document.createElement('div');
            resizer.className = 'absolute top-0 right-0 h-full w-4 cursor-col-resize z-30 resizer-handle';
            // Commentez/Décommentez pour debug visuel
            // resizer.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'; 
            resizer.style.userSelect = 'none';
            resizer.style.cursor = 'col-resize'; 
            resizer.addEventListener('mousedown', (e) => {
                 e.stopPropagation(); 
                 handleMouseDown(e, instance, index);
            });
            // Ajout écouteur double-clic
            resizer.addEventListener('dblclick', (e) => {
                handleDoubleClickResize(e, instance, index);
            });
            th.appendChild(resizer); 
        }

        headerRow.appendChild(th);
    });

    if (instance.options.rowActions && instance.options.rowActions.length > 0) {
        const thActions = document.createElement('th');
        thActions.scope = 'col';
        thActions.className = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider';
        thActions.textContent = 'Actions';
        headerRow.appendChild(thActions);

        // Correction: Appliquer la largeur ICI, à l'intérieur du if
        const actionsColWidth = state.getColumnWidths().get(-2);
        if (actionsColWidth) {
            thActions.style.width = `${actionsColWidth}px`;
             thActions.style.flexGrow = '0'; // Rendre non-flexible
             thActions.style.flexShrink = '0';
        }
    }
} 