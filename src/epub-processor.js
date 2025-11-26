/**
 * EPUB Processor Module
 * Uses epubjs to parse EPUB files and render pages to canvas
 * Creates image data URLs compatible with the flipbook generator
 *
 * @typedef {Object} EpubProcessorOptions
 * @property {number} scale - Rendering scale factor (default: 2 for high quality)
 * @property {Array<number>} [scales] - Optional array of scales for responsive images (e.g., [1, 2, 3])
 * @property {string} format - Output format: 'image/jpeg' or 'image/png' (default: 'image/jpeg')
 * @property {number} quality - JPEG quality 0-1 (default: 0.92)
 * @property {number} pageWidth - Base page width in pixels (default: 800)
 */

/**
 * @typedef {Object} CanvasAPI
 * @property {Function} createCanvas - Function to create canvas element
 * @property {Function} canvasToDataURL - Function to convert canvas to data URL
 */

/**
 * @typedef {Object} RenderVariant
 * @property {number} scale - The scale factor used
 * @property {number} width - Image width in pixels
 * @property {number} height - Image height in pixels
 * @property {string} dataUrl - The data URL for this variant
 */

import ePub from 'epubjs';
import html2canvas from 'html2canvas';
import { sanitizeEpubHtml } from './sanitizer.js';

/**
 * Default canvas API implementation using DOM
 */
export const defaultCanvasAPI = {
    createCanvas() {
        return document.createElement('canvas');
    },

    canvasToDataURL(canvas, format, quality) {
        return canvas.toDataURL(format, quality);
    }
};

/**
 * Validates and normalizes EPUB processor options
 * @param {EpubProcessorOptions} options - Raw options
 * @returns {EpubProcessorOptions} Normalized options
 */
export function normalizeEpubProcessorOptions(options = {}) {
    const {
        scale = 2,
        scales = null,
        format = 'image/jpeg',
        quality = 0.92,
        pageWidth = 800
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
        // Ensure scales are unique and sorted
        scales.sort((a, b) => a - b);
    }

    if (format !== 'image/jpeg' && format !== 'image/png') {
        throw new Error('format must be either "image/jpeg" or "image/png"');
    }

    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        throw new Error('quality must be a number between 0 and 1');
    }

    if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
        throw new Error('pageWidth must be a positive number');
    }

    return { scale, scales, format, quality, pageWidth };
}

/**
 * Loads an EPUB document from array buffer
 * @param {ArrayBuffer} arrayBuffer - EPUB data as array buffer
 * @returns {Promise<Object>} EPUB book object
 */
export async function loadEpubDocument(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error('arrayBuffer must be an ArrayBuffer');
    }

    try {
        const book = ePub(arrayBuffer);
        await book.ready;
        return book;
    } catch (error) {
        throw new Error(`Failed to load EPUB: ${error.message}`);
    }
}

/**
 * Renders HTML content to canvas
 * @param {string} html - HTML content to render
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {CanvasAPI} canvasAPI - Canvas API implementation
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas
 */
async function renderHtmlToCanvas(html, width, height, canvasAPI) {
    const canvas = canvasAPI.createCanvas();
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Create a temporary container for rendering HTML
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = `${width}px`;
    container.style.maxWidth = `${width}px`;
    container.style.padding = '20px';
    container.style.boxSizing = 'border-box';
    container.style.fontFamily = 'Georgia, serif';
    container.style.fontSize = '16px';
    container.style.lineHeight = '1.6';
    container.style.color = '#000000';
    container.style.backgroundColor = '#ffffff';
    container.innerHTML = html;

    document.body.appendChild(container);

    try {
        // Render using html2canvas
        const renderedCanvas = await html2canvas(container, {
            width: width,
            height: height,
            scale: 1,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: false
        });

        // Copy to our canvas
        ctx.drawImage(renderedCanvas, 0, 0);
    } finally {
        document.body.removeChild(container);
    }

    return canvas;
}

/**
 * Simple text rendering fallback when html2canvas is not available
 * @param {HTMLElement} container - Container with HTML content
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
async function renderTextToCanvas(container, ctx, width, height) {
    ctx.fillStyle = '#000000';
    ctx.font = '16px Georgia, serif';
    ctx.textBaseline = 'top';

    const text = container.textContent || '';
    const lines = [];
    const words = text.split(/\s+/);
    let currentLine = '';
    const maxWidth = width - 40; // 20px padding on each side
    const lineHeight = 24;
    let y = 20;

    // Simple word wrapping
    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }

    // Render lines
    for (const line of lines) {
        if (y + lineHeight > height - 20) break; // Stop if we exceed height
        ctx.fillText(line, 20, y, maxWidth);
        y += lineHeight;
    }
}

/**
 * Creates a page renderer function for an EPUB document
 * @param {Object} book - EPUB book object
 * @param {EpubProcessorOptions} options - Processing options
 * @param {CanvasAPI} canvasAPI - Canvas API implementation
 * @returns {Object} Object with renderPage and renderPageVariants functions
 */
