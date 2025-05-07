import { DataTable } from "../core/DataTable";
import { SortDirection, TextFilterOperator, ColumnFilterState } from "../core/types";

// Supprimer les interfaces de détail spécifiques, nous utiliserons des objets anonymes
// export interface PageChangeDetail { ... }
// export interface SelectionChangeDetail { ... }
// ... etc ...

/** Type générique pour les détails des événements personnalisés */
// Renommer pour éviter confusion si on utilise des types spécifiques plus tard?
// export type CustomEventDetailPayload = { [key: string]: any };

// --- Generic Dispatcher ---

/**
 * Helper générique pour dispatcher les CustomEvents depuis l'élément DataTable.
 * @param instance L'instance DataTable.
 * @param eventName Nom de l'événement préfixé (ex: dt:pageChange).
 * @param detail Données associées à l'événement.
 */
export function dispatchEvent<DetailType = any>(instance: DataTable, eventName: string, detail?: DetailType): void {
    const prefixedEventName = eventName.startsWith('dt:') ? eventName : `dt:${eventName}`;
    console.log(`Dispatching event: ${prefixedEventName}`, detail);
    
    // Log final pour vérifier instance.el juste avant l'appel natif
    console.log(`[dispatchEvent] About to call native dispatchEvent. instance.el is:`, instance.el);
    if (!instance.el) {
        console.error("[dispatchEvent] CRITICAL: instance.el became null or undefined just before native dispatchEvent!");
        return; // Ne pas essayer d'appeler dispatchEvent sur undefined
    }

    const event = new CustomEvent<DetailType>(prefixedEventName, {
        detail: detail,
        bubbles: true,
        cancelable: true
    });
    instance.el.dispatchEvent(event);
}

// --- Specific Event Dispatchers --- (Ne plus être génériques)

/**
 * Dispatch l'événement de changement de page.
 */
export function dispatchPageChangeEvent(instance: DataTable): void {
    dispatchEvent(instance, 'pageChange', {
        currentPage: instance.state.getCurrentPage(),
        rowsPerPage: instance.state.getRowsPerPage()
    });
}

/**
 * Dispatch l'événement de changement de sélection.
 */
export function dispatchSelectionChangeEvent(instance: DataTable): void {
    const selectedIds = Array.from(instance.state.getSelectedRowIds());
    dispatchEvent(instance, 'selectionChange', { selectedIds });
}

/**
 * Dispatch l'événement de changement de tri.
 */
export function dispatchSortChangeEvent(instance: DataTable): void {
     dispatchEvent(instance, 'sortChange', {
         sortColumnIndex: instance.state.getSortColumnIndex(),
         sortDirection: instance.state.getSortDirection()
     });
}

/**
 * Dispatch l'événement de recherche (terme global).
 */
export function dispatchSearchEvent(instance: DataTable): void {
    dispatchEvent(instance, 'search', {
        searchTerm: instance.state.getFilterTerm()
    });
}

/**
 * Dispatch l'événement de changement de filtre (colonne ou clearAll).
 */
export function dispatchFilterChangeEvent(instance: DataTable, detail: { type: 'column' | 'clearAll', columnIndex?: number, filterState?: ColumnFilterState }): void {
    dispatchEvent(instance, 'filterChange', detail);
}

/**
 * Dispatch l'événement de clic sur un bouton d'action de ligne.
 */
export function dispatchActionClickEvent(instance: DataTable, detail: { actionId: string, rowId: any, rowData: any[], rowIndex: number }): void {
    dispatchEvent(instance, 'actionClick', detail);
}

/**
 * Dispatch l'événement de chargement de données.
 */
export function dispatchDataLoadEvent(instance: DataTable, detail: { source: string, data?: any[][] }): void {
    dispatchEvent(instance, 'dataLoad', detail);
}

/** Dispatch l'événement d'effacement des données. */
export function dispatchDataClearEvent(instance: DataTable): void {
    dispatchEvent(instance, 'dataClear');
}

/** Dispatch l'événement de rendu terminé. */
export function dispatchRenderCompleteEvent(instance: DataTable): void {
    dispatchEvent(instance, 'renderComplete');
}

/** Dispatch l'événement de changement d'état de chargement. */
export function dispatchLoadingStateChangeEvent(instance: DataTable, detail: { isLoading: boolean }): void {
    dispatchEvent(instance, 'loadingStateChange', detail);
}

/** Dispatch l'événement d'erreur. */
export function dispatchErrorEvent(instance: DataTable, detail: { message: string, error?: any }): void {
    dispatchEvent(instance, 'error', detail);
}

/** Dispatch l'événement d'ajout de ligne. */
export function dispatchRowAddEvent(instance: DataTable, detail: { rowData: any[] }): void {
    dispatchEvent(instance, 'rowAdd', detail);
}

/** Dispatch l'événement de suppression de ligne. */
export function dispatchRowDeleteEvent(instance: DataTable, detail: { rowId: any }): void {
    dispatchEvent(instance, 'rowDelete', detail);
}

/** Dispatch l'événement de mise à jour de ligne. */
export function dispatchRowUpdateEvent(instance: DataTable, detail: { rowId: any, rowData: any[] }): void {
    dispatchEvent(instance, 'rowUpdate', detail);
} 