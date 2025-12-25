/**
 * EPUB Processor Module
 * The main orchestration engine for EPUB documents. It coordinates the loading,
 * asset enrichment (resolving images/CSS), and recursive pagination into fixed-layout pages.
 */

import JSZip from 'jszip';
import { normalizeEpubProcessorOptions } from './options.js';
import { loadEpubDocument } from './loader.js';
import { createEnrichedPages } from './enrichment.js';
import { extractTableOfContents } from './toc.js';

let EPUB_DEFAULTS_CSS = '';

/**
 * Processes an EPUB file and returns page data for flipbook generation
 * @param {File|ArrayBuffer} input - The EPUB file or array buffer to process
 * @param {Object} options - Processing options
 * @returns {Promise<{pageCount: number, pages: Array, pageHeight: number, linkMap: Object, tableOfContents: Array}>}
 */
export async function processEpub(input, options = {}) {
    // Load CSS on demand if in browser
    if (typeof window !== 'undefined' && !EPUB_DEFAULTS_CSS) {
        try {
            const module = await import('./defaults.css?raw');
            EPUB_DEFAULTS_CSS = module.default;
        } catch (e) {
            console.warn('Failed to load epub-defaults.css?raw:', e);
        }
    }

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

    // Extract title from EPUB metadata
    let epubTitle = '';
    try {
        epubTitle = book.package?.metadata?.title || '';
    } catch (e) {
        console.warn('Failed to extract EPUB title:', e);
    }

    // Load zip directly for asset extraction
    const zip = await JSZip.loadAsync(arrayBuffer);

    const { pages: enrichedPages, linkMap } = await createEnrichedPages(book, zip, normalizedOptions, EPUB_DEFAULTS_CSS);

    // Extract TOC
    const tableOfContents = extractTableOfContents(book, linkMap);

    return {
        pageCount: enrichedPages.length,
        pages: enrichedPages,
        pageWidth: normalizedOptions.pageWidth,
        pageHeight: normalizedOptions.pageHeight,
        css: EPUB_DEFAULTS_CSS,
        linkMap,
        tableOfContents,
        title: epubTitle
    };
}

// Re-exporting for tests and other modules if needed
export { normalizeEpubProcessorOptions } from './options.js';
export { loadEpubDocument } from './loader.js';
export { createEnrichedPages } from './enrichment.js';
export { paginateContent } from './pagination.js';
export { extractTableOfContents } from './toc.js';
