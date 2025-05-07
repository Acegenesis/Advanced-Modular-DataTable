import { DataTable } from '../core/DataTable';
import { dispatchEvent } from '../events/dispatcher';

// --- Public API Methods for Data Manipulation ---

export function setData(instance: DataTable, newData: any[][]): void {
    if (!Array.isArray(newData)) {
        console.error("setData: Les nouvelles données doivent être un tableau.");
        return;
    }
    instance.state.setData(JSON.parse(JSON.stringify(newData)));
    if (instance.options.serverSideTotalRows !== undefined) {
         instance.state.setTotalRows(instance.options.serverSideTotalRows ?? instance.state.getOriginalData().length);
    } else {
         instance.state.setTotalRows(newData.length);
    }
    instance.state.setCurrentPage(1);
    instance.state.setFilterTerm('');
    instance.state.setSort(null, 'none');
    instance.render();
    dispatchEvent(instance, 'dt:dataChange', { source: 'setData' });
}

export function addRow(instance: DataTable, rowData: any[]): void {
    if (!Array.isArray(rowData)) {
         console.error("addRow: La nouvelle ligne doit être un tableau.");
         return;
    }
    instance.state.getOriginalData().push(JSON.parse(JSON.stringify(rowData)));
    if (instance.options.serverSideTotalRows !== undefined) { 
         console.warn("addRow appelé en mode serveur...");
         if (instance.options.serverSideTotalRows !== undefined) {
             instance.state.setTotalRows(instance.options.serverSideTotalRows + 1);
         }
         instance.render();
    } else {
        instance.render(); 
    }
     dispatchEvent(instance, 'dt:dataChange', { source: 'addRow', addedRow: rowData });
}

export function deleteRowById(instance: DataTable, id: any, idColumnIndex: number = 0): boolean {
    const originalData = instance.state.getOriginalData();
    const initialLength = originalData.length;
    
    // Trouver l'index de la ligne à supprimer
    const rowIndexToDelete = originalData.findIndex(row => row[idColumnIndex] === id);

    let rowDeleted = false;
    // Si la ligne est trouvée, la supprimer avec splice
    if (rowIndexToDelete !== -1) {
        originalData.splice(rowIndexToDelete, 1); 
        rowDeleted = true; // La suppression a eu lieu
    } else {
         console.warn(`deleteRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
    }

    // Continuer uniquement si une ligne a été effectivement supprimée
    if (rowDeleted) {
        if (instance.options.serverSideTotalRows !== undefined) { 
            console.warn("deleteRowById appelé en mode serveur...");
            if (instance.options.serverSideTotalRows !== undefined) {
                // Mettre à jour le total. Attention, si l'ID n'existait pas, on le décrémente quand même ici.
                // Idéalement, on devrait s'assurer que l'ID existe avant de décrémenter.
                instance.state.setTotalRows(instance.state.getTotalRows() - 1); 
            }
            const totalPages = Math.max(1, Math.ceil(instance.state.getTotalRows() / instance.state.getRowsPerPage()));
            if (instance.state.getCurrentPage() > totalPages) {
                instance.state.setCurrentPage(totalPages);
            }
            instance.render();
        } else {
            // Mettre à jour le totalRows pour le mode client aussi
            instance.state.setTotalRows(originalData.length);
            instance.render(); 
        }
        dispatchEvent(instance, 'dt:dataChange', { source: 'deleteRowById', deletedId: id });
    } 
    return rowDeleted;
}

export function updateRowById(instance: DataTable, id: any, newRowData: any[], idColumnIndex: number = 0): boolean {
     if (!Array.isArray(newRowData)) {
         console.error("updateRowById: Les nouvelles données de ligne doivent être un tableau.");
         return false;
     }
    const rowIndex = instance.state.getOriginalData().findIndex(row => row[idColumnIndex] === id);
    if (rowIndex !== -1) {
        instance.state.getOriginalData()[rowIndex] = JSON.parse(JSON.stringify(newRowData));
        if (instance.options.serverSideTotalRows !== undefined) {
            console.warn("updateRowById appelé en mode serveur...");
        }
        instance.render();
        dispatchEvent(instance, 'dt:dataChange', { source: 'updateRowById', updatedId: id, newRowData: newRowData });
        return true;
    } else {
         console.warn(`updateRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
        return false;
    }
}

/**
 * Vide toutes les données du StateManager.
 * @param instance L'instance DataTable.
 */
export function clearDataInternal(instance: DataTable): void {
    instance.state.setData([]);
    instance.state.setTotalRows(0);
    instance.state.setSelectedRowIds(new Set());
    instance.state.setCurrentPage(1);
    instance.state.setSort(null, 'none');
    instance.state.setFilterTerm('');
    instance.state.clearAllColumnFilters();
}

/**
 * Récupère une ligne par son ID depuis les données originales.
 * @param instance L'instance DataTable.
 * @param id L'ID de la ligne à rechercher.
 * @param idColumnIndex L'index de la colonne contenant l'ID (défaut: 0).
 * @returns Les données de la ligne trouvée, ou undefined si non trouvée.
 */
export function getRowByIdInternal(instance: DataTable, id: any, idColumnIndex: number = 0): any[] | undefined {
    return instance.state.getOriginalData().find(row => row[idColumnIndex] === id);
} 