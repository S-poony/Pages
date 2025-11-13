class Flipbook {
    constructor(totalPages, pages, transitionMs = 800) {
        this.totalPages = totalPages;
        this.pages = pages;
        this.transitionMs = transitionMs;
        this.currentPage = 1;
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
            pageInput.value = this.currentPage;
        }
    }

    turnNext() {
        if (this.isTurning || this.currentPage >= this.totalPages - 1) return;
        
        const oldRightPage = this.pages[this.currentPage];
        const newLeftPage = this.pages[this.currentPage + 1];
        const newRightPage = this.pages[this.currentPage + 2];

        if (!oldRightPage || !newLeftPage) return;

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
            this.isTurning = false;
            this._updatePageIndicator();
            this.updateImageSizes(); // Update sizes for new visible pages
        }, { once: true });
    }

    turnPrev() {
        if (this.isTurning || this.currentPage === 1) return;

        const oldLeftPage = this.pages[this.currentPage - 1];
        const newRightPage = this.pages[this.currentPage - 2];
        const newLeftPage = this.pages[this.currentPage - 3];

        if (!oldLeftPage || !newRightPage) return;

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
            this.isTurning = false;
            this._updatePageIndicator();
            this.updateImageSizes(); // Update sizes for new visible pages
        }, { once: true });
    }

    goToPage(targetPage) {
        const pageIndex = parseInt(targetPage);
        if (isNaN(pageIndex) || pageIndex < 1) return;

        let newCurrentPage = pageIndex;
        if (newCurrentPage % 2 === 0) {
            newCurrentPage = Math.max(1, newCurrentPage - 1);
        }

        newCurrentPage = Math.max(1, Math.min(newCurrentPage, this.totalPages - 1));

        if (newCurrentPage === this.currentPage) return;

        if (this.isTurning) {
             this.pages[this.currentPage - 1].addEventListener('transitionend', () => {
                this.goToPage(targetPage); 
             }, { once: true });
             return;
        }

        this.currentPage = newCurrentPage;
        this.updateSpread(this.currentPage);
        this._updatePageIndicator();
        this.updateImageSizes(); // Update sizes when jumping pages
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
            pageInput.value = this.currentPage;
        }
    }

    // CORRECTED: Update img sizes attribute based on zoom level
    updateImageSizes() {
        const isDoubleSpread = window.__DOUBLE_SPREAD__ || false;
        const zoom = window.currentZoom || 1;
        
        // Calculate dynamic sizes based on actual zoom level
        const baseSize = isDoubleSpread ? 50 : 100; // vw base
        const zoomedSize = Math.round(baseSize * zoom);
        
        // Update sizes attribute for all visible images
        document.querySelectorAll('.page.visible img').forEach(img => {
            if (img && img.hasAttribute('srcset')) {
                img.sizes = `${zoomedSize}vw`;
            }
        });
    }
}

// --- Zoom & Pan support ---
const wrapper = document.getElementById('flipbook-wrapper');
const book = document.getElementById('book-container');
const zoomSlider = document.getElementById('zoom-slider');
const zoomText = document.getElementById('zoom-level');
let BOOK_WIDTH_AT_1X = 0;
let BOOK_HEIGHT_AT_1X = 0;

let zoom = 1;
window.currentZoom = 1; // Expose globally for updateImageSizes()
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;
const ZOOM_RESET_TOLERANCE = 0.01; 

function updateTransform() {
    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    
    if (zoom > 1) {
        const maxPanX = Math.max(0, (BOOK_WIDTH_AT_1X * zoom - wrapperWidth) / 2);
        const maxPanY = Math.max(0, (BOOK_HEIGHT_AT_1X * zoom - wrapperHeight) / 2);
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    } else {
        panX = 0;
        panY = 0;
    }
    
    book.style.transform = `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`;
    
    // Trigger responsive image loading when zoom changes
    window.currentZoom = zoom;
    if (window.flipbook) {
        window.flipbook.updateImageSizes();
    }
}

zoomSlider?.addEventListener('input', e => {
    if (flipbook.isTurning) return;
    let newZoom = parseFloat(e.target.value);
    
    if (Math.abs(newZoom - 1) < ZOOM_RESET_TOLERANCE) {
        newZoom = 1;
    }
    
    zoom = newZoom;
    updateTransform();
    zoomText.textContent = `${Math.round(zoom * 100)}%`;
    wrapper.style.cursor = zoom > 1 ? 'grab' : 'default';
});

// Mouse pan logic
wrapper.addEventListener('mousedown', e => {
    if (zoom === 1 || flipbook.isTurning) return;
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    wrapper.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateTransform();
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        wrapper.style.cursor = 'grab';
    }
});

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('book-container');
    const totalPages = parseInt(container?.dataset.pageCount) || window.__PAGE_COUNT__;
    const pages = Array.from(document.querySelectorAll('.page'));
    
    window.flipbook = new Flipbook(totalPages, pages);
    const book = document.getElementById('book-container');
    BOOK_WIDTH_AT_1X = book.clientWidth;
    BOOK_HEIGHT_AT_1X = book.clientHeight;

    // Block page turns while zoomed
    const origNext = flipbook.turnNext.bind(flipbook);
    const origPrev = flipbook.turnPrev.bind(flipbook);
    flipbook.turnNext = () => { if (zoom === 1) origNext(); };
    flipbook.turnPrev = () => { if (zoom === 1) origPrev(); };

    // Initial call to set correct sizes
    window.flipbook.updateImageSizes();
    
    console.log('Flipbook initialized. Use Arrow keys or click to turn pages.');
});