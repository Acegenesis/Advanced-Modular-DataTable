# Advanced Modular **DataTable** 🎛️

![npm version](https://img.shields.io/npm/v/advanced-datatable?style=flat-square)
![license](https://img.shields.io/github/license/your‑org/advanced-datatable?style=flat-square)
![bundle size](https://img.shields.io/bundlephobia/minzip/advanced-datatable?style=flat-square)

> **A lightweight, modular JavaScript/TypeScript library for building high‑performance, feature‑rich data grids with Tailwind CSS.**

---

## ✨ Preview

*(Le GIF de démo peut nécessiter une mise à jour pour montrer les nouvelles fonctionnalités)*
![DataTable demo](docs/assets/demo.gif)

---

## 📚 Table of Contents  
- [Key Features](#key-features)  
- [Quick Start](#quick-start)  
- [Basic Usage](#basic-usage)
- [Server-Side Processing Example](#server-side-processing-example)
- [Configuration Options](#configuration-options)  
- [Programmatic API](#programmatic-api)  
- [Custom Events](#custom-events)  
- [Styling & Dark Mode](#styling--dark-mode)  
- [Responsive Columns](#responsive-columns)
- [Architecture](#architecture)  
- [Roadmap & Changelog](#roadmap--changelog)

---

## 🚀 Key Features

| | Feature | Description |
|:-:|:--|:--|
| 🔢 | **Efficient Rendering** | Optimized rendering for standard datasets. Virtual scrolling planned. |
| ↕️ | **Client‑Side Sorting** | Single-column sorting with visual indicators and keyboard navigation. |
| 🔍 | **Global Search** | Dynamic, debounce‑controlled search across all searchable columns. |
| 🧩 | **Per‑Column Filters** | Advanced filter pop‑ups (Text, Number, Date, Multi‑Select) with operators and Enter key submission. |
| 📄 | **Pagination** | Simple, numbered, or numbered‑jump modes with dynamic rows-per-page selector. |
| ☑️ | **Row Selection** | Single/Multiple selection modes with checkboxes and state management. |
| 🛠️ | **Row Actions** | Easily attach custom action buttons (e.g., view, edit, delete) to each row. |
| 📏 | **Resizable Columns** | Drag column dividers to resize. Double-click for auto-fit (implementation may vary). |
| ⇆ | **Column Reorder** | Drag‑and‑drop column headers to change their display order. |
| 📤 | **Data Export** | Export current view (filtered/sorted) to **CSV**, **Excel (.xlsx)**, or **PDF** via a dropdown menu. |
| 💾 | **State Persistence** | Optional automatic save/restore of pagination, sorting, filters, column order & widths via `localStorage`. |
| ⌛ | **Loading Overlay** | Visual overlay indicator for asynchronous operations (e.g., server-side fetch). |
| 🖌️ | **Custom Cell Renderers** | Provide a render callback per column for flexible cell content. |
| 🖼️ | **Swappable Icons** | Uses SVG sprites via `<use>` with automatic inline SVG fallbacks. Configurable icon IDs. |
| 📱 | **Responsive Visibility** | Dynamically show/hide columns based on screen breakpoints using `ColumnVisibilityController`. |
| 🎨 | **Dark Mode Support** | Adapts to light/dark themes using Tailwind's `dark:` variant. |
| 🔗 | **Fluent API & Events** | Programmatic control over table state and detailed custom events for integration. |

---

## ⚡ Quick Start

```bash
# 1. Install Package & Dependencies
npm install advanced-datatable exceljs jspdf jspdf-autotable papaparse
# or
yarn add advanced-datatable exceljs jspdf jspdf-autotable papaparse

# 2. Build / Dev Server (Assuming you have build scripts)
npm run build       # Example: compiles TS -> /dist
npm run dev         # Example: starts dev server with live-reload

# 3. Include Tailwind CSS (ensure your build process includes Tailwind)
# Example via CDN (for demos): <link href="https://cdn.jsdelivr.net/npm/tailwindcss@^3/dist/tailwind.min.css" rel="stylesheet">
```

> **Note**: `exceljs`, `jspdf`, `jspdf-autotable` are required for the Excel and PDF export functionalities. `papaparse` is used internally for robust CSV parsing if you use the `loadFromCSV` method.

---

## 🏗️ Basic Usage

```html
<!DOCTYPE html>
<html lang="en"> <!-- Add 'dark' class here if using class-based dark mode -->
<head>
  <meta charset="UTF-8" />
  <title>Advanced DataTable Example</title>
  <!-- Include your compiled CSS with Tailwind -->
  <link href="/path/to/your/tailwind.css" rel="stylesheet">
  <!-- Optional: Define SVG sprite if using custom icons -->
  <!-- 
  <svg id="dt-svg-sprite-container" style="display: none;">
    <symbol id="icon-sort-arrow" viewBox="...">...</symbol>
    <symbol id="icon-filter" viewBox="...">...</symbol>
    <symbol id="icon-dropdown" viewBox="...">...</symbol>
    <symbol id="icon-page-prev" viewBox="...">...</symbol>
    <symbol id="icon-page-next" viewBox="...">...</symbol>
  </svg> 
  -->
</head>
<body class="p-4 md:p-8 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <h1 class="text-2xl font-bold mb-4">User Data</h1>
  <div id="usersTable" class="shadow-md rounded-lg overflow-hidden"></div>

  <script type="module">
    import { DataTable } from "./dist/index.js"; // Adjust path as needed
    // Optional: Import visibility controller if used
    // import { ColumnVisibilityController } from "./dist/index.js"; 

    const columns = [
      // See Configuration Options -> ColumnDefinition for details
      { title: "ID",     field: "id",     type: "number", sortable: true, width: "80px" },
      { title: "Nom",    field: "nom",    type: "string", sortable: true, searchable: true, filterType: "text", resizable: true },
      { title: "Prénom", field: "prenom", type: "string", searchable: true, filterType: "multi-select" }, // Example filter
      { title: "Email",  field: "email",  type: "string", searchable: true, width:"200px", resizable: true },
      { title: "Salaire",field: "salaire",type: "money",  sortable: true, locale: "fr-FR", currency: "EUR", width: "150px", filterType: "number", resizable: true },
      { title: "Statut", field: "statut", width:"120px" }
    ];

    // Example data (replace with your actual data loading)
    const data = [
      [1, "Dupont", "Jean", "jean.dupont@email.com", 50000, "Actif"],
      [2, "Martin", "Alice", "alice.martin@provider.net", 62000, "Actif"],
      // ... more rows
    ];

    const tableOptions = {
      columns: columns,
      data: data,
      uniqueRowIdColumn: "id", // Use 'id' field as the unique identifier

      pagination: { 
        enabled: true, 
        rowsPerPage: 10, 
        style: "numbered-jump",
        rowsPerPageOptions: [5, 10, 25, 50] // Options for the selector
      },
      sorting: { enabled: true },
      searching: { enabled: true, debounceTime: 300 },
      selection: { enabled: true, mode: "multiple" },
      columnFiltering: { enabled: true },
      resizableColumns: true, // Enable resizing globally
      reorderableColumns: true, // Enable drag-and-drop reordering

      exporting: { // Enable export options
        csv: true,
        excel: true,
        pdf: true
      },
      
      rowActions: [ // Example row actions
          { label: "Voir", actionId: "view" },
          { label: "Modifier", actionId: "edit", className:"text-blue-600 dark:text-blue-400" },
          { label: "Supprimer", actionId: "delete", className:"text-red-600 dark:text-red-400" }
      ],
      
      stateManagement: { persist: true } // Optional: Persist state
    };

    const table = new DataTable("usersTable", tableOptions);

    // --- Optional: Responsive Column Visibility ---
    // const visibilityBreakpoints = {
    //   sm: ['id', 'nom'],         // Show ID, Nom on small screens and up
    //   md: ['+', 'email'],        // Add Email on medium screens and up
    //   lg: ['+']                  // Show all columns on large screens and up
    // };
    // const visibilityController = new ColumnVisibilityController(table, visibilityBreakpoints);
    // -------------------------------------------

    // --- Event Listener Example ---
    table.el.addEventListener("dt:selectionChange", (event) => {
      console.log("Selection Changed:", event.detail.selectedIds);
    });
    table.el.addEventListener("dt:actionClick", (event) => {
      console.log(`Action '${event.detail.actionId}' clicked for row ID: ${event.detail.rowId}`);
      // Add logic for view/edit/delete based on event.detail.actionId
    });
    table.el.addEventListener("dt:columnReorder", (event) => {
      console.log("Columns Reordered:", event.detail.columnOrder);
    });
    // --- End Event Listener Example ---

  </script>
</body>
</html>
```

---

## 📡 Server-Side Processing Example

*(Le concept reste le même que dans la version précédente du README. Assurez-vous que la logique backend correspond aux paramètres envoyés, notamment pour les filtres de colonne avancés si nécessaire.)*

*(Contenu détaillé de l'exemple Server-Side omis ici pour la concision, mais peut être conservé de la version précédente du README)*

---

## ⚙️ Configuration Options

L'initialisation de `DataTable` accepte un objet `DataTableOptions`.

<details>
<summary>Click to expand full <code>DataTableOptions</code> interface (Approximation)</summary>

```ts
interface DataTableOptions {
  columns: ColumnDefinition[];        // REQUIRED: Defines table columns.
  data?: any[][];                     // Initial data for client-side mode.
  uniqueRowIdColumn?: number | string;// Column index or 'field' for unique row ID (Default: 0).

  pagination?: PaginationOptions;     // Configuration for pagination feature.
  sorting?: { enabled: boolean };     // Configuration for sorting feature.
  searching?: { enabled: boolean; debounceTime?: number }; // Config for global search.
  selection?: {                       // Config for row selection.
    enabled: boolean;
    mode?: 'single' | 'multiple';
    initialSelectedIds?: any[];       // Pre-select rows by ID.
  };
  exporting?: {                       // Config for data export.
    csv?:   boolean | CsvExportOptions;   // Enable/configure CSV export.
    excel?: boolean | ExcelExportOptions; // Enable/configure Excel export.
    pdf?:   boolean | PdfExportOptions;   // Enable/configure PDF export.
  };
  columnFiltering?: {                 // Config for per-column filters.
      enabled: boolean; 
      // showClearButton?: boolean; // Option retirée? À vérifier.
  }; 
  rowActions?: RowAction[];             // Define actions for each row.
  actionsColumn?: { header?: string; width?: string }; // Customize the actions column.
  stateManagement?: { persist?: boolean; prefix?: string }; // Config for state persistence.
  resizableColumns?: boolean;         // Enable/disable column resizing globally (Default: false).
  reorderableColumns?: boolean;         // Enable/disable column reordering globally (Default: false).
  processingMode?: 'client' | 'server'; // Data processing mode (Default: 'client').
  serverSide?: {                      // Required for server-side mode.
    fetchData?: (params: ServerSideParams) => Promise<{ data: any[][]; totalRecords: number }>;
  };
  loadingMessage?: string;            // Text for loading overlay (Default: "Loading...").
  noDataMessage?: string;             // Text when table body is empty (Default: "Aucune donnée disponible").
  icons?: Partial<IconIds>;           // Override default SVG sprite IDs.
  scrollWrapperMaxHeight?: string;    // Set max-height CSS property on the scroll wrapper.
  createdRowCallback?: (tr: HTMLTableRowElement, rowData: any[]) => void; // Callback after a row element is created.
}

// Note: CsvExportOptions, ExcelExportOptions, PdfExportOptions details omitted.
// Note: ServerSideParams, RowAction, IconIds details omitted. Refer to types.ts.
```

</details>

### **Options Principales (`DataTableOptions`)**

| Option | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `columns` | `ColumnDefinition[]` | — | **Requis.** Définit les colonnes (titre, type, tri, filtre, etc.). |
| `data` | `any[][]` | `[]` | Données initiales pour le mode client. |
| `uniqueRowIdColumn` | `number \| string` | `0` | Index ou `field` de la colonne contenant l'ID unique de la ligne. |
| `pagination` | `PaginationOptions` | `{ enabled: false }` | Active et configure la pagination. |
| `sorting` | `{ enabled: boolean }` | `{ enabled: false }` | Active le tri client-side (monocolonne). |
| `searching` | `{ enabled: boolean; debounceTime?: number }` | `{ enabled: false }` | Active la recherche globale. `debounceTime` (ms) pour limiter les appels. |
| `selection` | `{ enabled: boolean; mode?: 'single'\|'multiple'; initialSelectedIds?: any[] }` | `{ enabled: false }` | Active la sélection de lignes. `initialSelectedIds` pour présélectionner. |
| `exporting` | `{ csv?: boolean; excel?: boolean; pdf?: boolean }` | `{}` | Active les options d'export. Affiche un dropdown si plusieurs sont `true`. |
| `columnFiltering` | `{ enabled: boolean }` | `{ enabled: false }` | Active les popups de filtre par colonne. |
| `rowActions` | `RowAction[]` | `[]` | Définit les boutons d'action à afficher sur chaque ligne. |
| `actionsColumn` | `{ header?: string; width?: string }` | `{ header: "Actions" }` | Configure le titre et la largeur de la colonne d'actions. |
| `stateManagement` | `{ persist?: boolean; prefix?: string }` | `{ persist: false }` | Active la persistance de l'état (tri, filtre, etc.) dans `localStorage`. |
| `resizableColumns` | `boolean` | `false` | Active globalement le redimensionnement des colonnes. |
| `reorderableColumns` | `boolean` | `false` | Active globalement la réorganisation des colonnes par glisser-déposer. |
| `processingMode` | `'client' \| 'server'` | `'client'` | Mode de traitement des données. |
| `serverSide` | `{ fetchData: ... }` | — | **Requis en mode `'server'`.** Fonction pour récupérer les données du serveur. |
| `loadingMessage` | `string` | `"Loading..."` | Message affiché pendant le chargement. |
| `noDataMessage` | `string` | `"Aucune donnée disponible"` | Message affiché quand la table est vide. |
| `icons` | `Partial<IconIds>` | (voir code) | Permet de surcharger les IDs des icônes SVG du sprite. |
| `scrollWrapperMaxHeight` | `string` | — | Applique un `max-height` au conteneur scrollable de la table. |
| `createdRowCallback` | `(tr, rowData) => void` | — | Fonction appelée après la création de chaque élément `<tr>`. |

### `ColumnDefinition`

| Property | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `title` | `string` | — | **Requis.** Titre affiché dans l'en-tête. |
| `field` | `string` | — | **Requis.** Identifiant unique de la colonne (utilisé pour `uniqueRowIdColumn`, responsivité, mapping serveur). |
| `type` | `'string' \| 'number' \| 'date' \| 'datetime' \| 'boolean' \| 'money' \| 'mail' \| 'tel'` | `'string'` | Influence le tri, le formatage par défaut et le type de filtre. |
| `width` | `string` | — | Largeur CSS initiale (ex: '150px', '10%'). |
| `sortable` | `boolean` | `true` | Autorise le tri sur cette colonne. |
| `searchable` | `boolean` | `true` | Inclut cette colonne dans la recherche globale. |
| `resizable` | `boolean` | (hérite `resizableColumns`) | Autorise le redimensionnement pour cette colonne spécifique. |
| `render` | `(cellData, rowData, colDef, td) => string \| Node \| void` | — | Fonction de rendu personnalisée pour le contenu de la cellule. |
| `filterType` | `'text' \| 'number' \| 'date' \| 'multi-select'` | (inféré de `type`) | Spécifie le type de popup de filtre à utiliser. |
| `filterOptions` | `(string \| { value: any; label: string })[]` | — | Options prédéfinies pour le filtre `multi-select`. Générées automatiquement si absentes. |
| `filterOperators` | `(TextFilterOperator[] \| ...)` | (tous les opérateurs) | Restreint la liste des opérateurs disponibles dans la popup de filtre. |
| `locale` | `string` | (navigateur) | Locale pour le formatage (date, money). |
| `currency` | `string` | `'USD'` | Code devise ISO pour le type `money`. |
| `dateFormatOptions` | `Intl.DateTimeFormatOptions` | (options par défaut) | Options de formatage pour les types `date` et `datetime`. |
| `className` | `string` | — | Classes CSS additionnelles pour les cellules `<td>` de cette colonne. |
| `unsafeRenderHtml` | `boolean` | `false` | Si `render` retourne une chaîne HTML, permet son insertion directe (attention au XSS). |

### `PaginationOptions`

| Option | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `enabled` | `boolean` | `false` | Active la pagination. |
| `rowsPerPage` | `number` | `10` | Nombre de lignes par page initial. |
| `rowsPerPageOptions` | `number[]` | `[10, 25, 50, 100]` | Options pour le sélecteur de lignes par page. Omettre pour cacher le sélecteur. |
| `style` | `'simple' \| 'numbered' \| 'numbered-jump'` | `'numbered-jump'` | Style des contrôles de pagination. |
| `previousButtonContent` | `string` | (Icône SVG) | Contenu HTML pour le bouton "Précédent". |
| `nextButtonContent` | `string` | (Icône SVG) | Contenu HTML pour le bouton "Suivant". |
| `jumpButtonText` | `string` | `"Go"` | Texte du bouton pour sauter à une page (style `numbered-jump`). |

---

## 🔌 Programmatic API

La `DataTable` expose plusieurs méthodes pour interagir avec elle par programmation.

| Method                       | Parameters                                      | Description                                                                 |
| :--------------------------- | :---------------------------------------------- | :-------------------------------------------------------------------------- |
| `render()`                   | `columnOrderOverride?: number[]`                | Redessine la table. Peut prendre un ordre de colonnes personnalisé.        |
| `destroy()`                  |                                                 | Détruit l'instance de la table et nettoie les éléments du DOM.                |
| `setData()`                  | `rows: any[][]`                                 | Remplace les données actuelles de la table par celles fournies et redessine. |
| `addRow()`                   | `row: any[]`                                    | Ajoute une nouvelle ligne de données à la table et redessine.                   |
| `deleteRowById()`            | `id: string \| number`                          | Supprime une ligne par son ID unique et redessine.                            |
| `updateRowById()`            | `id: string \| number, data: any[]`             | Met à jour les données d'une ligne par son ID unique et redessine.           |
| `goToPage()`                 | `page: number`                                  | Navigue vers la page spécifiée.                                              |
| `setSort()`                  | `colIndex: number \| null, dir: SortDirection`  | Applique un tri sur la colonne spécifiée.                                    |
| `fetchData()`                |                                                 | (Server-side) Déclenche manuellement la récupération des données.           |
| `getSelectedRowData()`       |                                                 | Retourne les données des lignes actuellement sélectionnées.                     |
| `getSelectedRowIds()`        |                                                 | Retourne les IDs des lignes actuellement sélectionnées.                      |
| `setSelectedRowIds()`        | `ids: any[]`                                    | Définit les lignes sélectionnées par programmation.                         |
| `setLoading()`               | `isLoading: boolean`                            | Affiche ou masque l'indicateur de chargement.                               |
| `clearAllFilters()`          |                                                 | Efface tous les filtres (globaux et par colonne) et redessine.             |
| `loadFromCSV()`              | `csvString: string, options?: LoadCsvOptions`   | **Nouveau**: Charge les données à partir d'une chaîne CSV. Utilise PapaParse en interne. |
| `DataTable.extractCsvHeader()`| `csvString: string, config?: Papa.ParseConfig`| **Nouveau (Statique)**: Extrait la 1ère ligne (en-tête) d'un CSV.            |

### **Nouvelles Méthodes de Chargement CSV**

#### `dataTable.loadFromCSV(csvString: string, options?: LoadCsvOptions)`

Cette méthode d'instance permet de charger des données directement à partir d'une chaîne de caractères au format CSV. Elle utilise la bibliothèque [PapaParse](https://www.papaparse.com/) en interne pour une analyse robuste des données CSV, gérant correctement les délimiteurs, les guillemets, et les sauts de ligne.

**Paramètres :**

*   `csvString: string`: La chaîne de caractères contenant les données CSV.
*   `options?: LoadCsvOptions` (optionnel): Un objet pour configurer le processus de chargement.
    *   `csvIncludesHeader?: boolean`: Si `true`, la première ligne de la chaîne CSV sera traitée comme une ligne d'en-tête et ne sera pas incluse dans les données de la table. (Défaut: `false`)
    *   `papaParseConfig?: Papa.ParseConfig`: Un objet de configuration PapaParse pour surcharger les options de parsing par défaut (ex: `skipEmptyLines: true`, `dynamicTyping: true`). Consultez la [documentation de PapaParse](https://www.papaparse.com/docs#config) pour toutes les options.

Après le parsing, cette méthode appelle `setData()` en interne pour mettre à jour la table.

#### `DataTable.extractCsvHeader(csvString: string, papaParseConfig?: Papa.ParseConfig): string[] | null`

Il s'agit d'une méthode **statique** utilitaire qui peut être appelée directement sur la classe `DataTable`. Elle est utile pour extraire la première ligne (généralement la ligne d'en-tête) d'une chaîne CSV sans instancier une table complète. Cela peut être utilisé pour dynamiquement configurer les `ColumnDefinition` de votre table avant de charger les données.

**Paramètres :**

*   `csvString: string`: La chaîne de caractères contenant les données CSV.
*   `papaParseConfig?: Papa.ParseConfig` (optionnel): Un objet de configuration PapaParse. Par défaut, elle est configurée pour lire uniquement la première ligne (`preview: 1`).

**Retourne :** Un tableau de chaînes (`string[]`) représentant les cellules de l'en-tête, ou `null` si l'en-tête ne peut pas être lu ou est vide.

**Exemple d'utilisation combinée :**

```javascript
// Supposons que vous avez récupéré votre chaîne CSV dans la variable 'myCsvString'
// Et que vous avez une instance de DataTable: const myTable = new DataTable('myTableElement', initialOptions);

async function loadCsvDataIntoTable(csvString, tableInstance) {
  // 1. Extraire l'en-tête pour configurer les colonnes (si nécessaire)
  const headerRow = DataTable.extractCsvHeader(csvString);

  if (headerRow) {
    const newColumns = headerRow.map(headerText => ({
      title: headerText,
      field: headerText.toLowerCase().replace(/\\s+/g, '_'), // Logique de base pour générer un 'field'
      sortable: true,
      searchable: true,
      // ... autres options de colonne basées sur l'en-tête ou des règles métier
    }));
    
    // Mettre à jour les colonnes de la table si elle est déjà initialisée
    // (Note: La DataTable actuelle pourrait nécessiter une méthode pour mettre à jour les colonnes post-initialisation,
    // ou alors, initialiser la table avec ces colonnes et des données vides avant loadFromCSV)
    // Pour l'exemple, supposons que vous initialisez la table avec ces colonnes:
    // const table = new DataTable('elementId', { columns: newColumns, data: [] });
    // Ou si la table existe déjà et supporte la mise à jour de colonnes :
    // tableInstance.setColumns(newColumns); // Méthode hypothétique
    
    console.log("Colonnes configurées à partir de l'en-tête CSV:", newColumns);
    // Pour cet exemple, nous allons juste afficher les colonnes
    // et supposer que la table est initialisée avec des colonnes correspondantes.
  } else {
    console.warn("Impossible d'extraire l'en-tête du CSV.");
    // Utiliser des colonnes par défaut ou gérer l'erreur
  }

  // 2. Charger les données CSV dans la table
  //    (en supposant que la première ligne du CSV est bien l'en-tête)
  tableInstance.loadFromCSV(csvString, { csvIncludesHeader: true });
  
  console.log("Données CSV chargées dans la table.");
}

// Exemple d'appel (après avoir récupéré votre chaîne CSV):
// const csvStringFromServer = "ID,Nom,Email\\n1,Dupont,jean@test.com\\n2,Martin,alice@test.com";
// const myDataTable = new DataTable('myTableContainer', { columns: [...] }); // Initialisez avec des colonnes
// loadCsvDataIntoTable(csvStringFromServer, myDataTable);
```
> **Note :** L'exemple ci-dessus montre le concept. Pour une mise à jour dynamique des colonnes après l'initialisation de la table, votre classe `DataTable` pourrait nécessiter une méthode dédiée comme `setColumns()`. Actuellement, il est préférable de définir les colonnes lors de l'initialisation, puis de charger les données.

---

## 📣 Custom Events

La table émet des événements personnalisés sur son élément racine (`table.el`) pour permettre une intégration facile. Utilisez `addEventListener` pour les écouter.

| Event | Fires when… | `event.detail` |
|:--|:--|:--|
| `dt:renderComplete` | Rendu terminé | `{}` (Peut être enrichi) |
| `dt:pageChange` | Page ou lignes/page changent | `{ currentPage, rowsPerPage }` |
| `dt:sortChange` | Ordre de tri change | `{ sortColumnIndex, sortDirection }` |
| `dt:search` | Terme de recherche globale change | `{ searchTerm }` |
| `dt:filterChange` | Un filtre (colonne/global) change | `{ type: 'column' \| 'global' \| 'clearAll' }` |
| `dt:actionClick` | Bouton d'action de ligne cliqué | `{ actionId, rowData, rowId, rowIndex }` |
| `dt:selectionChange` | Sélection de ligne change | `{ selectedIds: Set<any>, selectedData: any[][] }` |
| `dt:columnResize` | Colonne redimensionnée par l'utilisateur | `{ columnIndex, newWidth }` |
| `dt:columnReorder` | Ordre des colonnes changé par glisser-déposer | `{ columnOrder: number[] }` |
| `dt:loadingStateChange` | État de chargement change (`setLoading`) | `{ isLoading: boolean }` |
| `dt:error` | Erreur interne ou fetch serveur | `{ message: string, error?: any }` |

---

## 🎨 Styling & Dark Mode

Le style par défaut est basé sur **Tailwind CSS**.

*   **Intégration :** Assurez-vous que votre processus de build inclut Tailwind et traite les classes utilisées dans les fichiers `.ts` de la bibliothèque.
*   **Personnalisation :**
    1.  Modifiez directement les classes Tailwind dans les fichiers `src/**/*.ts` (recompilation nécessaire).
    2.  Surchargez les styles avec votre propre CSS. Les classes CSS spécifiques non-Tailwind (comme `.resizer-handle`) peuvent être trouvées ou ajoutées si nécessaire.
*   **Dark Mode :** La table supporte le mode sombre via les utilitaires `dark:` de Tailwind. Assurez-vous que votre configuration Tailwind (stratégie `media` ou `class`) est correcte. Si vous utilisez la stratégie `class`, ajoutez/supprimez la classe `dark` sur l'élément `<html>` ou `<body>`.

---

## 📱 Responsive Columns

*(Contenu de la section Responsive Columns conservé de la version précédente, car il semble toujours pertinent)*

---

## 🗺️ Architecture

*(Diagramme Mermaid à conserver ou mettre à jour si besoin)*

---

## 🛣️ Roadmap & Changelog

### Implemented Features (Current State)
*   Fondations: Data display, **Single-column sorting**, Global search, Pagination (client-side, 3 styles, rows/page selector).
*   Advanced Filtering: Per-column filters (text, number, date, multi-select) via popups with operators.
*   Interactions: Row selection (single/multiple), Row actions buttons.
*   Column Management: **Resizing**, **Reordering**.
*   Export: **CSV, Excel (.xlsx), PDF** via dropdown menu.
*   State & UX: State persistence (localStorage), Loading indicator, **Animated Export Dropdown**.
*   Optimisation: Next page pre-loading (client-side).
*   Icons: SVG sprite usage with inline fallback and configuration.
*   Styling: **Tailwind CSS based**, **Dark Mode support**.
*   Responsive Column Visibility Controller.
*   Event System & Programmatic API.

### Upcoming / Possible Enhancements 💡
- Inline editing ✏️  
- Grouping / aggregation 📊  
- **Multi‑column sort** ⇅⇅  
- **Virtual scrolling** for massive datasets 🚀  
- Theming API / CSS Variables 🌈  
- Improved server-side mode examples & documentation.
- Drag-select rows.
- Unit/Integration tests.

Voir **[CHANGELOG.md](CHANGELOG.md)** (à créer/maintenir) pour l'historique détaillé.

---

## 🖇️ License

*(À définir)*

