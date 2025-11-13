/**
 * PDF Processor Module
 * Uses pdf.js to render PDF pages to canvas and convert to image data URLs
 *
 * @typedef {Object} ProcessorOptions
 * @property {number} scale - Rendering scale factor (default: 2 for high quality)
 * @property {Array<number>} [scales] - Optional array of scales for responsive images (e.g., [1, 2, 4])
 * @property {string} format - Output format: 'image/jpeg' or 'image/png' (default: 'image/jpeg')
 * @property {number} quality - JPEG quality 0-1 (default: 0.92)
 * @property {boolean} doubleSpread - Split pages into left/right halves
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

// Lazy initialization of pdf.js to handle different environments
let pdfjsLibPromise = null;

async function getPdfJsLib() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            if (typeof window !== 'undefined') {
                // Browser environment
                const pdfjsModule = await import('pdfjs-dist');
                const lib = pdfjsModule.default || pdfjsModule;

                // Configure worker with fallbacks
                if (!lib.GlobalWorkerOptions) {
                    lib.GlobalWorkerOptions = {};
                }

                // Try multiple strategies to set workerSrc
                const strategies = [
                    // Strategy 1: Use import.meta.url (modern bundlers)
                    () => {
                        if (import.meta?.url) {
                            return new URL(
                                'pdfjs-dist/build/pdf.worker.min.mjs',
                                import.meta.url
                            ).toString();
                        }
                        throw new Error('import.meta.url not available');
                    },
                    // Strategy 2: Use relative path (some dev servers)
                    () => '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
                    // Strategy 3: Use CDN
                    () => {
                        const version = lib.version || '3.11.174';
                        console.log(`Using CDN worker for pdf.js v${version}`);
                        return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                    }
                ];

                for (const strategy of strategies) {
                    try {
                        lib.GlobalWorkerOptions.workerSrc = strategy();
                        console.log('Worker src set to:', lib.GlobalWorkerOptions.workerSrc);
                        break;
                    } catch (e) {
                        console.warn('Worker setup failed, trying next strategy:', e.message);
                    }
                }

                // Ensure it's set
                if (!lib.GlobalWorkerOptions.workerSrc) {
                    throw new Error('Could not set pdf.js worker source');
                }

                window.pdfjsLib = lib;
                return lib;
            } else {
                // Node.js environment - unchanged
                try {
                    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
                    return pdfjsModule.default || pdfjsModule;
                } catch (e) {
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

// Global toggle for double-spread behavior
export const DOUBLESPREAD = false;

/**
 * Validates and normalizes processor options
 * @param {ProcessorOptions} options - Raw options
 * @returns {ProcessorOptions} Normalized options
 */
export function normalizeProcessorOptions(options = {}) {
    const {
        scale = 2,
        scales = null, // null = single scale mode (backward compatible)
        format = 'image/jpeg',
        quality = 0.92,
        doubleSpread = DOUBLESPREAD
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

    if (typeof doubleSpread !== 'boolean') {
        throw new Error('doubleSpread must be a boolean');
    }

    return { scale, scales, format, quality, doubleSpread };
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
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf;
}

/**
 * Creates a page renderer function for a PDF document
 * @param {Object} pdf - PDF document
 * @param {ProcessorOptions} options - Processing options
 * @param {CanvasAPI} canvasAPI - Canvas API implementation
 * @returns {Function & Object} Page renderer function with attached helpers
 */
export function createPageRenderer(pdf, options, canvasAPI = defaultCanvasAPI) {
    const { scale, scales, format, quality } = options;
    const pageCount = pdf.numPages;

    // Cache full-page canvases by page number and scale to avoid re-rendering
    const fullCanvasCache = new Map();

    function getCacheKey(pageNumber, renderScale) {
        return `${pageNumber}-${renderScale}`;
    }

    async function renderPageToCanvas(pageNumber, renderScale) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
            throw new Error(`Page ${pageNumber} is out of range (1-${pageCount})`);
        }

        const cacheKey = getCacheKey(pageNumber, renderScale);
        if (fullCanvasCache.has(cacheKey)) {
            return fullCanvasCache.get(cacheKey);
        }

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = canvasAPI.createCanvas();
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        const context = canvas.getContext('2d');

        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        fullCanvasCache.set(cacheKey, canvas);

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ page: pageNumber, scale: renderScale, step: 'renderToCanvas', ms: Math.round(t1 - t0) });
            }
        } catch (e) {}

        return canvas;
    }

    async function renderCanvasToDataUrl(canvas) {
        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const data = canvasAPI.canvasToDataURL(canvas, format, quality);
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ step: 'canvasToDataUrl', ms: Math.round(t1 - t0) });
            }
        } catch (e) {}

        return data;
    }

    /**
     * Renders a single page at specific scale
     * @param {number} pageNumber - 1-based PDF page number
     * @param {number} renderScale - Scale factor
     * @returns {Promise<RenderVariant>}
     */
    async function renderPageVariant(pageNumber, renderScale) {
        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const canvas = await renderPageToCanvas(pageNumber, renderScale);
        const data = await renderCanvasToDataUrl(canvas);
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ page: pageNumber, scale: renderScale, step: 'renderVariant', ms: Math.round(t1 - t0) });
            }
        } catch (e) {}

        return {
            scale: renderScale,
            width: canvas.width,
            height: canvas.height,
            dataUrl: data
        };
    }

    /**
     * Renders multiple variants of a page
     * @param {number} pageNumber - 1-based PDF page number
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
     * Create a half image (left or right) from a rendered full-page canvas.
     * @param {HTMLCanvasElement} fullCanvas
     * @param {'left'|'right'} side
     * @param {number} renderScale - Scale factor used for rendering
     * @returns {Promise<RenderVariant>}
     */
    async function splitCanvasHalfToVariant(fullCanvas, side, renderScale) {
        const w = fullCanvas.width;
        const h = fullCanvas.height;
        const halfW = Math.floor(w / 2);

        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        const c = canvasAPI.createCanvas();
        c.width = halfW;
        c.height = h;
        const ctx = c.getContext('2d');

        const sx = side === 'left' ? 0 : halfW;
        ctx.drawImage(fullCanvas, sx, 0, halfW, h, 0, 0, halfW, h);

        const data = canvasAPI.canvasToDataURL(c, format, quality);
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ step: 'splitHalf', side, scale: renderScale, ms: Math.round(t1 - t0) });
            }
        } catch (e) {}

        return {
            scale: renderScale,
            width: c.width,
            height: c.height,
            dataUrl: data
        };
    }

    /**
     * Renders a full page (backward compatible)
     * @param {number} pageNumber - 1-based PDF page number
     * @returns {Promise<string>} Data URL
     */
    async function renderPage(pageNumber) {
        const variant = await renderPageVariant(pageNumber, scale);
        return variant.dataUrl;
    }

    // Attach helpers for advanced usage
    renderPage.renderPageToCanvas = renderPageToCanvas;
    renderPage.renderPageVariants = renderPageVariants;
    renderPage.renderPageVariant = renderPageVariant;
    renderPage.splitCanvasHalfToVariant = splitCanvasHalfToVariant;
    renderPage.pdfPageCount = pageCount;

    return renderPage;
}

