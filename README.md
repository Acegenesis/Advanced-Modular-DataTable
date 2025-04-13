# DataTable Modulaire en TypeScript

Un composant DataTable simple, modulaire et personnalisable, écrit en TypeScript pur, sans dépendances externes majeures (hormis pour l'exemple HTML qui utilise TailwindCSS pour le style).

## Fonctionnalités

*   **Affichage des données :** Affiche des données tabulaires fournies sous forme de tableau de tableaux.
*   **Pagination :**
    *   Côté client ou serveur (`processingMode`).
    *   Nombre de lignes par page configurable.
    *   Styles de contrôles : 'simple', 'numbered', 'numbered-jump'.
    *   Personnalisation des boutons Précédent/Suivant/Go.
*   **Tri :**
    *   Tri par colonne activable/désactivable par colonne.
    *   Indicateurs visuels SVG pour l'état du tri (ascendant, descendant, non trié).
    *   Événement `dt:sortChange` pour le tri côté serveur.
*   **Recherche Globale :**
    *   Champ de recherche pour filtrer toutes les colonnes `searchable`.
    *   Délai configurable (debounce).
    *   Événement `dt:search` pour la recherche côté serveur.
*   **Filtrage par Colonne :**
    *   Activation globale via `columnFiltering.enabled`.
    *   Filtres individuels par colonne via `ColumnDefinition.filterType`.
    *   **Types de filtres :**
        *   `'text'`: Ouvre une popup via une icône d'entonnoir pour choisir l'opérateur (`contains`, `notContains`, `equals`, `startsWith`, `endsWith`, `isEmpty`, `isNotEmpty`) et saisir une valeur.
        *   `'select'`: Affiche un `<select>` directement dans l'en-tête avec les options fournies (`filterOptions`).
    *   Personnalisation des opérateurs disponibles pour les filtres texte (`filterOperators`).
    *   Placeholder personnalisable (`filterPlaceholder`).
    *   Bouton optionnel "Effacer tous les filtres" (`columnFiltering.showClearButton`).
    *   Événement `dt:filterChange` pour le filtrage côté serveur.
*   **Sélection de Lignes :**
    *   Activation via `selection.enabled`.
    *   Modes 'single' ou 'multiple'.
    *   Case "Sélectionner tout" en mode multiple.
    *   API pour obtenir/définir les lignes sélectionnées (`getSelectedRowIds`, `getSelectedRowData`, `setSelectedRowIds`).
    *   Événement `dt:selectionChange`.
*   **Actions par Ligne :**
    *   Définition de boutons d'action personnalisés (`rowActions`).
    *   Événement `dt:actionClick` lors du clic sur un bouton d'action.
*   **Export :**
    *   Export CSV des données filtrées/triées (mode client).
    *   Options configurables : délimiteur, encodage, nom de fichier, inclusion du BOM UTF-8.
*   **Indicateur de Chargement :**
    *   Méthode `setLoading(true/false)` pour afficher/masquer un overlay.
    *   Message de chargement personnalisable (`loadingMessage`).
*   **Rendu Personnalisé :**
    *   Option `render` dans `ColumnDefinition` pour personnaliser l'affichage du contenu d'une cellule.
    *   Types de colonnes prédéfinis (`mail`, `tel`, `money`, `number`) avec rendu spécifique.
*   **API Publique :** Méthodes pour interagir avec la table (setData, addRow, deleteRow, updateRow, etc.).
*   **Système d'Événements :** Événements personnalisés pour réagir aux actions utilisateur et aux changements d'état.
*   **TypeScript :** Code typé pour une meilleure maintenabilité.
*   **Focus Management :** Conserve le focus sur les champs de recherche/filtre après un re-rendu.

## Installation / Utilisation

1.  **Build:** (Adapter selon votre processus de build)
    ```bash
    npm install
    npm run build 
    ```
    Cela devrait générer un bundle JavaScript (par exemple dans `dist/index.js`).

2.  **HTML:**
    ```html
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>DataTable Example</title>
        <!-- Inclure CSS (ex: Tailwind) -->
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style> /* Styles additionnels si besoin */ </style>
    </head>
    <body>
        <h1>Mon Tableau de Données</h1>
        <div id="myTableContainer" class="mt-4">
            <!-- La DataTable sera rendue ici -->
        </div>

        <script type="module">
            // Importer depuis le bundle généré
            import { DataTable } from './dist/index.js'; 

            const data = [
                // Vos données ici... ex: [1, 'Dupont', 'Jean', ...]
            ];

            const columns = [
                // Définitions de colonnes ici... ex: { title: 'ID' }, { title: 'Nom', filterType: 'text' }, ...
            ];

            const options = {
                columns: columns,
                data: data,
                pagination: { enabled: true, rowsPerPage: 10, style: 'numbered-jump' },
                sorting: { enabled: true },
                searching: { enabled: true },
                columnFiltering: { enabled: true, showClearButton: true },
                selection: { enabled: true, mode: 'multiple' },
                exporting: { csv: { enabled: true, delimiter: ';' } },
                rowActions: [ /* ... vos actions ... */ ]
                // ... autres options
            };

            const dataTableInstance = new DataTable('myTableContainer', options);

            // Écouter les événements si nécessaire
            dataTableInstance.element.addEventListener('dt:selectionChange', (e) => {
                console.log('Sélection:', e.detail.selectedIds);
            });

            // Utiliser l'API si nécessaire
            // dataTableInstance.setLoading(true);
        </script>
    </body>
    </html>
    ```

## Options (`DataTableOptions`)

*   `columns: ColumnDefinition[]`: **Requis.** Tableau définissant les colonnes.
    *   `title: string`: Titre de la colonne.
    *   `type?: 'string' | 'number' | 'mail' | 'tel' | 'money'`: Type de données (influence le rendu par défaut).
    *   `render?: (cellData: any, rowData: any[]) => string | HTMLElement | DocumentFragment`: Fonction de rendu personnalisée.
    *   `sortable?: boolean`: Autorise le tri sur cette colonne (défaut: `true` si `sorting.enabled` est `true`).
    *   `searchable?: boolean`: Inclut cette colonne dans la recherche globale (défaut: `true`).
    *   `locale?: string`: Locale pour formater les nombres/dates/monnaie (ex: 'fr-FR').
    *   `currency?: string`: Code devise pour le type 'money' (ex: 'EUR').
    *   `width?: string`: Largeur fixe pour la colonne (ex: '150px', '20%').
    *   `filterType?: 'text' | 'select'`: Active le filtrage pour cette colonne et définit le type de contrôle.
    *   `filterOptions?: string[] | { value: any; label: string }[]`: Options pour `filterType: 'select'`.
    *   `filterPlaceholder?: string`: Placeholder pour l'input texte ou le select.
    *   `filterOperators?: TextFilterOperator[]`: Opérateurs autorisés pour `filterType: 'text'`.
*   `data: any[][]`: **Requis.** Les données à afficher.
*   `pagination?: { enabled: boolean; rowsPerPage?: number; style?: PaginationStyle; previousButtonContent?: string; nextButtonContent?: string; jumpButtonText?: string; }`: Configuration de la pagination.
    *   `enabled: boolean`: Active/désactive la pagination.
    *   `rowsPerPage?: number`: Nombre de lignes par page (défaut: 10).
    *   `style?: 'simple' | 'numbered' | 'numbered-jump'`: Style des contrôles (défaut: 'numbered-jump').
    *   `previousButtonContent?`, `nextButtonContent?`, `jumpButtonText?`: HTML/Texte pour les boutons.
*   `sorting?: { enabled: boolean; }`: Configuration du tri.
    *   `enabled: boolean`: Active/désactive le tri globalement.
*   `searching?: { enabled: boolean; debounceTime?: number; }`: Configuration de la recherche globale.
    *   `enabled: boolean`: Active/désactive la barre de recherche.
    *   `debounceTime?: number`: Délai (ms) avant de lancer la recherche après saisie (défaut: 300).
*   `columnFiltering?: { enabled: boolean; showClearButton?: boolean; }`: Configuration du filtrage par colonne.
    *   `enabled: boolean`: Active/désactive les filtres par colonne.
    *   `showClearButton?: boolean`: Affiche le bouton "Effacer tous les filtres" (défaut: false).
*   `selection?: { enabled: boolean; mode?: 'single' | 'multiple'; initialSelectedIds?: any[]; }`: Configuration de la sélection.
    *   `enabled: boolean`: Active/désactive la sélection.
    *   `mode?: 'single' | 'multiple'`: Mode de sélection (défaut: 'multiple').
    *   `initialSelectedIds?: any[]`: IDs (basés sur `rowData[0]`) initialement sélectionnés.
*   `rowActions?: RowAction[]`: Tableau définissant les actions par ligne.
    *   `label: string`: Texte du bouton.
    *   `actionId: string`: Identifiant unique de l'action (utilisé dans l'événement).
    *   `className?: string`: Classes CSS additionnelles pour le bouton.
