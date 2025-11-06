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
        }, { once: true });
    }

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
            const rect = container.getBoundingClientRect();
            if (e.clientX > rect.left + rect.width / 2) {
                this.turnNext();
            } else {
                this.turnPrev();
            }
        });
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
});

// --- Zoom & Pan support ---
const wrapper = document.getElementById('flipbook-wrapper');
const book = document.getElementById('book-container');
const zoomSlider = document.getElementById('zoom-slider');
const zoomText = document.getElementById('zoom-level');

let zoom = 1;
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;

function updateTransform() {
    book.style.transform = `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`;
}

// Handle zoom slider
zoomSlider?.addEventListener('input', e => {
    if (flipbook.isTurning) return;
    const newZoom = parseFloat(e.target.value);
    const factor = newZoom / zoom;
    panX *= factor;
    panY *= factor;
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