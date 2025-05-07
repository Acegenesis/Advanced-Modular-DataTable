import { DataTable } from "../core/DataTable";
import { getCurrentFilteredSortedData } from "./selection"; // Réutiliser pour obtenir les données pertinentes
import { CsvExportOptions } from "../core/types"; // Importer le type
import ExcelJS from 'exceljs'; // Importation de la bibliothèque ExcelJS
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Échappe une valeur pour une utilisation dans un CSV (guillemets si nécessaire).
 */
function escapeCsvValue(value: any): string {
    const stringValue = (value === null || value === undefined) ? '' : String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        // Doubler les guillemets existants et entourer de guillemets
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

/**
 * Génère une chaîne CSV à partir des données et des en-têtes.
 * @param instance DataTable instance.
 * @param data Les données à exporter (généralement filtrées/triées).
 * @returns La chaîne CSV complète.
 */
function generateCsvString(instance: DataTable, data: any[][]): string {
    const state = instance.state;
    const columns = instance.options.columns;
    const columnOrder = state.getColumnOrder();
    const visibleColumns = state.getVisibleColumns();

    // Créer les en-têtes basés sur l'ordre et la visibilité actuels
    const headers = columnOrder
        .filter(index => visibleColumns.has(index))
        .map(index => escapeCsvValue(columns[index]?.title || `Colonne ${index}`));
    
    let csvContent = headers.join(',') + '\r\n'; // En-têtes CSV

    // Ajouter les lignes de données
    data.forEach(row => {
        const rowValues = columnOrder
            .filter(index => visibleColumns.has(index))
            .map(index => escapeCsvValue(row[index]));
        csvContent += rowValues.join(',') + '\r\n';
    });

    return csvContent;
}

/**
 * Déclenche le téléchargement d'un fichier texte (utilisé pour CSV/Excel simplifié).
 */
function triggerDownload(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Exporte les données actuellement visibles (filtrées/triées) au format CSV.
 */
export function exportToCSV(instance: DataTable): void {
    console.log("[Export] Exporting to CSV...");
    try {
        const dataToExport = getCurrentFilteredSortedData(instance);
        if (dataToExport.length === 0) {
            console.warn("[Export CSV] Aucune donnée à exporter.");
            alert("Aucune donnée à exporter."); // Informer l'utilisateur
            return;
        }
        const csvString = generateCsvString(instance, dataToExport);
        triggerDownload(csvString, 'export.csv', 'text/csv;charset=utf-8;');
        console.log("[Export CSV] Exportation réussie.");
    } catch (error) {
        console.error("[Export CSV] Erreur lors de l'exportation:", error);
        alert("Une erreur est survenue lors de l'exportation CSV.");
    }
}

/**
 * Exporte les données actuellement visibles (filtrées/triées) dans un fichier .xlsx
 * (en utilisant le format CSV encapsulé, lisible par Excel).
 */
export function exportToExcel(instance: DataTable): void {
     console.log("[Export] Exporting to Excel (CSV format)...");
     try {
         const dataToExport = getCurrentFilteredSortedData(instance);
          if (dataToExport.length === 0) {
             console.warn("[Export Excel] Aucune donnée à exporter.");
             alert("Aucune donnée à exporter.");
             return;
         }
         // Ajouter un BOM UTF-8 pour une meilleure compatibilité Excel avec les caractères spéciaux
         const BOM = '\uFEFF'; 
         const csvString = generateCsvString(instance, dataToExport);
         triggerDownload(BOM + csvString, 'export.xlsx', 'text/csv;charset=utf-8;'); // Utiliser .xlsx mais MIME CSV
         console.log("[Export Excel] Exportation réussie.");
    } catch (error) {
        console.error("[Export Excel] Erreur lors de l'exportation:", error);
        alert("Une erreur est survenue lors de l'exportation Excel.");
    }
}

// Fonction pour PDF (non implémentée par défaut)
export function exportToPDF(instance: DataTable): void {
    console.warn("[Export PDF] La fonction d'exportation PDF n'est pas implémentée par défaut.");
    alert("L'exportation PDF n'est pas disponible pour le moment.");
    // Logique nécessitant jspdf / jspdf-autotable...
}

// --- Excel Export (Utilisant ExcelJS) ---
export async function exportToExcelJS(instance: DataTable): Promise<void> {
    console.log("[exportToExcel - ExcelJS] Starting Excel export...");
    const state = instance.state;

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
export function exportToPDFJS(instance: DataTable): void {
    console.log("[exportToPDF] Starting PDF export...");
    const state = instance.state;

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