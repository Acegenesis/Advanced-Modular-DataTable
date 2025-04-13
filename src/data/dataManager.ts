import { DataTable } from '../core/DataTable';
import { dispatchEvent } from '../events/dispatcher';

// --- Public API Methods for Data Manipulation ---

export function setData(instance: DataTable, newData: any[][]): void {
    if (!Array.isArray(newData)) {
        console.error("setData: Les nouvelles données doivent être un tableau.");
        return;
    }
    instance.originalData = JSON.parse(JSON.stringify(newData));
    if (instance.isServerSide) {
         instance.totalRows = instance.options.serverSideTotalRows ?? instance.originalData.length; // Use server total if provided
    } else {
         // totalRows will be recalculated in render based on filtered/sorted data
    }
    instance.currentPage = 1;
    instance.filterTerm = '';
    instance.sortColumnIndex = null;
    instance.sortDirection = 'none';
    instance.render(); // Re-render with new data
    dispatchEvent(instance, 'dt:dataChange', { source: 'setData' });
}

export function addRow(instance: DataTable, rowData: any[]): void {
    if (!Array.isArray(rowData)) {
         console.error("addRow: La nouvelle ligne doit être un tableau.");
         return;
    }
    // Note: In server mode, adding directly might desync. Prefer server-side add then setData.
    instance.originalData.push(JSON.parse(JSON.stringify(rowData)));
    if (instance.isServerSide) { 
         console.warn("addRow appelé en mode serveur...");
         if (instance.options.serverSideTotalRows !== undefined) {
             instance.options.serverSideTotalRows++;
             instance.totalRows = instance.options.serverSideTotalRows;
         }
         instance.render(); // Re-render pagination etc.
    } else {
        // Client mode: render will recalculate totalRows and display
        instance.render(); 
    }
     dispatchEvent(instance, 'dt:dataChange', { source: 'addRow', addedRow: rowData });
}

export function deleteRowById(instance: DataTable, id: any, idColumnIndex: number = 0): boolean {
    const initialLength = instance.originalData.length;
    instance.originalData = instance.originalData.filter(row => row[idColumnIndex] !== id);
    const rowDeleted = instance.originalData.length < initialLength;
    if (rowDeleted) {
         // Note: In server mode, deleting directly might desync. Prefer server-side delete then setData.
        if (instance.isServerSide) { 
             console.warn("deleteRowById appelé en mode serveur...");
             if (instance.options.serverSideTotalRows !== undefined) {
                instance.options.serverSideTotalRows--;
                instance.totalRows = instance.options.serverSideTotalRows;
             }
             // Adjust page if necessary (server mode relies on external fetch)
             const totalPages = Math.max(1, Math.ceil(instance.totalRows / instance.rowsPerPage));
             if (instance.currentPage > totalPages) {
                 instance.currentPage = totalPages;
             }
              instance.render(); // Re-render pagination etc.
        } else {
            // Client mode: render will recalculate totalRows and display
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
     // Note: In server mode, updating directly might desync. Prefer server-side update then setData.
    const rowIndex = instance.originalData.findIndex(row => row[idColumnIndex] === id);
    if (rowIndex !== -1) {
        instance.originalData[rowIndex] = JSON.parse(JSON.stringify(newRowData));
        if (instance.isServerSide) {
            console.warn("updateRowById appelé en mode serveur...");
        }
        // Render will display the updated data (client or server)
        instance.render();
        dispatchEvent(instance, 'dt:dataChange', { source: 'updateRowById', updatedId: id, newRowData: newRowData });
        return true;
    } else {
         console.warn(`updateRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
        return false;
    }
} 