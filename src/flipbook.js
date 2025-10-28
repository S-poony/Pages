/**
 * Flipbook Core Logic
 * Handles page turning, lazy loading, and user interactions
 */

class Flipbook {
    /**
     * @param {number} totalPages - Total number of pages
     * @param {HTMLElement[]} pages - Array of page DOM elements
     * @param {string[]} pageImages - Array of base64 image data URLs
     * @param {number} transitionMs - Transition duration in milliseconds
     */
    constructor(totalPages, pages, pageImages, transitionMs = 800) {
        this.totalPages = totalPages;
        this.pages = pages;
        this.pageImages = pageImages;
        this.transitionMs = transitionMs;
        this.currentPage = 1;
        this.isTurning = false;
        this.loadedPages = new Set();

        this.initializePages();
        this.updateSpread(this.currentPage);
        this.setupListeners();
    }

    /**
     * Pre-loads images in the background for smoother transitions
     * @param {string} imageSrc - Image source URL
     * @returns {Promise<void>}
     */
    preloadImage(imageSrc) {
        return new Promise((resolve, reject) => {
            if (this.loadedPages.has(imageSrc)) {
                resolve();
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.loadedPages.add(imageSrc);
                resolve();
            };
            img.onerror = reject;
            img.src = imageSrc;
        });
    }

    /**
     * Initialize all page elements with loading placeholders
     */
    initializePages() {
        this.pages.forEach((page, index) => {
            const pageNum = index + 1;
            const frontFace = page.querySelector('.page-face-front');
            const backFace = page.querySelector('.page-face-back');
            
            frontFace.innerHTML = '<div class="loading-placeholder">Page ' + pageNum + '</div>';
            backFace.innerHTML = '<div class="loading-placeholder">Page ' + pageNum + '</div>';
        });
    }

    /**
     * Loads content into a specific face of a page element
     * Uses lazy loading for better performance
     * @param {number} pageIndex - 1-based page index
     * @param {string} faceType - 'front' or 'back'
     * @param {HTMLElement} pageEl - Page DOM element
     */
    loadFaceContent(pageIndex, faceType, pageEl) {
        if (pageIndex < 1 || pageIndex > this.totalPages) {
            return;
        }

        if (!pageEl) {
            pageEl = this.pages[pageIndex - 1];
        }
        if (!pageEl) return;

        const faceEl = pageEl.querySelector('.page-face-' + faceType);
        if (!faceEl) return;

        const imageSrc = this.pageImages[pageIndex - 1];
        if (!imageSrc) return;

        this.preloadImage(imageSrc).then(() => {
            const currentHtml = faceEl.innerHTML || '';
            const expectedHtml = '<img src="' + imageSrc + '" alt="Page ' + pageIndex + '" loading="eager" />';
            
            if (!currentHtml.includes('src="')) {
                faceEl.innerHTML = expectedHtml;
            }
        }).catch(() => {
            faceEl.innerHTML = '<div class="loading-placeholder">Failed to load page ' + pageIndex + '</div>';
        });
    }

    /**
     * Sets up a page for display with proper positioning and content
     * @param {number} pageIndex - 1-based page index
     */
    setupPageForDisplay(pageIndex) {
        if (pageIndex < 1 || pageIndex > this.totalPages) return;
        const pageEl = this.pages[pageIndex - 1];
        if (!pageEl) return;

        pageEl.classList.remove('turned', 'turned-back');
        pageEl.style.transform = 'rotateY(0deg)';
        pageEl.style.zIndex = this.totalPages - pageIndex;

        this.loadFaceContent(pageIndex, 'front', pageEl);

        const backFace = pageEl.querySelector('.page-face-back');
        if (backFace) backFace.innerHTML = '<div class="loading-placeholder">Loading...</div>';

        if (pageIndex % 2 !== 0) {
            pageEl.style.left = '0%';
            pageEl.style.transformOrigin = 'right center';
        } else {
            pageEl.style.left = '50%';
            pageEl.style.transformOrigin = 'left center';
        }
    }

