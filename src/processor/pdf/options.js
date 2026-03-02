/**
 * PDF Processor Options Module
 * Normalizes and validates configuration for the PDF engine, including render quality,
 * scaling factors, and optional double-spread split settings.
 */

// Global toggle for double-spread behavior (default false)
export const DOUBLESPREAD = false;

/**
 * @typedef {Object} ProcessorOptions
 * @property {number} scale - Rendering scale factor (default: 2 for high quality)
 * @property {Array<number>} [scales] - Optional array of scales for responsive images
 * @property {string} format - Output format: 'image/jpeg' or 'image/png'
 * @property {number} quality - JPEG quality 0-1
 * @property {boolean} doubleSpread - Split pages into left/right halves
 */

/**
 * Validates and normalizes processor options
 * @param {ProcessorOptions} options - Raw options
 * @returns {ProcessorOptions} Normalized options
 */
export function normalizeProcessorOptions(options = {}) {
    const {
        scale = 2,
        scales = null,
        format = 'image/jpeg',
        quality = 0.92,
        doubleSpread = DOUBLESPREAD,
        preserveText = false
    } = options;

    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error('scale must be a positive number');
    }

    if (scales !== null) {
        if (!Array.isArray(scales) || scales.length === 0) {
            throw new Error('scales must be a non-empty array of numbers');
        }
        for (const s of scales) {
            if (!Number.isFinite(s) || s <= 0) {
                throw new Error(`All scales must be positive numbers, got ${s}`);
            }
        }
        scales.sort((a, b) => a - b);
    }

    if (format !== 'image/jpeg' && format !== 'image/png') {
        throw new Error('format must be either "image/jpeg" or "image/png"');
    }

    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new Error('quality must be a number between 0 and 1');
    }

    if (typeof doubleSpread !== 'boolean') {
        throw new Error('doubleSpread must be a boolean');
    }

    if (typeof preserveText !== 'boolean') {
        throw new Error('preserveText must be a boolean');
    }

    return { scale, scales, format, quality, doubleSpread, preserveText };
}
