class Flipbook {
    constructor(totalPages, pages, transitionMs = 800) {
        this.totalPages = totalPages;
        this.pages = pages;
        this.transitionMs = transitionMs;
        this.currentPage = 1;
        // Flag to prevent concurrent animations
        this.isTurning = false; 

        this.updateSpread(this.currentPage);
        this.setupListeners();
    }

    updateSpread(pageIndex) {
        this.pages.forEach(p => {
            p.classList.remove('visible', 'turning-forward', 'turning-backward', 'immediate');
        });

        const leftPage = this.pages[pageIndex - 1];
        const rightPage = this.pages[pageIndex];

        if (leftPage) leftPage.classList.add('visible');
        if (rightPage) rightPage.classList.add('visible');
    }

    _updatePageIndicator() {
            const pageInput = document.getElementById('page-input');
            if (pageInput) {
                // Update the input field with the new current page number (left page of the visible spread)
                pageInput.value = this.currentPage;
            }
        }

    turnNext() {
        // Return early if an animation is in progress
        if (this.isTurning || this.currentPage >= this.totalPages - 1) return;
        
        const oldRightPage = this.pages[this.currentPage];
        const newLeftPage = this.pages[this.currentPage + 1];
        const newRightPage = this.pages[this.currentPage + 2];

        if (!oldRightPage || !newLeftPage) return;

        // Set flag to true to start the animation lock
        this.isTurning = true;

        if (newRightPage) {
            newRightPage.classList.add('visible', 'immediate');
        }

        newLeftPage.classList.add('visible');
        oldRightPage.classList.add('turning-forward');
        newLeftPage.classList.add('turning-forward');

        oldRightPage.addEventListener('transitionend', () => {
            this.currentPage += 2;
            this.updateSpread(this.currentPage);
            // Reset flag when animation is complete
            this.isTurning = false; 
            this._updatePageIndicator();
        }, { once: true });
    }

    turnPrev() {
        // Return early if an animation is in progress
        if (this.isTurning || this.currentPage === 1) return;

        const oldLeftPage = this.pages[this.currentPage - 1];
        const newRightPage = this.pages[this.currentPage - 2];
        const newLeftPage = this.pages[this.currentPage - 3];

        if (!oldLeftPage || !newRightPage) return;

        // Set flag to true to start the animation lock
        this.isTurning = true;

        if (newLeftPage) {
            newLeftPage.classList.add('visible', 'immediate');
        }

        newRightPage.classList.add('visible');
        oldLeftPage.classList.add('turning-backward');
        newRightPage.classList.add('turning-backward');

        oldLeftPage.addEventListener('transitionend', () => {
            this.currentPage -= 2;
            this.updateSpread(this.currentPage);
            // Reset flag when animation is complete
            this.isTurning = false;
            this._updatePageIndicator();
        }, { once: true });
    }

    //goToPage
    goToPage(targetPage) {
        // Ensure the target page is a valid number
        const pageIndex = parseInt(targetPage);
        if (isNaN(pageIndex) || pageIndex < 1) return;

        // The flipbook displays spreads: [left, right]
        // We only care about the *starting* page of the spread (which is always an odd number 1, 3, 5, ...)
        let newCurrentPage = pageIndex;
        if (newCurrentPage % 2 === 0) {
            // If an even page is requested (e.g., page 2 or 4), we treat the spread as starting with the previous page (1 or 3)
            newCurrentPage = Math.max(1, newCurrentPage - 1);
        }

        // Clamp to valid range (1 is the first spread, totalPages-1 is the last spread's left page)
        newCurrentPage = Math.max(1, Math.min(newCurrentPage, this.totalPages - 1));

        if (newCurrentPage === this.currentPage) return; // Already there

        // Check the animation flag and wait if an animation is in progress
        if (this.isTurning) {
             // Defer the jump until the current animation is complete
             this.pages[this.currentPage - 1].addEventListener('transitionend', () => {
                // Re-run the function once free, passing the original target
                this.goToPage(targetPage); 
             }, { once: true });
             return;
        }

        this.currentPage = newCurrentPage;
        // Use an immediate update to skip the transition animation
        this.updateSpread(this.currentPage);
        this._updatePageIndicator(); // Update the UI element
    }