export function createEpubPageRenderer(book, options, canvasAPI = defaultCanvasAPI) {
    const { scale, scales, format, quality, pageWidth } = options;

    // Calculate height based on 16:9 ratio (width * 9/16)
    const aspectRatio = 16 / 9;
    const pageHeight = Math.round(pageWidth * aspectRatio);

    // Cache for rendered pages
    const pageCache = new Map();
    let spineItems = [];
    let pages = [];

    /**
     * Initialize spine items and prepare pages
     */
    async function initialize() {
        spineItems = book.spine.spineItems;

        // Pre-process all spine items to create pages
        for (let i = 0; i < spineItems.length; i++) {
            const item = spineItems[i];
            try {
                const doc = await item.load(book.load.bind(book));
                const bodyContent = doc.body ? doc.body.innerHTML : doc.innerHTML || '';

                // Sanitize HTML content
                const sanitizedHtml = sanitizeEpubHtml(bodyContent);

                pages.push({
                    index: i,
                    html: sanitizedHtml,
                    href: item.href
                });
            } catch (error) {
                console.warn(`Failed to load page ${i}:`, error);
                pages.push({
                    index: i,
                    html: `<p>Error loading content: ${error.message}</p>`,
                    href: item.href
                });
            }
        }
    }

    /**
     * Renders a single page at specific scale
     * @param {number} pageNumber - 1-based page number
     * @param {number} renderScale - Scale factor
     * @returns {Promise<RenderVariant>}
     */
    async function renderPageVariant(pageNumber, renderScale) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pages.length) {
            throw new Error(`Page ${pageNumber} is out of range (1-${pages.length})`);
        }

        const cacheKey = `${pageNumber}-${renderScale}`;
        if (pageCache.has(cacheKey)) {
            return pageCache.get(cacheKey);
        }

        const page = pages[pageNumber - 1];
        const scaledWidth = Math.round(pageWidth * renderScale);
        const scaledHeight = Math.round(pageHeight * renderScale);

        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        const canvas = await renderHtmlToCanvas(page.html, scaledWidth, scaledHeight, canvasAPI);
        const dataUrl = canvasAPI.canvasToDataURL(canvas, format, quality);

        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        const variant = {
            scale: renderScale,
            width: canvas.width,
            height: canvas.height,
            dataUrl: dataUrl
        };

        pageCache.set(cacheKey, variant);

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({
                    page: pageNumber,
                    scale: renderScale,
                    step: 'renderEpubPage',
                    ms: Math.round(t1 - t0)
                });
            }
        } catch (e) { }

        return variant;
    }

    /**
     * Renders multiple variants of a page
     * @param {number} pageNumber - 1-based page number
     * @returns {Promise<Array<RenderVariant>>}
     */
    async function renderPageVariants(pageNumber) {
        const effectiveScales = scales || [scale];
        const variants = [];

        for (const renderScale of effectiveScales) {
            const variant = await renderPageVariant(pageNumber, renderScale);
            variants.push(variant);
        }

        return variants;
    }

    /**
     * Renders a full page (backward compatible)
     * @param {number} pageNumber - 1-based page number
     * @returns {Promise<string>} Data URL
     */
    async function renderPage(pageNumber) {
        const variant = await renderPageVariant(pageNumber, scale);
        return variant.dataUrl;
    }

    return {
        initialize,
        renderPage,
        renderPageVariants,
        renderPageVariant,
        getPageCount: () => pages.length
    };
}

/**
 * Processes an EPUB file and returns page count and renderers
 * @param {File|ArrayBuffer} input - The EPUB file or array buffer to process
 * @param {EpubProcessorOptions} options - Processing options
 * @param {CanvasAPI} canvasAPI - Canvas API implementation (optional)
 * @returns {Promise<{pageCount: number, renderPage: Function, renderPageVariants: Function}>}
 */
export async function processEpub(input, options = {}, canvasAPI = defaultCanvasAPI) {
    const normalizedOptions = normalizeEpubProcessorOptions(options);

    let arrayBuffer;
    if (input instanceof ArrayBuffer) {
        arrayBuffer = input;
    } else if (input && typeof input.arrayBuffer === 'function') {
        arrayBuffer = await input.arrayBuffer();
    } else {
        throw new Error('input must be a File or ArrayBuffer');
    }

    const book = await loadEpubDocument(arrayBuffer);
    const renderer = createEpubPageRenderer(book, normalizedOptions, canvasAPI);

    // Initialize and prepare all pages
    await renderer.initialize();

    const pageCount = renderer.getPageCount();

    return {
        pageCount,
        renderPage: (pageNumber) => renderer.renderPage(pageNumber),
        renderPageVariants: (pageNumber) => renderer.renderPageVariants(pageNumber)
    };
}