    /**
     * Updates the visible spread (two-page view)
     * @param {number} index - 1-based page index for left page
     */
    updateSpread(index) {
        this.pages.forEach(p => {
            p.classList.remove('visible', 'turned', 'turned-back');
        });

        const oddPageIndex = index;
        if (oddPageIndex >= 1 && oddPageIndex <= this.totalPages) {
            this.setupPageForDisplay(oddPageIndex);
            this.pages[oddPageIndex - 1].classList.add('visible');
        }

        const evenPageIndex = index + 1;
        if (evenPageIndex >= 1 && evenPageIndex <= this.totalPages) {
            this.setupPageForDisplay(evenPageIndex);
            this.pages[evenPageIndex - 1].classList.add('visible');
        }
    }

    /**
     * Turns to the next page
     */
    turnNext() {
        if (this.currentPage >= this.totalPages - 1 || this.isTurning) return;
        this.isTurning = true;

        const turningPageIndex = this.currentPage + 1;
        const versoPageIndex = this.currentPage + 2;
        const revealedPageIndex = this.currentPage + 3;

        const turningPage = this.pages[turningPageIndex - 1];
        const leftPage = this.pages[this.currentPage - 1];

        if (revealedPageIndex <= this.totalPages) {
            this.setupPageForDisplay(revealedPageIndex);
            this.pages[revealedPageIndex - 1].classList.add('visible');
        }

        this.loadFaceContent(versoPageIndex, 'back', turningPage);

        const frontFace = turningPage.querySelector('.page-face-front');
        if (frontFace) {
            setTimeout(() => {
                frontFace.innerHTML = '';
            }, Math.round(this.transitionMs / 2));
        }

        if (leftPage) {
            leftPage.style.zIndex = this.totalPages + 1;
        }

        turningPage.classList.add('turned');

        setTimeout(() => {
            this.currentPage += 2;
            this.updateSpread(this.currentPage);
            this.isTurning = false;
        }, this.transitionMs);
    }

    /**
     * Turns to the previous page
     */
    turnPrev() {
        if (this.currentPage === 1 || this.isTurning) return;
        this.isTurning = true;

        const turningPageIndex = this.currentPage;
        const versoPageIndex = this.currentPage - 1;
        const revealedPageIndex = this.currentPage - 2;

        const turningPage = this.pages[turningPageIndex - 1];
        const rightPage = this.pages[this.currentPage];

        if (revealedPageIndex >= 1) {
            this.setupPageForDisplay(revealedPageIndex);
            this.pages[revealedPageIndex - 1].classList.add('visible');
        }

        this.loadFaceContent(versoPageIndex, 'back', turningPage);

        const frontFace = turningPage.querySelector('.page-face-front');
        if (frontFace) {
            setTimeout(() => {
                frontFace.innerHTML = '';
            }, Math.round(this.transitionMs / 2));
        }

        if (rightPage) {
            rightPage.style.zIndex = this.totalPages + 1;
        }

        turningPage.classList.add('turned-back');

        setTimeout(() => {
            this.currentPage -= 2;
            this.updateSpread(this.currentPage);
            this.isTurning = false;
        }, this.transitionMs);
    }

    /**
     * Sets up event listeners for keyboard and mouse interactions
     */
    setupListeners() {
        const container = document.getElementById('book-container');
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                this.turnNext();
            } else if (e.key === 'ArrowLeft') {
                this.turnPrev();
            }
        });

        container.addEventListener('click', (e) => {
            if (this.isTurning) return;
            const rect = container.getBoundingClientRect();
            if (e.clientX > rect.left + rect.width / 2) {
                this.turnNext();
            } else {
                this.turnPrev();
            }
        });
    }
}

// Initialize flipbook when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const totalPages = parseInt(document.getElementById('book-container').dataset.pageCount);
    const pageImages = JSON.parse(document.getElementById('book-container').dataset.pageImages);
    const pages = Array.from(document.querySelectorAll('.page'));
    const container = document.getElementById('book-container');
    
    window.flipbook = new Flipbook(totalPages, pages, pageImages);
    console.log('Flipbook initialized. Use Arrow keys or click to turn pages.');
});

