# Simple DataTable

Une classe TypeScript simple pour créer des tableaux de données HTML interactifs avec des fonctionnalités de tri, pagination, recherche et actions sur les lignes. Conçue pour être utilisée avec Tailwind CSS pour le style.

## Fonctionnalités

*   **Affichage Tabulaire :** Rend un tableau HTML à partir d'un tableau de données JavaScript (`any[][]`).
*   **Configuration Flexible :** Utilise un objet d'options pour configurer :
    *   **Colonnes :** Définition du titre, type (`string`, `number`, `mail`, `tel`, `money`), formatage (locale, devise), triabilité, cherchabilité, et fonction de rendu personnalisée (`render`).
    *   **Données :** Le tableau 2D des données à afficher.
    *   **Pagination :** Activation/désactivation, nombre de lignes par page.
    *   **Tri :** Activation/désactivation globale, indicateurs visuels.
    *   **Recherche :** Activation/désactivation globale, délai de debounce configurable.
    *   **Actions sur les Lignes :** Définition de boutons d'action (ex: Voir, Modifier, Supprimer) pour chaque ligne.
*   **Rendu Personnalisé :** Permet de fournir une fonction `render` pour chaque colonne afin de contrôler entièrement le contenu et le style des cellules (peut retourner une chaîne, un `HTMLElement` ou un `DocumentFragment`).
*   **Formatage Automatique :** Formate automatiquement les types `mail`, `tel` (liens `mailto:`/`tel:`) et `number`, `money` (en utilisant `Intl.NumberFormat`).
*   **Pagination Côté Client :** Navigation simple avec boutons "Précédent"/"Suivant" et affichage des informations (ex: "Affichage 1 à 5 sur 12 résultats").
*   **Tri Côté Client :** Tri par clic sur les en-têtes de colonnes (configurable), support ascendant/descendant, indicateurs visuels (`▲`/`▼`/`↕`).
*   **Recherche/Filtrage Côté Client :** Filtrage dynamique basé sur un champ de recherche. La recherche est insensible à la casse et prend en compte l'option `searchable` des colonnes. L'input est "debounced" pour de meilleures performances.
*   **Actions sur les Lignes :** Ajoute automatiquement une colonne "Actions" avec les boutons définis. Émet un événement `dt:actionClick` lors du clic sur un bouton.
*   **API Publique :** Méthodes pour manipuler la table après initialisation :
    *   `setData(newData)` : Remplace toutes les données.
    *   `addRow(rowData)` : Ajoute une ligne.
    *   `deleteRowById(id, [idColumnIndex])` : Supprime une ligne par identifiant.
    *   `updateRowById(id, newRowData, [idColumnIndex])` : Met à jour une ligne par identifiant.
*   **Système d'Événements :** Émet des `CustomEvent` pour diverses interactions (`dt:renderComplete`, `dt:pageChange`, `dt:sortChange`, `dt:search`, `dt:actionClick`, `dt:dataChange`) permettant à l'application d'y réagir.
*   **Style :** Utilise des classes Tailwind CSS par défaut.

## Installation

1.  **Compilez le code TypeScript :**
    ```bash
    npm install # Si vous ne l'avez pas déjà fait pour installer TypeScript, etc.
    npm run build # Ou la commande équivalente dans votre projet (ex: tsc)
    ```
    Cela devrait générer un fichier JavaScript (par exemple, `dist/index.js`).

2.  **Incluez le fichier JavaScript compilé** dans votre page HTML :
    ```html
    <script type="module" src="./dist/index.js"></script>
    ```

## Usage Basique

**HTML :**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Exemple DataTable</title>
    <!-- Inclure Tailwind CSS (via CDN ou build process) -->
    <script src="https://cdn.tailwindcss.com"></script> 
