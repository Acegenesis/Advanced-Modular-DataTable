# DataTable Modulaire Avancée

Une bibliothèque JavaScript/TypeScript pour créer des tableaux de données interactifs et riches en fonctionnalités, construite de manière modulaire.

## Fonctionnalités Principales

*   **Affichage de Données Tabulaires :** Rendu efficace de larges ensembles de données.
*   **Tri Côté Client :** Tri sur une ou plusieurs colonnes, avec indicateurs visuels.
*   **Recherche Globale :** Filtrage rapide sur l'ensemble des données.
*   **Filtrage par Colonne :** Filtres avancés par type de données (texte, nombre, date, sélection multiple) avec popups dédiés.
*   **Pagination :** Navigation par page avec plusieurs styles et sélecteur de lignes par page.
*   **Sélection de Lignes :** Mode simple ou multiple, avec état persistant et API.
*   **Actions sur les Lignes :** Définition facile de boutons d'action personnalisés par ligne.
*   **Colonnes Redimensionnables :** Ajustement manuel de la largeur des colonnes par glisser-déposer et double-clic pour l'auto-ajustement (adapte la largeur au contenu le plus large de l'en-tête ou des cellules, plus une petite marge).
*   **Réorganisation des Colonnes :** Modification de l'ordre des colonnes par glisser-déposer.
*   **Exportation de Données :** Export des données (filtrées/triées) aux formats CSV, Excel (.xlsx) et PDF via un menu déroulant.
*   **Persistance de l'État :** Sauvegarde automatique de l'état (page, tri, filtres, largeurs/ordre des colonnes) dans le `localStorage`.
*   **Indicateur de Chargement :** Affichage d'un overlay pendant les opérations asynchrones (simulation incluse).
*   **Rendu Personnalisé :** Possibilité de définir des fonctions de rendu spécifiques pour les cellules.
*   **API Programmatique :** Méthodes pour interagir avec la table (ajout/suppression de lignes, etc.).
*   **Événements Personnalisés :** Émission d'événements pour intégration avec d'autres parties de l'application.

## Installation & Démarrage

1.  **Cloner le dépôt** (si applicable)
2.  **Installer les dépendances :**
    ```bash
    npm install
    # ou
    yarn install
    ```
    Cela installera les dépendances nécessaires, y compris `exceljs`, `jspdf`, et `jspdf-autotable` pour l'export.
3.  **Lancer le build / serveur de développement :**
    ```bash
    npm run build # Pour compiler les fichiers TypeScript en JavaScript dans /dist
    # ou
    npm run start # Si un script 'start' est configuré (ex: avec live-server ou webpack-dev-server)
    ```
4.  Ouvrez le fichier `index.html` dans votre navigateur.

## Utilisation Basique

```html
<!DOCTYPE html>
<html>
<head>
    <title>DataTable</title>
    <!-- Inclure CSS (ex: Tailwind) -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
    <div id="myTable"></div>

    <script type="module">
        import { DataTable } from './dist/index.js'; // Ajustez le chemin

        const columns = [
            { title: 'ID', type: 'number' },
            { title: 'Nom', type: 'string' },
            // ... autres colonnes
        ];

        const data = [
            [1, 'Dupont'],
            [2, 'Martin'],
            // ... autres données
        ];

        const options = {
            columns: columns,
            data: data,
            // ... autres options
        };

        const myDataTable = new DataTable('myTable', options);
    </script>
</body>
</html>
```

## Options de Configuration (`DataTableOptions`)

L'objet `options` passé au constructeur `DataTable` permet de configurer toutes les fonctionnalités.

