/**
 * Turn.js Flipbook Implementation
 * Replaces custom CSS animations with turn.js page turning
 */

// Global state
let zoom = 1;
window.currentZoom = 1; // Expose globally for responsive images
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;
const ZOOM_RESET_TOLERANCE = 0.01;
let BOOK_WIDTH_AT_1X = 0;
let BOOK_HEIGHT_AT_1X = 0;

/**
 * Update img sizes attribute based on zoom level for currently visible pages
 */
function updateImageSizes() {
    const isDoubleSpread = window.__DOUBLE_SPREAD__ || false;
    const zoomLevel = window.currentZoom || 1;
    
    // turn.js uses 'page-on' class for visible pages
    document.querySelectorAll('#flipbook .page-on img').forEach(img => {
        if (img && img.hasAttribute('srcset')) {
            const baseSize = isDoubleSpread ? 50 : 100; // vw base
            const zoomedSize = Math.round(baseSize * zoomLevel);
            img.sizes = `${zoomedSize}vw`;
        }
    });
}

/**
 * Apply pan transform to turn.js container
 */
function updateTransform() {
    const wrapper = document.getElementById('flipbook-wrapper');
    const book = document.getElementById('flipbook');
    
    if (!wrapper || !book) return;
    
    if (BOOK_WIDTH_AT_1X === 0) {
        BOOK_WIDTH_AT_1X = wrapper.clientWidth;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight;
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
    
    // Apply ONLY translate for panning (scale is handled by turn.js)
    book.style.transform = `translate(${panX}px, ${panY}px)`;
    
    window.currentZoom = zoom;
    updateImageSizes();
}

// Initialize turn.js and all controls
document.addEventListener('DOMContentLoaded', () => {
    const pageCount = window.__PAGE_COUNT__ || 0;
    const isDoubleSpread = window.__DOUBLE_SPREAD__ || false;
    
    if (!pageCount) {
        console.error('No page count found');
        return;
    }
    
    // Verify dependencies
    if (typeof $ === 'undefined' || !$.fn.turn) {
        console.error('turn.js or jQuery not loaded');
        return;
    }
    
    const $flipbook = $('#flipbook');
    const wrapper = document.getElementById('flipbook-wrapper');
    
    // Calculate dimensions
    BOOK_WIDTH_AT_1X = wrapper.clientWidth;
    BOOK_HEIGHT_AT_1X = wrapper.clientHeight;
    
    // Initialize turn.js
    $flipbook.turn({
        width: BOOK_WIDTH_AT_1X,
        height: BOOK_HEIGHT_AT_1X,
        pages: pageCount,
        display: 'double',
        autoCenter: true,
        elevation: 50,
        gradients: true,
        when: {
            turned: function(event, page) {
                // Update page indicator
                const pageInput = document.getElementById('page-input');
                if (pageInput) {
                    pageInput.value = page;
                }
                // Update image sizes for newly visible pages
                updateImageSizes();
            }
        }
    });
    
    // Store reference for global access
    window.flipbook = $flipbook;
    
    // Setup zoom slider
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    
    zoomSlider?.addEventListener('input', e => {
        let newZoom = parseFloat(e.target.value);
        
        if (Math.abs(newZoom - 1) < ZOOM_RESET_TOLERANCE) {
            newZoom = 1;
        }
        
        zoom = newZoom;
        
        // Update turn.js size
        $flipbook.turn('size', BOOK_WIDTH_AT_1X * zoom, BOOK_HEIGHT_AT_1X * zoom);
        
        // Disable turn.js mouse interaction when zoomed to allow panning
        if (zoom > 1) {
            $flipbook.turn('mouseAction', false);
            wrapper.style.cursor = 'grab';
        } else {
            $flipbook.turn('mouseAction', true);
            wrapper.style.cursor = 'default';
        }
        
         const zoomTextElement = document.getElementById('zoom-level');
        if (zoomTextElement) {
            zoomTextElement.textContent = `${Math.round(zoom * 100)}%`;
        }
        updateTransform();
    });
    
    // Setup keyboard navigation
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') {
            $flipbook.turn('next');
        } else if (e.key === 'ArrowLeft') {
            $flipbook.turn('previous');
        }
    });
    
    // Setup page input
    const pageInput = document.getElementById('page-input');
    if (pageInput) {
        pageInput.addEventListener('change', e => {
            const targetPage = parseInt(e.target.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= pageCount) {
                $flipbook.turn('page', targetPage);
            }
        });
        pageInput.value = 1;
    }
    
    // Setup mouse panning
    wrapper.addEventListener('mousedown', e => {
        if (zoom === 1) return;
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        wrapper.style.cursor = 'grabbing';
    });
    
    window.addEventListener('mousemove', e => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
    });
    
    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            wrapper.style.cursor = zoom > 1 ? 'grab' : 'default';
        }
    });
    
    // Initial image size update
    updateImageSizes();
    
    console.log('Turn.js flipbook initialized');
});