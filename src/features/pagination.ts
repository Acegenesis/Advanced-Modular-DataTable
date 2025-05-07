import { DataTable } from "../core/DataTable";
import { PaginationStyle } from "../core/types";

// --- Pagination Feature ---

/**
 * Calculates the data for the current page (client-side only).
 * @param instance The DataTable instance.
 * @param sourceData The full data array (already filtered/sorted).
 * @returns The data array for the current page.
 */
export function getCurrentPageData(instance: DataTable, sourceData: any[][]): any[][] {
    const state = instance.state;
    if (!instance.options.pagination?.enabled || state.getIsServerSide()) {
        return sourceData;
    }
    const rowsPerPage = state.getRowsPerPage();
    const currentPage = state.getCurrentPage();
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    console.log(`[getCurrentPageData] Slicing data: rowsPerPage=${rowsPerPage}, currentPage=${currentPage}, startIndex=${startIndex}, endIndex=${endIndex}, sourceLength=${sourceData.length}`);
    const slicedData = sourceData.slice(startIndex, endIndex);
    console.log(`[getCurrentPageData] Returned slice length: ${slicedData.length}`);
    return slicedData;
}

/**
 * Crée un bouton de pagination individuel.
 */
function createPageButton(instance: DataTable, pageNumber: number, isCurrent: boolean = false, content?: string): HTMLButtonElement {
    const state = instance.state;
    const button = document.createElement('button');
    button.innerHTML = content ?? pageNumber.toString();
    
    // Classes de base
    let baseClasses = 'relative inline-flex items-center border text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition ease-in-out duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Ajuster padding basé sur contenu (numéro vs icône)
    if (content && content.includes('<svg')) {
        baseClasses += ' px-2 py-2'; // Padding réduit pour icônes
    } else {
        baseClasses += ' px-4 py-2'; // Padding normal pour numéros
    }
    button.className = baseClasses;

    if (isCurrent) {
        button.className += ' z-10 bg-indigo-50 border-indigo-500 text-indigo-600';
        button.setAttribute('aria-current', 'page');
        button.disabled = true;
    } else {
        button.className += ' bg-white border-gray-300 text-gray-500 hover:bg-gray-50';
        if (!content) button.setAttribute('aria-label', `Aller à la page ${pageNumber}`);
        button.addEventListener('click', () => {
            instance.goToPage(pageNumber);
        });
    }
    // Ajouter classes pour coins arrondis pour prev/next en se basant sur les IDs ou le contenu SVG
    const prevId = instance.options.icons?.pagePrev || 'icon-page-prev';
    const nextId = instance.options.icons?.pageNext || 'icon-page-next';
    if (content && (content.includes(`#${prevId}`) || content.includes('M12.707'))) button.classList.add('rounded-l-md');
    if (content && (content.includes(`#${nextId}`) || content.includes('M7.293'))) button.classList.add('rounded-r-md');

    return button;
}

/**
 * Crée un élément "..." pour la pagination.
 */
function createEllipsisElement(): HTMLSpanElement {
    const span = document.createElement('span');
    span.textContent = '...';
    span.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700';
    return span;
}

/**
 * Renders the pagination controls based on the selected style.
 * @param instance The DataTable instance.
 * @param displayRowCount The number of rows currently being displayed (after filtering).
 * @param targetContainer The HTMLElement where the controls should be rendered.
 */
