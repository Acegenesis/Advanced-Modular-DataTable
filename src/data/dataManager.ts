import { DataTable } from '../core/DataTable';
import { dispatchEvent } from '../events/dispatcher';

// --- Public API Methods for Data Manipulation ---

export function setData(instance: DataTable, newData: any[][]): void {
    if (!Array.isArray(newData)) {
        console.error("setData: Les nouvelles données doivent être un tableau.");
        return;
    }
    instance.stateManager.setData(JSON.parse(JSON.stringify(newData)));
    if (instance.stateManager.getIsServerSide()) {
         instance.stateManager.setTotalRows(instance.options.serverSideTotalRows ?? instance.stateManager.getOriginalData().length);
    } else {
         instance.stateManager.setTotalRows(newData.length);
    }
    instance.stateManager.setCurrentPage(1);
    instance.stateManager.setFilterTerm('');
    instance.stateManager.setSort(null, 'none');
    instance.render();
    dispatchEvent(instance, 'dt:dataChange', { source: 'setData' });
}

export function addRow(instance: DataTable, rowData: any[]): void {
    if (!Array.isArray(rowData)) {
         console.error("addRow: La nouvelle ligne doit être un tableau.");
         return;
    }
    instance.stateManager.getOriginalData().push(JSON.parse(JSON.stringify(rowData)));
    if (instance.stateManager.getIsServerSide()) { 
         console.warn("addRow appelé en mode serveur...");
         if (instance.options.serverSideTotalRows !== undefined) {
             instance.stateManager.setTotalRows(instance.options.serverSideTotalRows + 1);
         }
         instance.render();
    } else {
        instance.render(); 
    }
     dispatchEvent(instance, 'dt:dataChange', { source: 'addRow', addedRow: rowData });
}

export function deleteRowById(instance: DataTable, id: any, idColumnIndex: number = 0): boolean {
    const initialLength = instance.stateManager.getOriginalData().length;
    instance.stateManager.getOriginalData().filter(row => row[idColumnIndex] !== id);
    const rowDeleted = instance.stateManager.getOriginalData().length < initialLength;
    if (rowDeleted) {
        if (instance.stateManager.getIsServerSide()) { 
             console.warn("deleteRowById appelé en mode serveur...");
             if (instance.options.serverSideTotalRows !== undefined) {
                instance.stateManager.setTotalRows(instance.options.serverSideTotalRows - 1);
             }
             const totalPages = Math.max(1, Math.ceil(instance.stateManager.getTotalRows() / instance.stateManager.getRowsPerPage()));
             if (instance.stateManager.getCurrentPage() > totalPages) {
                 instance.stateManager.setCurrentPage(totalPages);
             }
              instance.render();
        } else {
            instance.render(); 
        }
         dispatchEvent(instance, 'dt:dataChange', { source: 'deleteRowById', deletedId: id });
    } else {
        console.warn(`deleteRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
    }
    return rowDeleted;
}

export function updateRowById(instance: DataTable, id: any, newRowData: any[], idColumnIndex: number = 0): boolean {
     if (!Array.isArray(newRowData)) {
         console.error("updateRowById: Les nouvelles données de ligne doivent être un tableau.");
         return false;
     }
    const rowIndex = instance.stateManager.getOriginalData().findIndex(row => row[idColumnIndex] === id);
    if (rowIndex !== -1) {
        instance.stateManager.getOriginalData()[rowIndex] = JSON.parse(JSON.stringify(newRowData));
        if (instance.stateManager.getIsServerSide()) {
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
    instance.stateManager.setData([]);
    instance.stateManager.setTotalRows(0);
    instance.stateManager.setSelectedRowIds(new Set());
    instance.stateManager.setCurrentPage(1);
    instance.stateManager.setSort(null, 'none');
    instance.stateManager.setFilterTerm('');
    instance.stateManager.clearAllColumnFilters();
}

/**
 * Récupère une ligne par son ID depuis les données originales.
 * @param instance L'instance DataTable.
 * @param id L'ID de la ligne à rechercher.
 * @param idColumnIndex L'index de la colonne contenant l'ID (défaut: 0).
 * @returns Les données de la ligne trouvée, ou undefined si non trouvée.
 */
export function getRowByIdInternal(instance: DataTable, id: any, idColumnIndex: number = 0): any[] | undefined {
    return instance.stateManager.getOriginalData().find(row => row[idColumnIndex] === id);
} 