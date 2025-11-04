/**
 * Flipbook Core Logic
 * Handles page turning, lazy loading, and user interactions
 */

class Flipbook {
    /**
     * @param {number} totalPages - Total number of pages
     * @param {HTMLElement[]} pages - Array of page DOM elements
     * @param {number} transitionMs - Transition duration in milliseconds
     */
    constructor(totalPages, pages, transitionMs = 800) {
        this.totalPages = totalPages;
        this.pages = pages;
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
            
            const frontImg = frontFace.querySelector('img');
            const backImg = backFace.querySelector('img');
            
            if (frontImg) {
                frontImg.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'loading-placeholder';
                placeholder.textContent = 'Page ' + pageNum;
                frontFace.appendChild(placeholder);
            } else {
                frontFace.innerHTML = '<div class="loading-placeholder">Page ' + pageNum + '</div>';
            }
            
            if (backImg) {
                backImg.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'loading-placeholder';
                placeholder.textContent = 'Page ' + pageNum;
                backFace.appendChild(placeholder);
            } else {
                backFace.innerHTML = '<div class="loading-placeholder">Page ' + pageNum + '</div>';
            }
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

        const img = faceEl.querySelector('img');
        if (!img) return;

        const imageSrc = img.src;

        this.preloadImage(imageSrc).then(() => {
            img.style.display = '';
            img.setAttribute('loading', 'eager');
            
            // Fix: Remove the placeholder after successful load
            const placeholder = faceEl.querySelector('.loading-placeholder');
            if (placeholder) {
                placeholder.remove();
            }
            
        }).catch(() => {
            // Keep the error fallback
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
        if (backFace) {
            const backImg = backFace.querySelector('img');
            let placeholder = backFace.querySelector('.loading-placeholder');

            // 1. Hide the image (as the back face should not be seen)
            if (backImg) {
                backImg.style.display = 'none';
            }
            
            // 2. Ensure the placeholder div is present and visible (by removing/re-adding)
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.className = 'loading-placeholder';
                backFace.appendChild(placeholder);
            }
            placeholder.textContent = 'Loading...'; // Reset text just in case
        }
        
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
   /**
     * Turns to the next page
     */
    turnNext() {
        if (this.currentPage >= this.totalPages - 1 || this.isTurning) return;
        this.isTurning = true;

        const turningPageIndex = this.currentPage + 1;
        const revealedPageIndex = this.currentPage + 3;
        const versoRightPageIndex = turningPageIndex + 1; 
        const turningPage = this.pages[turningPageIndex - 1];
        const leftPage = this.pages[this.currentPage - 1];
        
        if (revealedPageIndex <= this.totalPages) {
            this.setupPageForDisplay(revealedPageIndex);
            this.pages[revealedPageIndex - 1].classList.add('visible');
        }
        
        // Load back face content before turning so it is visible during the turn
        const backFace = turningPage.querySelector('.page-face-back');
        const backImg = backFace.querySelector('img');
        const backPlaceholder = backFace.querySelector('.loading-placeholder');

        if (backPlaceholder) {
            backPlaceholder.remove();
        }
        if (backImg) {
            backImg.style.display = '';
        }
        
        // **FIXED:** versoPageIndex is correctly calculated as turningPageIndex + 1
        this.loadFaceContent(versoRightPageIndex, 'back', turningPage);

        const frontFace = turningPage.querySelector('.page-face-front');
        const frontImg = frontFace.querySelector('img'); // Get the image element
        const placeholder = frontFace.querySelector('.loading-placeholder'); // Get the placeholder

        if (frontImg || placeholder) {
            setTimeout(() => {
                if (frontImg) frontImg.style.display = 'none'; // Safely hide the image
                if (placeholder) placeholder.remove(); // Remove placeholder if present
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
        const versoLeftpageIndex = turningPageIndex - 1;
        const revealedPageIndex = this.currentPage - 2;
        const turningPage = this.pages[turningPageIndex - 1];
        const rightPageToCover = this.pages[this.currentPage]; 

        if (revealedPageIndex >= 1) {
            this.setupPageForDisplay(revealedPageIndex);
            this.pages[revealedPageIndex - 1].classList.add('visible');
        }

        // Load back face content before turning so it is visible during the turn
        const backFace = turningPage.querySelector('.page-face-back');
        const backImg = backFace.querySelector('img');
        const backPlaceholder = backFace.querySelector('.loading-placeholder');

        if (backPlaceholder) {
            backPlaceholder.remove();
        }
        if (backImg) {
            backImg.style.display = '';
        }

        this.loadFaceContent(versoLeftpageIndex, 'back', turningPage);

        const frontFace = turningPage.querySelector('.page-face-front');
        const frontImg = frontFace.querySelector('img'); 
        const placeholder = frontFace.querySelector('.loading-placeholder'); 

        if (frontImg || placeholder) {
            setTimeout(() => {
                if (frontImg) frontImg.style.display = 'none'; 
                if (placeholder) placeholder.remove(); 
            }, Math.round(this.transitionMs / 2));
        }

        // **FIX 3: Elevate the z-index of the covered page (the right page) for correct stacking.**
        if (rightPageToCover) {
            rightPageToCover.style.zIndex = this.totalPages + 1;
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
    const container = document.getElementById('book-container');
    const totalPages = parseInt(container?.dataset.pageCount) || window.__PAGE_COUNT__;
    const pages = Array.from(document.querySelectorAll('.page'));
    
    window.flipbook = new Flipbook(totalPages, pages);
    console.log('Flipbook initialized. Use Arrow keys or click to turn pages.');
});

