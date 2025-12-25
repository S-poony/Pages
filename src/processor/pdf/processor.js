/**
 * PDF Processor Module
 * The main entry point for PDF documents. It orchestrates the pdf.js library
 * to render pages into high-quality images and handle double-spread layout splitting.
 */

import { extractBookmarks } from './bookmarks.js';
import { normalizeProcessorOptions } from './options.js';
import { loadPdfDocument } from './loader.js';
import { defaultCanvasAPI } from './canvas.js';
import { createPageRenderer } from './renderer.js';

/**
 * Processes a PDF file and returns page count and renderers
 * @param {File|ArrayBuffer} input - The PDF file or array buffer to process
 * @param {Object} options - Processing options
 * @param {Object} canvasAPI - Canvas API implementation (optional)
 * @returns {Promise<{pageCount: number, renderPage: Function, renderPageVariants: Function}>}
 */
export async function processPdf(input, options = {}, canvasAPI = defaultCanvasAPI) {
    const normalizedOptions = normalizeProcessorOptions(options);
    const { scale, scales, doubleSpread, format, quality } = normalizedOptions;

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

    // Extract title from PDF metadata
    let pdfTitle = '';
    try {
        const metadata = await pdf.getMetadata();
        pdfTitle = metadata?.info?.Title || '';
    } catch (e) {
        console.warn('Failed to extract PDF title:', e);
    }

    // Extract bookmarks (only for normal mode, not double-spread)
    let tableOfContents = [];
    if (!doubleSpread) {
        try {
            tableOfContents = await extractBookmarks(pdf);
        } catch (error) {
            console.warn('Failed to extract PDF bookmarks:', error);
        }
    }

    // Helper to get all variants for a page
    const renderPageVariants = async (pageNumber) => {
        return renderer.renderPageVariants(pageNumber);
    };

    if (doubleSpread) {
        const halfPageCount = pdf.numPages * 2;

        async function renderHalfPageVariant(halfIndex, renderScale) {
            if (!Number.isInteger(halfIndex) || halfIndex < 1 || halfIndex > halfPageCount)
                throw new Error(`Page ${halfIndex} is out of range (1-${halfPageCount})`);

            const pdfPageNumber = Math.ceil(halfIndex / 2);
            const side = halfIndex % 2 === 1 ? 'left' : 'right';

            const page = await pdf.getPage(pdfPageNumber);
            const wholeVp = page.getViewport({ scale: renderScale });
            const halfWidth = Math.floor(wholeVp.width / 2);

            const canvas = canvasAPI.createCanvas();
            canvas.width = halfWidth;
            canvas.height = Math.round(wholeVp.height);

            const transform = side === 'right' ? [1, 0, 0, 1, -halfWidth, 0] : undefined;

            const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            await page.render({
                canvasContext: canvas.getContext('2d'),
                viewport: wholeVp,
                transform: transform
            }).promise;
            const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

            const dataUrl = canvasAPI.canvasToDataURL(canvas, format, quality);
            if (canvasAPI.releaseCanvas) canvasAPI.releaseCanvas(canvas);

            try {
                if (typeof window !== 'undefined') {
                    window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                    window.__RENDER_METRICS__.push({
                        page: pdfPageNumber,
                        side,
                        scale: renderScale,
                        step: 'renderHalf',
                        ms: Math.round(t1 - t0)
                    });
                }
            } catch (e) { }

            return {
                scale: renderScale,
                width: canvas.width,
                height: canvas.height,
                dataUrl
            };
        }

        async function renderPage(halfIndex) {
            const variant = await renderHalfPageVariant(halfIndex, scale);
            return variant.dataUrl;
        }

        async function renderPageVariantsDS(halfIndex) {
            const effectiveScales = scales || [scale];
            const variants = [];
            for (const s of effectiveScales) {
                variants.push(await renderHalfPageVariant(halfIndex, s));
            }
            return variants;
        }

        return {
            pageCount: halfPageCount,
            renderPage,
            renderPageVariants: renderPageVariantsDS,
            tableOfContents: [],
            title: pdfTitle
        };
    }

    /* MODE SIMPLE PAGE (default) */
    async function renderPageSimple(pageNumber) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) {
            throw new Error(`Page ${pageNumber} is out of range (1-${pdf.numPages})`);
        }
        const variant = await renderer.renderPageVariant(pageNumber, scale);
        return variant.dataUrl;
    }

    return {
        pageCount: pdf.numPages,
        renderPage: renderPageSimple,
        renderPageVariants: async (pageNumber) => renderer.renderPageVariants(pageNumber),
        tableOfContents,
        title: pdfTitle
    };
}

// Re-exports
export { normalizeProcessorOptions } from './options.js';
export { loadPdfDocument } from './loader.js';
export { createPageRenderer } from './renderer.js';
export { defaultCanvasAPI } from './canvas.js';