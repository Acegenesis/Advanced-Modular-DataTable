import { DataTable } from '../core/DataTable';

// Type pour la configuration des breakpoints
interface BreakpointConfig {
    [key: string]: string[]; // ex: { sm: ['id', 'name'], md: ['+', 'email'] }
}

// Breakpoints et ordre (basé sur Tailwind par défaut)
const BREAKPOINTS = {
    sm: '(min-width: 640px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 1024px)',
    xl: '(min-width: 1280px)',
    '2xl': '(min-width: 1536px)',
} as const;
// Utiliser keyof typeof pour obtenir les clés spécifiques
type BreakpointKey = keyof typeof BREAKPOINTS;
const BREAKPOINT_ORDER: BreakpointKey[] = ['sm', 'md', 'lg', 'xl', '2xl']; // Ordre croissant

export class ColumnVisibilityController {
    private instance: DataTable;
    private config: BreakpointConfig;
    private columnIdToIndexMap: Map<string, number> = new Map();
    private allColumnIndices: Set<number> = new Set();
    private mediaQueryLists: Partial<Record<BreakpointKey, MediaQueryList>> = {};
    private listener: () => void;

    constructor(instance: DataTable, config: BreakpointConfig) {
        this.instance = instance;
        this.config = config;

        // Mapper les noms/fields des colonnes à leurs index originaux
        this.instance.options.columns.forEach((col, index) => {
            const id = col.field || col.title.toLowerCase(); 
            if (id) {
                this.columnIdToIndexMap.set(id, index);
            }
            this.allColumnIndices.add(index);
        });

        console.log('[ColumnVisibilityController] Initialized with config:', config, 'and map:', this.columnIdToIndexMap);

        this.listener = () => this._updateVisibility();

        this._setupListeners();
        this._updateVisibility();
    }

    private _setupListeners(): void {
        BREAKPOINT_ORDER.forEach((key: BreakpointKey) => {
            const mediaQueryString = BREAKPOINTS[key];
            const mql = window.matchMedia(mediaQueryString);
            mql.addEventListener('change', this.listener);
            this.mediaQueryLists[key] = mql;
        });
    }

    private _getActiveBreakpoint(): BreakpointKey | null {
        let activeBreakpoint: BreakpointKey | null = null;
        for (let i = BREAKPOINT_ORDER.length - 1; i >= 0; i--) {
            const key = BREAKPOINT_ORDER[i];
            if (this.mediaQueryLists[key]?.matches) {
                activeBreakpoint = key;
                break;
            }
        }
        return activeBreakpoint;
    }

    private _calculateTargetVisibleColumns(): Set<number> {
        const activeBreakpoint = this._getActiveBreakpoint();
        let targetVisibleIndices = new Set<number>();

        let baseBreakpointKey: BreakpointKey | undefined = undefined;
        for(const key of BREAKPOINT_ORDER) {
            if (this.config[key]) {
                baseBreakpointKey = key;
                break;
            }
        }
        
        const effectiveBreakpoint = activeBreakpoint || baseBreakpointKey || null;

        // Utiliser une vérification plus directe pour la config
        const initialConfig = effectiveBreakpoint ? this.config[effectiveBreakpoint] : undefined;

        if (!effectiveBreakpoint || !initialConfig) {
            return new Set(this.allColumnIndices);
        }

        let accumulatedVisible = new Set<number>();
        let firstConfigProcessed = false;

        for (const bpKey of BREAKPOINT_ORDER) {
             // Vérifier si la clé est bien une clé de config et existe dans BREAKPOINT_ORDER
             const bpConfig = this.config[bpKey];
             if (bpConfig && BREAKPOINT_ORDER.includes(bpKey as BreakpointKey)) { 
                let isAdditive = bpConfig.includes('+');
                const columnIds = bpConfig.filter(id => id !== '+');
                
                if (!firstConfigProcessed && !isAdditive) {
                    accumulatedVisible = new Set(); 
                } else if (!firstConfigProcessed && isAdditive) {
                     console.warn(`[ColumnVisibilityController] First breakpoint config for '${bpKey}' is additive ('+'). Starting from all columns visible.`);
                     accumulatedVisible = new Set(this.allColumnIndices);
                } 
                firstConfigProcessed = true;

                columnIds.forEach(id => {
                    const index = this.columnIdToIndexMap.get(id.toLowerCase());
                    if (index !== undefined) {
                        accumulatedVisible.add(index);
                    } else {
                        console.warn(`[ColumnVisibilityController] Column ID "${id}" in config for breakpoint "${bpKey}" not found.`);
                    }
                });
                 
                 if (bpKey === effectiveBreakpoint && columnIds.length === 0 && isAdditive) {
                    accumulatedVisible = new Set(this.allColumnIndices);
                 }
            }

            if (bpKey === effectiveBreakpoint) {
                break;
            }
        }
        
        targetVisibleIndices = accumulatedVisible;
        return targetVisibleIndices;
    }

    private _updateVisibility(): void {
        const targetVisibleSet = this._calculateTargetVisibleColumns();
        const stateManager = this.instance.stateManager;

        if (stateManager.setVisibleColumns(targetVisibleSet)) {
            console.log('[ColumnVisibilityController] Visibility changed, triggering render...');
            this.instance.render();
        } 
    }

    public destroy(): void {
        BREAKPOINT_ORDER.forEach(key => {
            if (this.mediaQueryLists[key]) {
                this.mediaQueryLists[key]?.removeEventListener('change', this.listener);
            }
        });
         console.log('[ColumnVisibilityController] Listeners removed.');
    }
} 