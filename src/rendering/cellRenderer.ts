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
    
    if (isError) {
        cell.classList.add('text-red-600'); // Consider a more specific error class
    } else {
        cell.classList.remove('text-red-600'); // Ensure error class is removed if not an error
    }
}

/**
 * Renders cell content based on the column type definition.
 * @param cell The TD element.
 * @param data The cell data.
 * @param columnDef The column definition object.
 */
export function renderCellByType(cell: HTMLTableCellElement, data: any, columnDef: ColumnDefinition): void {
    let content: string | HTMLElement = String(data ?? ''); // Default to empty string if data is null/undefined
    const dataString = String(data ?? '');
    const type = columnDef.type; 

    switch (type) {
        case 'mail':
            if (dataString) {
                const linkMail = document.createElement('a');
                linkMail.href = `mailto:${dataString}`;
                linkMail.textContent = dataString;
                linkMail.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                content = linkMail;
            }
            break;
        case 'tel':
             if (dataString) {
                 const linkTel = document.createElement('a');
                 linkTel.href = `tel:${dataString.replace(/\s+/g, '')}`;
                 linkTel.textContent = dataString;
                 linkTel.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                 content = linkTel;
             }
            break;
        case 'money':
            const amount = parseFloat(dataString);
            if (!isNaN(amount)) {
                try {
                    const locale = columnDef.locale || navigator.language || 'fr-FR'; // Use browser locale as fallback
                    const currency = columnDef.currency || 'EUR'; 
                    content = new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
                } catch (e) {
                     console.error("Erreur formatage monétaire:", e, { data, locale: columnDef.locale, currency: columnDef.currency });
                     content = dataString + " (Err)"; 
                }
            } else if (dataString) { // Only show NaN if there was input data
                content = dataString + " (NaN)"; 
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
                 }
             } else if (dataString) {
                 content = dataString + " (NaN)";
             }
             break;
        // case 'string': // Explicit string handling (usually default)
        // default:
            // content remains as String(data ?? '')
    }
    appendRenderedContent(cell, content);
} 