/**
 * PDF Renderer Module
 */

import { defaultCanvasAPI } from './canvas.js';

/**
 * Creates a page renderer function for a PDF document
 * @param {Object} pdf - PDF document
 * @param {Object} options - Processing options
 * @param {Object} canvasAPI - Canvas API implementation
 * @returns {Function & Object} Page renderer function with attached helpers
 */
export function createPageRenderer(pdf, options, canvasAPI = defaultCanvasAPI) {
    const { scale, scales, format, quality } = options;
    const pageCount = pdf.numPages;

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

        if (options.doubleSpread) {
            fullCanvasCache.set(cacheKey, canvas);
        }

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ page: pageNumber, scale: renderScale, step: 'renderToCanvas', ms: Math.round(t1 - t0) });
            }
        } catch (e) { }

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
        } catch (e) { }

        return data;
    }

    async function renderPageVariant(pageNumber, renderScale) {
        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const canvas = await renderPageToCanvas(pageNumber, renderScale);
        const data = await renderCanvasToDataUrl(canvas);

        if (!options.doubleSpread && canvasAPI.releaseCanvas) {
            canvasAPI.releaseCanvas(canvas);
        }
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ page: pageNumber, scale: renderScale, step: 'renderVariant', ms: Math.round(t1 - t0) });
            }
        } catch (e) { }

        return {
            scale: renderScale,
            width: canvas.width,
            height: canvas.height,
            dataUrl: data
        };
    }

    async function renderPageVariants(pageNumber) {
        const effectiveScales = scales || [scale];
        const variants = [];

        for (const renderScale of effectiveScales) {
            const variant = await renderPageVariant(pageNumber, renderScale);
            variants.push(variant);
        }

        return variants;
    }

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

        if (canvasAPI.releaseCanvas) canvasAPI.releaseCanvas(c);

        try {
            if (typeof window !== 'undefined') {
                window.__RENDER_METRICS__ = window.__RENDER_METRICS__ || [];
                window.__RENDER_METRICS__.push({ step: 'splitHalf', side, scale: renderScale, ms: Math.round(t1 - t0) });
            }
        } catch (e) { }

        return {
            scale: renderScale,
            width: c.width,
            height: c.height,
            dataUrl: data
        };
    }

    async function renderPage(pageNumber) {
        const variant = await renderPageVariant(pageNumber, scale);
        return variant.dataUrl;
    }

    renderPage.renderPageToCanvas = renderPageToCanvas;
    renderPage.renderPageVariants = renderPageVariants;
    renderPage.renderPageVariant = renderPageVariant;
    renderPage.splitCanvasHalfToVariant = splitCanvasHalfToVariant;
    renderPage.pdfPageCount = pageCount;

    return renderPage;
}