*   `exporting?: { csv?: CsvExportOptions | boolean; }`: Configuration de l'export.
    *   `csv?: boolean | { enabled?: boolean; delimiter?: string; encoding?: string; filename?: string; bom?: boolean; }`: Active ou configure l'export CSV. `true` active avec les défauts.
*   `processingMode?: 'client' | 'server'`: Mode de traitement (défaut: 'client'). En mode 'server', la pagination, le tri et le filtrage doivent être gérés côté serveur via les événements.
*   `serverSideTotalRows?: number`: **Requis si `processingMode: 'server'`.** Nombre total de lignes sur le serveur.
*   `loadingMessage?: string`: Message affiché dans l'overlay de chargement.

## API Publique (`DataTable` instance)

*   `setData(newData: any[][]): void`: Remplace les données actuelles et redessine.
*   `addRow(rowData: any[]): void`: Ajoute une ligne (mode client) et redessine.
*   `deleteRowById(id: any, idColumnIndex?: number): boolean`: Supprime une ligne par son ID (mode client) et redessine. Retourne `true` si trouvée et supprimée.
*   `updateRowById(id: any, newRowData: any[], idColumnIndex?: number): boolean`: Met à jour une ligne par son ID (mode client) et redessine. Retourne `true` si trouvée et mise à jour.
*   `getSelectedRowData(): any[][]`: Retourne les données complètes des lignes sélectionnées.
*   `getSelectedRowIds(): any[]`: Retourne les IDs (`rowData[0]`) des lignes sélectionnées.
*   `setSelectedRowIds(ids: any[]): void`: Définit les lignes sélectionnées programmatiquement.
*   `setLoading(isLoading: boolean): void`: Affiche ou masque l'indicateur de chargement.
*   `setColumnFilter(columnIndex: number, filterState: ColumnFilterState | null): void`: Applique un filtre à une colonne. `filterState` est `{ value: any, operator?: TextFilterOperator }` ou `null` pour effacer.
*   `clearAllFilters(): void`: Efface tous les filtres (colonne et global) et la recherche globale.
*   `render(): void`: Force un re-rendu complet de la table.
*   `destroy(): void`: Nettoie l'élément et supprime les écouteurs.

