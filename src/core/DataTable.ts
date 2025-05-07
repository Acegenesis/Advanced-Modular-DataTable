import { DataTableOptions, ColumnFilterState, ServerSideParams, SortDirection } from "./types";
import { StateManager } from "./StateManager";
import { dispatchEvent, dispatchSelectionChangeEvent, dispatchPageChangeEvent } from "../events/dispatcher";
import { getSelectedRowData, updateSelectAllCheckboxState, getCurrentFilteredSortedData } from "../features/selection";
import { renderHeader } from "../rendering/headerRenderer";
import { renderVirtualBody, renderStandardBody } from "../rendering/bodyRenderer";
import { renderToolbar } from "../rendering/toolbarRenderer";
import { renderPaginationControls } from "../features/pagination";
import { throttle } from "../utils/throttle";

/* -------------------------------------------------------------------------- */
/*                               Default options                              */
/* -------------------------------------------------------------------------- */
const DEFAULT_OPTIONS: DataTableOptions = {
  pagination: { enabled: true, rowsPerPage: 10, style: "numbered-jump" },
            sorting: { enabled: true },
            searching: { enabled: true, debounceTime: 300 },
  selection: { enabled: false, mode: "multiple" },
            columnFiltering: { enabled: false },
            resizableColumns: false,
            reorderableColumns: false,
  processingMode: "client",
  columns: [],
};

export class DataTable {
  /* ------------------------------------------------------------------------ */
  /* Public state                                                             */
  /* ------------------------------------------------------------------------ */
  public readonly el: HTMLElement;
  public readonly options: DataTableOptions;
  public readonly state: StateManager;
  public selectAllCheckbox: HTMLInputElement | null = null;
  public paginationContainer: HTMLElement | null = null;
  public spriteAvailable: Record<string, boolean> = {
    sortArrow: false,
    filter: false,
    dropdown: false,
    pagePrev: false,
    pageNext: false,
  };
  public readonly idColumn: number = 0;

  /* ------------------------------------------------------------------------ */
  /* Private state                                                            */
  /* ------------------------------------------------------------------------ */
  private focusedElementId: string | null = null;
  private loadingOverlay: HTMLElement | null = null;

  // DOM references (built once)
  private toolbarEl: HTMLElement | null = null;
  private wrapperEl: HTMLElement | null = null;
  private footerEl: HTMLElement | null = null;

  // Virtual scroll elements
  private vsViewport: HTMLElement | null = null;
  private vsContent: HTMLElement | null = null;
  private onVScroll?: () => void;

  // Client‑side page‑preload cache
  private preloadCache = new Map<number, any[][]>();

