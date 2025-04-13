import { ColumnDefinition } from "../core/types";

// --- Cell Rendering Logic ---

/**
 * Appends content to a table cell, handling different content types.
 * @param cell The TD element.
 * @param content The content to append (string, HTMLElement, DocumentFragment, or other).
 * @param isError If true, adds an error class.
 */
export function appendRenderedContent(cell: HTMLTableCellElement, content: any, isError: boolean = false): void {
    // Clear previous content
    while(cell.firstChild) { cell.removeChild(cell.firstChild); }
    
    // Append new content
    if (content instanceof HTMLElement || content instanceof DocumentFragment) {
         cell.appendChild(content); 
    } else if (typeof content === 'string') {
         // Be cautious with innerHTML for security if content can be user-generated
         cell.innerHTML = content; 
    } else {
        // Default to textContent for safety
        cell.textContent = String(content ?? ''); // Handle null/undefined
    }
    
    // Manage error class
    if (isError) {
        cell.classList.add('dt-cell-error', 'text-red-600'); // Use specific and utility class
    } else {
        cell.classList.remove('dt-cell-error', 'text-red-600');
    }
}

/**
 * Renders cell content based on the column type definition.
 * @param cell The TD element.
 * @param data The cell data.
 * @param columnDef The column definition object.
 */
export function renderCellByType(cell: HTMLTableCellElement, data: any, columnDef: ColumnDefinition): void {
    let content: string | HTMLElement = String(data ?? ''); // Default to empty string
    const dataString = String(data ?? '');
    const type = columnDef.type; 
    let isError = false;

    switch (type) {
        case 'mail':
            if (dataString) {
                const linkMail = document.createElement('a');
                linkMail.href = `mailto:${dataString}`;
                linkMail.textContent = dataString;
                // Consider adding target="_blank" and rel="noopener noreferrer" for security/UX
                linkMail.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                content = linkMail;
            }
            break;
        case 'tel':
             if (dataString) {
                 const linkTel = document.createElement('a');
                 linkTel.href = `tel:${dataString.replace(/\s+/g, '')}`; // Clean for href
                 linkTel.textContent = dataString;
                 linkTel.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                 content = linkTel;
             }
            break;
        case 'money':
            const amount = parseFloat(dataString);
            if (!isNaN(amount)) {
                try {
                    // Use navigator.language as a fallback for locale
                    const locale = columnDef.locale || navigator.language || 'fr-FR';
                    const currency = columnDef.currency || 'EUR';
                    content = new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
                } catch (e) {
                     console.error("Erreur formatage monétaire:", e, { data, locale: columnDef.locale, currency: columnDef.currency });
                     content = dataString + " (Err)";
                     isError = true;
                }
            } else if (dataString) { // Only show NaN if there was non-empty input data
                content = dataString + " (NaN)";
                isError = true;
            }
            break;
        case 'number':
             const num = parseFloat(dataString);
             if (!isNaN(num)) {
                 const locale = columnDef.locale || navigator.language || 'fr-FR';
                 try {
                    content = new Intl.NumberFormat(locale).format(num);
                 } catch(e) {
                    console.error("Erreur formatage nombre:", e, { data, locale: columnDef.locale });
                    content = dataString + " (Err)";
                    isError = true;
                 }
             } else if (dataString) {
                 content = dataString + " (NaN)";
                 isError = true;
             }
             break;
        // Default case handles 'string' type implicitly
        // default:
        //     content = dataString;
    }
    // Pass isError flag to appendRenderedContent
    appendRenderedContent(cell, content, isError);
} 