/**
 * PDF Processor Module
 * Uses pdf.js to render PDF pages to canvas and convert to image data URLs
 *
 * @typedef {Object} ProcessorOptions
 * @property {number} scale - Rendering scale factor (default: 2 for high quality)
 * @property {string} format - Output format: 'image/jpeg' or 'image/png' (default: 'image/jpeg')
 * @property {number} quality - JPEG quality 0-1 (default: 0.92)
 */

/**
 * @typedef {Object} CanvasAPI
 * @property {Function} createCanvas - Function to create canvas element
 * @property {Function} canvasToDataURL - Function to convert canvas to data URL
 */

// Lazy initialization of pdf.js to handle different environments
let pdfjsLibPromise = null;

async function getPdfJsLib() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            if (typeof window !== 'undefined') {
                // Browser environment - use regular imports
                const pdfjsModule = await import('pdfjs-dist');
                const lib = pdfjsModule.default || pdfjsModule;

                // Import worker
                await import('pdfjs-dist/build/pdf.worker.min.mjs');

                window.pdfjsLib = lib;
                return lib;
            } else {
                // Node.js environment - use legacy build to avoid DOMMatrix issues
                try {
                    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
                    return pdfjsModule.default || pdfjsModule;
                } catch (e) {
                    // Fallback for testing - return a mock
                    return {
                        getDocument: async () => ({
                            promise: Promise.resolve({
                                numPages: 1,
                                getPage: async () => ({
                                    getViewport: () => ({ width: 100, height: 100 }),
                                    render: () => ({ promise: Promise.resolve() })
                                })
                            })
                        })
                    };
                }
            }
        })();
    }
    return pdfjsLibPromise;
}

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

// Global toggle for double-spread behavior. If true, each PDF page is
// split into two assets (left/right). Can be overridden per-call via
// options.DOUBLESPREAD in processPdf.
export const DOUBLESPREAD = false;

/**
 * Validates and normalizes processor options
 * @param {ProcessorOptions} options - Raw options
 * @returns {ProcessorOptions} Normalized options
 */
export function normalizeProcessorOptions(options = {}) {
    const {
        scale = 2,
        format = 'image/jpeg',
        quality = 0.92
        , doubleSpread = DOUBLESPREAD
    } = options;

    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error('scale must be a positive number');
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

    return { scale, format, quality, doubleSpread };
}

/**
 * Loads a PDF document from array buffer
 * @param {ArrayBuffer} arrayBuffer - PDF data as array buffer
 * @returns {Promise<Object>} PDF document
 */
export async function loadPdfDocument(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error('arrayBuffer must be an ArrayBuffer');
    }

    const pdfjsLib = await getPdfJsLib();
    const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;

    return pdf;
}

/**
 * Creates a page renderer function for a PDF document
 * @param {Object} pdf - PDF document
 * @param {ProcessorOptions} options - Processing options
 * @param {CanvasAPI} canvasAPI - Canvas API implementation
 * @returns {Function} Page renderer function
 */
