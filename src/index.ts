// Point d'entrée principal du package

// Type pour définir une colonne
interface ColumnDefinition {
    title: string; // Titre affiché dans l'en-tête
    type?: 'string' | 'number' | 'mail' | 'tel' | 'money'; // Types prédéfinis
    // dataProperty?: string; // Pour lier à une propriété d'objet (ajout futur)
    render?: (cellData: any, rowData: any[]) => string | HTMLElement; // Fonction de rendu personnalisé (prioritaire)
    sortable?: boolean; // Option pour rendre cette colonne spécifiquement triable
    searchable?: boolean; // Option pour inclure dans la recherche (ajout futur)
    locale?: string; // Pour formatage de nombre/devise (ex: 'en-US', 'fr-FR')
    currency?: string; // Code ISO 4217 pour type='money' (ex: 'USD', 'EUR')
}

// Nouvelle interface pour définir une action sur une ligne
interface RowAction {
    label: string;        // Texte affiché sur le bouton
    actionId: string;     // Identifiant unique pour l'action (ex: 'edit', 'delete', 'view')
    className?: string;   // Classes CSS optionnelles pour le bouton
}

interface DataTableOptions {
    // Remplacer string[] par ColumnDefinition[]
    columns: ColumnDefinition[]; 
    data: any[][];    
    pagination?: {
        enabled: boolean;
        rowsPerPage?: number; // Nombre de lignes par page (par défaut 10)
    };
    sorting?: {
        enabled: boolean;
    };
    searching?: {
        enabled: boolean;
        debounceTime?: number; // Temps en ms pour le debounce (défaut 300)
    };
    // Nouvelle option pour les actions sur les lignes
    rowActions?: RowAction[];
}

type SortDirection = 'asc' | 'desc' | 'none';

export class DataTable {
    private element: HTMLElement;
    private options: DataTableOptions;
    private currentPage: number = 1;
    private rowsPerPage: number = 10; // Valeur par défaut
    private totalRows: number = 0;
    private sortColumnIndex: number | null = null;
    private sortDirection: SortDirection = 'none';
    private originalData: any[][]; // Conserver les données originales
    private filterTerm: string = '';
    private debounceTimer: number | null = null;

