/**
 * Flipbook Zoom Module
 * Implements high-resolution physical zoom and panning logic with viewport boundary enforcement.
 */
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
