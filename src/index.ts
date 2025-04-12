// Point d'entrée principal du package

interface DataTableOptions {
    columns: string[]; // Noms des colonnes pour l'en-tête
    data: any[][];    // Données du tableau (tableau de tableaux)
    pagination?: {
        enabled: boolean;
        rowsPerPage?: number; // Nombre de lignes par page (par défaut 10)
    };
}

export class DataTable {
    private element: HTMLElement;
    private options: DataTableOptions;
    private currentPage: number = 1;
    private rowsPerPage: number = 10; // Valeur par défaut
    private totalRows: number = 0;

    constructor(elementId: string, options: DataTableOptions) {
        const targetElement = document.getElementById(elementId);
        if (!targetElement) {
            throw new Error(`Element with ID "${elementId}" not found.`);
        }
        this.element = targetElement;
        this.options = options;
        this.totalRows = options.data.length;

        // Configurer la pagination si activée
        if (this.options.pagination?.enabled) {
            this.rowsPerPage = this.options.pagination.rowsPerPage ?? 10;
        }

        this.render(); // Appel initial pour afficher le tableau et la pagination
    }

    private render(): void {
        // Vider l'élément cible avant de redessiner
        this.element.innerHTML = '';

        const table = document.createElement('table');
        table.classList.add('simple-datatable'); // Ajout d'une classe CSS

        this.renderHeader(table);
        this.renderBody(table);

        this.element.appendChild(table);

        // Afficher les contrôles de pagination si activés
        if (this.options.pagination?.enabled && this.totalRows > this.rowsPerPage) {
            this.renderPaginationControls();
        }
    }

    private renderHeader(table: HTMLTableElement): void {
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        this.options.columns.forEach(columnName => {
            const th = document.createElement('th');
            th.textContent = columnName;
            headerRow.appendChild(th);
        });
    }

    private renderBody(table: HTMLTableElement): void {
        const tbody = table.createTBody();
        const dataToRender = this.options.pagination?.enabled
            ? this.getCurrentPageData()
            : this.options.data;

        dataToRender.forEach(rowData => {
            const row = tbody.insertRow();
            rowData.forEach(cellData => {
                const cell = row.insertCell();
                cell.textContent = String(cellData); // Convertit en chaîne pour l'affichage
            });
        });
    }

    private getCurrentPageData(): any[][] {
        if (!this.options.pagination?.enabled) {
            return this.options.data;
        }
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        return this.options.data.slice(startIndex, endIndex);
    }

    private renderPaginationControls(): void {
        const paginationContainer = document.createElement('div');
        paginationContainer.classList.add('simple-datatable-pagination');

        const totalPages = Math.ceil(this.totalRows / this.rowsPerPage);

        // Bouton Précédent
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Précédent';
        prevButton.disabled = this.currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.render(); // Redessiner le tableau et la pagination
            }
        });

        // Indicateur de page
        const pageIndicator = document.createElement('span');
        pageIndicator.textContent = `Page ${this.currentPage} sur ${totalPages}`;
        pageIndicator.style.margin = '0 10px'; // Un peu d'espacement

        // Bouton Suivant
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Suivant';
        nextButton.disabled = this.currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.render(); // Redessiner le tableau et la pagination
            }
        });

        paginationContainer.appendChild(prevButton);
        paginationContainer.appendChild(pageIndicator);
        paginationContainer.appendChild(nextButton);

        this.element.appendChild(paginationContainer);
    }
}

// Exemple d'initialisation (sera utile pour tester dans un environnement navigateur)
// window.onload = () => {
//     const data = [
//         [1, 'Alice', 'alice@example.com'],
//         [2, 'Bob', 'bob@example.com'],
//         [3, 'Charlie', 'charlie@example.com']
//     ];
//     const columns = ['ID', 'Nom', 'Email'];
//     new DataTable('myTableContainer', {
//         columns,
//         data,
//         pagination: { enabled: true, rowsPerPage: 2 }
//     });
// };

console.log("Simple DataTable Class Loaded");

// TODO: Implémenter la logique du DataTable 