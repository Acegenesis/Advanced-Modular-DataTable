// Point d'entrée principal du package

// Type pour définir une colonne
interface ColumnDefinition {
    title: string; 
    type?: 'string' | 'number' | 'mail' | 'tel' | 'money'; 
    render?: (cellData: any, rowData: any[]) => string | HTMLElement | DocumentFragment; 
    sortable?: boolean; 
    searchable?: boolean; 
    locale?: string; 
    currency?: string; 
    width?: string; // Nouvelle propriété optionnelle pour la largeur (ex: '150px', '20%')
}

// Interface pour les actions
interface RowAction {
    label: string;        
    actionId: string;     
    className?: string;   
}

// Options principales
interface DataTableOptions {
    columns: ColumnDefinition[]; 
    data: any[][];    
    pagination?: {
        enabled: boolean;
        rowsPerPage?: number; 
    };
    sorting?: {
        enabled: boolean;
    };
    searching?: {
        enabled: boolean;
        debounceTime?: number; 
    };
    rowActions?: RowAction[];
    processingMode?: 'client' | 'server'; // 'client' (default) or 'server'
    serverSideTotalRows?: number;      // Required if processingMode is 'server'
    selection?: {
        enabled: boolean;
        mode?: 'single' | 'multiple'; // Défaut 'multiple' si activé
        initialSelectedIds?: any[];   // IDs des lignes initialement sélectionnées (basé sur rowData[0])
    };
}

type SortDirection = 'asc' | 'desc' | 'none';

export class DataTable {
    private element: HTMLElement;
    private options: DataTableOptions;
    private currentPage: number = 1;
    private rowsPerPage: number = 10; 
    private totalRows: number = 0;
    private sortColumnIndex: number | null = null;
    private sortDirection: SortDirection = 'none';
    private originalData: any[][]; // Holds original data in client mode, or current page data in server mode
    private filterTerm: string = '';
    private debounceTimer: number | null = null;
    private isServerSide: boolean = false;
    private selectionEnabled: boolean = false;
    private selectionMode: 'single' | 'multiple' = 'multiple';
    private selectedRowIds: Set<any> = new Set();
    private selectAllCheckbox: HTMLInputElement | null = null;

    constructor(elementId: string, options: DataTableOptions) {
        const targetElement = document.getElementById(elementId);
        if (!targetElement) {
            throw new Error(`Element with ID "${elementId}" not found.`);
        }
        this.element = targetElement;

        // --- Options Setup --- 
        this.options = { ...options }; 
        // Deep copy sensitive options
        if (options.columns) {
            this.options.columns = options.columns.map(col => ({ ...col }));
        }
        if (options.pagination) {
            this.options.pagination = { ...options.pagination };
        }
         if (options.sorting) {
            this.options.sorting = { ...options.sorting };
        }
         if (options.searching) {
            this.options.searching = { ...options.searching };
        }
        if (options.rowActions) {
            this.options.rowActions = options.rowActions.map(action => ({ ...action }));
        }
        
        // --- Mode Setup --- 
        this.isServerSide = options.processingMode === 'server';
        
        // --- Data Setup --- 
        this.originalData = options.data ? JSON.parse(JSON.stringify(options.data)) : [];
        if (this.isServerSide) {
            this.totalRows = options.serverSideTotalRows ?? 0;
        } else {
        this.totalRows = this.originalData.length;
        }

        // --- Pagination Setup --- 
        if (this.options.pagination?.enabled) {
            this.rowsPerPage = this.options.pagination.rowsPerPage ?? 10;
        }
        this.currentPage = 1;

        // --- Initial State --- 
        this.sortColumnIndex = null;
        this.sortDirection = 'none';
        this.filterTerm = '';
        this.debounceTimer = null;

        // --- Initialisation Sélection --- 
        if (options.selection?.enabled) {
            this.selectionEnabled = true;
            this.selectionMode = options.selection.mode ?? 'multiple';
            if (options.selection.initialSelectedIds) {
                this.selectedRowIds = new Set(options.selection.initialSelectedIds);
            }
            console.log(`DataTable: Sélection ${this.selectionMode} activée.`);
        }
        // ------------------------------

        // Initial Render
        this.render(); 
    }

