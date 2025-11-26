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
 * Scale EPUB content to fit the page container
 * This ensures fixed-dimension content (from pagination) fits the responsive page
 */
function updateEpubContentScale() {
    const epubContents = document.querySelectorAll('.epub-content');
    epubContents.forEach(content => {
        const parent = content.closest('.page-container');
        if (!parent) return;

        // Get fixed dimensions from inline styles
        const fixedWidth = parseFloat(content.style.width);
        const fixedHeight = parseFloat(content.style.height);

        if (!fixedWidth || !fixedHeight) return;

        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;

        if (parentWidth === 0 || parentHeight === 0) return;

        const scaleX = parentWidth / fixedWidth;
        const scaleY = parentHeight / fixedHeight;

        // Use the smaller scale to ensure it fits
        const scale = Math.min(scaleX, scaleY);

        content.style.transform = `scale(${scale})`;
        content.style.transformOrigin = 'top left';
    });
}

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

    // Update EPUB content scale immediately to prevent visual glitches
    updateEpubContentScale();
}

// Initialize StPageFlip and all controls
document.addEventListener('DOMContentLoaded', () => {
    const config = window.FLIPBOOK_CONFIG || {};
    const pageCount = config.pageCount || 0;
    const isDoubleSpread = config.doubleSpread || false;

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
        const pageAspectRatio = config.pageAspectRatio || 0.707;

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

        // We strictly enforce pixel dimensions on the elements before StPageFlip sees them.
        // This prevents pages preview in animation to look different from the final result.
        page.style.width = (BOOK_WIDTH_AT_1X / 2) + 'px';
        page.style.height = BOOK_HEIGHT_AT_1X + 'px';
        // Ensure overflow is hidden so content doesn't leak during measurement
        page.style.overflow = 'hidden'; 
        
        flipbookEl.appendChild(page.cloneNode(true));
    });

    // We delay initialization by two animation frames.
    // Frame 1: Browser applies the style.width/height we just set above.
    // Frame 2: Browser performs layout/paint.
    // Callback: StPageFlip initializes using the now-rendered correct dimensions.
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            initStPageFlip();
        });
    });

    function initStPageFlip() {
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
            flippingShadowOpacity: 0.5, // Base opacity (0-1), independent of flip progress
            flippingShadowWidthOffset: 50, // Base width in pixels (minimum shadow width)
            flippingShadowWidthScale: 1.5, // Width scale factor (multiplier of base shadow width)
            flippingShadowStartAlpha: .7, // Gradient start opacity (0-1)
            flippingShadowEndAlpha: 0, // Gradient end opacity (0-1)
            otherShadowOpacityScale: .5, // Scale factor for other shadows (0-1)
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
            updateEpubContentScale();

            // PRELOAD NEXT SPREAD
            preloadNextSpread(e.data);
        });

        pageFlip.on('init', () => {
            console.log('StPageFlip initialized event');
            updateImageSizes();
            updateEpubContentScale();
            // Preload initial next spread
            preloadNextSpread(0);
        });
    }

    /**
     * Preload images for the next spread to ensure smooth flipping
     * @param {number} currentIndex - Current page index (0-based)
     */
    function preloadNextSpread(currentIndex) {
        const config = window.FLIPBOOK_CONFIG || {};
        const isDoubleSpread = config.doubleSpread;
        const pageCount = config.pageCount;

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
                const allImages = document.querySelectorAll('.page-image');
                if (allImages[idx]) {
                    const img = allImages[idx];
                    // img.loading = 'eager'; // Handled in HTML generator now
                    // Force browser to download by creating a detached image
                    // This ensures it downloads even if the original img is hidden/off-screen
                    if (img.src) {
                        const preloader = new Image();
                        preloader.src = img.src;
                        if (img.srcset) preloader.srcset = img.srcset;

                        // Calculate correct sizes matching updateImageSizes logic
                        const zoomLevel = window.currentZoom || 1;
                        const baseSize = 50;
                        const zoomedSize = Math.round(baseSize * zoomLevel);
                        preloader.sizes = `${zoomedSize}vw`;
                    }
                }
            }
        });
    }

    // Cache control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    const pageInput = document.getElementById('page-input');
    const controlsPanel = document.getElementById('controls-panel');

    // Mobile-friendly control panel activation
    let controlsPanelTimeout = null;
    let isUsingSlider = false;

    const activateControlPanel = () => {
        controlsPanel.classList.add('active');

        // Clear any existing timeout
        if (controlsPanelTimeout) {
            clearTimeout(controlsPanelTimeout);
            controlsPanelTimeout = null;
        }
    };

    const deactivateControlPanel = () => {
        // Don't deactivate if slider is being used
        if (isUsingSlider) return;

        // Remove active class after 1 second
        controlsPanelTimeout = setTimeout(() => {
            controlsPanel.classList.remove('active');
        }, 1000);
    };

    if (controlsPanel) {
        controlsPanel.addEventListener('click', () => {
            activateControlPanel();
            deactivateControlPanel();
        });
    }

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
        // Track slider interaction to keep panel active
        zoomSlider.addEventListener('mousedown', () => {
            isUsingSlider = true;
            activateControlPanel();
        });

        zoomSlider.addEventListener('touchstart', () => {
            isUsingSlider = true;
            activateControlPanel();
        });

        zoomSlider.addEventListener('mouseup', () => {
            isUsingSlider = false;
            deactivateControlPanel();
        });

        zoomSlider.addEventListener('touchend', () => {
            isUsingSlider = false;
            deactivateControlPanel();
        });

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