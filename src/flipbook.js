/**
 * Turn.js Flipbook Implementation
 * Uses #flipbook-container for zoom/pan transforms to avoid conflicts with turn.js
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
    
    document.querySelectorAll('#flipbook .page-on img').forEach(img => {
        if (img && img.hasAttribute('srcset')) {
            const baseSize = isDoubleSpread ? 50 : 100; // vw base
            const zoomedSize = Math.round(baseSize * zoomLevel);
            img.sizes = `${zoomedSize}vw`;
        }
    });
}

/**
 * Apply zoom and pan transforms to the container (not turn.js directly)
 */
function updateTransform() {
    const wrapper = document.getElementById('flipbook-wrapper');
    const container = document.getElementById('flipbook-container');
    
    if (!wrapper || !container) return;
    
    if (BOOK_WIDTH_AT_1X === 0) {
        BOOK_WIDTH_AT_1X = wrapper.clientWidth * 0.9;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight * 0.9;
    }
    
    // Constrain pan when zoomed
    if (zoom > 1) {
        const maxPanX = Math.max(0, (BOOK_WIDTH_AT_1X * zoom - wrapper.clientWidth) / 2);
        const maxPanY = Math.max(0, (BOOK_HEIGHT_AT_1X * zoom - wrapper.clientHeight) / 2);
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    } else {
        panX = 0;
        panY = 0;
    }
    
    // Apply scale + translate to container
    container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    
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
    
    if (typeof $ === 'undefined' || !$.fn.turn) {
        console.error('turn.js or jQuery not loaded');
        return;
    }
    
    const $flipbook = $('#flipbook');
    const wrapper = document.getElementById('flipbook-wrapper');
    
    // Calculate dimensions (90% of viewport)
    BOOK_WIDTH_AT_1X = wrapper.clientWidth * 0.9;
    BOOK_HEIGHT_AT_1X = wrapper.clientHeight * 0.9;
    
    // Initialize turn.js at 1x size
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
                const pageInput = document.getElementById('page-input');
                if (pageInput) {
                    pageInput.value = page;
                }
                updateImageSizes();
            }
        }
    });
    
    window.flipbook = $flipbook;
    
    // Cache control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    const pageInput = document.getElementById('page-input');
    
    // Zoom slider handler
    zoomSlider?.addEventListener('input', e => {
        let newZoom = parseFloat(e.target.value);
        if (Math.abs(newZoom - 1) < ZOOM_RESET_TOLERANCE) newZoom = 1;
        
        zoom = newZoom;
        
        // Update zoom percentage display
        if (zoomText) {
            zoomText.textContent = `${Math.round(zoom * 100)}%`;
        }
        
        // Apply transform
        updateTransform();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') {
            $flipbook.turn('next');
        } else if (e.key === 'ArrowLeft') {
            $flipbook.turn('previous');
        }
    });
    
    // Page input handler
    if (pageInput) {
        pageInput.addEventListener('change', e => {
            const targetPage = parseInt(e.target.value);
            if (!isNaN(targetPage) && targetPage >= 2 && targetPage <= pageCount) {
                $flipbook.turn('page', targetPage);
            }
        });
        pageInput.value = 2;
    }
    
    // Mouse panning
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
    console.log('Turn.js flipbook initialized');
});