    // --- Public API Method: Destroy --- 
    public destroy(): void {
        this.element.innerHTML = '';
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        // Remove other listeners if any were added directly to document/window
        console.log("DataTable instance destroyed");
    }

    // --- Core Rendering Logic --- 
    private render(): void {
        this.element.innerHTML = ''; 
        const mainContainer = document.createElement('div'); 

        // 1. Search Input
        if (this.options.searching?.enabled) {
            this.renderSearchInput(mainContainer); 
        }
 
        // 2. Data Preparation (Filter/Sort only in client mode)
        let dataToDisplay = this.isServerSide ? [...this.originalData] : [...this.originalData]; // Start with appropriate data
        if (!this.isServerSide) {
            const filteredData = this.getFilteredData(dataToDisplay); // Pass data to filter
            const sortedData = this.sortDataIfEnabled(filteredData);   // Pass filtered data to sort
            dataToDisplay = sortedData; // Final data for client-side display
            this.totalRows = dataToDisplay.length; // Update total based on filtered/sorted data
        } // In server mode, totalRows is already set, dataToDisplay is the current page.

        // 3. Table Structure
        const tableContainer = document.createElement('div');
        tableContainer.className = 'mt-6 shadow overflow-x-auto border-b border-gray-200 sm:rounded-lg'; // overflow-x-auto added

        const table = document.createElement('table');
        table.className = 'min-w-full border-collapse table-fixed'; // Use table-layout: fixed !
        table.style.width = '100%';
        table.setAttribute('role', 'grid');
 
        // 4. Render Header & Body
        this.renderHeader(table);
        this.renderStandardBody(table, dataToDisplay); // Rend le TBODY standard
        this.updateSelectAllCheckboxState(); 
       
        tableContainer.appendChild(table);
        mainContainer.appendChild(tableContainer);
        this.element.appendChild(mainContainer);
 
        // 5. Render Pagination (if applicable)
        if (this.options.pagination?.enabled && this.totalRows > this.rowsPerPage) {
            this.renderPaginationControls(); 
        }

        // 6. Dispatch Render Complete Event
        this.dispatchEvent('dt:renderComplete');
    }

    // --- Rendering Helper Methods --- 