/**
 * Processes a PDF file and returns page count and renderers
 * @param {File|ArrayBuffer} input - The PDF file or array buffer to process
 * @param {ProcessorOptions} options - Processing options
 * @param {CanvasAPI} canvasAPI - Canvas API implementation (optional)
 * @returns {Promise<{pageCount: number, renderPage: Function, renderPageVariants: Function}>}
 */
export async function processPdf(input, options = {}, canvasAPI = defaultCanvasAPI) {
    const normalizedOptions = normalizeProcessorOptions(options);
    const { scale, scales, doubleSpread } = normalizedOptions;

    let arrayBuffer;
    if (input instanceof ArrayBuffer) {
        arrayBuffer = input;
    } else if (input && typeof input.arrayBuffer === 'function') {
        arrayBuffer = await input.arrayBuffer();
    } else {
        throw new Error('input must be a File or ArrayBuffer');
    }

    const pdf = await loadPdfDocument(arrayBuffer);
    const renderer = createPageRenderer(pdf, normalizedOptions, canvasAPI);

    // Helper to get all variants for a page
    const renderPageVariants = async (pageNumber) => {
        return renderer.renderPageVariants(pageNumber);
    };

    /* ----------------------------------------------------------
       PARTIE DOUBLE-SPREAD  (inchangée sauf ajout de renderPage)
       ---------------------------------------------------------- */
    if (doubleSpread) {
        const halfPageCount = pdf.numPages * 2;

        // Fonction legacy : une seule data URL
        async function renderPage(halfIndex) {
            if (!Number.isInteger(halfIndex) || halfIndex < 1 || halfIndex > halfPageCount) {
                throw new Error(`Page ${halfIndex} is out of range (1-${halfPageCount})`);
            }
            const pdfPageNumber = Math.ceil(halfIndex / 2);
            const side = halfIndex % 2 === 1 ? 'left' : 'right';
            const fullCanvas = await renderer.renderPageToCanvas(pdfPageNumber, scale);
            const variant = await renderer.splitCanvasHalfToVariant(fullCanvas, side, scale);
            return variant.dataUrl;
        }

        // Fonction responsive : tableau de variants
        async function renderPageVariantsForHalf(halfIndex) {
            if (!Number.isInteger(halfIndex) || halfIndex < 1 || halfIndex > halfPageCount) {
                throw new Error(`Page ${halfIndex} is out of range (1-${halfPageCount})`);
            }
            const pdfPageNumber = Math.ceil(halfIndex / 2);
            const side = halfIndex % 2 === 1 ? 'left' : 'right';
            const effectiveScales = scales || [scale];
            const variants = [];
            for (const renderScale of effectiveScales) {
                const fullCanvas = await renderer.renderPageToCanvas(pdfPageNumber, renderScale);
                const variant = await renderer.splitCanvasHalfToVariant(fullCanvas, side, renderScale);
                variants.push(variant);
            }
            return variants;
        }

        return {
            pageCount: halfPageCount,
            renderPage,
            renderPageVariants: renderPageVariantsForHalf
        };
    }

    /* ----------------------------------------------------------
       MODE SIMPLE PAGE (default) – on définit renderPage AVANT de le renvoyer
       ---------------------------------------------------------- */
    async function renderPage(pageNumber) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) {
            throw new Error(`Page ${pageNumber} is out of range (1-${pdf.numPages})`);
        }
        const variant = await renderer.renderPageVariant(pageNumber, scale);
        return variant.dataUrl;
    }

    return {
        pageCount: pdf.numPages,
        renderPage,
        renderPageVariants: async (pageNumber) => renderer.renderPageVariants(pageNumber)
    };
}