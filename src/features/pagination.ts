import { DataTable } from "../core/DataTable";
import { dispatchPageChangeEvent } from "../events/dispatcher";
import { PaginationStyle } from "../core/types";

// --- Pagination Feature ---

/**
 * Calculates the data for the current page (client-side only).
 * @param instance The DataTable instance.
 * @param sourceData The full data array (already filtered/sorted).
 * @returns The data array for the current page.
 */
export function getCurrentPageData(instance: DataTable, sourceData: any[][]): any[][] {
    const state = instance.stateManager;
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
    const state = instance.stateManager;
    const button = document.createElement('button');
    button.innerHTML = content ?? pageNumber.toString();
    button.className = `relative inline-flex items-center px-4 py-2 border text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition ease-in-out duration-150 disabled:opacity-50 disabled:cursor-not-allowed`;

    if (isCurrent) {
        button.className += ' z-10 bg-indigo-50 border-indigo-500 text-indigo-600';
        button.setAttribute('aria-current', 'page');
        button.disabled = true;
    } else {
        button.className += ' bg-white border-gray-300 text-gray-500 hover:bg-gray-50';
        if (!content) button.setAttribute('aria-label', `Aller à la page ${pageNumber}`);
        button.addEventListener('click', () => {
            state.setCurrentPage(pageNumber);
            dispatchPageChangeEvent(instance);
            if (!state.getIsServerSide()) {
                instance.render();
            }
        });
    }

    if (content && content.includes('<svg')) {
        button.classList.remove('px-4');
        button.classList.add('px-2');
        if (content.includes('M12.707')) button.classList.add('rounded-l-md');
        if (content.includes('M7.293')) button.classList.add('rounded-r-md');
    }
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
    const state = instance.stateManager;
    
    targetContainer.innerHTML = ''; 

    const paginationOptions = instance.options.pagination;
    if (!paginationOptions?.enabled) {
        targetContainer.style.display = 'none';
        return;
    } else {
        targetContainer.style.display = '';
    }

    const currentTotalRows = state.getTotalRows();
    const rowsPerPage = state.getRowsPerPage();
    const currentPage = state.getCurrentPage();
    const totalPages = Math.ceil(displayRowCount / rowsPerPage);
    const startItem = displayRowCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(startItem + rowsPerPage - 1, displayRowCount);

    const defaultPrevContent = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
    const defaultNextContent = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
    const defaultJumpText = 'Go';
    const prevContent = paginationOptions.previousButtonContent ?? defaultPrevContent;
    const nextContent = paginationOptions.nextButtonContent ?? defaultNextContent;
    const jumpText = paginationOptions.jumpButtonText ?? defaultJumpText;

    const leftContainer = document.createElement('div');
    leftContainer.className = 'flex-1 flex justify-start items-center space-x-4';

    const rowsPerPageOptions = paginationOptions.rowsPerPageOptions?.filter((n: number) => n > 0);
    const showRowsPerPageSelector = rowsPerPageOptions && rowsPerPageOptions.length > 0;
    if (showRowsPerPageSelector) {
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'flex items-center text-sm text-gray-700';
        const selectorLabel = document.createElement('label');
        selectorLabel.htmlFor = `${instance.element.id}-rows-per-page`;
        selectorLabel.textContent = 'Lignes par page:';
        selectorLabel.className = 'mr-2';
        const selector = document.createElement('select');
        selector.id = `${instance.element.id}-rows-per-page`;
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
            const newRowsPerPage = parseInt((event.target as HTMLSelectElement).value, 10);
            if (!isNaN(newRowsPerPage) && newRowsPerPage > 0) {
                state.setRowsPerPage(newRowsPerPage);
                state.setCurrentPage(1);
                dispatchPageChangeEvent(instance);
                if (!state.getIsServerSide()) instance.render();
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
        const simplePrev = document.createElement('button');
        simplePrev.textContent = prevContent.replace(/<[^>]*>/g, '') || 'Précédent';
        simplePrev.disabled = currentPage === 1;
        simplePrev.className = 'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
        if (!simplePrev.disabled) {
             simplePrev.addEventListener('click', () => {
                 state.setCurrentPage(currentPage - 1);
                 dispatchPageChangeEvent(instance);
                 if (!state.getIsServerSide()) instance.render();
             });
        }
        const simpleNext = document.createElement('button');
        simpleNext.textContent = nextContent.replace(/<[^>]*>/g, '') || 'Suivant';
        simpleNext.disabled = currentPage === totalPages || displayRowCount === 0;
        simpleNext.className = 'ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
        if (!simpleNext.disabled) {
             simpleNext.addEventListener('click', () => {
                 state.setCurrentPage(currentPage + 1);
                 dispatchPageChangeEvent(instance);
                 if (!state.getIsServerSide()) instance.render();
             });
        }
        rightContainer.appendChild(simplePrev);
        rightContainer.appendChild(simpleNext);
    } else {
        const navContainer = document.createElement('nav');
        navContainer.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px';
        navContainer.setAttribute('aria-label', 'Pagination');
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
                    state.setCurrentPage(pageNum);
                    dispatchPageChangeEvent(instance);
                    if (!state.getIsServerSide()) instance.render();
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
} 