    setupListeners() {
        const container = document.getElementById('book-container');
        const pageInput = document.getElementById('page-input');
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                this.turnNext();
            } else if (e.key === 'ArrowLeft') {
                this.turnPrev();
            }
        });

        container.addEventListener('click', (e) => {
            const rect = container.getBoundingClientRect();
            if (e.clientX > rect.left + rect.width / 2) {
                this.turnNext();
            } else {
                this.turnPrev();
            }
        });
        
        if (pageInput) {
             pageInput.addEventListener('change', (e) => {
                this.goToPage(e.target.value);
            });
             // Set initial value
             pageInput.value = this.currentPage;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('book-container');
    const totalPages = parseInt(container?.dataset.pageCount) || window.__PAGE_COUNT__;
    const pages = Array.from(document.querySelectorAll('.page'));
    
    window.flipbook = new Flipbook(totalPages, pages);

    // Block page turns while zoomed
    const origNext = flipbook.turnNext.bind(flipbook);
    const origPrev = flipbook.turnPrev.bind(flipbook);
    flipbook.turnNext = () => { if (zoom === 1) origNext(); };
    flipbook.turnPrev = () => { if (zoom === 1) origPrev(); };

    console.log('Flipbook initialized. Use Arrow keys or click to turn pages.');
    
});// --- Zoom & Pan support ---
const wrapper = document.getElementById('flipbook-wrapper');
const book = document.getElementById('book-container');
const zoomSlider = document.getElementById('zoom-slider');
const zoomText = document.getElementById('zoom-level');

let zoom = 1;
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0; // The total translation in pixels

// Dimensions used for clamping pan. Initialize here, or better, in a resize observer.
// Assuming book width/height are the size of the *full spread* at zoom=1.
const BOOK_WIDTH_AT_1X = 1000; // Replace with actual size or dynamically fetch book.clientWidth
const BOOK_HEIGHT_AT_1X = 500; // Replace with actual size or dynamically fetch book.clientHeight

// Add a small tolerance for checking if zoom is 100%
const ZOOM_RESET_TOLERANCE = 0.01; 


function updateTransform() {
    // Get current wrapper dimensions
    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    
    // --- Pan Clamping Logic (for better UX when zoomed) ---
    if (zoom > 1) {
        // Calculate the maximum allowed pan (half the difference between zoomed size and wrapper size)
        const maxPanX = Math.max(0, (BOOK_WIDTH_AT_1X * zoom - wrapperWidth) / 2);
        const maxPanY = Math.max(0, (BOOK_HEIGHT_AT_1X * zoom - wrapperHeight) / 2);
        
        // Clamp panX and panY within the bounds
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    } else {
        // Ensure pan is 0 when not zoomed
        panX = 0;
        panY = 0;
    }
    
    // Apply the transformation
    book.style.transform = `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`;
}

// Handle zoom slider
zoomSlider?.addEventListener('input', e => {
    if (flipbook.isTurning) return;
    let newZoom = parseFloat(e.target.value);
    
    // Check if the new zoom is close to 1 (100%)
    if (Math.abs(newZoom - 1) < ZOOM_RESET_TOLERANCE) {
        newZoom = 1; // Snap to 1.0 for a clean reset
    }
    
    // We update panX/Y and handle reset/clamping inside updateTransform() now
    zoom = newZoom;
    updateTransform();
    zoomText.textContent = `${Math.round(zoom * 100)}%`;
    wrapper.style.cursor = zoom > 1 ? 'grab' : 'default';
});

// Mouse pan logic (No changes needed here as clamping is in updateTransform)
wrapper.addEventListener('mousedown', e => {
    if (zoom === 1 || flipbook.isTurning) return;
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    wrapper.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    // Calculate the new pan position based on the current mouse position and the start position
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform(); // updateTransform will now automatically clamp the pan values
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        wrapper.style.cursor = 'grab';
    }
});