import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { RowAction } from "../core/types";
import { dispatchActionClickEvent } from "../events/dispatcher";

// --- UI Component Rendering ---

/**
 * Renders the action buttons for a row, adding data attributes for delegation.
 * @param instance The DataTable instance.
 * @param rowElement The TR element the cell belongs to (used for context, not direct append).
 * @param rowData The data for the current row.
 * @returns The created TD element containing the buttons, or null if no actions.
 */
export function renderActionButtons(instance: DataTable, rowElement: HTMLTableRowElement, rowData: any[]): HTMLTableCellElement | null {
    const actions = instance.options.rowActions;
    if (!actions || actions.length === 0) {
        return null;
    }
    const state = instance.stateManager;
    const uniqueRowIdColumn = instance.options.uniqueRowIdColumn ?? 0;
    const rowId = rowData[uniqueRowIdColumn as number];

    const cell = document.createElement('td'); // Créer le TD
    cell.className = 'dt-td px-6 py-4 text-sm text-gray-800 border-b border-gray-200 text-right align-middle whitespace-nowrap'; 
    cell.setAttribute('role', 'cell'); 

    actions.forEach((actionDef: RowAction, index: number) => {
        const button = document.createElement('button');
        button.textContent = actionDef.label;
        button.className = `dt-action-button text-indigo-600 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${index > 0 ? 'ml-4' : ''} ${actionDef.className || ''}`;
        button.type = 'button';
        button.dataset.actionId = actionDef.actionId; // ID de l'action
        if (rowId !== undefined && rowId !== null) {
            button.dataset.rowId = String(rowId); // ID de la ligne
        }

        // // Supprimer l'ancien listener
        // button.addEventListener('click', (event) => { ... });
        
        cell.appendChild(button);
    });

    return cell; // Retourner le TD pour que renderStandardBody l'ajoute
}

// TODO: Add functions to render other UI components like search input, pagination buttons if needed elsewhere 