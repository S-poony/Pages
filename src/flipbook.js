/**
 * StPageFlip Implementation
 * Uses #flipbook-container for zoom/pan transforms
 */

// Global state
let zoom = 1;
window.currentZoom = 1;
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;
const ZOOM_RESET_TOLERANCE = 0.01;
let BOOK_WIDTH_AT_1X = 0;
let BOOK_HEIGHT_AT_1X = 0;
let pageFlip = null;
let updateImageTimeout = null;

/**
 * Update img sizes attribute based on zoom level for currently visible pages
 */
function updateImageSizes() {
    const isDoubleSpread = window.__DOUBLE_SPREAD__ || false;
    const zoomLevel = window.currentZoom || 1;

    // Target ALL images in the flipbook, including those cloned by StPageFlip
    // StPageFlip wraps pages in .stf__item or .stf__block. 
    // We target all images inside #flipbook to be safe.
    const images = document.querySelectorAll('#flipbook img');

    images.forEach(img => {
        if (img && img.hasAttribute('srcset')) {
            const baseSize = isDoubleSpread ? 50 : 100;
            const zoomedSize = Math.round(baseSize * zoomLevel);
            const newSizes = `${zoomedSize}vw`;

            if (img.sizes !== newSizes) {
                img.sizes = newSizes;
                // Force browser to re-evaluate srcset by re-assigning it
                const srcset = img.srcset;
                img.srcset = '';
                img.srcset = srcset;
            }

            // Hack to force repaint/high-res rasterization on some browsers
            // Toggling transform or opacity sometimes helps
            img.style.transform = 'translateZ(0)';
        }
    });
}

/**
 * Apply zoom and pan transforms to the container
 */
function updateTransform() {
    const wrapper = document.getElementById('flipbook-wrapper');
    const container = document.getElementById('flipbook-container');

    if (!wrapper || !container) return;

    if (BOOK_WIDTH_AT_1X === 0) {
        BOOK_WIDTH_AT_1X = wrapper.clientWidth * 0.9;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight * 0.9;
    }

    // Constrain pan
    if (zoom > 1) {
        const maxPanX = Math.max(0, (BOOK_WIDTH_AT_1X * zoom - wrapper.clientWidth) / 2);
        const maxPanY = Math.max(0, (BOOK_HEIGHT_AT_1X * zoom - wrapper.clientHeight) / 2);
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    } else {
        panX = 0;
        panY = 0;
    }

    // Apply transform
    container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

    // Update cursor and disable/enable flipping
    const flipbookEl = document.getElementById('flipbook');

    if (zoom > 1) {
        wrapper.style.cursor = 'grab';
        // Disable flipping by blocking pointer events on the book
        // We need to ensure this doesn't block panning (which is on wrapper)
        if (flipbookEl) {
            // Disable pointer events on the flipbook itself to prevent drags/clicks reaching StPageFlip
            flipbookEl.style.pointerEvents = 'none';

            // Also try to disable user-select to prevent highlighting
            flipbookEl.style.userSelect = 'none';
        }
    } else {
        wrapper.style.cursor = 'default';
        if (flipbookEl) {
            flipbookEl.style.pointerEvents = 'auto';
            flipbookEl.style.userSelect = 'auto';
        }
    }

    window.currentZoom = zoom;
    // updateImageSizes() is now called with debounce in zoom handler
}

// Initialize StPageFlip and all controls
document.addEventListener('DOMContentLoaded', () => {
    const pageCount = window.__PAGE_COUNT__ || 0;
    const isDoubleSpread = window.__DOUBLE_SPREAD__ || false;

    if (!pageCount) {
        console.error('No page count found');
        return;
    }

    if (typeof St === 'undefined' || !St.PageFlip) {
        console.error('StPageFlip not loaded');
        return;
    }

    const wrapper = document.getElementById('flipbook-wrapper');
    const flipbookEl = document.getElementById('flipbook');

    // Calculate dimensions
    BOOK_WIDTH_AT_1X = wrapper.clientWidth * 0.9;
    BOOK_HEIGHT_AT_1X = wrapper.clientHeight * 0.9;

    // StPageFlip takes width of a SINGLE page
    // If doubleSpread (spread mode), we show 1 page, so pageWidth = container width.
    // If single pages (book mode), we show 2 pages, so pageWidth = container width / 2.
    const pageWidth = isDoubleSpread ? BOOK_WIDTH_AT_1X : BOOK_WIDTH_AT_1X / 2;
    const pageHeight = BOOK_HEIGHT_AT_1X;

    // Initialize StPageFlip
    pageFlip = new St.PageFlip(flipbookEl, {
        width: pageWidth,
        height: pageHeight,
        size: 'fixed',
        minWidth: pageWidth,
        maxWidth: pageWidth,
        minHeight: pageHeight,
        maxHeight: pageHeight,
        showCover: false,
        usePortrait: isDoubleSpread, // If doubleSpread (spreads in PDF), show 1 page. If single pages, show 2 pages (landscape).
        startPage: 0, // 0-based index
        drawShadow: true,
        flippingTime: 1000,
        useMouseEvents: true,
        swipeDistance: 30,
        mobileScrollSupport: false // We handle panning
    });

    // Load pages
    pageFlip.loadFromHTML(document.querySelectorAll('.page-container'));

    // Store globally for debugging
    window.pageFlip = pageFlip;

    let updateImageTimeout = null; // Declare debounce timeout variable

    // Events
    pageFlip.on('flip', (e) => {
        const pageInput = document.getElementById('page-input');
        if (pageInput) {
            // e.data is the page index (0-based)
            // We want to display 1-based page number.
            pageInput.value = e.data + 1;
        }
        // We do NOT update image sizes on flip anymore.
        // Images are updated only when zooming.
    });

    // Cache control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    const pageInput = document.getElementById('page-input');

    // Zoom slider
    zoomSlider?.addEventListener('input', e => {
        let newZoom = parseFloat(e.target.value);
        if (Math.abs(newZoom - 1) < ZOOM_RESET_TOLERANCE) newZoom = 1;
        zoom = newZoom;
        if (zoomText) zoomText.textContent = `${Math.round(zoom * 100)}%`;
        updateTransform();

        // Debounce image update for zoom
        if (updateImageTimeout) clearTimeout(updateImageTimeout);
        updateImageTimeout = setTimeout(updateImageSizes, 200);
    });

    // Page input handler
    if (pageInput) {
        pageInput.addEventListener('change', e => {
            if (zoom > 1) return; // Disable when zoomed
            const targetPage = parseInt(e.target.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= pageCount) {
                // StPageFlip uses 0-based index
                // Also, flip() takes the page index.
                pageFlip.flip(targetPage - 1);
            }
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', e => {
        if (zoom > 1) {
            // Prevent default to avoid scrolling or other side effects
            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
                e.preventDefault();
            }
            return;
        }

        if (e.key === 'ArrowRight') {
            pageFlip.flipNext();
        } else if (e.key === 'ArrowLeft') {
            pageFlip.flipPrev();
        }
    });

    // Mouse panning
    wrapper.addEventListener('mousedown', e => {
        if (zoom === 1) return;
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        wrapper.style.cursor = 'grabbing';
        e.preventDefault(); // Prevent text selection or other defaults
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
            wrapper.style.cursor = zoom > 1 ? 'grab' : 'default';
        }
    });

    // Initial setup
    updateImageSizes();
    console.log('StPageFlip initialized');
});