    private renderSearchInput(parentElement: HTMLElement): void {
        const inputId = `datatable-search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.className = 'sr-only'; 
        label.textContent = this.isServerSide ? 'Rechercher dans les données' : 'Filtrer le tableau';
        parentElement.appendChild(label);
        
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Rechercher...';
        searchInput.className = 'block w-full md:w-1/2 mb-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';
        searchInput.value = this.filterTerm;
        searchInput.id = inputId;
        searchInput.setAttribute('role', 'searchbox');
        searchInput.setAttribute('aria-controls', this.element.id + '-tbody'); 

        searchInput.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            const searchTerm = target.value;
            const debounceTime = this.options.searching?.debounceTime ?? 300;

            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = window.setTimeout(() => {
                this.filterTerm = searchTerm;
                this.currentPage = 1; // Reset to page 1 on search
                this.dispatchEvent('dt:search', { searchTerm: this.filterTerm });
                if (!this.isServerSide) {
                     this.render(); // Re-render only in client mode
                }
            }, debounceTime);
        });
        parentElement.appendChild(searchInput); 
    }

    private renderHeader(table: HTMLTableElement): void {
        const thead = table.createTHead();
        thead.className = 'bg-gray-50'; 
        // --- Apply sticky header styles --- 
        thead.style.position = 'sticky';
        thead.style.top = '0';
        thead.style.zIndex = '10'; // Ensure it stays above body content
        // ----------------------------------
        const headerRow = thead.insertRow();
        headerRow.setAttribute('role', 'row');

        // --- Ajouter la colonne checkbox "Select All" si activé ---
        if (this.selectionEnabled && this.selectionMode === 'multiple') { // Seulement en multiple
            const thCheckbox = document.createElement('th');
            thCheckbox.scope = 'col';
            thCheckbox.setAttribute('role', 'columnheader');
            // Ajuster padding, etc. pour la checkbox
            thCheckbox.className = 'px-4 py-3 text-center w-12'; 
            thCheckbox.style.boxSizing = 'border-box';

            this.selectAllCheckbox = document.createElement('input');
            this.selectAllCheckbox.type = 'checkbox';
            this.selectAllCheckbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
            // Mettre à jour l'état initial lors du rendu
            this.updateSelectAllCheckboxState(); 
            this.selectAllCheckbox.setAttribute('aria-label', 'Sélectionner toutes les lignes visibles');

            this.selectAllCheckbox.addEventListener('change', (event) => {
                const isChecked = (event.target as HTMLInputElement).checked;
                this.handleSelectAllClick(isChecked);
            });

            thCheckbox.appendChild(this.selectAllCheckbox);
            headerRow.appendChild(thCheckbox);
        }
        // -------------------------------------------------------

        this.options.columns.forEach((columnDef, index) => { 
            const th = document.createElement('th');
            th.scope = 'col';
            th.setAttribute('role', 'columnheader');
            th.className = 'px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis'; // Ajout overflow/ellipsis
            th.style.boxSizing = 'border-box'; 
            
            // --- Appliquer la largeur si spécifiée --- 
            if (columnDef.width) {
                th.style.width = columnDef.width;
            }
            // -------------------------------------

            const titleSpan = document.createElement('span');
            titleSpan.textContent = columnDef.title || ''; 
            th.appendChild(titleSpan);

            const isSortable = this.options.sorting?.enabled && columnDef.sortable !== false;
            if (isSortable) { 
                th.classList.add('cursor-pointer', 'hover:bg-gray-100', 'transition-colors', 'duration-150'); 
                th.addEventListener('click', () => this.handleSortClick(index));
                
                let indicatorSymbol = '';
                let ariaSortValue: "ascending" | "descending" | "none" = "none";
                let sortDescription = '';

                if (this.sortColumnIndex === index && this.sortDirection !== 'none') {
                    indicatorSymbol = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
                    ariaSortValue = this.sortDirection === 'asc' ? 'ascending' : 'descending';
                    th.classList.add('bg-gray-100'); 
                    sortDescription = this.sortDirection === 'asc' ? 'trié par ordre croissant' : 'trié par ordre décroissant';
                 } else {
                    indicatorSymbol = ' ↕'; 
                    ariaSortValue = 'none'; 
                    sortDescription = 'non trié';
                 }
                 const indicatorSpan = document.createElement('span');
                 indicatorSpan.className = 'ml-1'; 
                 indicatorSpan.setAttribute('aria-hidden', 'true'); // Hide decorative indicator
                 indicatorSpan.textContent = indicatorSymbol;
                 th.appendChild(indicatorSpan);
                 th.setAttribute('aria-sort', ariaSortValue);
                 
                 const accessibleDescription = document.createElement('span');
                 accessibleDescription.className = 'sr-only'; 
                 accessibleDescription.textContent = `, ${sortDescription}, cliquez pour changer l'ordre de tri`;
                 th.appendChild(accessibleDescription);
            } 
            headerRow.appendChild(th);
        });
        
        // Add header for actions column if needed
        if (this.options.rowActions && this.options.rowActions.length > 0) {
            const thActions = document.createElement('th');
            // --- Appliquer une largeur spécifique pour la colonne Action si possible ---
            // Recherche d'une définition de colonne "Actions" potentielle (peu probable)
            // ou définition d'une largeur par défaut/via une option globale ?
            // Pour l'instant, on laisse le navigateur décider ou on utilise une largeur fixe via CSS externe.
            // Alternative : Ajouter une option globale `options.actionColumnWidth = '120px'`
            thActions.scope = 'col';
            thActions.setAttribute('role', 'columnheader');
            thActions.className = 'px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis';
            thActions.textContent = 'Actions'; 
            thActions.style.boxSizing = 'border-box';
            headerRow.appendChild(thActions);
        }
    }

    // This is the primary body rendering method now
    private renderStandardBody(table: HTMLTableElement, data: any[][]): void {
        let tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.remove(); // Remove old tbody if exists
        }
        tbody = table.createTBody();
        tbody.className = 'bg-white divide-y divide-gray-200';
        tbody.id = this.element.id + '-tbody'; 

        // Determine which data to render based on pagination (client mode only)
        const dataToRender = this.options.pagination?.enabled && !this.isServerSide
            ? this.getCurrentPageData(data)
            : data;

        if (dataToRender.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
           const totalColumnCount = this.options.columns.length + (this.options.rowActions && this.options.rowActions.length > 0 ? 1 : 0);
           cell.colSpan = totalColumnCount;
           cell.className = 'px-6 py-12 text-center text-sm text-gray-500';
            cell.textContent = this.filterTerm ? 'Aucun résultat trouvé pour votre recherche.' : 'Aucune donnée à afficher.';
           return;
        }

        // Render rows
        dataToRender.forEach(rowData => {
            const row = tbody!.insertRow(); 
            // --- Appliquer la classe si sélectionné --- 
            const rowId = rowData[0]; // Assumer ID en colonne 0
            const isSelected = this.selectedRowIds.has(rowId);
            row.className = `hover:bg-gray-50 transition-colors duration-150 ${isSelected ? 'dt-row-selected bg-indigo-50' : ''}`;
            // -----------------------------------------
            row.setAttribute('role', 'row');
            row.setAttribute('aria-selected', isSelected ? 'true' : 'false'); // A11y

            // --- Ajouter la cellule checkbox si activé ---
            if (this.selectionEnabled) {
                const tdCheckbox = row.insertCell();
                tdCheckbox.className = 'px-4 py-4 text-center align-middle'; // Ajuster padding
                tdCheckbox.setAttribute('role', 'gridcell');

                const rowCheckbox = document.createElement('input');
                rowCheckbox.type = 'checkbox';
                rowCheckbox.className = 'form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500';
                rowCheckbox.checked = isSelected;
                rowCheckbox.setAttribute('aria-label', `Sélectionner ligne ${rowId}`);

                rowCheckbox.addEventListener('change', (event) => {
                    const isChecked = (event.target as HTMLInputElement).checked;
                    this.handleRowCheckboxClick(rowId, rowData, isChecked, row);
                });
                 tdCheckbox.appendChild(rowCheckbox);
            }
            // ------------------------------------------

            rowData.forEach((cellData, cellIndex) => {
                const cell = row.insertCell();
                // Apply standard cell classes + overflow handling needed with table-fixed
                cell.className = 'px-6 py-4 text-sm text-gray-800 align-middle whitespace-nowrap overflow-hidden text-ellipsis';
                cell.setAttribute('role', 'gridcell');
                const columnDef = this.options.columns[cellIndex]; 

                if (columnDef && typeof columnDef.render === 'function') { 
                    try { this.appendRenderedContent(cell, columnDef.render(cellData, rowData)); }
                    catch (error) { console.error('Render error:', error); this.appendRenderedContent(cell, '[Erreur Rendu]', true); }
                } else if (columnDef && columnDef.type) {
                    this.renderCellByType(cell, cellData, columnDef);
                } else {
                    this.appendRenderedContent(cell, cellData); 
                }
            });

            if (this.options.rowActions && this.options.rowActions.length > 0) {
                this.renderActionButtons(row, rowData);
            }
        });
    }

    private renderPaginationControls(): void {
        let paginationContainer = this.element.querySelector('#dt-pagination-controls');
        if (paginationContainer) { paginationContainer.remove(); } // Remove old controls

        paginationContainer = document.createElement('div');
        paginationContainer.id = 'dt-pagination-controls';
        paginationContainer.className = 'bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-1';
        paginationContainer.setAttribute('role', 'navigation');
        paginationContainer.setAttribute('aria-label', 'Pagination');

        const currentTotalRows = this.totalRows; 
        const totalPages = Math.ceil(currentTotalRows / this.rowsPerPage);
        const startItem = currentTotalRows === 0 ? 0 : (this.currentPage - 1) * this.rowsPerPage + 1;
        const endItem = Math.min(startItem + this.rowsPerPage - 1, currentTotalRows);

        const flexContainer = document.createElement('div');
        flexContainer.className = 'flex-1 flex justify-between sm:hidden'; 
        // Add mobile buttons if needed

        const hiddenOnMobileContainer = document.createElement('div');
        hiddenOnMobileContainer.className = 'hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'; 

        const infoContainer = document.createElement('div');
        infoContainer.className = 'text-sm text-gray-700';
        infoContainer.setAttribute('aria-live', 'polite'); 
        const p = document.createElement('p'); 
        if (currentTotalRows > 0) {
            p.innerHTML = `Affichage <span class="font-medium text-gray-900">${startItem}</span> à <span class="font-medium text-gray-900">${endItem}</span> sur <span class="font-medium text-gray-900">${currentTotalRows}</span> résultats`;
        } else {
            p.textContent = 'Aucun résultat';
        }
        infoContainer.appendChild(p);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px'; 

        const prevButton = document.createElement('button');
        prevButton.disabled = this.currentPage === 1;
        prevButton.className = 'relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
        prevButton.setAttribute('aria-label', 'Page précédente');
        if (prevButton.disabled) {
            prevButton.setAttribute('aria-disabled', 'true');
        }
        prevButton.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
        prevButton.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.dispatchPageChangeEvent();
                if (!this.isServerSide) {
                    this.render(); 
                }
            }
        });

        const nextButton = document.createElement('button');
        nextButton.disabled = this.currentPage === totalPages || currentTotalRows === 0;
        nextButton.className = 'relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
        nextButton.setAttribute('aria-label', 'Page suivante');
        if (nextButton.disabled) {
            nextButton.setAttribute('aria-disabled', 'true');
        }
        nextButton.innerHTML = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(this.totalRows / this.rowsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.dispatchPageChangeEvent();
                if (!this.isServerSide) {
                     this.render(); 
                }
            }
        });

        buttonContainer.appendChild(prevButton);
        buttonContainer.appendChild(nextButton);

        hiddenOnMobileContainer.appendChild(infoContainer);
        hiddenOnMobileContainer.appendChild(buttonContainer);

        paginationContainer.appendChild(flexContainer); 
        paginationContainer.appendChild(hiddenOnMobileContainer);

        this.element.appendChild(paginationContainer); 
    }
    
    // --- Data Handling Methods --- 

    private getFilteredData(data: any[][]): any[][] {
        if (!this.options.searching?.enabled || !this.filterTerm) {
            return data; // Return original data passed (or copy if needed?)
        }
        // Client-side filtering logic (only called if !isServerSide)
        const searchTermLower = this.filterTerm.toLowerCase();
        return data.filter(row => {
            for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
                const columnDef = this.options.columns[cellIndex];
                const isSearchable = !columnDef || columnDef.searchable !== false; 
                if (isSearchable) {
                    if (String(row[cellIndex]).toLowerCase().includes(searchTermLower)) {
                        return true; 
                    }
                } 
            }
            return false; 
        });
    }

    private sortDataIfEnabled(dataToSort: any[][]): any[][] {
        if (!this.options.sorting?.enabled || this.sortColumnIndex === null || this.sortDirection === 'none') {
            return dataToSort;
        }
        // Client-side sorting logic (only called if !isServerSide)
        const sortedData = [...dataToSort]; // Sort copy
        const columnIndex = this.sortColumnIndex;
        const direction = this.sortDirection;

        sortedData.sort((a, b) => {
            const valA = a[columnIndex];
            const valB = b[columnIndex];
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);
            if (!isNaN(numA) && !isNaN(numB)) {
                return direction === 'asc' ? numA - numB : numB - numA;
            }
            const strA = String(valA);
            const strB = String(valB);
            if (strA < strB) return direction === 'asc' ? -1 : 1;
            if (strA > strB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sortedData;
    }

    private handleSortClick(columnIndex: number): void {
        const columnDef = this.options.columns[columnIndex];
        if (!this.options.sorting?.enabled || !columnDef || columnDef.sortable === false) {
             return; 
        }
        let newDirection: SortDirection;
        if (this.sortColumnIndex === columnIndex) {
            newDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            newDirection = 'asc';
        }
        this.sortColumnIndex = columnIndex;
        this.sortDirection = newDirection;
        this.currentPage = 1; // Reset to page 1 on sort

        this.dispatchEvent('dt:sortChange', { 
            sortColumnIndex: this.sortColumnIndex, 
            sortDirection: this.sortDirection 
        });

        if (!this.isServerSide) {
             this.render(); 
        }
    }

    private getCurrentPageData(sourceData: any[][]): any[][] {
        if (!this.options.pagination?.enabled) {
            return sourceData;
        }
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        return sourceData.slice(startIndex, endIndex);
    }

    // --- Cell Rendering Helpers --- 

    private renderActionButtons(row: HTMLTableRowElement, rowData: any[]): HTMLTableCellElement | null {
        const cell = row.insertCell();
        cell.className = 'px-6 py-4 text-sm text-gray-800 border-b border-gray-200 text-right align-middle whitespace-nowrap'; // Adjusted classes
        this.options.rowActions?.forEach((actionDef, index) => {
            const button = document.createElement('button');
            button.textContent = actionDef.label;
            button.className = `text-indigo-600 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${index > 0 ? 'ml-4' : ''} ${actionDef.className || ''}`;
            button.type = 'button';
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                this.dispatchEvent('dt:actionClick', { 
                    action: actionDef.actionId, 
                    rowData: rowData 
                });
            });
            cell.appendChild(button);
        });
        return cell; 
    }

    private appendRenderedContent(cell: HTMLTableCellElement, content: any, isError: boolean = false): void {
        // Clear previous content
        while(cell.firstChild) { cell.removeChild(cell.firstChild); }
        // Append new content
        if (content instanceof HTMLElement || content instanceof DocumentFragment) {
             cell.appendChild(content); 
        } else if (typeof content === 'string') {
             cell.innerHTML = content;
        } else {
            cell.textContent = String(content);
        }
        if (isError) {
            cell.classList.add('text-red-600');
        }
    }

    private renderCellByType(cell: HTMLTableCellElement, data: any, columnDef: ColumnDefinition): void {
        let content: string | HTMLElement = String(data); 
        const dataString = String(data);
        const type = columnDef.type; 

        switch (type) {
            case 'mail':
                const linkMail = document.createElement('a');
                linkMail.href = `mailto:${dataString}`;
                linkMail.textContent = dataString;
                linkMail.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                content = linkMail;
                break;
            case 'tel':
                 const linkTel = document.createElement('a');
                 linkTel.href = `tel:${dataString.replace(/\s+/g, '')}`;
                 linkTel.textContent = dataString;
                 linkTel.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                 content = linkTel;
                break;
            case 'money':
                const amount = parseFloat(dataString);
                if (!isNaN(amount)) {
                    try {
                        const locale = columnDef.locale || 'fr-FR'; 
                        const currency = columnDef.currency || 'EUR'; 
                        content = new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
                    } catch (e) {
                         console.error("Erreur formatage monétaire:", e);
                         content = dataString + " (Err)"; 
                    }
                } else {
                    content = dataString + " (NaN)"; 
                }
                break;
            case 'number':
                 const num = parseFloat(dataString);
                 if (!isNaN(num)) {
                     const locale = columnDef.locale || 'fr-FR'; 
                     content = new Intl.NumberFormat(locale).format(num);
                 } else {
                     content = dataString + " (NaN)";
                 }
                 break;
        }
        this.appendRenderedContent(cell, content);
    }

    // --- Event Helpers --- 
    private dispatchPageChangeEvent(): void {
         this.dispatchEvent('dt:pageChange', { 
            currentPage: this.currentPage,
            rowsPerPage: this.rowsPerPage,
            totalRows: this.totalRows
        });
    }
    private dispatchEvent<T>(eventName: string, detail?: T): void {
        const event = new CustomEvent<T>(eventName, { 
            detail: detail,
            bubbles: true,
            cancelable: true
        });
        this.element.dispatchEvent(event);
    }

    // --- Public API Methods --- 
    public setData(newData: any[][]): void {
        if (!Array.isArray(newData)) {
            console.error("setData: Les nouvelles données doivent être un tableau.");
            return;
        }
        this.originalData = JSON.parse(JSON.stringify(newData));
        if (this.isServerSide) {
             this.totalRows = this.options.serverSideTotalRows ?? this.originalData.length; // Use server total if provided
        } else {
             // totalRows will be recalculated in render based on filtered/sorted data
        }
        this.currentPage = 1;
        this.filterTerm = '';
        this.sortColumnIndex = null;
        this.sortDirection = 'none';
        this.render(); // Re-render with new data
        this.dispatchEvent('dt:dataChange', { source: 'setData' });
    }
    public addRow(rowData: any[]): void {
        if (!Array.isArray(rowData)) {
             console.error("addRow: La nouvelle ligne doit être un tableau.");
             return;
        }
        // Note: In server mode, adding directly might desync. Prefer server-side add then setData.
        this.originalData.push(JSON.parse(JSON.stringify(rowData)));
        if (this.isServerSide) { 
             console.warn("addRow appelé en mode serveur...");
             if (this.options.serverSideTotalRows !== undefined) {
                 this.options.serverSideTotalRows++;
                 this.totalRows = this.options.serverSideTotalRows;
             }
             this.render(); // Re-render pagination etc.
        } else {
            // Client mode: render will recalculate totalRows and display
            this.render(); 
        }
         this.dispatchEvent('dt:dataChange', { source: 'addRow', addedRow: rowData });
    }
    public deleteRowById(id: any, idColumnIndex: number = 0): boolean {
        const initialLength = this.originalData.length;
        this.originalData = this.originalData.filter(row => row[idColumnIndex] !== id);
        const rowDeleted = this.originalData.length < initialLength;
        if (rowDeleted) {
             // Note: In server mode, deleting directly might desync. Prefer server-side delete then setData.
            if (this.isServerSide) { 
                 console.warn("deleteRowById appelé en mode serveur...");
                 if (this.options.serverSideTotalRows !== undefined) {
                    this.options.serverSideTotalRows--;
                    this.totalRows = this.options.serverSideTotalRows;
                 }
                 // Adjust page if necessary (server mode relies on external fetch)
                 const totalPages = Math.max(1, Math.ceil(this.totalRows / this.rowsPerPage));
                 if (this.currentPage > totalPages) {
                     this.currentPage = totalPages;
                 }
                  this.render(); // Re-render pagination etc.
            } else {
                // Client mode: render will recalculate totalRows and display
                this.render(); 
            }
             this.dispatchEvent('dt:dataChange', { source: 'deleteRowById', deletedId: id });
        } else {
            console.warn(`deleteRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
        }
        return rowDeleted;
    }
    public updateRowById(id: any, newRowData: any[], idColumnIndex: number = 0): boolean {
         if (!Array.isArray(newRowData)) {
             console.error("updateRowById: Les nouvelles données de ligne doivent être un tableau.");
             return false;
         }
         // Note: In server mode, updating directly might desync. Prefer server-side update then setData.
        const rowIndex = this.originalData.findIndex(row => row[idColumnIndex] === id);
        if (rowIndex !== -1) {
            this.originalData[rowIndex] = JSON.parse(JSON.stringify(newRowData));
            if (this.isServerSide) {
                console.warn("updateRowById appelé en mode serveur...");
            }
            // Render will display the updated data (client or server)
            this.render();
            this.dispatchEvent('dt:dataChange', { source: 'updateRowById', updatedId: id, newRowData: newRowData });
            return true;
        } else {
             console.warn(`updateRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
            return false;
        }
    }

    // --- Nouvelles Méthodes de Gestion de la Sélection ---

    private handleSelectAllClick(isChecked: boolean): void {
        // Obtenir TOUTES les données filtrées/triées (pertinentes pour la sélection globale)
        const allRelevantData = this.getCurrentFilteredSortedData(); 

        // Mettre à jour l'état interne pour TOUTES les lignes pertinentes
        allRelevantData.forEach(rowData => {
            const rowId = rowData[0]; // Assumer ID en colonne 0
            if (isChecked) {
                this.selectedRowIds.add(rowId);
            } else {
                this.selectedRowIds.delete(rowId);
            }
        });

        // --- Mettre à jour l'UI directement --- 
        const tbody = this.element.querySelector(`#${this.element.id}-tbody`);
        if (tbody) {
            const rows = tbody.querySelectorAll('tr[role="row"]');
            // On suppose que les lignes visibles dans le DOM correspondent à visibleRowsData
            // C'est le cas après un rendu normal. 
            rows.forEach((rowElement) => {
                const checkbox = rowElement.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
                // Pour retrouver l'ID, on pourrait le stocker en data-attribute, 
                // mais pour 'select all', on applique juste l'état global 'isChecked'.
                if (checkbox) {
                    checkbox.checked = isChecked;
                }
                if (isChecked) {
                    rowElement.classList.add('dt-row-selected', 'bg-indigo-50');
                    rowElement.setAttribute('aria-selected', 'true');
                } else {
                    rowElement.classList.remove('dt-row-selected', 'bg-indigo-50');
                    rowElement.setAttribute('aria-selected', 'false');
                }
            });
        }
        // ------------------------------------

        this.updateSelectAllCheckboxState(); // Mettre à jour l'état de la checkbox "select all"
        this.dispatchSelectionChangeEvent();
    }

    private handleRowCheckboxClick(rowId: any, rowData: any[], isChecked: boolean, rowElement: HTMLTableRowElement): void {
        if (isChecked) {
            if (this.selectionMode === 'single') {
                this.selectedRowIds.clear(); // Désélectionner les autres en mode single
            }
            this.selectedRowIds.add(rowId);
            rowElement.classList.add('dt-row-selected', 'bg-indigo-50');
            rowElement.setAttribute('aria-selected', 'true');
        } else {
            this.selectedRowIds.delete(rowId);
            rowElement.classList.remove('dt-row-selected', 'bg-indigo-50');
            rowElement.setAttribute('aria-selected', 'false');
        }

        this.updateSelectAllCheckboxState(); // Mettre à jour l'état de la checkbox "select all"
        this.dispatchSelectionChangeEvent();
    }

    // Met à jour l'état checked/indeterminate de la checkbox "select all"
    private updateSelectAllCheckboxState(): void {
        if (!this.selectAllCheckbox || this.selectionMode === 'single') return;

        // Baser l'état sur TOUTES les données filtrées/triées
        const allRelevantData = this.getCurrentFilteredSortedData();

        if (allRelevantData.length === 0) {
            this.selectAllCheckbox.checked = false;
            this.selectAllCheckbox.indeterminate = false;
            return;
        }

        let allVisibleSelected = true; // Renommé conceptuellement mais garde le nom pour moins de diff
        let someVisibleSelected = false; // Idem

        // Vérifier l'état de sélection sur toutes les données pertinentes
        for (const rowData of allRelevantData) { 
            const rowId = rowData[0]; // Assumer ID en colonne 0
            if (this.selectedRowIds.has(rowId)) {
                someVisibleSelected = true;
            } else {
                allVisibleSelected = false;
            }
        }

        if (allVisibleSelected) {
            this.selectAllCheckbox.checked = true;
            this.selectAllCheckbox.indeterminate = false;
        } else if (someVisibleSelected) {
            this.selectAllCheckbox.checked = false;
            this.selectAllCheckbox.indeterminate = true;
        } else {
            this.selectAllCheckbox.checked = false;
            this.selectAllCheckbox.indeterminate = false;
        }
    }

    // Récupère les données filtrées/triées courantes (client-side)
    private getCurrentFilteredSortedData(): any[][] {
         if (this.isServerSide) {
             // En mode serveur, on ne peut pas connaître toutes les données filtrées/triées
             // 'Select All' devrait peut-être sélectionner uniquement la page visible
              return [...this.originalData]; // Retourne juste la page actuelle
         }
         const filteredData = this.getFilteredData([...this.originalData]); 
         const sortedData = this.sortDataIfEnabled(filteredData);   
         return sortedData;
    }

    // Récupère les données complètes des lignes sélectionnées
    public getSelectedRowData(): any[][] {
        // En mode serveur, il faut idéalement avoir TOUTES les données originales
        // ou alors renvoyer seulement les IDs et laisser l'app gérer.
        // On va filtrer originalData, qui contient la page actuelle en mode serveur.
        // Si on veut les données complètes, il faudrait une autre approche.
        const allData = this.isServerSide ? [...this.originalData] : this.getCurrentFilteredSortedData();
        
        return allData.filter(rowData => this.selectedRowIds.has(rowData[0]));
    }

    // Dispatch l'événement de changement de sélection
    private dispatchSelectionChangeEvent(): void {
        this.dispatchEvent('dt:selectionChange', { selectedData: this.getSelectedRowData() });
    }
}

console.log("Simple DataTable Class Loaded");

if (typeof window !== 'undefined') {
   (window as any).SimpleDataTable = DataTable;
}