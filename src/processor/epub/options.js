/**
 * EPUB Processor Options Module
 */

/**
 * @typedef {Object} EpubProcessorOptions
 * @property {number} pageWidth - Target page width (default: 600)
 * @property {number} [pageHeight] - Target page height (default: pageWidth * 1.5)
 * @property {string} backgroundColor - Page background color (default: '#ffffff')
 */

/**
 * Validates and normalizes EPUB processor options
 * @param {EpubProcessorOptions} options - Raw options
 * @returns {EpubProcessorOptions} Normalized options
 */
export function normalizeEpubProcessorOptions(options = {}) {
    const {
        pageWidth = 600,
        backgroundColor = '#ffffff',
        fontSize = 16
    } = options;

    let { pageHeight } = options;

    if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
        throw new Error('pageWidth must be a positive number');
    }

    if (pageHeight === undefined) {
        // Default aspect ratio 2:3 (portrait)
        pageHeight = Math.round(pageWidth * 1.5);
    } else if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
        throw new Error('pageHeight must be a positive number');
    }

    return { pageWidth, pageHeight, backgroundColor, fontSize };
}