| Option                  | Type                                                         | Description                                                                                                                              |
| :---------------------- | :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`               | `ColumnDefinition[]`                                         | **Obligatoire.** Tableau définissant chaque colonne. Voir détails ci-dessous.                                                             |
| `data`                  | `any[][]`                                                    | Données initiales à afficher. Chaque sous-tableau représente une ligne.                                                                    |
| `uniqueRowIdColumn`     | `number` \| `string`                                           | Index (0-basé) ou `name` de la colonne contenant l'identifiant unique de chaque ligne. Défaut: 0. Utilisé pour la sélection et les actions. |
| `pagination`            | `PaginationOptions`                                          | Options de pagination. Voir détails ci-dessous.                                                                                           |
| `sorting`               | `{ enabled: boolean; }`                                      | Active (`true`) ou désactive (`false`) le tri globalement. Défaut: `{ enabled: false }`.                                                    |
| `searching`             | `{ enabled: boolean; debounceTime?: number; }`              | Active la recherche globale. `debounceTime` (ms) pour limiter les appels au rendu (ex: 300).                                                 |
| `selection`             | `{ enabled: boolean; mode?: 'single'\|'multiple'; initialSelectedIds?: any[]; }` | Active la sélection. `mode` ('single' ou 'multiple'). `initialSelectedIds` pour présélectionner.                                       |
| `exporting`             | `{ csv?: boolean\|CsvExportOptions; excel?: boolean\|ExcelExportOptions; pdf?: boolean\|PdfExportOptions; }` | Configure les options d'export. Mettre à `true` pour activer un format, ou passer un objet d'options spécifiques.              |
| `columnFiltering`       | `{ enabled: boolean; showClearButton?: boolean; }`           | Active le filtrage par colonne. `showClearButton` affiche un bouton pour effacer tous les filtres actifs.                               |
| `rowActions`            | `RowAction[]`                                                | Définit les boutons d'action à afficher pour chaque ligne. Voir `RowAction` ci-dessous.                                                      |
| `actionsColumn`         | `{ header?: string; width?: string; }`                       | Options pour la colonne d'actions (si `rowActions` est utilisé).                                                                            |
| `stateManagement`       | `{ persist?: boolean; prefix?: string; }`                   | Active la persistance de l'état dans `localStorage`. `prefix` pour la clé de stockage.                                                     |
| `resizableColumns`      | `boolean`                                                    | Active (`true`) ou désactive (`false`) globalement le redimensionnement des colonnes. Défaut: `false`.                                       |
| `processingMode`        | `'client'` \| `'server'`                                     | Définit si le tri, le filtrage, la pagination sont gérés côté client ou serveur. Défaut: `'client'`.                                   |
| `serverSideTotalRows` | `number`                                                     | **Requis si `processingMode` est 'server'.** Nombre total d'enregistrements côté serveur (après filtrage potentiel).                         |
| `serverSide`            | `{ fetchData?: (params: ServerSideParams) => Promise<{ data: any[][]; totalRecords: number }>; }` | Fonction à appeler pour récupérer les données en mode serveur.                                                                           |
| `loadingMessage`        | `string`                                                     | Message à afficher pendant le chargement. Défaut: "Chargement...".                                                                        |

### `ColumnDefinition`

Chaque objet dans le tableau `columns` définit une colonne.

| Propriété         | Type                                                                | Description                                                                                                                                  |
| :---------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | `string`                                                            | **Obligatoire.** Texte affiché dans l'en-tête de la colonne.                                                                                   |
| `type`            | `'string'`\|`'number'`\|`'date'`\|`'mail'`\|`'tel'`\|`'money'`       | Type de données pour le tri, le filtrage et potentiellement le rendu.                                                                            |
| `width`           | `string`                                                            | Largeur initiale de la colonne (ex: '150px', '10%').                                                                                           |
| `sortable`        | `boolean`                                                           | Permet le tri sur cette colonne si `sorting.enabled` est `true`. Défaut: `true`.                                                               |
| `searchable`      | `boolean`                                                           | Inclut cette colonne dans la recherche globale si `searching.enabled` est `true`. Défaut: `true`.                                               |
| `resizable`       | `boolean`                                                           | Permet le redimensionnement de cette colonne si `resizableColumns` est `true`. Défaut: `false` (ou la valeur de `resizableColumns`).          |
| `textAlign`       | `'left'`\|`'center'`\|`'right'`\|`'justify'`                       | Alignement du texte dans les cellules de cette colonne.                                                                                       |
| `render`          | `(cellData: any, rowData: any[], rowIndex: number) => string\|Node` | Fonction pour personnaliser le rendu HTML du contenu de la cellule. Reçoit la donnée de la cellule, la ligne complète et son index.           |
| `filterType`      | `'text'`\|`'number'`\|`'date'`\|`'multi-select'`                    | Type de filtre à utiliser pour cette colonne si `columnFiltering.enabled` est `true`.                                                            |
| `filterOptions`   | `(string \| { value: any; label: string })[]`                       | Options prédéfinies pour le filtre `multi-select`. Si omis, les options sont générées à partir des données uniques de la colonne.              |
| `filterPlaceholder` | `string`                                                            | Placeholder pour le champ de saisie du filtre texte.                                                                                          |
| `filterOperators` | `TextFilterOperator[]`\|`NumberFilterOperator[]`\|...               | Permet de restreindre les opérateurs disponibles dans les popups de filtre avancé (ex: `['equals', 'greaterThan']`).                      |
| `locale`          | `string`                                                            | Locale pour le formatage `money` (ex: 'fr-FR', 'en-US').                                                                                      |
| `currency`        | `string`                                                            | Code devise pour le formatage `money` (ex: 'EUR', 'USD').                                                                                     |
| `name`            | `string`                                                            | Nom unique optionnel pour identifier la colonne (utile pour `uniqueRowIdColumn` si string).                                                |
| `data`            | `string`                                                            | *(Non utilisé actuellement, prévu pour accès objet)*                                                                                          |

### `PaginationOptions`

| Option             | Type                   | Description                                                                                                                             |
| :----------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`          | `boolean`              | Active (`true`) ou désactive (`false`) la pagination.                                                                                    |
| `rowsPerPage`      | `number`               | Nombre de lignes à afficher par page. Défaut: 10.                                                                                       |
| `rowsPerPageOptions` | `number[]`             | Tableau des choix disponibles pour le sélecteur "Lignes par page" (ex: `[10, 25, 50, 100]`). Si omis, le sélecteur n'est pas affiché. |
| `style`            | `'simple'`\|`'numbered'`\|`'numbered-jump'` | Style des contrôles de pagination. Défaut: `'numbered-jump'`.                                                             |
| `previousButtonContent`| `string`             | Contenu HTML/texte pour le bouton "Précédent".                                                                                          |
| `nextButtonContent`| `string`             | Contenu HTML/texte pour le bouton "Suivant".                                                                                           |
| `jumpButtonText`   | `string`             | Texte pour le bouton "Aller" du style `'numbered-jump'`.                                                                                |