</head>
<body>
    <h1>Mon Tableau</h1>
    <!-- Conteneur où la table sera injectée -->
    <div id="tableContainer"></div>

    <!-- Inclure le script compilé de DataTable -->
    <script type="module" src="./dist/index.js"></script> 
    <!-- Script d'initialisation -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const columns = [
                { title: 'ID', type: 'number', sortable: true },
                { title: 'Nom' },
                { title: 'Email', type: 'mail' }
            ];
            const data = [
                [1, 'Alice', 'alice@example.com'],
                [2, 'Bob', 'bob@example.com']
            ];
            const options = {
                columns: columns,
                data: data,
                pagination: { enabled: true, rowsPerPage: 5 },
                sorting: { enabled: true },
                searching: { enabled: true },
                rowActions: [
                    { label: 'Voir', actionId: 'view' },
                    { label: 'Supprimer', actionId: 'delete', className: 'text-red-600' }
                ]
            };

            if (window.SimpleDataTable) {
                const myTable = new window.SimpleDataTable('tableContainer', options);

                // Écouter les événements (optionnel)
                document.getElementById('tableContainer').addEventListener('dt:actionClick', (e) => {
                    console.log('Action:', e.detail.action, 'Data:', e.detail.rowData);
                    if (e.detail.action === 'delete') {
                        if (confirm('Supprimer la ligne ?')) {
                            myTable.deleteRowById(e.detail.rowData[0]); // Supprime par ID (col 0)
                        }
                    }
                });
            } else {
                console.error('SimpleDataTable class not found!');
            }
        });
    </script>
</body>
</html>
```

## Options de Configuration (`DataTableOptions`)

*   `columns: ColumnDefinition[]` : Tableau définissant les colonnes.
*   `data: any[][]` : Tableau 2D des données.
*   `pagination?: { enabled: boolean; rowsPerPage?: number; }` : Options de pagination. `rowsPerPage` par défaut est 10.
*   `sorting?: { enabled: boolean; }` : Active/désactive le tri globalement.
*   `searching?: { enabled: boolean; debounceTime?: number; }` : Options de recherche. `debounceTime` par défaut est 300ms.
*   `rowActions?: RowAction[]` : Tableau définissant les actions sur les lignes.

### `ColumnDefinition`

*   `title: string` : Titre affiché dans l'en-tête.
*   `type?: 'string' | 'number' | 'mail' | 'tel' | 'money'` : Type de données pour formatage automatique.
*   `render?: (cellData: any, rowData: any[]) => string | HTMLElement | DocumentFragment` : Fonction pour rendu personnalisé de la cellule.
*   `sortable?: boolean` : Si la colonne est triable (défaut `true` si `sorting.enabled` est `true`).
*   `searchable?: boolean` : Si la colonne doit être incluse dans la recherche (défaut `true` si `searching.enabled` est `true`).
*   `locale?: string` : Locale pour le formatage (`number`, `money`), ex: 'fr-FR'.
*   `currency?: string` : Code devise ISO 4217 pour `type='money'`, ex: 'EUR'.

### `RowAction`

*   `label: string` : Texte du bouton.
*   `actionId: string` : Identifiant unique renvoyé dans l'événement `dt:actionClick`.
*   `className?: string` : Classes CSS additionnelles pour le bouton.

## API Publique

Ces méthodes peuvent être appelées sur l'instance de `DataTable` après son initialisation.

*   `setData(newData: any[][]): void`
*   `addRow(rowData: any[]): void`
*   `deleteRowById(id: any, idColumnIndex: number = 0): boolean`
*   `updateRowById(id: any, newRowData: any[], idColumnIndex: number = 0): boolean`

## Événements

Écoutables sur l'élément conteneur de la table.

*   `dt:renderComplete` : Déclenché après chaque rendu/re-rendu complet de la table. `event.detail` est `undefined`.
*   `dt:pageChange` : Déclenché après un changement de page. `event.detail` contient `{ currentPage: number; rowsPerPage: number; totalRows: number; }`.
*   `dt:sortChange` : Déclenché après un changement de tri. `event.detail` contient `{ sortColumnIndex: number | null; sortDirection: 'asc' | 'desc' | 'none'; }`.
*   `dt:search` : Déclenché après une recherche (après debounce). `event.detail` contient `{ searchTerm: string; }`.
*   `dt:actionClick` : Déclenché lors du clic sur un bouton d'action. `event.detail` contient `{ action: string; rowData: any[]; }`.
*   `dt:dataChange` : Déclenché après une modification des données via l'API publique. `event.detail` contient `{ source: 'setData' | 'addRow' | 'deleteRowById' | 'updateRowById'; ... }` (les détails varient selon la source).

## Style

La classe utilise des classes utilitaires Tailwind CSS pour le style par défaut. Vous pouvez surcharger ces styles avec votre propre CSS ou personnaliser les classes via l'option `className` de `RowAction` ou en modifiant directement le code source si nécessaire.

## Développement

*   Le code source est en TypeScript (`src/index.ts`).
*   Assurez-vous d'avoir Node.js et npm installés.
*   Installez les dépendances : `npm install`
*   Compilez le code : `npm run build` (ou la commande `tsc` configurée dans votre `tsconfig.json`). 