/**
 * StPageFlip Implementation
 * Uses #flipbook-container for zoom/pan transforms
 */

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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
// updateImageTimeout is replaced by debounce

/**
 * Update img sizes attribute based on zoom level for currently visible pages
 */
function updateImageSizes() {
    const zoomLevel = window.currentZoom || 1;
    const images = document.querySelectorAll('#flipbook img');

    images.forEach((img) => {
        if (img && img.hasAttribute('srcset')) {
            const baseSize = 50;
            const zoomedSize = Math.round(baseSize * zoomLevel);
            const newSizes = `${zoomedSize}vw`;

            if (img.sizes !== newSizes) {
                img.sizes = newSizes;
                if (zoomLevel > 1) {
                    const srcset = img.srcset;
                    img.srcset = '';
                    img.srcset = srcset;
                }
            }

            if (zoomLevel > 1) {
                img.style.transform = 'translateZ(0)';
            } else {
                img.style.transform = '';
            }
        }
    });
}

const debouncedUpdateImageSizes = debounce(updateImageSizes, 200);

/**
 * Apply zoom and pan transforms to the container
 */
function updateTransform() {
    const wrapper = document.getElementById('flipbook-wrapper');
    const container = document.getElementById('flipbook-container');
    const blocker = document.getElementById('zoom-blocker');

    if (!wrapper || !container) return;

    if (BOOK_WIDTH_AT_1X === 0) {
        BOOK_WIDTH_AT_1X = wrapper.clientWidth;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight;
    }

    // Constrain pan
    if (zoom > 1) {
        // Add a small buffer (e.g. 50px) to allow reaching the edges easily
        const buffer = 50;
        const maxPanX = Math.max(0, (BOOK_WIDTH_AT_1X * zoom - wrapper.clientWidth) / 2) + buffer;
        const maxPanY = Math.max(0, (BOOK_HEIGHT_AT_1X * zoom - wrapper.clientHeight) / 2) + buffer;
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    } else {
        panX = 0;
        panY = 0;
    }

    // Apply transform
    container.style.width = `${BOOK_WIDTH_AT_1X * zoom}px`;
    container.style.height = `${BOOK_HEIGHT_AT_1X * zoom}px`;
    container.style.transform = `translate(${panX}px, ${panY}px)`;

    // Force StPageFlip to update its size
    window.isProgrammaticResize = true;
    window.dispatchEvent(new Event('resize'));
    window.isProgrammaticResize = false;

    // Update cursor and disable/enable flipping
    if (zoom > 1) {
        wrapper.style.cursor = 'grab';
        if (blocker) blocker.style.display = 'block';
    } else {
        wrapper.style.cursor = 'default';
        if (blocker) blocker.style.display = 'none';
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

    // Calculate dimensions based on aspect ratio to fit wrapper
    // This eliminates margins/letterboxing by making the container match the content shape
    function calculateDimensions() {
        const wrapperWidth = wrapper.clientWidth;
        const wrapperHeight = wrapper.clientHeight;
        // Use injected aspect ratio or fallback to A4-ish (0.707)
        const pageAspectRatio = window.__PAGE_ASPECT_RATIO__ || 0.707;

        // Since we force usePortrait: false (always 2 pages), 
        // the target aspect ratio is ALWAYS double spread.
        // This prevents large vertical margins on mobile.
        const targetAspectRatio = pageAspectRatio * 2;

        // Calculate dimensions to fit within wrapper while maintaining targetAspectRatio
        // 1. Try fitting by width
        let width = wrapperWidth;
        let height = width / targetAspectRatio;

        // 2. If height exceeds wrapper height, fit by height
        if (height > wrapperHeight) {
            height = wrapperHeight;
            width = height * targetAspectRatio;
        }

        return {
            width: Math.floor(width),
            height: Math.floor(height)
        };
    }

    // Initial calculation
    const dims = calculateDimensions();
    BOOK_WIDTH_AT_1X = dims.width;
    BOOK_HEIGHT_AT_1X = dims.height;

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
        usePortrait: false, // no margins on the sides
        startPage: 0, // 0-based index
        drawShadow: true,
        maxShadowOpacity: 0.5, // Shadow intensity (0-1)
        flippingTime: 500,
        useMouseEvents: true,
        swipeDistance: 30,
        mobileScrollSupport: false, // We handle panning

        // CUSTOM SHADOW SETTINGS
        flippingShadow: true, // Enable/disable the flipping shadow
        flippingShadowStartAlpha: 0.0, // Opacity at the start of the gradient (static corner)
        flippingShadowEndAlpha: .1, // Opacity at the end of the gradient (flipping corner)
        otherShadowOpacityScale: .4, // Scale factor for other shadows (0.7 = 30% reduction)
    });

    // Load pages
    pageFlip.loadFromHTML(document.querySelectorAll('.page-container'));

    // Store globally for debugging
    window.pageFlip = pageFlip;

    // Event Listeners
    pageFlip.on('flip', (e) => {
        // Update controls
        const pageNum = e.data + 1; // 0-based index to 1-based page number
        if (pageInput) pageInput.value = pageNum;

        // Update image sizes for responsiveness
        updateImageSizes();

        // PRELOAD NEXT SPREAD
        preloadNextSpread(e.data);
    });

    pageFlip.on('init', () => {
        console.log('StPageFlip initialized event');
        updateImageSizes();
        // Preload initial next spread
        preloadNextSpread(0);
    });

    /**
     * Preload images for the next spread to ensure smooth flipping
     * @param {number} currentIndex - Current page index (0-based)
     */
    function preloadNextSpread(currentIndex) {
        const isDoubleSpread = window.__DOUBLE_SPREAD__;
        const pageCount = window.__PAGE_COUNT__;

        // Calculate next pages to preload
        // If double spread, we usually see 2 pages. We want the NEXT 2 pages.
        // If single spread, we see 1 page. We want the NEXT 1 page.

        let pagesToPreload = [];

        if (isDoubleSpread) {
            // Current: [currentIndex, currentIndex + 1] (roughly)
            // Next spread starts after these.
            // StPageFlip index usually points to the top-left page or the single page.
            // Let's just preload the next 4 pages to be safe and aggressive.
            pagesToPreload = [
                currentIndex + 1,
                currentIndex + 2,
                currentIndex + 3,
                currentIndex + 4
            ];
        } else {
            pagesToPreload = [currentIndex + 1, currentIndex + 2];
        }

        pagesToPreload.forEach(idx => {
            if (idx < pageCount) {
                // Find the image in the DOM
                // Note: StPageFlip creates clones, so we might have multiple images for the same page?
                // Or we can just look for the source image in the hidden container if StPageFlip moves them?
                // Actually, StPageFlip keeps the DOM structure inside .stf__block.

                // We can query by the image source or just iterate all images and check their index?
                // Easier: The images are usually in order in the DOM before StPageFlip messes with them, 
                // but after init, they are inside .page-container.

                // Let's try to find the Nth .page-image
                const allImages = document.querySelectorAll('.page-image');
                if (allImages[idx]) {
                    const img = allImages[idx];

                    // 1. Force eager loading
                    img.loading = 'eager';

                    // 2. Force browser to download by creating a detached image
                    // This ensures it downloads even if the original img is hidden/off-screen
                    if (img.src) {
                        const preloader = new Image();
                        preloader.src = img.src;
                        if (img.srcset) preloader.srcset = img.srcset;
                        preloader.sizes = img.sizes || '100vw';
                    }
                }
            }
        });
    }

    // Cache control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    const pageInput = document.getElementById('page-input');

    // Create Zoom Blocker
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
        document.getElementById('flipbook-container').appendChild(blocker);
    }

    // Zoom Slider
    if (zoomSlider) {
        zoomSlider.addEventListener('input', e => {
            const newZoom = parseFloat(e.target.value);
            zoom = newZoom;
            if (zoomText) zoomText.textContent = `${Math.round(zoom * 100)}%`;
            updateTransform();

            // Debounce image update for zoom
            debouncedUpdateImageSizes();
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
        // Ignore if typing in an input
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

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

    // Mouse/Touch Events for Panning
    const onStart = (clientX, clientY) => {
        if (zoom > 1) {
            isPanning = true;
            startX = clientX - panX;
            startY = clientY - panY;
            wrapper.style.cursor = 'grabbing';
        }
    };

    const onMove = (clientX, clientY) => {
        if (isPanning && zoom > 1) {
            panX = clientX - startX;
            panY = clientY - startY;
            updateTransform();
        }
    };

    const onEnd = () => {
        isPanning = false;
        if (zoom > 1) wrapper.style.cursor = 'grab';
    };

    // Mouse Listeners
    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('#controls-panel')) return;
        onStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            e.preventDefault();
            onMove(e.clientX, e.clientY);
        }
    });
    window.addEventListener('mouseup', onEnd);

    // Touch Listeners
    wrapper.addEventListener('touchstart', (e) => {
        if (e.target.closest('#controls-panel')) return;
        if (e.touches.length === 1) {
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (isPanning && e.touches.length === 1) {
            // e.preventDefault() is already called in the global listener for >1 touches
            // But we need it here too to prevent scrolling if touch-action fails
            if (e.cancelable) e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', onEnd);

    // Initial setup
    updateTransform();

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.isProgrammaticResize) return;

        // Recalculate dimensions on resize
        const dims = calculateDimensions();
        BOOK_WIDTH_AT_1X = dims.width;
        BOOK_HEIGHT_AT_1X = dims.height;

        // Update container size explicitly
        const container = document.getElementById('flipbook-container');
        if (container) {
            container.style.width = `${BOOK_WIDTH_AT_1X}px`;
            container.style.height = `${BOOK_HEIGHT_AT_1X}px`;
        }

        // Re-center
        panX = 0;
        panY = 0;
        updateTransform();
    });

    console.log('StPageFlip setup complete');

    // Prevent pinch-zoom and trackpad zoom
    document.addEventListener('wheel', function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
    });

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