### `RowAction`

| Propriété   | Type     | Description                                              |
| :---------- | :------- | :------------------------------------------------------- |
| `label`     | `string` | Texte affiché sur le bouton.                           |
| `actionId`  | `string` | Identifiant unique pour cette action (utilisé dans l'événement `dt:actionClick`). |
| `className` | `string` | Classes CSS additionnelles à appliquer au bouton.      |

## API Programmatique

L'instance `DataTable` expose plusieurs méthodes publiques :

*   `setLoading(isLoading: boolean): void`: Affiche ou masque l'overlay de chargement.
*   `setData(newData: any[][]): void`: Remplace complètement les données de la table.
*   `addRow(newRowData: any[]): void`: Ajoute une nouvelle ligne à la fin.
*   `updateRowById(rowId: any, updatedRowData: any[]): boolean`: Met à jour une ligne existante par son ID. Retourne `true` si la mise à jour a réussi, `false` sinon.
*   `deleteRowById(rowId: any): boolean`: Supprime une ligne par son ID. Retourne `true` si la suppression a réussi, `false` sinon.
*   `setSelectedRowIds(ids: any[]): void`: Définit les lignes sélectionnées.
*   `getSelectedRowIds(): any[]`: Retourne un tableau des IDs des lignes sélectionnées.
*   `getSelectedRowData(): any[][]`: Retourne les données complètes des lignes sélectionnées. *(Attention: mode serveur peut limiter)*
*   `setPage(pageNumber: number): void`: Navigue vers une page spécifique.
*   `clearAllFilters(): void`: Efface le filtre global et tous les filtres de colonne.
*   `destroy(): void`: Nettoie les écouteurs d'événements et supprime les éléments du DOM créés par la table. *(Note: Le nettoyage des écouteurs globaux peut être amélioré)*.
*   `render(): void`: Force un re-rendu complet de la table.

## Événements Personnalisés

La DataTable émet des événements personnalisés sur son élément racine (`instance.element`). Vous pouvez les écouter avec `addEventListener`. Les données spécifiques à l'événement sont dans `event.detail`.

*   `dt:renderComplete`: Émis après chaque rendu complet de la table.
*   `dt:pageChange`: Émis après un changement de page ou de nombre de lignes par page. `event.detail`: `{ currentPage: number; rowsPerPage: number; }`
*   `dt:sortChange`: Émis après un changement de tri. `event.detail`: `{ columnIndex: number | null; direction: SortDirection; }`
*   `dt:search`: Émis après une recherche globale. `event.detail`: `{ searchTerm: string; }`
*   `dt:filterChange`: Émis après l'application ou la suppression d'un filtre de colonne. `event.detail`: `{ filters: Map<number, ColumnFilterState>; }`
*   `dt:actionClick`: Émis lorsqu'un bouton d'action de ligne est cliqué. `event.detail`: `{ action: string; rowData: any[]; }`
*   `dt:selectionChange`: Émis après un changement de sélection. `event.detail`: `{ selectedIds: any[]; selectedData: any[][]; }`
*   `dt:columnResize`: Émis après le redimensionnement manuel d'une colonne. `event.detail`: `{ columnIndex: number; newWidth: number; }`
*   `dt:columnReorder`: Émis après la réorganisation des colonnes. `event.detail`: `{ columnOrder: number[]; }`

## Styling

Le style par défaut utilise des classes **TailwindCSS**. Vous pouvez :

*   Inclure Tailwind dans votre projet.
*   Adapter les classes utilisées dans le code source (principalement dans les fichiers `src/rendering/*.ts`) à votre propre framework CSS ou à du CSS personnalisé.
*   Surcharger les styles par défaut avec votre propre CSS.

---

Ce README devrait fournir une bonne base. Vous pourrez l'affiner en ajoutant des exemples plus spécifiques, en détaillant le mode serveur si vous l'implémentez complètement, ou en documentant plus en profondeur l'API et les événements si nécessaire. 


## Changelog / Évolution

### Fonctionnalités Implémentées

*   **Fondations :** Affichage données, tri, recherche globale, pagination (client).
*   **Filtrage Avancé :** Filtrage par colonne (texte, nombre, date, multi-select) avec popups et opérateurs.
*   **Interactions :** Sélection de lignes (simple/multiple), actions par ligne.
*   **Gestion des Colonnes :**
    *   Redimensionnement manuel (glisser).
    *   Redimensionnement automatique au double-clic (ajustement au contenu corps & en-tête).
    *   Réorganisation par glisser-déposer.
    *   Correction des conflits entre redimensionnement et réorganisation.
*   **Export :**
    *   Formats CSV, Excel (.xlsx via `exceljs`), PDF (via `jspdf` & `jspdf-autotable`).
    *   Bouton unique "Exporter" avec menu déroulant.
    *   Options de configuration pour activer/désactiver chaque format.
*   **État & UX :**
    *   Persistance de l'état (page, tri, filtres, largeurs/ordre colonnes) via `localStorage`.
    *   Indicateur de chargement (`setLoading`).
    *   Affichage persistant de la barre de pagination (même si une seule page).

### À Faire / Améliorations Possibles

*   **Nettoyage :** Supprimer les `console.log` de débogage.
*   **API & Événements :**
    *   ~~Vérifier/finaliser l'implémentation des méthodes API (`addRow`, `updateRowById`, `deleteRowById`, `destroy`).~~
    *   Améliorer la méthode `destroy` pour un nettoyage plus complet des écouteurs d'événements globaux.
*   **Filtres :**
    *   Améliorer l'UI des filtres (calendrier pour dates, slider pour nombres).
    *   Permettre la sauvegarde/chargement de "vues" (combinaisons de filtres/tri).
*   **Fonctionnalités Majeures :**
    *   Édition en ligne des cellules.
    *   Regroupement de lignes.
    *   Tri multi-colonnes.
    *   Rendu virtuel/Scroll infini pour très grands datasets.
*   **Export Avancé :**
    *   Options de styling pour Excel.
    *   Options de personnalisation pour PDF (titre, orientation dynamique, styles).
*   **Général :**
    *   Tester/améliorer le mode serveur (`serverSide`).
    *   Améliorations UI/UX (animations, accessibilité).
    *   Ajouter des tests unitaires et d'intégration. 