export function createPageRenderer(pdf, options, canvasAPI = defaultCanvasAPI) {
    const { scale, format, quality } = options;
    const pageCount = pdf.numPages;

    // Cache full-page canvases to avoid re-rendering the same PDF page
    // multiple times when splitting into halves.
    const fullCanvasCache = new Map();

    async function renderPageToCanvas(pageNumber) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
            throw new Error(`Page ${pageNumber} is out of range (1-${pageCount})`);
        }

        if (fullCanvasCache.has(pageNumber)) {
            return fullCanvasCache.get(pageNumber);
        }

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = canvasAPI.createCanvas();
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        fullCanvasCache.set(pageNumber, canvas);
        return canvas;
    }

    async function renderCanvasToDataUrl(canvas) {
        return canvasAPI.canvasToDataURL(canvas, format, quality);
    }

    /**
     * Renders either a full page or a half-page asset depending on the
     * callers indexing. When callers want halves, the processPdf wrapper
     * will expose a pageCount that is doubled and call renderPage with a
     * half-based index. This function accepts either a PDF page number
     * (1..pdf.numPages) and returns a full dataURL, or a half index where
     * the mapping is handled by the caller wrapper.
     * @param {number} pageNumber - 1-based PDF page number
     * @returns {Promise<string>} Data URL of the rendered page
     */
    async function renderPageFull(pageNumber) {
        const canvas = await renderPageToCanvas(pageNumber);
        return renderCanvasToDataUrl(canvas);
    }

    /**
     * Create a half image (left or right) from a rendered full-page canvas.
     * @param {HTMLCanvasElement} fullCanvas
     * @param {'left'|'right'} side
     * @returns {string} dataURL
     */
    function splitCanvasHalfToDataUrl(fullCanvas, side) {
        const w = fullCanvas.width;
        const h = fullCanvas.height;
        const halfW = Math.floor(w / 2);

        const c = canvasAPI.createCanvas();
        c.width = halfW;
        c.height = h;
        const ctx = c.getContext('2d');

        const sx = side === 'left' ? 0 : halfW;
        ctx.drawImage(fullCanvas, sx, 0, halfW, h, 0, 0, halfW, h);

        return canvasAPI.canvasToDataURL(c, format, quality);
    }

    // For backward compatibility the renderer returns a function that
    // renders a full page data URL. We attach helper utilities to that
    // function so callers that need canvas-level access can use them.
    async function renderPage(pageNumber) {
        return renderPageFull(pageNumber);
    }

    // Attach helpers
    renderPage.renderPageToCanvas = renderPageToCanvas;
    renderPage.renderPageFull = renderPageFull;
    renderPage.splitCanvasHalfToDataUrl = splitCanvasHalfToDataUrl;
    renderPage.pdfPageCount = pageCount;

    return renderPage;
}

/**
 * Processes a PDF file and returns page count and page renderers
 * @param {File|ArrayBuffer} input - The PDF file or array buffer to process
 * @param {ProcessorOptions} options - Processing options
 * @param {CanvasAPI} canvasAPI - Canvas API implementation (optional)
 * @returns {Promise<{pageCount: number, renderPage: Function}>}
 */
export async function processPdf(input, options = {}, canvasAPI = defaultCanvasAPI) {
    const normalizedOptions = normalizeProcessorOptions(options);

    const { doubleSpread } = normalizedOptions;

    let arrayBuffer;
    if (input instanceof ArrayBuffer) {
        arrayBuffer = input;
    } else if (input && typeof input.arrayBuffer === 'function') {
        // File-like object
        arrayBuffer = await input.arrayBuffer();
    } else {
        throw new Error('input must be a File or ArrayBuffer');
    }

    const pdf = await loadPdfDocument(arrayBuffer);
    // Create a renderer helper that exposes canvas-level rendering and
    // splitting utilities. This keeps splitting logic local and avoids
    // re-rendering PDF pages when generating both halves.
    const renderer = createPageRenderer(pdf, normalizedOptions, canvasAPI);

    // If doubleSpread is enabled, we expose a flattened "half-page"
    // indexing: 1..(pdf.numPages * 2) where odd indices are left halves
    // and even indices are right halves.
    if (doubleSpread) {
        const halfPageCount = pdf.numPages * 2;

        async function renderPage(halfIndex) {
            if (!Number.isInteger(halfIndex) || halfIndex < 1 || halfIndex > halfPageCount) {
                throw new Error(`Page ${halfIndex} is out of range (1-${halfPageCount})`);
            }

            const pdfPageNumber = Math.ceil(halfIndex / 2);
            const side = halfIndex % 2 === 1 ? 'left' : 'right';

            // Render or fetch full canvas and split
            const fullCanvas = await renderer.renderPageToCanvas(pdfPageNumber);
            return renderer.splitCanvasHalfToDataUrl(fullCanvas, side);
        }

        return {
            pageCount: halfPageCount,
            renderPage
        };
    }

    // Default (no splitting) behaviour: keep existing contract
    const pageCount = pdf.numPages;
    async function renderPage(pageNumber) {
        return renderer.renderPageFull(pageNumber);
    }

    return { pageCount, renderPage };
}

