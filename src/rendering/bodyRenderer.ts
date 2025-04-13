import { DataTable } from "../core/DataTable";
import { getCurrentPageData } from "../features/pagination";
import { handleRowCheckboxClick } from "../features/selection";
import { appendRenderedContent, renderCellByType } from "./cellRenderer";
import { renderActionButtons } from './uiComponents';

// --- Body Rendering Logic ---

/**
 * Renders the table body (TBODY) for standard mode.
 * @param instance The DataTable instance.
 * @param table The TABLE element.
 * @param data The data to render in the body.
 */
export function renderStandardBody(instance: DataTable, table: HTMLTableElement, data: any[][]): void {
    const state = instance.stateManager;
    let tbody = table.tBodies[0];
    if (!tbody) {
        tbody = table.createTBody();
    } else {
        tbody.innerHTML = ''; // Clear previous body content
    }

    const columnOrder = state.getColumnOrder(); // Récupérer l'ordre des colonnes
    const selectedRowIds = state.getSelectedRowIds();
    const selectionEnabled = state.getSelectionEnabled();
    const uniqueRowIdColumn = instance.options.uniqueRowIdColumn || 0;

    data.forEach((row, rowIndex) => {
        const tr = tbody.insertRow();
        tr.setAttribute('role', 'row');
        const rowId = row[uniqueRowIdColumn as number];

        // Appliquer style si la ligne est sélectionnée
        if (selectionEnabled && selectedRowIds.has(rowId)) {
            tr.classList.add('bg-blue-100'); // Example selection style
        }

        // --- Selection Checkbox Cell (if enabled) ---
        if (selectionEnabled) {
            const tdCheckbox = tr.insertCell();
            tdCheckbox.setAttribute('role', 'cell');
            tdCheckbox.className = 'dt-td dt-td-checkbox px-4 py-2 text-center align-middle sticky left-0 z-5'; // Make sticky, adjust z-index if needed
            // Appliquer le fond de sélection si la ligne est sélectionnée
            if (selectedRowIds.has(rowId)) {
                tdCheckbox.classList.add('bg-blue-100'); 
            } else {
                 tdCheckbox.classList.add('bg-white'); // Fond blanc par défaut
            }
            tdCheckbox.style.width = '50px'; // Correspond à la largeur de l'en-tête checkbox
            const checkbox = document.createElement('input');
            checkbox.type = state.getSelectionMode() === 'single' ? 'radio' : 'checkbox';
            checkbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
            checkbox.name = state.getSelectionMode() === 'single' ? `dt-select-${instance.element.id}` : ''; // Nom commun pour radio
            checkbox.checked = selectedRowIds.has(rowId);
            checkbox.setAttribute('aria-label', `Select row ${rowIndex + 1}`);
            checkbox.addEventListener('change', () => {
                state.toggleRowSelection(rowId);
                instance.render(); // Re-render to update styles and potentially the header checkbox
                // Envoyer un événement personnalisé si nécessaire
                instance.element.dispatchEvent(new CustomEvent('selectionChange', { detail: { selectedIds: Array.from(state.getSelectedRowIds()) } }));
            });
            tdCheckbox.appendChild(checkbox);
        }

        // --- Data Cells (iterate based on columnOrder) ---
        columnOrder.forEach(originalIndex => {
            const columnDef = instance.options.columns[originalIndex];
            const cellData = row[originalIndex]; // Obtenir les données via l'index original
            const td = tr.insertCell();
            td.setAttribute('role', 'cell');
            td.className = 'dt-td px-4 py-2 text-sm text-gray-700 border-b border-gray-200 whitespace-nowrap overflow-hidden text-ellipsis';

            if (columnDef?.render) {
                // Custom renderer
                td.innerHTML = columnDef.render(cellData, row, rowIndex) as string;
            } else {
                // Default rendering
                td.textContent = cellData !== null && cellData !== undefined ? String(cellData) : '';
            }
            // Appliquer l'alignement du texte si défini dans columnDef
            if (columnDef?.textAlign) {
                td.style.textAlign = columnDef.textAlign;
            }
        });

        // --- Actions Cell (if defined) ---
        renderActionButtons(instance, tr, row); 
    });
}

/**
 * Renders the empty state message in the table body.
 * @param instance The DataTable instance.
 * @param tbody The TBODY element.
 */
function renderEmptyState(instance: DataTable, tbody: HTMLTableSectionElement): void {
    const state = instance.stateManager; // Référence au stateManager
    const row = tbody.insertRow();
    const cell = row.insertCell();
    const totalColumnCount =
        instance.options.columns.length +
        (instance.options.rowActions && instance.options.rowActions.length > 0 ? 1 : 0) +
        // Utiliser stateManager pour vérifier si la sélection est activée
        (state.getSelectionEnabled() ? 1 : 0);
    cell.colSpan = totalColumnCount;
    cell.className = 'px-6 py-12 text-center text-sm text-gray-500';
    // Utiliser stateManager pour vérifier le terme de filtre
    cell.textContent = state.getFilterTerm()
        ? 'Aucun résultat trouvé pour votre recherche.'
        : 'Aucune donnée à afficher.';
} 