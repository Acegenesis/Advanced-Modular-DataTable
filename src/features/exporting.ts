import { DataTable } from "../core/DataTable";
import { getCurrentFilteredSortedData } from "./selection"; // Réutiliser pour obtenir les données pertinentes
import { CsvExportOptions } from "../core/types"; // Importer le type
import ExcelJS from 'exceljs'; // Importation de la bibliothèque ExcelJS
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    const state = instance.stateManager;
    // 1. Récupérer les données à exporter (filtrées/triées, dans l'ordre actuel)
    const dataToExport = state.getDisplayedData(); // Utiliser les données déjà traitées (ou recalculer si nécessaire)
    const columnOrder = state.getColumnOrder();
    const headers = columnOrder.map(index => instance.options.columns[index]?.title || `Colonne ${index}`);

    if (dataToExport.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }

    // 2. Préparer les données pour CSV
    // Mapping des données selon l'ordre des colonnes
    const csvData = dataToExport.map(row => 
        columnOrder.map(index => `"${String(row[index] ?? '').replace(/"/g, '""')}"`) // Échapper les guillemets
        .join(',')
    );

    // 3. Créer le contenu CSV
    const csvContent = [
        headers.map(header => `"${header.replace(/"/g, '""')}"`).join(','), // Headers échappés
        ...csvData
    ].join('\r\n'); // Séparateur de ligne Windows/standard

    // 4. Créer et télécharger le fichier
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM pour Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'datatable_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Excel Export (Utilisant ExcelJS) ---
export async function exportToExcel(instance: DataTable): Promise<void> {
    console.log("[exportToExcel - ExcelJS] Starting Excel export...");
    const state = instance.stateManager;

    // 1. Récupérer données et en-têtes
    const dataToExport = state.getDisplayedData(); 
    const columnOrder = state.getColumnOrder();
    const headers = columnOrder.map(index => instance.options.columns[index]?.title || `Colonne ${index}`);

    if (dataToExport.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }
    console.log(`[exportToExcel - ExcelJS] Exporting ${dataToExport.length} rows with ${headers.length} columns.`);

    // 2. Préparer les données pour ExcelJS (Array of Arrays)
    const excelData = dataToExport.map(row => 
        columnOrder.map(index => row[index] ?? null) // Utiliser null pour les cellules vides
    );

    const dataWithHeaders = [headers, ...excelData];
    // console.log("[exportToExcel - ExcelJS] Data prepared (first 5 rows):", dataWithHeaders.slice(0, 5));

    try {
        // 3. Créer le classeur et la feuille
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Données'); // Nom de la feuille
        console.log("[exportToExcel - ExcelJS] Workbook and worksheet created.");

        // 4. Ajouter les données
        // addRows est simple mais ne gère pas les types aussi bien que l'ajout par cellule
        // worksheet.addRows(dataWithHeaders); 
        // Méthode alternative: ajout par ligne pour un meilleur contrôle potentiel
        dataWithHeaders.forEach((rowData, rowIndex) => {
            worksheet.addRow(rowData);
            // Optionnel: appliquer des styles basiques à l'en-tête
            if (rowIndex === 0) { 
                worksheet.getRow(1).font = { bold: true };
            }
        });
        console.log("[exportToExcel - ExcelJS] Rows added to worksheet.");

        // 5. Ajuster la largeur des colonnes (plus robuste avec ExcelJS)
        worksheet.columns.forEach((column, i) => {
            let maxLength = 0;
            column.eachCell!({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? String(cell.value).length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2; // Largeur min + petit buffer
        });
        console.log("[exportToExcel - ExcelJS] Column widths adjusted.");

        // 6. Générer le buffer et déclencher le téléchargement
        // Utiliser writeBuffer car writeFile est pour Node.js
        const buffer = await workbook.xlsx.writeBuffer(); 
        console.log("[exportToExcel - ExcelJS] Buffer generated.");

        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'datatable_export.xlsx');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("[exportToExcel - ExcelJS] File download initiated.");

    } catch (error) {
        console.error("[exportToExcel - ExcelJS] Error during Excel export:", error);
        alert("Une erreur s'est produite lors de la génération du fichier Excel.");
    }
}

// --- PDF Export (NOUVEAU) ---
export function exportToPDF(instance: DataTable): void {
    console.log("[exportToPDF] Starting PDF export...");
    const state = instance.stateManager;

    // 1. Récupérer données et en-têtes
    const dataToExport = state.getDisplayedData();
    const columnOrder = state.getColumnOrder();
    // Obtenir uniquement les titres des colonnes pour l'en-tête du PDF
    const headers = columnOrder.map(index => instance.options.columns[index]?.title || `Colonne ${index}`);
    // Préparer les données du corps (body) comme tableau de tableaux de chaînes/nombres
    const body = dataToExport.map(row => 
        columnOrder.map(index => row[index] ?? '') // Utiliser valeur brute ou vide
    );

    if (body.length === 0) {
        alert("Aucune donnée à exporter.");
        return;
    }
    console.log(`[exportToPDF] Exporting ${body.length} rows with ${headers.length} columns.`);

    try {
        // 2. Initialiser jsPDF
        const doc = new jsPDF({
            orientation: 'landscape', // Optionnel: 'portrait' ou 'landscape'
            unit: 'pt',             // Unité (pt, mm, cm, in)
            format: 'a4'             // Format de page
        });
        console.log("[exportToPDF] jsPDF instance created.");

        // 3. Générer le tableau avec jspdf-autotable
        autoTable(doc, {
            head: [headers], // En-têtes doivent être dans un tableau
            body: body,     // Données du corps
            startY: 40,     // Position de départ verticale (laisser de la marge)
            theme: 'grid', // Thème visuel ('striped', 'grid', 'plain')
            styles: {        // Styles généraux
                fontSize: 8,
                cellPadding: 2,
                overflow: 'linebreak' // Gérer le dépassement de texte
            },
            headStyles: {    // Styles spécifiques pour l'en-tête
                fillColor: [22, 160, 133], // Couleur de fond (RVB)
                textColor: 255,           // Couleur texte (blanc)
                fontStyle: 'bold'
            },
            // Optionnel: ajuster la largeur des colonnes si besoin (plus complexe)
            // columnStyles: { ... }
        });
        console.log("[exportToPDF] autoTable generated.");

        // 4. Sauvegarder le PDF
        doc.save('datatable_export.pdf');
        console.log("[exportToPDF] File save initiated.");

    } catch (error) {
        console.error("[exportToPDF] Error during PDF export:", error);
        alert("Une erreur s'est produite lors de la génération du fichier PDF.");
    }
}

// --- PDF Export (Sera ajouté plus tard) ---
// export function exportToPDF(instance: DataTable): void { ... } 