export function renderPaginationControls(instance: DataTable, displayRowCount: number, targetContainer: HTMLElement): void {
    // Log 1: Début de renderPaginationControls
    console.log(`[renderPaginationControls START] Called for table ${instance.el.id}. Display row count: ${displayRowCount}`);

    // Log 2: Vérifier existence instance.state
    if (!instance.state) {
        console.error("[renderPaginationControls CRITICAL ERROR] instance.state is UNDEFINED or NULL!");
        return; // Stop rendering if state is not available
    }
    console.log("[renderPaginationControls] instance.state exists. Proceeding...");

    const state = instance.state;
    const paginationOptions = instance.options.pagination;
    
    // Cacher la pagination si le virtual scroll est activé
    if (instance.options.virtualScroll?.enabled) {
        targetContainer.style.display = 'none';
        return;
    }

    targetContainer.innerHTML = ''; 
    
    if (!paginationOptions?.enabled) {
        targetContainer.style.display = 'none';
        return;
    } else {
        targetContainer.style.display = '';
    }

    // Log 3: Vérifier méthodes state AVANT appel
    if (typeof state.getCurrentPage !== 'function' || typeof state.getRowsPerPage !== 'function' || typeof state.getTotalRows !== 'function') {
        console.error("[renderPaginationControls CRITICAL ERROR] Une des méthodes de state (getCurrentPage, getRowsPerPage, getTotalRows) n'est pas une fonction! State:", state);
        return;
    }
    console.log("[renderPaginationControls] state methods (getCurrentPage, getRowsPerPage, getTotalRows) seem OK. Calling them...");

    const currentTotalRows = state.getTotalRows();
    const rowsPerPage = state.getRowsPerPage();
    const currentPage = state.getCurrentPage();

    // Log 4: Valeurs récupérées depuis state
    console.log(`[renderPaginationControls] State values: currentPage=${currentPage}, rowsPerPage=${rowsPerPage}, totalRows=${currentTotalRows}, displayRowCount=${displayRowCount}`);

    const totalPages = Math.ceil(displayRowCount / rowsPerPage);
    const startItem = displayRowCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(startItem + rowsPerPage - 1, displayRowCount);

    // --- Contenu des boutons via Sprite ou Fallback --- 
    let prevContent: string;
    let nextContent: string;

    if (instance.spriteAvailable.pagePrev) {
        const iconPrevId = instance.options.icons?.pagePrev || 'icon-page-prev';
        prevContent = `<svg class="h-5 w-5" fill="currentColor" aria-hidden="true"><use href="#${iconPrevId}"></use></svg>`;
    } else {
        // Fallback SVG inline
        prevContent = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
    }

    if (instance.spriteAvailable.pageNext) {
        const iconNextId = instance.options.icons?.pageNext || 'icon-page-next';
        nextContent = `<svg class="h-5 w-5" fill="currentColor" aria-hidden="true"><use href="#${iconNextId}"></use></svg>`;
    } else {
         // Fallback SVG inline
        nextContent = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
    }

    const jumpText = instance.options.pagination?.jumpButtonText ?? 'Go';
    // --------------------------------------------------

    const leftContainer = document.createElement('div');
    leftContainer.className = 'flex-1 flex justify-start items-center space-x-4';

    const rowsPerPageOptions = paginationOptions.rowsPerPageOptions?.filter((n: number) => n > 0);
    const showRowsPerPageSelector = rowsPerPageOptions && rowsPerPageOptions.length > 0;
    if (showRowsPerPageSelector) {
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'flex items-center text-sm text-gray-700';
        const selectorLabel = document.createElement('label');
        selectorLabel.htmlFor = `${instance.el.id}-rows-per-page`;
        selectorLabel.textContent = 'Lignes par page:';
        selectorLabel.className = 'mr-2';
        const selector = document.createElement('select');
        selector.id = `${instance.el.id}-rows-per-page`;
        selector.name = 'rows-per-page';
        selector.className = 'border border-gray-300 rounded-md shadow-sm px-2 py-1 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
        selector.setAttribute('aria-label', 'Choisir le nombre de lignes par page');
        rowsPerPageOptions.forEach((optionValue: number) => {
            const option = document.createElement('option');
            option.value = String(optionValue);
            option.textContent = String(optionValue);
            if (optionValue === rowsPerPage) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
        selector.addEventListener('change', (event) => {
            const target = event.target as HTMLSelectElement;
            const newRowsPerPage = parseInt(target.value, 10);
            console.log(`[RowsPerPage] Change event: selected value="${target.value}", parsed=${newRowsPerPage}`);
            if (!isNaN(newRowsPerPage) && newRowsPerPage > 0) {
                try {
                    console.log(`[RowsPerPage] Setting rowsPerPage to ${newRowsPerPage}. Current page before: ${instance.state.getCurrentPage()}`);
                    state.setRowsPerPage(newRowsPerPage);
                    console.log(`[RowsPerPage] State rowsPerPage is now: ${instance.state.getRowsPerPage()}. Calling goToPage(1)...`);
                    instance.goToPage(1);
                    console.log(`[RowsPerPage] goToPage(1) called. Current page after: ${instance.state.getCurrentPage()}`);
                } catch(error) {
                    console.error("[RowsPerPage] Error during update:", error);
                }
            } else {
                console.warn(`[RowsPerPage] Invalid value selected: ${target.value}`);
            }
        });
        selectorContainer.appendChild(selectorLabel);
        selectorContainer.appendChild(selector);
        leftContainer.appendChild(selectorContainer); 
    }

    const infoContainer = document.createElement('div');
    infoContainer.className = 'text-sm text-gray-700';
    infoContainer.setAttribute('aria-live', 'polite');
    const p = document.createElement('p');
    console.log(`[renderPaginationControls] About to set innerHTML for 'p'. p exists: ${!!p}, displayRowCount: ${displayRowCount}, startItem: ${startItem}, endItem: ${endItem}`);
    if (displayRowCount > 0) {
        p.innerHTML = `Affichage <span class="font-medium text-gray-900">${startItem}</span> à <span class="font-medium text-gray-900">${endItem}</span> sur <span class="font-medium text-gray-900">${displayRowCount}</span> résultats`;
    } else {
        p.textContent = 'Aucun résultat';
    }
    infoContainer.appendChild(p);
    leftContainer.appendChild(infoContainer);

    const rightContainer = document.createElement('div');
    rightContainer.className = 'flex justify-end items-center';

    const prevButton = createPageButton(instance, currentPage - 1, false, prevContent);
    const nextButton = createPageButton(instance, currentPage + 1, false, nextContent);
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages || displayRowCount === 0;
    
    const paginationStyle: PaginationStyle = paginationOptions.style || 'numbered-jump';
    if (paginationStyle === 'simple') {
        // --- Style Simple --- 
        const simplePrev = document.createElement('button');
        simplePrev.textContent = instance.options.pagination?.previousButtonContent || 'Précédent'; // Utiliser le texte ici
        simplePrev.disabled = currentPage === 1;
        simplePrev.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
        if (!simplePrev.disabled) {
             simplePrev.addEventListener('click', () => {
                 instance.goToPage(currentPage - 1);
             });
        }

        const simpleNext = document.createElement('button');
        simpleNext.textContent = instance.options.pagination?.nextButtonContent || 'Suivant'; // Utiliser le texte ici
        simpleNext.disabled = currentPage === totalPages || displayRowCount === 0;
        simpleNext.className = 'ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
        if (!simpleNext.disabled) {
             simpleNext.addEventListener('click', () => {
                 instance.goToPage(currentPage + 1);
             });
        }
        
        rightContainer.appendChild(simplePrev);
        rightContainer.appendChild(simpleNext);
    } else {
        // --- Styles Numbered / Numbered-Jump --- 
        const navContainer = document.createElement('nav');
        navContainer.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px';
        navContainer.setAttribute('aria-label', 'Pagination');
        
        // Ajouter les boutons Précédent/Suivant (qui ont maintenant les <use>)
        navContainer.appendChild(prevButton);
        
        const maxVisiblePages = 7; 
        const sidePages = Math.floor((maxVisiblePages - 3) / 2);
        let startPage = Math.max(2, currentPage - sidePages);
        let endPage = Math.min(totalPages - 1, currentPage + sidePages);
        if (currentPage - sidePages <= 2) endPage = Math.min(totalPages - 1, maxVisiblePages - 2);
        if (currentPage + sidePages >= totalPages - 1) startPage = Math.max(2, totalPages - (maxVisiblePages - 3));

        if (totalPages > 0) {
            navContainer.appendChild(createPageButton(instance, 1, currentPage === 1));
            if (startPage > 2) navContainer.appendChild(createEllipsisElement());
            for (let i = startPage; i <= endPage; i++) {
                navContainer.appendChild(createPageButton(instance, i, currentPage === i));
            }
            if (endPage < totalPages - 1) navContainer.appendChild(createEllipsisElement());
            if (totalPages > 1) navContainer.appendChild(createPageButton(instance, totalPages, currentPage === totalPages));
        }
        
        // Ajouter le bouton Suivant (qui a maintenant le <use>)
        navContainer.appendChild(nextButton);
        rightContainer.appendChild(navContainer);
        
        if (paginationStyle === 'numbered-jump' && totalPages > maxVisiblePages) {
            const jumpContainer = document.createElement('div');
            jumpContainer.className = 'ml-4 flex items-center';
            const jumpInput = document.createElement('input');
            jumpInput.type = 'number';
            jumpInput.min = '1';
            jumpInput.max = String(totalPages);
            jumpInput.className = 'w-16 border border-gray-300 rounded-md shadow-sm px-2 py-1 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
            jumpInput.placeholder = 'Page...';
            jumpInput.setAttribute('aria-label', 'Aller à la page');
            const jumpButton = document.createElement('button');
            jumpButton.textContent = jumpText;
            jumpButton.className = 'ml-2 px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
            const goToPage = () => {
                const pageNum = parseInt(jumpInput.value, 10);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    instance.goToPage(pageNum);
                }
            };
            jumpButton.addEventListener('click', goToPage);
            jumpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') goToPage(); });
            jumpContainer.appendChild(jumpInput);
            jumpContainer.appendChild(jumpButton);
            rightContainer.appendChild(jumpContainer);
        }
    }

    targetContainer.appendChild(leftContainer);
    targetContainer.appendChild(rightContainer);
    targetContainer.className = 'py-2 px-4 flex items-center justify-between border-t border-gray-200';
    console.log("[renderPaginationControls END]"); // Log 5
} 