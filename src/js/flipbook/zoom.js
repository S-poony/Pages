/**
 * Flipbook Zoom Module
 * Implements high-resolution physical zoom and panning logic with viewport boundary enforcement.
 */
/**
 * Apply zoom and pan transforms to the container
 */
/**
 * Apply zoom and pan transforms to the container
 * @param {boolean} isPanOnly - If true, skip expensive resizing operations and only apply translation
 */
function updateTransform(isPanOnly = false) {
    const wrapper = document.getElementById('flipbook-wrapper');
    const container = document.getElementById('flipbook-container');

    if (!wrapper || !container) return;

    if (BOOK_WIDTH_AT_1X === 0) {
        BOOK_WIDTH_AT_1X = wrapper.clientWidth;
        BOOK_HEIGHT_AT_1X = wrapper.clientHeight;
    }

    // Constrain pan
    if (isZoomed()) {
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
    // We always set width/height to ensure consistency, but layout thrashing should be minimal if values don't change
    // However, dispatching 'resize' is VERY expensive.

    if (!isPanOnly) {
        container.style.width = `${BOOK_WIDTH_AT_1X * zoom}px`;
        container.style.height = `${BOOK_HEIGHT_AT_1X * zoom}px`;
    }

    container.style.transform = `translate(${panX}px, ${panY}px)`;

    if (!isPanOnly) {
        // Force StPageFlip to update its size
        window.isProgrammaticResize = true;
        window.dispatchEvent(new Event('resize'));
        window.isProgrammaticResize = false;

        // Update EPUB content scale immediately to prevent visual glitches
        updateEpubContentScale();
    }

    // Update cursor and disable/enable flipping
    // Only verify this on zoom change or start/end, not every frame of pan?
    // Doing it here is safe but we can skip if isPanOnly to save DOM writes
    if (!isPanOnly) {
        if (isZoomed()) {
            wrapper.style.cursor = 'grab';

            // Native library locks (supported after our custom lib build)
            if (window.pageFlip) {
                const settings = window.pageFlip.getSettings();
                settings.useMouseEvents = false;
                settings.showPageCorners = false;
            }
        } else {
            wrapper.style.cursor = 'default';

            if (window.pageFlip) {
                const settings = window.pageFlip.getSettings();
                settings.useMouseEvents = true;
                settings.showPageCorners = true;
            }
        }
    }

    window.currentZoom = zoom;
    // updateImageSizes() is now called with debounce in zoom handler
}
