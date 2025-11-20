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

    // Only target visible pages
    // StPageFlip doesn't expose visible pages directly easily, but we can guess based on current index.
    // We'll check a range around the current page.
    let currentIndex = 0;
    try {
        currentIndex = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    } catch (e) {
        console.warn('StPageFlip not ready yet', e);
        return;
    }
    // Check pages from index - 2 to index + 3 (covers double spread + buffer)
    // StPageFlip clones pages, so we need to be careful.
    // Actually, querying all images is fast, but setting sizes/srcset forces layout.
    // Let's try to be more specific.

    const images = document.querySelectorAll('#flipbook img');

    images.forEach((img, idx) => {
        // We can't easily map img index to page index because of clones/structure.
        // But we can check if the image is visible or close to viewport?
        // Or just check if it's within the .stf__block that is visible?
        // StPageFlip adds classes like --active to visible pages? No.
        // It uses z-index.

        // If zoom > 1, we need high res.
        // If zoom == 1, we can stick to base.

        if (img && img.hasAttribute('srcset')) {
            // We always show 2 pages (approx 50% width each)
            const baseSize = 50;
            const zoomedSize = Math.round(baseSize * zoomLevel);
            const newSizes = `${zoomedSize}vw`;

            if (img.sizes !== newSizes) {
                img.sizes = newSizes;

                // Only force reload if we are zooming IN (zoomLevel > 1)
                // and only if the sizes actually changed significantly
                if (zoomLevel > 1) {
                    const srcset = img.srcset;
                    img.srcset = '';
                    img.srcset = srcset;
                }
            }

            // Apply hack if zoomed
            if (zoomLevel > 1) {
                img.style.transform = 'translateZ(0)';
            } else {
                img.style.transform = '';
            }
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
        BOOK_WIDTH_AT_1X = wrapper.clientWidth;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight;
    }

    // Constrain pan
    // The content size is BOOK_WIDTH_AT_1X * zoom (visually).
    // The wrapper size is wrapper.clientWidth.
    // Pan limits should be based on visual size.
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
    // We resize the container to achieve zoom. This ensures high resolution (re-layout) 
    // and correct mouse interaction (native coordinates).
    container.style.width = `${BOOK_WIDTH_AT_1X * zoom}px`;
    container.style.height = `${BOOK_HEIGHT_AT_1X * zoom}px`;
    container.style.transform = `translate(${panX}px, ${panY}px)`;

    // Force StPageFlip to update its size
    // StPageFlip listens to window resize when size is 'stretch'.
    // We dispatch a resize event to trigger it.
    // We use a flag to prevent our own resize listener from creating an infinite loop.
    window.isProgrammaticResize = true;
    window.dispatchEvent(new Event('resize'));
    window.isProgrammaticResize = false;

    // Update cursor and disable/enable flipping
    let blocker = document.getElementById('zoom-blocker');
    if (!blocker) {
        blocker = document.createElement('div');
        blocker.id = 'zoom-blocker';
        blocker.style.position = 'absolute';
        blocker.style.top = '0';
        blocker.style.left = '0';
        blocker.style.width = '100%';
        blocker.style.height = '100%';
        blocker.style.zIndex = '9999'; // Above StPageFlip
        blocker.style.display = 'none';
        // We want the blocker to capture events but NOT block panning.
        // Panning is on #flipbook-wrapper.
        // This blocker should be INSIDE #flipbook-container or #flipbook-wrapper?
        // If it's in wrapper, it covers everything.
        // We want to block interactions with the BOOK pages (peeling).
        // So we put it over the book.
        document.getElementById('flipbook-container').appendChild(blocker);
    }

    if (zoom > 1) {
        wrapper.style.cursor = 'grab';
        blocker.style.display = 'block';
    } else {
        wrapper.style.cursor = 'default';
        blocker.style.display = 'none';
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
    // User requested "container follows the book" and "no big margins".
    // We set the base size to the full wrapper size.
    BOOK_WIDTH_AT_1X = wrapper.clientWidth;
    BOOK_HEIGHT_AT_1X = wrapper.clientHeight;

    // Container size matches book size (at 1x)
    const container = document.getElementById('flipbook-container');
    if (container) {
        container.style.width = `${BOOK_WIDTH_AT_1X}px`;
        container.style.height = `${BOOK_HEIGHT_AT_1X}px`;
    }

    // Store original pages for re-initialization
    // CRITICAL: Must be done BEFORE clearing flipbookEl
    const originalPages = Array.from(document.querySelectorAll('.page-container')).map(node => node.cloneNode(true));

    // Ensure flipbook element exists and is clean
    if (!flipbookEl) {
        const newFlipbookEl = document.createElement('div');
        newFlipbookEl.id = 'flipbook';
        document.getElementById('flipbook-container').appendChild(newFlipbookEl);
        flipbookEl = newFlipbookEl;
    }
    flipbookEl.innerHTML = ''; // Clear previous content

    // Re-append pages
    originalPages.forEach(page => {
        flipbookEl.appendChild(page.cloneNode(true));
    });

    // Initialize StPageFlip
    // We use size: 'stretch' so it adapts to the container size (which we resize for zoom)
    pageFlip = new St.PageFlip(flipbookEl, {
        width: BOOK_WIDTH_AT_1X / 2, // Always 2 pages, so width is half of container
        height: BOOK_HEIGHT_AT_1X,
        size: 'stretch',
        // "You must set threshold values ​​with size: 'stretch'"
        minWidth: 100,
        maxWidth: 10000,
        minHeight: 100,
        maxHeight: 10000,
        autoSize: false, // We control the container size
        showCover: false,
        usePortrait: false, // Always 2 pages (Book View)
        startPage: 0, // 0-based index
        drawShadow: true,
        maxShadowOpacity: 0.5, // Shadow intensity (0-1)
        flippingTime: 500,
        useMouseEvents: true,
        swipeDistance: 30,
        mobileScrollSupport: false // We handle panning
    });

    // Load pages
    pageFlip.loadFromHTML(document.querySelectorAll('.page-container'));

    // Store globally for debugging
    window.pageFlip = pageFlip;

    // Events
    pageFlip.on('init', () => {
        console.log('StPageFlip initialized event');
        updateImageSizes();
    });

    pageFlip.on('flip', (e) => {
        const pageInput = document.getElementById('page-input');
        if (pageInput) {
            pageInput.value = e.data + 1;
        }
    });

    // Cache control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    const pageInput = document.getElementById('page-input');

    // Zoom slider
    if (zoomSlider) {
        zoomSlider.addEventListener('input', e => {
            let newZoom = parseFloat(e.target.value);
            if (Math.abs(newZoom - 1) < ZOOM_RESET_TOLERANCE) newZoom = 1;
            zoom = newZoom;
            if (zoomText) zoomText.textContent = `${Math.round(zoom * 100)}%`;
            updateTransform();

            // Debounce image update for zoom
            if (updateImageTimeout) clearTimeout(updateImageTimeout);
            updateImageTimeout = setTimeout(updateImageSizes, 200);
        });

        // Prevent arrow keys from changing the slider value
        zoomSlider.addEventListener('keydown', e => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }

    // Page input handler
    if (pageInput) {
        pageInput.addEventListener('change', e => {
            if (zoom > 1) return; // Disable when zoomed
            const targetPage = parseInt(e.target.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= pageCount) {
                pageFlip.flip(targetPage - 1);
            }
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', e => {
        if (zoom > 1) {
            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
                e.preventDefault();
            }
            return;
        }

        if (pageFlip) {
            if (e.key === 'ArrowRight') {
                pageFlip.flipNext();
            } else if (e.key === 'ArrowLeft') {
                pageFlip.flipPrev();
            }
        }
    });

    // Mouse panning
    wrapper.addEventListener('mousedown', e => {
        if (zoom === 1) return;
        if (e.target.closest('#controls-panel')) return;

        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        wrapper.style.cursor = 'grabbing';
        e.preventDefault();
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
    // Force initial transform to scale down the high-res book
    updateTransform();

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.isProgrammaticResize) return;

        // Recalculate base dimensions on resize
        BOOK_WIDTH_AT_1X = wrapper.clientWidth;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight;

        updateTransform();
    });

    console.log('StPageFlip setup complete');

    // Hack: Disable automatic corner peeling (hover effect)
    // We block mouse/pointer move events unless the mouse is down.
    // This prevents StPageFlip from seeing the mouse hover over corners.
    let isMouseDownOnBook = false;
    flipbookEl.addEventListener('mousedown', () => { isMouseDownOnBook = true; });
    flipbookEl.addEventListener('touchstart', () => { isMouseDownOnBook = true; }); // For mobile
    window.addEventListener('mouseup', () => { isMouseDownOnBook = false; });
    window.addEventListener('touchend', () => { isMouseDownOnBook = false; });

    const blockHover = (e) => {
        if (!isMouseDownOnBook) {
            e.stopPropagation();
        }
    };

    ['mousemove', 'pointermove'].forEach(evt => {
        flipbookEl.addEventListener(evt, blockHover, { capture: true });
    });
});