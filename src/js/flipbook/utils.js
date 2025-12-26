/**
 * Flipbook Utilities Module
 * Contains general-purpose helper functions like debounce for performance optimization.
 */
/**
 * Utility: Debounce
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
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
/**
 * Utility: isZoomed
 * Returns true if the flipbook is currently zoomed in.
 */
function isZoomed() {
    return typeof zoom !== 'undefined' && zoom > 1;
}

/**
 * Utility: getDistance
 * Calculates Euclidean distance between two points.
 */
function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Utility: resetZoomState
 * Resets zoom and pan state to 1x and updates UI.
 */
function resetZoomState() {
    zoom = 1;
    panX = 0;
    panY = 0;

    const slider = document.getElementById('zoom-slider');
    if (slider) slider.value = 1;

    const zoomText = document.getElementById('zoom-level');
    if (zoomText) zoomText.textContent = '1x';

    if (typeof updateTransform === 'function') {
        updateTransform();
    }
}

/**
 * Utility: handleZoomNavigation
 * Resets zoom before performing a navigation action if zoomed in.
 * @param {Function} navigateCallback - The navigation action to perform
 */
function handleZoomNavigation(navigateCallback) {
    if (isZoomed()) {
        resetZoomState();
        // Small delay to allow zoom-out animation to start
        setTimeout(navigateCallback, 150);
    } else {
        navigateCallback();
    }
}
