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
import { extractPageLinks, resolveLinkDestinations, normalizeLinkRects } from './annotations.js';
import { calculateNormalization } from './normalization.js';

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

    let pdf;
    if (input && typeof input.numPages === 'number' && typeof input.getPage === 'function') {
        // Direct PDF document injection (for testing)
        pdf = input;
    } else {
        let arrayBuffer;
        if (input instanceof ArrayBuffer) {
            arrayBuffer = input;
        } else if (input && typeof input.arrayBuffer === 'function') {
            arrayBuffer = await input.arrayBuffer();
        } else {
            throw new Error('input must be a File, ArrayBuffer, or PDFDocumentProxy');
        }
        pdf = await loadPdfDocument(arrayBuffer);
    }

    // We'll use a precision of 3 decimal places for aspect ratio grouping
    const getRatioKey = (width, height) => (width / height).toFixed(3);

    // Scan all pages in parallel
    const aspectRatios = new Map();
    const dimensions = new Map();

    const pagePromises = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        pagePromises.push(pdf.getPage(i).then(page => {
            const vp = page.getViewport({ scale: 1.0 });
            return { width: vp.width, height: vp.height };
        }).catch(e => {
            console.warn(`Failed to get viewport for page ${i}:`, e);
            return null;
        }));
    }

    const results = await Promise.all(pagePromises);

    results.forEach(vp => {
        if (!vp) return;
        const key = getRatioKey(vp.width, vp.height);
        aspectRatios.set(key, (aspectRatios.get(key) || 0) + 1);
        if (!dimensions.has(key)) {
            dimensions.set(key, { width: vp.width, height: vp.height });
        }
    });

    // Find most common aspect ratio
    let standardRatioKey = null;
    let maxCount = 0;
    for (const [key, count] of aspectRatios.entries()) {
        if (count > maxCount) {
            maxCount = count;
            standardRatioKey = key;
        }
    }

    const standardDims = dimensions.get(standardRatioKey);
    const processorOptions = {
        ...normalizedOptions,
        targetAspectRatio: standardDims ? standardDims.width / standardDims.height : null,
        standardWidth: standardDims ? standardDims.width : null,
        standardHeight: standardDims ? standardDims.height : null
    };

    const renderer = createPageRenderer(pdf, processorOptions, canvasAPI);

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

    // Extract links for all pages
    const pageLinks = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const links = await extractPageLinks(page);
            const resolvedLinks = await resolveLinkDestinations(pdf, links);

            // Get viewport to know dimensions for coordinate conversion
            const viewport = page.getViewport({ scale: 1.0 });
            const normalizedLinks = normalizeLinkRects(resolvedLinks, viewport.width, viewport.height);

            pageLinks.push({
                pageIndex: i - 1,
                links: normalizedLinks,
                width: viewport.width,
                height: viewport.height
            });
        } catch (e) {
            console.warn(`Failed to extract links for page ${i}:`, e);
            pageLinks.push({ pageIndex: i - 1, links: [], width: 0, height: 0 });
        }
    }

    // Helper to get all variants for a page
    const renderPageVariants = async (pageNumber) => {
        return renderer.renderPageVariants(pageNumber);
    };

    if (doubleSpread) {
        const halfPageCount = pdf.numPages * 2;

        // Note: For double spread, we'll need to map links to the correct half
        // For now, we return empty links for double spread or handle it later
        const dsPageLinks = [];
        for (const pl of pageLinks) {
            const { links, width, height } = pl;
            const halfWidth = width / 2;

            const leftLinks = links.filter(l => l.rect[0] < halfWidth)
                .map(l => ({ ...l, rect: [...l.rect] })); // Clone

            const rightLinks = links.filter(l => l.rect[0] >= halfWidth)
                .map(l => {
                    const r = [...l.rect];
                    r[0] -= halfWidth;
                    r[2] -= halfWidth;
                    return { ...l, rect: r };
                });

            dsPageLinks.push({ links: leftLinks, width: halfWidth, height });
            dsPageLinks.push({ links: rightLinks, width: halfWidth, height });
        }

        async function renderHalfPageVariant(halfIndex, renderScale) {
            if (!Number.isInteger(halfIndex) || halfIndex < 1 || halfIndex > halfPageCount)
                throw new Error(`Page ${halfIndex} is out of range (1-${halfPageCount})`);

            const pdfPageNumber = Math.ceil(halfIndex / 2);
            const side = halfIndex % 2 === 1 ? 'left' : 'right';

            const page = await pdf.getPage(pdfPageNumber);
            const wholeVp = page.getViewport({ scale: renderScale });

            // Apply normalization to the WHOLE page first
            // Note: pass processorOptions which has targetAspectRatio/standardDims
            const norm = calculateNormalization(wholeVp, processorOptions, renderScale);

            // New "Whole" Dimensions after normalization
            const normWidth = norm.canvasWidth;
            const normHeight = norm.canvasHeight;
            const halfWidth = Math.floor(normWidth / 2);

            const canvas = canvasAPI.createCanvas();
            canvas.width = halfWidth;
            canvas.height = normHeight; // Normalized Height

            const context = canvas.getContext('2d');

            // Always fill with white to prevent transparent/black background issues
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, halfWidth, normHeight);

            // Transform logic:
            // 1. Translating for Normalization (xOffset, yOffset) to put content in "Container"
            // 2. Translating for Split (shifting global coordinates so left/right aligns with 0,0)

            const splitOffset = side === 'right' ? -halfWidth : 0;
            const contextX = norm.xOffset + splitOffset;
            const contextY = norm.yOffset;

            // Final render scale
            const finalScale = norm.isNormalized ? renderScale * norm.contentScale : renderScale;
            // Note: renderScale was used to calc wholeVp. 
            // calculateNormalization expects viewport at renderScale.

            const renderViewport = page.getViewport({ scale: finalScale });

            const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

            context.save();
            context.translate(contextX, contextY);

            await page.render({
                canvasContext: context,
                viewport: renderViewport
            }).promise;

            context.restore();

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
            title: pdfTitle,
            pageLinks: dsPageLinks
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
        title: pdfTitle,
        pageLinks: pageLinks.map(pl => ({ links: pl.links, width: pl.width, height: pl.height }))
    };
}

// Re-exports
export { normalizeProcessorOptions } from './options.js';
export { loadPdfDocument } from './loader.js';
export { createPageRenderer } from './renderer.js';
export { defaultCanvasAPI } from './canvas.js';