    constructor(elementId: string, options: DataTableOptions) {
        const targetElement = document.getElementById(elementId);
        if (!targetElement) {
            throw new Error(`Element with ID "${elementId}" not found.`);
        }
        this.element = targetElement;

        // Copie superficielle des options pour isoler l'instance
        // tout en préservant les références aux fonctions (comme render)
        this.options = { ...options }; 
        // Copier explicitement les tableaux/objets imbriqués importants
        if (options.columns) {
            // Créer un nouveau tableau et copier chaque objet colonne superficiellement
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
        // Copier les actions si elles existent
        if (options.rowActions) {
            this.options.rowActions = options.rowActions.map(action => ({ ...action }));
        }

        // Copie profonde UNIQUEMENT pour les données originales car elles servent de base immuable
        this.originalData = options.data ? JSON.parse(JSON.stringify(options.data)) : [];

        // Initialiser le total basé sur les données originales
        this.totalRows = this.originalData.length;

        // Configurer la pagination si activée
        if (this.options.pagination?.enabled) {
            this.rowsPerPage = this.options.pagination.rowsPerPage ?? 10;
        }
        // Toujours initialiser currentPage
        this.currentPage = 1;

        // Initialiser l'état du tri et du filtre
        this.sortColumnIndex = null;
        this.sortDirection = 'none';
        this.filterTerm = '';
        this.debounceTimer = null;

        this.render(); // Appel initial pour afficher le tableau
    }

    private render(): void {
        this.element.innerHTML = ''; // Vider avant de redessiner

        // Créer un conteneur externe pour l'ombre et les coins arrondis
        const container = document.createElement('div');
        container.className = 'mt-6 shadow overflow-hidden border-b border-gray-200 sm:rounded-lg';

        // 1. Rendu du champ de recherche (placé à l'extérieur du conteneur de table pour cet exemple)
        if (this.options.searching?.enabled) {
            this.renderSearchInput(this.element); // Passer l'élément principal pour l'ajout
        }

        // 2. Filtrer les données
        const filteredData = this.getFilteredData();
        this.totalRows = filteredData.length; 

        // 3. Trier les données filtrées
        const sortedData = this.sortDataIfEnabled(filteredData);

        // 4. Rendu du tableau à l'intérieur du conteneur
        const table = document.createElement('table');
        // Classes pour la table elle-même (plus simple maintenant)
        table.className = 'min-w-full divide-y divide-gray-200'; 
        // --- A11y: Rôle sémantique pour le tableau ---
        table.setAttribute('role', 'grid');
        // -------------------------------------------
        this.renderHeader(table);
        this.renderBody(table, sortedData);
        container.appendChild(table); // Ajouter la table au conteneur stylé
        this.element.appendChild(container); // Ajouter le conteneur à l'élément principal

        // 5. Rendu de la pagination (placé après le conteneur de table)
        if (this.options.pagination?.enabled && this.totalRows > this.rowsPerPage) {
            this.renderPaginationControls(); 
        }

        // 6. Émettre l'événement de fin de rendu
        this.dispatchEvent('dt:renderComplete');
    }

    // Modifié pour accepter l'élément parent où ajouter l'input
    private renderSearchInput(parentElement: HTMLElement): void {
        // --- A11y: Générer un ID unique pour l'input et le label ---
        const inputId = `datatable-search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        // --- A11y: Ajouter un label (caché visuellement) ---
        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.className = 'sr-only'; // Classe Tailwind pour masquer visuellement mais accessible aux lecteurs
        label.textContent = 'Filtrer le tableau';
        parentElement.appendChild(label);
        // --------------------------------------------------

        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Rechercher...';
        // Style moderne pour l'input
        searchInput.className = 'block w-full md:w-1/2 mb-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm';
        searchInput.value = this.filterTerm;
        // --- A11y: Lier le label et ajouter le rôle ---
        searchInput.id = inputId;
        searchInput.setAttribute('role', 'searchbox');
        searchInput.setAttribute('aria-controls', this.element.id + '-tbody'); // Lier au corps du tableau si tbody a un id
        // --------------------------------------------

        searchInput.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            const searchTerm = target.value;
            const debounceTime = this.options.searching?.debounceTime ?? 300;

            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = window.setTimeout(() => {
                this.filterTerm = searchTerm;
                this.currentPage = 1; 

                // Émettre l'événement AVANT de redessiner
                this.dispatchEvent('dt:search', { searchTerm: this.filterTerm });
                
                this.render(); 
            }, debounceTime);
        });

        parentElement.appendChild(searchInput); // Ajouter à l'élément parent fourni
    }

    private getFilteredData(): any[][] {
        if (!this.options.searching?.enabled || !this.filterTerm) {
            return [...this.originalData]; // Retourner une copie pour éviter modifications externes
        }

        const searchTermLower = this.filterTerm.toLowerCase();

        return this.originalData.filter(row => {
            for (let cellIndex = 0; cellIndex < row.length; cellIndex++) {
                const cellData = row[cellIndex];
                const columnDef = this.options.columns[cellIndex];
                
                // Récupérer la valeur searchable explicitement
                const columnIsDefined = columnDef !== null && columnDef !== undefined;
                const searchableOption = columnIsDefined ? columnDef.searchable : undefined;
                // Calculer isSearchable
                const isSearchable = searchableOption !== false; 

                // Vérifier si la colonne est searchable AVANT de vérifier le contenu
                if (isSearchable === true) {
                    if (String(cellData).toLowerCase().includes(searchTermLower)) {
                        return true; 
                    }
                } 
                // Sinon (isSearchable est false), ne RIEN faire pour cette cellule
            }
            return false; 
        });
    }

    private sortDataIfEnabled(dataToSort: any[][]): any[][] {
        // Si aucun tri n'est actif, retourner les données telles quelles
        if (!this.options.sorting?.enabled || this.sortColumnIndex === null || this.sortDirection === 'none') {
            return dataToSort;
        }

        // Copier pour ne pas modifier l'array filtré original en place
        const sortedData = [...dataToSort];

        sortedData.sort((a, b) => {
            // Utiliser l'index et la direction stockés
            const columnIndex = this.sortColumnIndex as number;
            const direction = this.sortDirection;

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

    private renderHeader(table: HTMLTableElement): void {
        const thead = table.createTHead();
        // Header un peu plus clair
        thead.className = 'bg-gray-50'; 
        const headerRow = thead.insertRow();
        // --- A11y: Rôle pour la ligne d'en-tête ---
        headerRow.setAttribute('role', 'row');
        // -----------------------------------------

        this.options.columns.forEach((columnDef, index) => { 
            const th = document.createElement('th');
            th.textContent = columnDef.title || ''; 
            th.scope = 'col';
            // --- A11y: Rôle pour cellule d'en-tête ---
            th.setAttribute('role', 'columnheader');
            // ---------------------------------------
            // Padding ajusté, texte un peu plus visible
            th.className = 'px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider';

            const isSortable = this.options.sorting?.enabled && columnDef.sortable !== false;

            if (isSortable) { 
                // Hover plus subtil, transition ajoutée
                th.classList.add('cursor-pointer', 'hover:bg-gray-100', 'transition-colors', 'duration-150'); 
                th.addEventListener('click', () => this.handleSortClick(index));
                
                let indicatorSymbol = '';
                let ariaSortValue: "ascending" | "descending" | "none" = "none";
                // --- A11y: Texte alternatif pour l'état de tri ---
                let sortDescription = '';
                // ----------------------------------------------

                if (this.sortColumnIndex === index && this.sortDirection !== 'none') {
                    indicatorSymbol = this.sortDirection === 'asc' ? ' ▲' : ' ▼';
                    ariaSortValue = this.sortDirection === 'asc' ? 'ascending' : 'descending';
                    // Fond pour la colonne triée
                    th.classList.add('bg-gray-100'); 
                    // --- A11y ---
                    sortDescription = this.sortDirection === 'asc' ? 'trié par ordre croissant' : 'trié par ordre décroissant';
                    // -----------
                 } else {
                    indicatorSymbol = ' ↕'; 
                    ariaSortValue = 'none'; 
                     // --- A11y ---
                     sortDescription = 'non trié';
                     // -----------
                 }
                 // Span pour l'indicateur pour un meilleur contrôle potentiel du style
                 const indicatorSpan = document.createElement('span');
                 indicatorSpan.className = 'ml-1'; // Espace avant l'indicateur
                 indicatorSpan.textContent = indicatorSymbol;
                 th.appendChild(indicatorSpan);
                 th.setAttribute('aria-sort', ariaSortValue);

                 // --- A11y: Ajouter le texte descriptif caché ---
                 const accessibleDescription = document.createElement('span');
                 accessibleDescription.className = 'sr-only'; // Masqué visuellement
                 accessibleDescription.textContent = `, ${sortDescription}, cliquez pour changer l'ordre de tri`;
                 th.appendChild(accessibleDescription);
                 // ---------------------------------------------
                 
            } 
            headerRow.appendChild(th);
        });
        
        // Ajouter l'en-tête pour les actions si elles sont définies
        if (this.options.rowActions && this.options.rowActions.length > 0) {
            const thActions = document.createElement('th');
            thActions.scope = 'col';
            thActions.className = 'px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider'; // Alignement à droite
            thActions.textContent = 'Actions'; // Ou laisser vide: ''
            headerRow.appendChild(thActions);
        }
    }

    private renderBody(table: HTMLTableElement, data: any[][]): void {
        const tbody = table.createTBody();
        tbody.className = 'bg-white divide-y divide-gray-200';
        // --- A11y: Ajouter un ID au tbody pour aria-controls ---
        tbody.id = this.element.id + '-tbody';
        // ---------------------------------------------------
        const dataToRender = this.options.pagination?.enabled
            ? this.getCurrentPageData(data)
            : data;

        tbody.innerHTML = ''; 

        if (dataToRender.length === 0) {
            // Afficher une ligne indiquant qu'il n'y a pas de données
            const row = tbody.insertRow();
            const cell = row.insertCell();
            // Calculer le nombre de colonnes de données + potentielle colonne d'actions
            const totalColumnCount = this.options.columns.length + 
                                   (this.options.rowActions && this.options.rowActions.length > 0 ? 1 : 0);

            // Recalculer le colSpan en fonction du nombre total de colonnes
            cell.colSpan = totalColumnCount;
            cell.className = 'px-6 py-12 text-center text-sm text-gray-500'; // Centré et espacé
            cell.textContent = this.filterTerm ? 'Aucun résultat trouvé pour votre recherche.' : 'Aucune donnée à afficher.';
            return; // Sortir si pas de données
        }

        dataToRender.forEach(rowData => {
            const row = tbody.insertRow();
            // Transition sur le hover
            row.className = 'hover:bg-gray-50 transition-colors duration-150'; 
            // --- A11y: Rôle pour la ligne de données ---
            row.setAttribute('role', 'row');
            // -----------------------------------------
            // Calculer le nombre de colonnes de données + potentielle colonne d'actions
            const totalColumnCount = this.options.columns.length + 
                                   (this.options.rowActions && this.options.rowActions.length > 0 ? 1 : 0);

            // Recalculer le colSpan en fonction du nombre total de colonnes
            rowData.forEach((cellData, cellIndex) => {
                const cell = row.insertCell();
                 // Texte principal un peu plus foncé, alignement vertical
                cell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800 align-middle'; 
                // --- A11y: Rôle pour la cellule de données ---
                cell.setAttribute('role', 'gridcell');
                // ------------------------------------------
                const columnDef = this.options.columns[cellIndex]; 

                if (columnDef && typeof columnDef.render === 'function') { 
                    try {
                        const renderedContent = columnDef.render(cellData, rowData);
                        this.appendRenderedContent(cell, renderedContent);
                    } catch (error) {
                        console.error(`Erreur dans la fonction render pour la colonne "${columnDef.title}" :`, error);
                        this.appendRenderedContent(cell, '[Erreur Rendu]', true);
                    }
                } 
                else if (columnDef && columnDef.type) {
                    this.renderCellByType(cell, cellData, columnDef);
                } 
                else {
                    this.appendRenderedContent(cell, cellData); 
                }
            });
            
            // Ajouter la cellule d'actions si des actions sont définies
            if (this.options.rowActions && this.options.rowActions.length > 0) {
                this.renderActionButtons(row, rowData);
            }
        });
    }

    // Nouvelle méthode pour créer les boutons d'action pour une ligne
    private renderActionButtons(row: HTMLTableRowElement, rowData: any[]): void {
        const cell = row.insertCell();
        // Styles pour la cellule d'actions: alignement à droite, ne pas couper le texte
        cell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-middle';

        this.options.rowActions?.forEach((actionDef, index) => {
            const button = document.createElement('button');
            button.textContent = actionDef.label;
            // Classes par défaut + classes personnalisées. Ajout d'une marge sauf pour le premier bouton.
            button.className = `text-indigo-600 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${index > 0 ? 'ml-4' : ''} ${actionDef.className || ''}`;
            button.type = 'button'; // Important pour éviter soumission de formulaire

            button.addEventListener('click', (event) => {
                event.stopPropagation(); // Empêche le déclenchement d'autres événements (ex: clic sur la ligne)
                
                // Émettre l'événement dt:actionClick
                this.dispatchEvent('dt:actionClick', { 
                    action: actionDef.actionId, 
                    rowData: rowData 
                });
            });

            cell.appendChild(button);
        });
    }

    private appendRenderedContent(cell: HTMLTableCellElement, content: any, isError: boolean = false): void {
        // ATTENTION: Si vous utilisez la fonction 'render' pour retourner du HTML sous forme de chaîne,
        // assurez-vous que ce contenu est correctement échappé pour éviter les failles XSS.
        // La classe DataTable ne nettoie pas le HTML fourni par la fonction render.
        if (content instanceof HTMLElement) {
             cell.appendChild(content); // Ajouter l'élément DOM
        } else if (content instanceof DocumentFragment) {
            cell.appendChild(content); // Ajouter un fragment de document
        } else {
            // Cas par défaut pour autres types (null, undefined, number, string...)
            cell.textContent = String(content); // Utiliser textContent par défaut pour la sécurité
        }
        if (isError) {
            cell.classList.add('text-red-600', 'dark:text-red-400');
        }
    }

    private renderCellByType(cell: HTMLTableCellElement, data: any, columnDef: ColumnDefinition): void {
        let content: string | HTMLElement = String(data); 
        const dataString = String(data);
        const type = columnDef.type; // Récupérer le type depuis columnDef

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
                 linkTel.href = `tel:${dataString.replace(/\s+/g, '')}`; // Enlève les espaces pour href
                 linkTel.textContent = dataString;
                 linkTel.className = 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300';
                 content = linkTel;
                break;
            case 'money':
                const amount = parseFloat(dataString);
                if (!isNaN(amount)) {
                    try {
                        // Utiliser locale et currency de la définition de colonne, avec défauts
                        const locale = columnDef.locale || 'fr-FR'; 
                        const currency = columnDef.currency || 'EUR'; 
                        content = new Intl.NumberFormat(locale, { style: 'currency', currency: currency }).format(amount);
                    } catch (e) {
                         console.error("Erreur de formatage monétaire:", e);
                         content = dataString + " (Err)"; 
                    }
                } else {
                    content = dataString + " (NaN)"; 
                }
                break;
            case 'number':
                 const num = parseFloat(dataString);
                 if (!isNaN(num)) {
                     // Utiliser locale de la définition de colonne, avec défaut
                     const locale = columnDef.locale || 'fr-FR'; 
                     content = new Intl.NumberFormat(locale).format(num);
                 } else {
                     content = dataString + " (NaN)";
                 }
                 break;
            // case 'string' ou autres:
            // Le défaut (String(data)) est déjà géré avant le switch
            // ou on pourrait ajouter des formatages spécifiques si nécessaire
        }

        this.appendRenderedContent(cell, content);
    }

    private getCurrentPageData(sourceData: any[][]): any[][] {
        if (!this.options.pagination?.enabled) {
            return sourceData;
        }
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        return sourceData.slice(startIndex, endIndex);
    }

    private handleSortClick(columnIndex: number): void {
        // Vérification supplémentaire: ne rien faire si la colonne n'est pas triable
        const columnDef = this.options.columns[columnIndex];
        if (!this.options.sorting?.enabled || !columnDef || columnDef.sortable === false) {
             console.warn(`Tentative de tri sur une colonne non triable (index: ${columnIndex})`);
             return; 
        }

        // Déterminer le nouvel état de tri
        let newDirection: SortDirection;
        let newSortColumnIndex: number | null;
        if (this.sortColumnIndex === columnIndex) {
            newDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            newSortColumnIndex = columnIndex;
        } else {
            newDirection = 'asc';
            newSortColumnIndex = columnIndex;
        }

        // Mettre à jour l'état (avant l'événement)
        this.sortColumnIndex = newSortColumnIndex;
        this.sortDirection = newDirection;
        this.currentPage = 1; 

        // Émettre l'événement AVANT de redessiner
        this.dispatchEvent('dt:sortChange', { 
            sortColumnIndex: this.sortColumnIndex, 
            sortDirection: this.sortDirection 
        });

        this.render(); 
    }

    private renderPaginationControls(): void {
        const paginationContainer = document.createElement('div');
        // Pagination un peu plus aérée
        paginationContainer.className = 'bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-1'; // Ajout de mt-1 pour léger espace
        // --- A11y: Rôle et label pour la navigation ---
        paginationContainer.setAttribute('role', 'navigation');
        paginationContainer.setAttribute('aria-label', 'Pagination');
        // ---------------------------------------------

        const totalPages = Math.ceil(this.totalRows / this.rowsPerPage);
        const startItem = this.totalRows === 0 ? 0 : (this.currentPage - 1) * this.rowsPerPage + 1;
        const endItem = Math.min(startItem + this.rowsPerPage - 1, this.totalRows);

        // Utilisation de flex pour mieux organiser les éléments de pagination
        const flexContainer = document.createElement('div');
        flexContainer.className = 'flex-1 flex justify-between sm:hidden'; // Pour mobile
        // ... (ajouter boutons mobile si nécessaire)

        const hiddenOnMobileContainer = document.createElement('div');
        hiddenOnMobileContainer.className = 'hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'; // Pour écrans plus grands

        const infoContainer = document.createElement('div');
        infoContainer.className = 'text-sm text-gray-700';
        const p = document.createElement('p'); // Mettre le texte dans un <p>
        if (this.totalRows > 0) {
            // Utiliser des span pour styler les nombres si on veut
            p.innerHTML = `Affichage <span class="font-medium text-gray-900">${startItem}</span> à <span class="font-medium text-gray-900">${endItem}</span> sur <span class="font-medium text-gray-900">${this.totalRows}</span> résultats`;
        } else {
            p.textContent = 'Aucun résultat';
        }
        infoContainer.appendChild(p);

        const buttonContainer = document.createElement('div');
        // Changé pour utiliser space-x pour l'espacement
        buttonContainer.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px'; 

        const prevButton = document.createElement('button');
        prevButton.disabled = this.currentPage === 1;
        // Style plus moderne, icône SVG possible plus tard
        prevButton.className = 'relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
        // --- A11y: Label et état désactivé ---
        prevButton.setAttribute('aria-label', 'Page précédente');
        if (prevButton.disabled) {
            prevButton.setAttribute('aria-disabled', 'true');
        }
        // ------------------------------------
        prevButton.innerHTML = `<!-- Héroicon: chevron-left --> <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
        prevButton.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                // Émettre l'événement AVANT de redessiner
                this.dispatchPageChangeEvent();
                this.render(); 
            }
        });

        const nextButton = document.createElement('button');
        nextButton.disabled = this.currentPage === totalPages || this.totalRows === 0;
        // Style plus moderne, icône SVG possible plus tard
        nextButton.className = 'relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
        // --- A11y: Label et état désactivé ---
        nextButton.setAttribute('aria-label', 'Page suivante');
        if (nextButton.disabled) {
            nextButton.setAttribute('aria-disabled', 'true');
        }
        // ------------------------------------
        nextButton.innerHTML = `<!-- Héroicon: chevron-right --> <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
        nextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(this.totalRows / this.rowsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                 // Émettre l'événement AVANT de redessiner
                this.dispatchPageChangeEvent();
                this.render(); 
            }
        });

        // Ajouter boutons au conteneur de boutons
        buttonContainer.appendChild(prevButton);
        // Ici on pourrait ajouter des numéros de page dans le futur
        buttonContainer.appendChild(nextButton);

        // Ajouter info et boutons au conteneur principal caché sur mobile
        hiddenOnMobileContainer.appendChild(infoContainer);
        hiddenOnMobileContainer.appendChild(buttonContainer);

        // Ajouter les deux mises en page (mobile/desktop) au conteneur global de pagination
        paginationContainer.appendChild(flexContainer); // Reste vide pour l'instant
        paginationContainer.appendChild(hiddenOnMobileContainer);

        this.element.appendChild(paginationContainer);
    }

    // --- Méthodes Helper --- 

    // Helper pour émettre l'événement de changement de page
    private dispatchPageChangeEvent(): void {
         this.dispatchEvent('dt:pageChange', { 
            currentPage: this.currentPage,
            rowsPerPage: this.rowsPerPage,
            totalRows: this.totalRows // Nombre total après filtrage
        });
    }

    // Helper générique pour émettre des CustomEvents
    private dispatchEvent<T>(eventName: string, detail?: T): void {
        const event = new CustomEvent<T>(eventName, { 
            detail: detail,
            bubbles: true, // Permet à l'événement de remonter le DOM
            cancelable: true // Peut être annulé (moins pertinent ici)
        });
        this.element.dispatchEvent(event);
    }

    // --- API Publique ---

    /**
     * Remplace l'ensemble des données de la table et la redessine.
     * @param newData Le nouveau tableau de données (any[][]).
     */
    public setData(newData: any[][]): void {
        // Valider un minimum newData ? (est-ce un tableau?)
        if (!Array.isArray(newData)) {
            console.error("setData: Les nouvelles données doivent être un tableau.");
            return;
        }
        // Copie profonde pour préserver l'immutabilité de l'entrée
        this.originalData = JSON.parse(JSON.stringify(newData));
        // Réinitialiser l'état potentiellement affecté par les anciennes données
        this.totalRows = this.originalData.length;
        this.currentPage = 1;
        this.filterTerm = ''; // Optionnel: réinitialiser aussi le filtre/tri?
        this.sortColumnIndex = null;
        this.sortDirection = 'none';
        // Redessiner la table avec les nouvelles données
        this.render();
        this.dispatchEvent('dt:dataChange', { source: 'setData' });
    }

    /**
     * Ajoute une nouvelle ligne de données à la fin de la table et la redessine.
     * @param rowData Tableau représentant la ligne à ajouter.
     */
    public addRow(rowData: any[]): void {
        if (!Array.isArray(rowData)) {
             console.error("addRow: La nouvelle ligne doit être un tableau.");
             return;
        }
        // Copie profonde de la ligne ajoutée
        this.originalData.push(JSON.parse(JSON.stringify(rowData)));
        this.totalRows = this.originalData.length;
        // Optionnel : aller à la dernière page où la ligne a été ajoutée ?
        // this.currentPage = Math.ceil(this.totalRows / this.rowsPerPage);
        this.render();
        this.dispatchEvent('dt:dataChange', { source: 'addRow', addedRow: rowData });
    }

    /**
     * Supprime une ligne basée sur la valeur d'une colonne identifiante (par défaut la première colonne, index 0).
     * @param id La valeur identifiant la ligne à supprimer.
     * @param idColumnIndex L'index de la colonne contenant l'identifiant (par défaut: 0).
     * @returns true si une ligne a été supprimée, false sinon.
     */
    public deleteRowById(id: any, idColumnIndex: number = 0): boolean {
        const initialLength = this.originalData.length;
        this.originalData = this.originalData.filter(row => row[idColumnIndex] !== id);
        const rowDeleted = this.originalData.length < initialLength;

        if (rowDeleted) {
            this.totalRows = this.originalData.length;
            // Ajuster la page courante si elle devient invalide
            const totalPages = Math.max(1, Math.ceil(this.totalRows / this.rowsPerPage));
            if (this.currentPage > totalPages) {
                this.currentPage = totalPages;
            }
            this.render();
            this.dispatchEvent('dt:dataChange', { source: 'deleteRowById', deletedId: id });
        } else {
            console.warn(`deleteRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
        }
        return rowDeleted;
    }

    /**
     * Met à jour une ligne existante basée sur la valeur d'une colonne identifiante.
     * @param id La valeur identifiant la ligne à mettre à jour.
     * @param newRowData Le nouveau tableau de données pour la ligne.
     * @param idColumnIndex L'index de la colonne contenant l'identifiant (par défaut: 0).
     * @returns true si une ligne a été mise à jour, false sinon.
     */
    public updateRowById(id: any, newRowData: any[], idColumnIndex: number = 0): boolean {
         if (!Array.isArray(newRowData)) {
             console.error("updateRowById: Les nouvelles données de ligne doivent être un tableau.");
             return false;
         }
        const rowIndex = this.originalData.findIndex(row => row[idColumnIndex] === id);

        if (rowIndex !== -1) {
            // Copie profonde des nouvelles données
            this.originalData[rowIndex] = JSON.parse(JSON.stringify(newRowData));
            this.render();
            this.dispatchEvent('dt:dataChange', { source: 'updateRowById', updatedId: id, newRowData: newRowData });
            return true;
        } else {
             console.warn(`updateRowById: Aucune ligne trouvée avec l'ID ${id} dans la colonne ${idColumnIndex}.`);
            return false;
        }
    }
}

console.log("Simple DataTable Class Loaded");

if (typeof window !== 'undefined') {
   (window as any).SimpleDataTable = DataTable;
}