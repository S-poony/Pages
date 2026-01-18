/**
 * PDF Renderer Module
 * Implements the core rendering logic using pdf.js. It handles the conversion of
 * PDF pages to scaled images and performs canvas-based cropping for double-spread layouts.
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

        // Normalization logic
        let renderViewport = viewport;
        let canvasWidth = Math.round(viewport.width);
        let canvasHeight = Math.round(viewport.height);
        let xOffset = 0;
        let yOffset = 0;

        if (options.targetAspectRatio && Math.abs((viewport.width / viewport.height) - options.targetAspectRatio) > 0.01) {
            // We need to normalize
            // Determine target dimensions based on standard size multiplied by scale
            // If we don't have standard sizes passed (e.g. from older calls), we derive from ratio
            // But simpler is to use the HEIGHT as the anchor if we want consistent height for flipbook
            // OR use the target aspect ratio to define the box.

            // Strategy: The container should have the target aspect ratio.
            // We should maintain the visual scale. 
            // If we rely on `renderScale`, that usually implies a resolution scale relative to 72DPI.

            // Let's assume we want to match the "height" of the standard page if possible, 
            // OR just ensure the container aspect ratio is correct.
            // If we have Mixed landscape/portrait, usually we want to fit them into the standard page size.

            // Let's try to match the Height of the viewport if possible to keep text size similar?
            // Actually, `options.standardHeight` would be better but if we just rely on ratio:

            // If we assume the vertical height determines the "page height" in a flipbook usually:
            // Let's create a canvas that has the target aspect ratio, but large enough to contain the page.

            // Case 1: Page is wider than target (e.g. Landscape vs Portrait)
            // We must shrink page to fit width? OR Expand container height?
            // Usually for a flipbook, all pages should have same dimensions.
            // So we should probably target `options.standardWidth * scale` and `options.standardHeight * scale`.

            if (options.standardWidth && options.standardHeight) {
                canvasWidth = Math.round(options.standardWidth * renderScale);
                canvasHeight = Math.round(options.standardHeight * renderScale);
            } else {
                // Fallback if standard dims missing: adjust width to match height * ratio
                canvasHeight = Math.round(viewport.height);
                canvasWidth = Math.round(canvasHeight * options.targetAspectRatio);
            }

            // Now calculate how to fit the actual page content into (canvasWidth, canvasHeight)
            // WITHOUT stretching. "Contain".
            const scaleX = canvasWidth / viewport.width;
            const scaleY = canvasHeight / viewport.height;
            const contentScale = Math.min(scaleX, scaleY);

            const drawnWidth = viewport.width * contentScale;
            const drawnHeight = viewport.height * contentScale;

            // Re-calculate viewport with the new scaling factor to draw correctly at high quality
            // Note: viewport.scale is the original renderScale. We need to adjust it.
            renderViewport = page.getViewport({ scale: renderScale * contentScale });

            // Calculate offsets
            // Align RIGHT: x = canvasWidth - drawnWidth. 
            // (User asked for Right alignment)
            // Vertical align: Center? or Bottom? Defaulting to Center usually looks best, or Bottom?
            // "white, with the image on top and aligned to the right"
            // "On top" might mean z-index, OR y-align top?
            // "Image on top" probably means "Layered on top of white bg".
            // Let's assume Center Vertically (standard behavior) unless "Aligned to right" implied "Right-Center" or "Top-Right"?
            // User said: "container needs to be white, with the image on top and aligned to the right"
            // "Aligned to the right" usually implies horizontal alignment. 
            // Vertical alignment isn't specified, let's stick to Center for vertical to look balanced, 
            // or check if "on top" meant "Align Top"? "Image on top" probably means z-order.
            // I'll assume Center Vertical, Right Horizontal.

            xOffset = canvasWidth - drawnWidth;
            yOffset = (canvasHeight - drawnHeight) / 2;
        }

        const canvas = canvasAPI.createCanvas();
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const context = canvas.getContext('2d');

        // Fill white background
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        // Render with transform to handle offset
        // renderViewport already has the correct scale (renderScale * contentScale)
        // We just need to translate the context to position it.
        // render() method takes a transform: [a, b, c, d, tx, ty]
        // but pdf.js render() usually handles viewport transform. 
        // We can just use context.translate() before passing context.

        context.save();
        context.translate(xOffset, yOffset);

        await page.render({
            canvasContext: context,
            viewport: renderViewport
        }).promise;

        context.restore();

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
