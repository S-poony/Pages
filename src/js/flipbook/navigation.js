/**
 * Flipbook Navigation Module
 * Manages URL hash-based navigation to allow sharing specific pages and history support.
 */
/**
 * URL Helper Functions for Page Navigation
 */

/**
 * Get the current page number from URL hash
 * @param {number} maxPage - Maximum valid page number
 * @returns {number|null} Page number (1-indexed) or null if invalid/not present
 */
function getPageFromHash(maxPage) {
    const hash = window.location.hash;
    if (!hash) return null;

    const match = hash.match(/#page=(\d+)/);
    if (!match) return null;

    const pageNum = parseInt(match[1]);
    // Validate page number using same logic as page input handler
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPage) {
        return pageNum;
    }
    return null;
}

/**
 * Update URL hash with current page number
 * @param {number} pageNum - Page number (1-indexed)
 */
function setPageInHash(pageNum) {
    const newHash = `#page=${pageNum}`;
    // Use replaceState to update URL without creating browser history entries
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', newHash);
    } else {
        // Fallback for older browsers
        window.location.hash = newHash;
    }
}
