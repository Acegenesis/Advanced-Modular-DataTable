import { DataTable } from "../core/DataTable";
import { SortCriterion, SortDirection, SortChangeEventDetail } from "../core/types";
import { dispatchEvent } from "../events/dispatcher";

// --- Sorting Feature ---

/**
 * Compare deux valeurs pour le tri, en tenant compte du type numérique ou chaîne.
 */
function compareValues(valA: any, valB: any): number {
    // Gestion basique null/undefined
    if (valA === null || valA === undefined) return -1;
    if (valB === null || valB === undefined) return 1;

    const numA = parseFloat(valA);
    const numB = parseFloat(valB);
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return -1;
    if (strA > strB) return 1;
    return 0;
    // TODO: Intl.Collator pour un meilleur tri de chaînes
}

/**
 * Sorts the data array based on multiple sort criteria (client-side only).
 * @param instance The DataTable instance.
 * @param dataToSort The data array to sort.
 * @returns The sorted data array.
 */
export function sortDataIfEnabled(instance: DataTable, dataToSort: any[][]): any[][] {
    if (!instance.options.sorting?.enabled || instance.sortCriteria.length === 0) {
        return dataToSort;
    }
    const sortedData = [...dataToSort];
    const criteria = instance.sortCriteria;

    sortedData.sort((rowA, rowB) => {
        for (const criterion of criteria) {
            const { columnIndex, direction } = criterion;
            if (direction === 'none') continue; // Ignore ce critère

            const valA = rowA[columnIndex];
            const valB = rowB[columnIndex];

            const comparison = compareValues(valA, valB);

            if (comparison !== 0) {
                return direction === 'asc' ? comparison : -comparison;
            }
        }
        return 0; // Les lignes sont égales selon tous les critères
    });

    return sortedData;
}

/**
 * Handles the click event on a sortable column header, supporting multi-sort with Shift key.
 * @param instance The DataTable instance.
 * @param columnIndex The index of the clicked column.
 * @param shiftKey Whether the Shift key was pressed during the click.
 * @param ctrlKey Whether the Ctrl/Cmd key was pressed during the click.
 */
export function handleSortClick(instance: DataTable, columnIndex: number, shiftKey: boolean, ctrlKey: boolean): void {
    const columnDef = instance.options.columns[columnIndex];
    if (!instance.options.sorting?.enabled || !columnDef || columnDef.sortable === false) {
        return;
    }

    let currentCriteria = [...instance.sortCriteria];
    const existingCriterionIndex = currentCriteria.findIndex(c => c.columnIndex === columnIndex);
    const isExisting = existingCriterionIndex !== -1;
    const isPrimarySort = isExisting && existingCriterionIndex === 0;

    if (ctrlKey) {
        // Mode Suppression (Ctrl/Cmd + Clic)
        if (isExisting) {
            currentCriteria.splice(existingCriterionIndex, 1);
        }
        // Si non existant, Ctrl+Clic ne fait rien
    } else if (shiftKey) {
        // Mode Ajout/Modification (Shift + Clic)
        if (isExisting) {
            // Inverser la direction du critère existant
            currentCriteria[existingCriterionIndex].direction = 
                currentCriteria[existingCriterionIndex].direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Ajouter comme nouveau critère
            currentCriteria.push({ columnIndex, direction: 'asc' });
        }
    } else {
        // Mode Tri Simple / Primaire (Clic simple)
        if (isExisting) {
             // Si on clique sur une colonne déjà triée
             const currentDirection = currentCriteria[existingCriterionIndex].direction;
             const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
             if (isPrimarySort) {
                 // Si c'est le critère primaire, on inverse juste sa direction
                 currentCriteria[existingCriterionIndex].direction = newDirection;
                 // On ne touche pas aux autres critères
             } else {
                 // Si ce n'est pas le primaire, on remplace tout par ce seul critère
                 currentCriteria = [{ columnIndex, direction: newDirection }];
             }
        } else {
            // Nouvelle colonne, remplace tous les tris existants
            currentCriteria = [{ columnIndex, direction: 'asc' }];
        }
    }

    // Nettoyer les éventuels critères 'none' qui auraient pu être créés (ne devrait pas arriver avec cette logique)
    instance.sortCriteria = currentCriteria.filter(c => c.direction !== 'none');
    instance.currentPage = 1; // Reset to page 1 on sort

    // Dispatch event with the full criteria array
    dispatchEvent<SortChangeEventDetail>(instance, 'dt:sortChange', { criteria: instance.sortCriteria });

    if (!instance.isServerSide) {
        instance.render();
    }
} 