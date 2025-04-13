import { DataTable } from "../core/DataTable";
import { getCurrentFilteredSortedData } from "./selection"; // Réutiliser pour obtenir les données pertinentes
import { CsvExportOptions } from "../core/types"; // Importer le type

/**
 * Converts an array of arrays into a CSV string with a specific delimiter.
 */
function convertToCSV(data: any[][], headers: string[], delimiter: string): string {
    const escapeCell = (cellData: any): string => {
        if (cellData === null || cellData === undefined) {
            return '';
        }
        const stringData = String(cellData);
        // Si la donnée contient le délimiteur, des guillemets ou un retour à la ligne, l'entourer de guillemets
        if (stringData.includes(delimiter) || stringData.includes('"') || stringData.includes('\n')) {
            const escapedData = stringData.replace(/"/g, '""');
            return `"${escapedData}"`;
        }
        return stringData;
    };

    const headerRow = headers.map(escapeCell).join(delimiter);
    const dataRows = data.map(row =>
        row.map(escapeCell).join(delimiter)
    );

    return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers the download of a CSV file with specified filename, encoding, and optional BOM.
 */
function downloadCSV(csvContent: string, filename: string, encoding: string, addBom: boolean): void {
    const mimeType = `text/csv;charset=${encoding.toLowerCase()}`;
    let contentToDownload = csvContent;

    // Préfixer avec BOM si UTF-8 et demandé
    if (addBom && encoding.toLowerCase() === 'utf-8') {
        contentToDownload = "\uFEFF" + csvContent; // BOM pour UTF-8
    }

    const blob = new Blob([contentToDownload], { type: mimeType });
    const link = document.createElement("a");

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert("La fonctionnalité de téléchargement n'est pas prise en charge par votre navigateur.");
    }
}

/**
 * Exports the current data using the specified CSV options.
 */
export function exportToCSV(instance: DataTable): void {
    // Récupérer les options CSV
    const csvOptions = (typeof instance.options.exporting?.csv === 'object'
        ? instance.options.exporting.csv
        : {}) as CsvExportOptions;

    const defaults = {
        delimiter: ',',
        encoding: 'utf-8',
        filename: `datatable-export-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
        bom: true // Mettre true par défaut pour une meilleure compatibilité Excel
    };

    const delimiter = csvOptions.delimiter ?? defaults.delimiter;
    const encoding = csvOptions.encoding ?? defaults.encoding;
    const filename = csvOptions.filename ?? defaults.filename;
    const addBom = csvOptions.bom ?? defaults.bom;

    if (instance.isServerSide) {
        alert("L'exportation CSV n'est pas encore implémentée pour le mode serveur.");
        return;
    }

    const headers = instance.options.columns.map(col => col.title);
    const dataToExport = getCurrentFilteredSortedData(instance);

    if (dataToExport.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }

    const csvContent = convertToCSV(dataToExport, headers, delimiter);
    downloadCSV(csvContent, filename, encoding, addBom);
} 