  /* ------------------------------------------------------------------------ */
  /* Life‑cycle                                                               */
  /* ------------------------------------------------------------------------ */
  constructor(elementId: string, opts: Partial<DataTableOptions>) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`Element '${elementId}' introuvable`);

    this.el = el;

    // Fusionne les options en s'assurant que les objets imbriqués sont correctement fusionnés
    this.options = {
        ...DEFAULT_OPTIONS, // Commence avec les valeurs par défaut
        ...opts,            // Écrase les valeurs de premier niveau avec celles de opts

        // Fusion explicite pour les objets imbriqués requis
        pagination: {
            ...DEFAULT_OPTIONS.pagination,
            ...(opts.pagination ?? {}),
        },
        sorting: {
            ...DEFAULT_OPTIONS.sorting,
            ...(opts.sorting ?? {}),
        },
        searching: {
            ...DEFAULT_OPTIONS.searching,
            ...(opts.searching ?? {}),
        },
        selection: {
            ...DEFAULT_OPTIONS.selection,
            ...(opts.selection ?? {}),
        },
        columnFiltering: {
            ...DEFAULT_OPTIONS.columnFiltering,
            ...(opts.columnFiltering ?? {}),
        },

        // Fusion pour les objets imbriqués optionnels (uniquement si opts les fournit)
        virtualScroll: opts.virtualScroll ? {
            ...(DEFAULT_OPTIONS.virtualScroll ?? {}), // Commence avec les défauts ou {}
            ...opts.virtualScroll,                  // Fusionne les opts de l'utilisateur
        } : DEFAULT_OPTIONS.virtualScroll,        // Sinon, garde la valeur par défaut (peut être undefined)

        serverSide: opts.serverSide ? {
            ...(DEFAULT_OPTIONS.serverSide ?? {}),
            ...opts.serverSide,
        } : DEFAULT_OPTIONS.serverSide,

        icons: opts.icons ? {
            ...(DEFAULT_OPTIONS.icons ?? {}),
            ...opts.icons,
        } : DEFAULT_OPTIONS.icons,

        // La logique de remplacement pour 'columns' est correcte
        columns: opts.columns ?? DEFAULT_OPTIONS.columns,

    } as DataTableOptions; // L'assertion peut être nécessaire car TS a du mal avec ce type de fusion complexe

    this._detectSprites();
    this.state = new StateManager(this.options, opts.data ?? [], elementId);
    this._resolveIdColumn();

    this._buildStructure();
    this._createLoadingOverlay();
    this.render();

    // Log avant dispatchEvent
    console.log(`[DataTable Constructor] Before dispatching selectionChange. this.el is:`, this.el);
    if (!this.el) {
        console.error("[DataTable Constructor] CRITICAL: this.el is null or undefined before dispatchEvent!");
    }

    dispatchEvent(this, "selectionChange", {
      selectedIds: this.state.getSelectedRowIds(),
      selectedData: [],
    });

    this._preloadNextPage();
  }

  /** Détruit l'instance et nettoie le DOM. */
  destroy(): void {
    if (this.vsViewport && this.onVScroll)
      this.vsViewport.removeEventListener("scroll", this.onVScroll);

    this.el.innerHTML = "";
    (window as any).DataTableInstances?.splice(
      (window as any).DataTableInstances.indexOf(this),
      1
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Rendering                                                                */
  /* ------------------------------------------------------------------------ */
  render(columnOrderOverride?: number[]): void {
    console.log(`[DataTable render] Called. Order override: ${JSON.stringify(columnOrderOverride)}`);
        this._saveFocus();

    if (this.options.virtualScroll?.enabled) this._renderVirtual(columnOrderOverride);
    else this._renderStandard(columnOrderOverride);

    if (this.loadingOverlay)
      this.loadingOverlay.style.display = this.state.getIsLoading()
        ? "flex"
        : "none";

    if (
      this.state.getSelectionEnabled() &&
      this.state.getSelectionMode() === "multiple"
    )
             updateSelectAllCheckboxState(this);

    this._restoreFocus();
  }

  /* ----------------------- Standard (paginated) table -------------------- */
  private _renderStandard(columnOrderOverride?: number[]): void {
    console.log(`[_renderStandard] Called. Order override: ${JSON.stringify(columnOrderOverride)}`);
    // detach any VS listener if we switch modes
    if (this.vsViewport && this.onVScroll) {
      this.vsViewport.removeEventListener("scroll", this.onVScroll);
      this.vsViewport = this.vsContent = undefined as any;
    }

    if (!this.wrapperEl || !this.footerEl) return;

    const allData = this.state.getIsServerSide()
      ? this.state.getDisplayedData()
      : getCurrentFilteredSortedData(this);

    const pageData = this.state.getIsServerSide()
      ? allData
      : this._currentPageSlice(allData);
      
    const total = this.state.getIsServerSide()
      ? this.state.getTotalRows()
      : allData.length;

    // --- Modification: Update existing elements instead of full recreation ---
    const table = this.wrapperEl.querySelector('table.dt-table') as HTMLTableElement;
    
    if (table) {
      console.log("[_renderStandard] Updating existing table - Calling renderHeader.");
      renderHeader(this, table, columnOrderOverride); 

      // Update existing table body
      const tBody = table.tBodies[0];
      if (tBody) {
        tBody.innerHTML = ''; // Clear existing body rows
        renderStandardBody(this, table, pageData, columnOrderOverride); // Render new rows into existing tbody
        } else {
        // Fallback if tbody doesn't exist (should not happen with current structure)
        renderStandardBody(this, table, pageData, columnOrderOverride);
      }
      
      // Update pagination controls in the existing footer
      this.footerEl.innerHTML = ""; // Clear existing footer content
      renderPaginationControls(this, total, this.footerEl); // Render new controls
            } else {
      // Fallback: If table doesn't exist yet, render it fully (initial render case)
      this.wrapperEl.innerHTML = "";
      const newTable = document.createElement("table");
      newTable.className = "dt-table w-full border-collapse table-fixed";
      this.wrapperEl.appendChild(newTable);
      renderHeader(this, newTable, columnOrderOverride);
      renderStandardBody(this, newTable, pageData, columnOrderOverride);
      
      this.footerEl.innerHTML = "";
      renderPaginationControls(this, total, this.footerEl);
    }
    // --- Fin de la modification ---
  }

  /* ----------------------------- Virtual scroll ------------------------- */
  private _renderVirtual(columnOrderOverride?: number[]): void {
    console.log(`[_renderVirtual] Called. Order override: ${JSON.stringify(columnOrderOverride)}`);
    // cleanup any old viewport listener
    if (this.vsViewport && this.onVScroll)
      this.vsViewport.removeEventListener("scroll", this.onVScroll);

    this.el.innerHTML = "";
    const data = getCurrentFilteredSortedData(this);
    const rowHeight = this.options.virtualScroll?.rowHeight ?? 30;

    /* Build wrapper */
    const wrap = document.createElement("div");
    wrap.className = "dt-vs-wrap flex flex-col h-full";

    /* Header */
    const headerT = document.createElement("table");
    headerT.className =
      "dt-table dt-table-header w-full border-collapse table-fixed";
    renderHeader(this, headerT, columnOrderOverride);
    wrap.appendChild(headerT);

    /* Viewport */
    this.vsViewport = document.createElement("div");
    this.vsViewport.className =
      "dt-vs-viewport flex-grow overflow-y-auto relative";
    wrap.appendChild(this.vsViewport);

    /* Content */
    this.vsContent = document.createElement("div");
    this.vsContent.className = "dt-vs-content relative";
    this.vsContent.style.height = `${data.length * rowHeight}px`;
    this.vsViewport.appendChild(this.vsContent);

    /* Footer */
    this.footerEl = document.createElement("div");
    this.footerEl.className = "dt-footer-container border-t border-gray-200";
    wrap.appendChild(this.footerEl);

    this.el.appendChild(wrap);

    renderVirtualBody(this, this.vsContent, this.vsViewport, data, columnOrderOverride);
    renderPaginationControls(this, data.length, this.footerEl);

    if (!this.onVScroll)
      this.onVScroll = throttle(() => this._onVirtualScroll(), 100);
    this.vsViewport.addEventListener("scroll", this.onVScroll);
  }

  /* ------------------------------------------------------------------------ */
  /* Data operations                                                          */
  /* ------------------------------------------------------------------------ */
  setData(rows: any[][]): void {
    this._clearPreload();
    this.state.setData(rows);
    this.goToPage(1);
    dispatchEvent(this, "dataLoad", { source: "setData", data: rows });
  }

  addRow(row: any[]): void {
    this._clearPreload();
    this.state._addRow(row);
            this.render(); 
    dispatchEvent(this, "dataChange", { source: "addRow", newRowData: row });
  }

  deleteRowById(id: string | number): boolean {
    this._clearPreload();
    const ok = this.state._deleteRowById(id, this.idColumn);
    if (ok) this.render();
    return ok;
  }

  updateRowById(id: string | number, data: any[]): boolean {
    this._clearPreload();
    const ok = this.state._updateRowById(id, data, this.idColumn);
    if (ok) this.render();
    return ok;
  }

  /* ------------------------------------------------------------------------ */
  /* Pagination, tri, filtrage                                                */
  /* ------------------------------------------------------------------------ */
  goToPage(page: number): void {
    console.log(`[goToPage] Called with page: ${page}. Current page is: ${this.state.getCurrentPage()}`);
    const total = this.state.getTotalRows();
    const per = this.state.getRowsPerPage();
    const max = Math.max(1, Math.ceil(total / per));
    const target = Math.max(1, Math.min(page, max));

    const pageChanged = target !== this.state.getCurrentPage();

    this._clearPreload();
    
    if (pageChanged) {
        this.state.setCurrentPage(target);
    }

    if (this.state.getIsServerSide()) { 
        if (pageChanged) {
            this.fetchData();
        } else {
             console.log("[goToPage] Server-side, page unchanged, skipping fetch.");
        }
    } else {
        console.log("[goToPage] Client-side, calling render().");
        this.render(); 
    }

    if (pageChanged) {
        dispatchPageChangeEvent(this);
    }
  }

  setSort(col: number | null, dir: SortDirection): void {
    if (
      col === this.state.getSortColumnIndex() &&
      dir === this.state.getSortDirection()
    )
      return;
    this._clearPreload();
    this.state.setSort(col, dir);
    this.goToPage(1);
    dispatchEvent(this, "sortChange", {
      sortColumnIndex: col,
      sortDirection: dir,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Server‑side                                                              */
  /* ------------------------------------------------------------------------ */
  async fetchData(): Promise<void> {
    if (!this.state.getIsServerSide() || !this.options.serverSide?.fetchData)
            return;

        this.setLoading(true);
        try {
             const params: ServerSideParams = {
        draw: Date.now(),
        start: (this.state.getCurrentPage() - 1) * this.state.getRowsPerPage(),
        length: this.state.getRowsPerPage(),
        search: { value: this.state.getFilterTerm(), regex: false },
        order:
          this.state.getSortColumnIndex() != null
            ? [
                {
                  column: this.state.getSortColumnIndex()!,
                  dir: this.state.getSortDirection(),
                },
              ]
            : [],
        columns: this.options.columns.map((c, i) => ({
          data: c.field,
          name: c.field,
          searchable: c.searchable ?? true,
          orderable: c.sortable ?? true,
                     search: {
            value: String(this.state.getColumnFilters().get(i)?.value ?? ""),
            regex: false,
          },
        })),
      };

      const { data, totalRecords } = await this.options.serverSide.fetchData(
        params
      );
      this.state.setData(data);
      this.state.setTotalRows(totalRecords);
    } catch (e) {
      this.state.setData([]);
      this.state.setTotalRows(0);
      dispatchEvent(this, "error", { message: "Erreur serveur", error: e });
        } finally {
            this.setLoading(false);
            this.render();
        }
    }

  /* ------------------------------------------------------------------------ */
  /* Public getters / setters                                                 */
  /* ------------------------------------------------------------------------ */
  getSelectedRowData = () => getSelectedRowData(this);
  getSelectedRowIds = () => [...this.state.getSelectedRowIds()];

  setSelectedRowIds(ids: any[]): void {
    this.state.setSelectedRowIds(new Set(ids ?? []));
    updateSelectAllCheckboxState(this);
    dispatchSelectionChangeEvent(this);
  }

  setLoading(isLoading: boolean): void {
    this.state.setLoading(isLoading);
    if (this.loadingOverlay)
      this.loadingOverlay.style.display = isLoading ? "flex" : "none";
  }

  /* ------------------------------------------------------------------------ */
  /* Private helpers                                                          */
  /* ------------------------------------------------------------------------ */
  private _buildStructure(): void {
    // ** Ajouter classes dark mode au conteneur principal **
    this.el.classList.add('dt-container', 'dark:bg-gray-900'); // Fond sombre pour le conteneur

    /* Toolbar */
    this.toolbarEl = renderToolbar(this);
    if (this.toolbarEl) this.el.appendChild(this.toolbarEl);

    /* Wrapper */
    this.wrapperEl = document.createElement("div");
    this.wrapperEl.className = "dt-scroll-wrapper relative overflow-x-auto"; // Assurer overflow-x-auto pour responsivité
    // ** Style wrapper optionnel pour dark mode **
    // this.wrapperEl.classList.add('dark:border', 'dark:border-gray-700');
    if (this.options.scrollWrapperMaxHeight) {
      this.wrapperEl.style.maxHeight = this.options.scrollWrapperMaxHeight;
      this.wrapperEl.style.overflowY = "auto"; 
    }
    this.el.appendChild(this.wrapperEl);

    /* Footer */
    this.footerEl = document.createElement("div");
    // ** Ajouter classes dark mode au footer **
    this.footerEl.className = "dt-footer-container border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800"; // Fond et bordure sombres
    this.el.appendChild(this.footerEl);
  }

  private _detectSprites(): void {
    const root = document.getElementById("dt-svg-sprite-container");
    if (!root) return;

    const check = (id: string) => !!root.querySelector(`symbol#${id}`);
    const i = this.options.icons ?? {};
    this.spriteAvailable = {
      sortArrow: check(i.sortArrow ?? "icon-sort-arrow"),
      filter: check(i.filter ?? "icon-filter"),
      dropdown: check(i.dropdown ?? "icon-dropdown"),
      pagePrev: check(i.pagePrev ?? "icon-page-prev"),
      pageNext: check(i.pageNext ?? "icon-page-next"),
    };
  }

  private _createLoadingOverlay(): void {
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className =
      "dt-loading-overlay absolute inset-0 bg-gray-300 bg-opacity-50 flex items-center justify-center z-50";
    this.loadingOverlay.style.display = "none";

    const spinner = document.createElement("div");
    spinner.className =
      "dt-loading-spinner animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600";
    this.loadingOverlay.appendChild(spinner);
    this.el.appendChild(this.loadingOverlay);
  }

    private _saveFocus(): void {
    const active = document.activeElement as HTMLElement | null;
    if (active && this.el.contains(active))
      this.focusedElementId = active.id || null;
    else this.focusedElementId = null;
  }

    private _restoreFocus(): void {
    if (!this.focusedElementId) return;
    const el = document.getElementById(this.focusedElementId);
    if (el && this.el.contains(el) && "focus" in el)
      (el as HTMLElement).focus();
    this.focusedElementId = null; // reset
  }

  private _onVirtualScroll(): void {
    if (!this.vsViewport || !this.vsContent) return;
    renderVirtualBody(
      this,
      this.vsContent,
      this.vsViewport,
      getCurrentFilteredSortedData(this)
    );
  }

  private _preloadNextPage(): void {
    if (
      !this.options.pagination?.enabled ||
      this.state.getIsServerSide() ||
      this.options.virtualScroll?.enabled
    )
      return;

    const next = this.state.getCurrentPage() + 1;
    const rows = getCurrentFilteredSortedData(this);
    const per = this.state.getRowsPerPage();
    const start = (next - 1) * per;
    const slice = rows.slice(start, start + per);
    if (slice.length) this.preloadCache.set(next, slice);
  }

  private _clearPreload() {
    this.preloadCache.clear();
  }

  private _currentPageSlice(data: any[][]): any[][] {
    // Log 4: Début de _currentPageSlice
    console.log(`[DataTable _currentPageSlice] Called. Checking state...`);
    if (!this.state) {
        console.error("[DataTable _currentPageSlice] ERREUR: this.state est UNDEFINED ici!");
        return []; // Retourner vide pour éviter l'erreur
    }
    console.log(`[DataTable _currentPageSlice] this.state existe. Accessing methods directly...`);
    
    // Appel direct au lieu de la déstructuration
    const per = this.state.getRowsPerPage(); 
    const currentPage = this.state.getCurrentPage();
    
    // Log 5: Valeur retournée par getRowsPerPage
    console.log(`[DataTable _currentPageSlice] this.state.getRowsPerPage() returned: ${per}`);
    if (per === undefined) {
        console.error("[DataTable _currentPageSlice] ERREUR: this.state.getRowsPerPage() a retourné UNDEFINED!");
        // Peut-être retourner une valeur par défaut pour éviter une erreur de slice ?
        // return data.slice(0, 10); // Exemple: tranche par défaut de 10
        return []; // Ou simplement retourner vide
    }

    const start = (currentPage - 1) * per;
    console.log(`[DataTable _currentPageSlice] Calculated start index: ${start} (page: ${currentPage}, per: ${per})`);
    
    const slice = data.slice(start, start + per);
    console.log(`[DataTable _currentPageSlice] Returning slice of length: ${slice.length}`);
    return slice;
  }

  private _resolveIdColumn(): void {
    const idCol = this.options.uniqueRowIdColumn;
    let resolvedIndex = 0;
    if (typeof idCol === "number" && idCol >= 0) {
        resolvedIndex = idCol;
    } else if (typeof idCol === "string") {
        resolvedIndex = this.options.columns.findIndex((c) => c.field === idCol);
        if (resolvedIndex === -1) resolvedIndex = 0; // Fallback to 0 if field not found
    }
    // Assigner la valeur à la propriété publique (possible car pas encore readonly dans le constructeur)
    (this as any).idColumn = resolvedIndex; 
  }

  /**
   * Efface tous les filtres actifs (colonnes et recherche globale) et redessine.
   */
  public clearAllFilters(): void {
    console.log("[clearAllFilters] Called.");
    let filterTermCleared = false;
    let columnFiltersCleared = false;

    const currentTerm = this.state.getFilterTerm();
    if (currentTerm !== '') {
      console.log(`[clearAllFilters] Clearing global filter term: "${currentTerm}"`);
      this.state.setFilterTerm('');
      filterTermCleared = true;
      const searchInput = this.el.querySelector('.dt-global-search-input') as HTMLInputElement | null;
      if (searchInput) searchInput.value = '';
      else console.warn("[clearAllFilters] Global search input not found to clear value.");
        } else {
        console.log("[clearAllFilters] Global filter term was already empty.");
    }

    const currentColFilters = this.state.getColumnFilters();
    if (currentColFilters.size > 0) {
        console.log(`[clearAllFilters] Clearing ${currentColFilters.size} column filters.`);
      this.state.clearAllColumnFilters();
      columnFiltersCleared = true;
      this.el.querySelectorAll('.dt-column-filter-input').forEach(input => {
        (input as HTMLInputElement).value = '';
      });
      console.log("[clearAllFilters] Column filter inputs cleared (if any exist).");
    } else {
        console.log("[clearAllFilters] No column filters were active.");
    }

    if (filterTermCleared || columnFiltersCleared) {
      this._clearPreload();
      console.log("[clearAllFilters] Filters changed, calling goToPage(1).");
      this.goToPage(1);
      dispatchEvent(this, 'filterChange', { type: 'clearAll' });
        } else {
        console.log("[clearAllFilters] No filters were active to clear, no redraw needed.");
    }
  }
}