## Événements Personnalisés

Écoutez ces événements sur `dataTableInstance.element`:

*   `dt:pageChange`: Déclenché lors du changement de page.
    *   `detail: { currentPage: number; rowsPerPage: number; totalRows: number; }`
*   `dt:selectionChange`: Déclenché lors du changement de sélection.
    *   `detail: { selectedIds: any[]; selectedData: any[][]; }`
*   `dt:sortChange`: Déclenché lors du changement de tri.
    *   `detail: { columnIndex: number | null; sortDirection: SortDirection; }`
*   `dt:search`: Déclenché après le debounce de la recherche globale.
    *   `detail: { searchTerm: string; }`
*   `dt:filterChange`: Déclenché lors de l'application ou suppression d'un filtre de colonne.
    *   `detail: { columnIndex: number; value: any | null; operator?: TextFilterOperator; allFilters: { [key: number]: ColumnFilterState }; }`
*   `dt:actionClick`: Déclenché lors du clic sur un bouton d'action de ligne.
    *   `detail: { actionId: string; rowData: any[]; rowIndex: number; }`
*   `dt:renderComplete`: Déclenché après la fin du rendu de la table.
    *   `detail: undefined`
*   `dt:filtersCleared`: Déclenché après l'appel de `clearAllFilters`.
    *   `detail: undefined`

## TODO / Améliorations Futures

*   Implémenter les filtres `number-range`, `date-range`.
*   Export Excel.
*   Rendu virtuel.
*   Tri multi-colonnes.
*   Édition inline.
*   Glisser-déposer colonnes.
*   Tests unitaires/intégration.
*   ... (voir liste complète dans la discussion précédente) 