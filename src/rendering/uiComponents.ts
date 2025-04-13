import { DataTable } from "../core/DataTable";
import { dispatchEvent } from "../events/dispatcher";
import { RowAction } from "../core/types";
import { dispatchActionClickEvent } from "../events/dispatcher";

// --- UI Component Rendering ---

/**
 * Renders the action buttons for a row.
 * @param instance The DataTable instance.
 * @param row The TR element to append the cell to.
 * @param rowData The data for the current row.
 * @returns The created TD element containing the buttons, or null if no actions.
 */
export function renderActionButtons(instance: DataTable, row: HTMLTableRowElement, rowData: any[]): HTMLTableCellElement | null {
    if (!instance.options.rowActions || instance.options.rowActions.length === 0) {
        return null;
    }

    const cell = row.insertCell();
    cell.className = 'px-6 py-4 text-sm text-gray-800 border-b border-gray-200 text-right align-middle whitespace-nowrap'; 
    cell.setAttribute('role', 'gridcell'); // Role for the cell itself

    instance.options.rowActions.forEach((actionDef: RowAction, index: number) => {
        const button = document.createElement('button');
        button.textContent = actionDef.label;
        // Base classes + margin + custom classes
        button.className = `text-indigo-600 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${index > 0 ? 'ml-4' : ''} ${actionDef.className || ''}`;
        button.type = 'button';
        button.dataset.actionId = actionDef.actionId; // Store action ID for potential delegation

        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent row click events if any
            dispatchEvent(instance, 'dt:actionClick', { 
                action: actionDef.actionId, 
                rowData: rowData 
            });
        });
        cell.appendChild(button);
    });

    return cell; 
}

// TODO: Add functions to render other UI components like search input, pagination buttons if needed elsewhere 