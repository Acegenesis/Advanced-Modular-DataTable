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
function createPageButton(instance: DataTable, pageNumber: number, isCurrent: boolean = false): HTMLButtonElement {
    const state = instance.stateManager;
    const button = document.createElement('button');
    button.textContent = pageNumber.toString();
    button.className = `relative inline-flex items-center px-4 py-2 border text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition ease-in-out duration-150 disabled:opacity-50 disabled:cursor-not-allowed`;

    if (isCurrent) {
        button.className += ' z-10 bg-indigo-50 border-indigo-500 text-indigo-600';
        button.setAttribute('aria-current', 'page');
        button.disabled = true;
    } else {
        button.className += ' bg-white border-gray-300 text-gray-500 hover:bg-gray-50';
        button.setAttribute('aria-label', `Aller à la page ${pageNumber}`);
        button.addEventListener('click', () => {
            state.setCurrentPage(pageNumber);
            dispatchPageChangeEvent(instance);
            if (!state.getIsServerSide()) {
                instance.render();
            }
        });
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
 */
export function renderPaginationControls(instance: DataTable, displayRowCount: number): void {
    const state = instance.stateManager;
    let paginationContainer = instance.element.querySelector('#dt-pagination-controls');
    if (paginationContainer) { paginationContainer.remove(); } // Remove old controls

    const paginationOptions = instance.options.pagination;
    if (!paginationOptions?.enabled) return; // Ne rien faire si la pagination est désactivée
    
    // Vérifier si on a des options pour le sélecteur de lignes/page
    const rowsPerPageOptions = paginationOptions.rowsPerPageOptions?.filter((n: number) => n > 0);
    const showRowsPerPageSelector = rowsPerPageOptions && rowsPerPageOptions.length > 0;

    const paginationStyle: PaginationStyle = paginationOptions.style || 'numbered-jump'; // Default style

    paginationContainer = document.createElement('div');
    paginationContainer.id = 'dt-pagination-controls';
    paginationContainer.className = 'bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-1';
    paginationContainer.setAttribute('role', 'navigation');
    paginationContainer.setAttribute('aria-label', 'Pagination');

    const currentTotalRows = state.getTotalRows();
    const displayRows = displayRowCount; 
    const rowsPerPage = state.getRowsPerPage();
    const currentPage = state.getCurrentPage();
    const totalPages = Math.ceil(displayRows / rowsPerPage);
    const startItem = displayRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(startItem + rowsPerPage - 1, displayRows);

    // --- Contenu par défaut des boutons ---
    const defaultPrevContent = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;
    const defaultNextContent = `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>`;
    const defaultJumpText = 'Go';

    const prevContent = paginationOptions.previousButtonContent ?? defaultPrevContent;
    const nextContent = paginationOptions.nextButtonContent ?? defaultNextContent;
    const jumpText = paginationOptions.jumpButtonText ?? defaultJumpText;

    // --- Conteneur Gauche (Info + Sélecteur Lignes/Page) ---
    const leftContainer = document.createElement('div');
    leftContainer.className = 'flex-1 flex justify-start items-center space-x-4'; // Ajout de space-x-4

    // --- Sélecteur Lignes par Page (si activé) ---
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
                console.log(`[Pagination Selector Event] User selected: ${newRowsPerPage}`);
                state.setRowsPerPage(newRowsPerPage);
                instance.render(); 
            }
        });

        selectorContainer.appendChild(selectorLabel);
        selectorContainer.appendChild(selector);
        leftContainer.appendChild(selectorContainer); // Ajouter au conteneur gauche
    }

    // --- Informations sur les lignes affichées ---
    const infoContainer = document.createElement('div');
    infoContainer.className = 'text-sm text-gray-700'; // Retrait de hidden sm:block pour le rendre visible
    infoContainer.setAttribute('aria-live', 'polite');
    const p = document.createElement('p');
    if (displayRows > 0) {
        p.innerHTML = `Affichage <span class="font-medium text-gray-900">${startItem}</span> à <span class="font-medium text-gray-900">${endItem}</span> sur <span class="font-medium text-gray-900">${displayRows}</span> résultats`;
    } else {
        p.textContent = 'Aucun résultat';
    }
    infoContainer.appendChild(p);
    leftContainer.appendChild(infoContainer); // Ajouter l'info aussi au conteneur gauche

    // --- Conteneur Droit (Contrôles de pagination) ---
    const rightContainer = document.createElement('div');
    rightContainer.className = 'flex justify-end items-center';

    // --- Création des éléments de contrôle --- 

    // Previous Button (commun à tous les styles > simple)
    const prevButton = document.createElement('button');
    prevButton.disabled = currentPage === 1;
    prevButton.className = 'relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
    prevButton.setAttribute('aria-label', 'Page précédente');
    if (prevButton.disabled) prevButton.setAttribute('aria-disabled', 'true');
    prevButton.innerHTML = prevContent;
    if (!prevButton.disabled) {
        prevButton.addEventListener('click', () => {
            state.setCurrentPage(currentPage - 1);
            dispatchPageChangeEvent(instance);
            if (!state.getIsServerSide()) instance.render();
        });
    }

    // Next Button (commun à tous les styles > simple)
    const nextButton = document.createElement('button');
    nextButton.disabled = currentPage === totalPages || displayRows === 0;
    nextButton.className = 'relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition ease-in-out duration-150';
    nextButton.setAttribute('aria-label', 'Page suivante');
    if (nextButton.disabled) nextButton.setAttribute('aria-disabled', 'true');
    nextButton.innerHTML = nextContent;
    if (!nextButton.disabled) {
        nextButton.addEventListener('click', () => {
            state.setCurrentPage(currentPage + 1);
            dispatchPageChangeEvent(instance);
            if (!state.getIsServerSide()) instance.render();
        });
    }

    // --- Assemblage basé sur le style --- 

    if (paginationStyle === 'simple') {
        // Style Simple: Boutons Previous/Next uniquement (utilisé pour mobile aussi)
        const simplePrev = document.createElement('button');
        simplePrev.textContent = paginationOptions.previousButtonContent?.replace(/<[^>]*>/g, '') || 'Précédent';
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
        simpleNext.textContent = paginationOptions.nextButtonContent?.replace(/<[^>]*>/g, '') || 'Suivant';
        simpleNext.disabled = currentPage === totalPages || displayRows === 0;
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

    } else { // Styles 'numbered' et 'numbered-jump'
        // Conteneur pour les boutons numérotés
        const navContainer = document.createElement('nav');
        navContainer.className = 'relative z-0 inline-flex rounded-md shadow-sm -space-x-px';
        navContainer.setAttribute('aria-label', 'Pagination');

        navContainer.appendChild(prevButton);

        // Page Number Buttons Logic (commun à 'numbered' et 'numbered-jump')
        const maxVisiblePages = 7; // Max buttons: 1 ... 3 4 5 ... 10 (example)
        const sidePages = Math.floor((maxVisiblePages - 3) / 2);
        let startPage = Math.max(2, currentPage - sidePages);
        let endPage = Math.min(totalPages - 1, currentPage + sidePages);

        if (currentPage - sidePages <= 2) {
            endPage = Math.min(totalPages - 1, maxVisiblePages - 2);
        }
        if (currentPage + sidePages >= totalPages - 1) {
            startPage = Math.max(2, totalPages - (maxVisiblePages - 3));
        }

        if (totalPages > 0) {
            navContainer.appendChild(createPageButton(instance, 1, currentPage === 1));
        }
        if (startPage > 2) {
            navContainer.appendChild(createEllipsisElement());
        }
        for (let i = startPage; i <= endPage; i++) {
            navContainer.appendChild(createPageButton(instance, i, currentPage === i));
        }
        if (endPage < totalPages - 1) {
            navContainer.appendChild(createEllipsisElement());
        }
        if (totalPages > 1) {
            navContainer.appendChild(createPageButton(instance, totalPages, currentPage === totalPages));
        }

        navContainer.appendChild(nextButton);
        rightContainer.appendChild(navContainer);

        // Jump to Page Input (seulement pour 'numbered-jump')
        if (paginationStyle === 'numbered-jump' && totalPages > 1) {
            const jumpContainer = document.createElement('div');
            jumpContainer.className = 'ml-4 flex items-center text-sm';

            const jumpLabel = document.createElement('label');
            jumpLabel.htmlFor = `${instance.element.id}-jump-page`;
            jumpLabel.textContent = 'Aller à:';
            jumpLabel.className = 'mr-2 text-gray-700';

            const jumpInput = document.createElement('input');
            jumpInput.type = 'number';
            jumpInput.id = `${instance.element.id}-jump-page`;
            jumpInput.name = 'jump-page';
            jumpInput.min = '1';
            jumpInput.max = totalPages.toString();
            jumpInput.value = currentPage.toString();
            jumpInput.className = 'w-16 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500';
            jumpInput.setAttribute('aria-label', `Page actuelle ${currentPage}, entrer le numéro de page pour y sauter`);

            const jumpButton = document.createElement('button');
            jumpButton.textContent = jumpText;
            jumpButton.className = 'ml-2 px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';
            jumpButton.disabled = totalPages <= 1;

            const goToPage = () => {
                const page = parseInt(jumpInput.value, 10);
                if (!isNaN(page) && page >= 1 && page <= totalPages && page !== currentPage) {
                    state.setCurrentPage(page);
                    dispatchPageChangeEvent(instance);
                    if (!state.getIsServerSide()) {
                        instance.render();
                    } else {
                        // En mode serveur, le fetchData sera déclenché par dispatchPageChangeEvent -> DataTable
                        // Mettre à jour l'input ici peut être prématuré si le fetch échoue
                        // jumpInput.value = state.getCurrentPage().toString(); // <- Mieux vaut attendre le prochain render
                    }
                } else {
                    // Remettre la valeur actuelle si l'entrée est invalide
                    jumpInput.value = state.getCurrentPage().toString();
                }
            };

            jumpInput.addEventListener('change', goToPage);
            jumpInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    goToPage();
                }
            });
            jumpButton.addEventListener('click', goToPage);

            jumpContainer.appendChild(jumpLabel);
            jumpContainer.appendChild(jumpInput);
            jumpContainer.appendChild(jumpButton);
            rightContainer.appendChild(jumpContainer); // Ajouter le conteneur jump
        }
    }

    // --- Assemblage final --- 
    paginationContainer.appendChild(leftContainer);
    paginationContainer.appendChild(rightContainer);

    // Cache le conteneur complet si 0 ou 1 page et style simple?
    if (totalPages <= 1 && paginationStyle === 'simple') {
         // Option: Cacher complètement si pas de pagination nécessaire pour 'simple'
         // paginationContainer.style.display = 'none';
    } else if (displayRows <= 0) {
        // Toujours afficher le message 'Aucun résultat'
        rightContainer.innerHTML = ''; // Vider les contrôles si pas de résultats
    }


    instance.element.appendChild(paginationContainer);
} 