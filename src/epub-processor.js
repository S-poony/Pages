/**
 * EPUB Processor Module
 * Uses epubjs to parse EPUB files and create HTML-enriched flipbook pages
 * Preserves interactive links and images by using enrichment layers
 *
 * @typedef {Object} EpubProcessorOptions
 * @property {number} pageWidth - Base page width in pixels (default: 800)
 * @property {string} backgroundColor - Page background color (default: '#ffffff')
 */

import ePub from 'epubjs';
import { sanitizeEpubHtml } from './sanitizer.js';

/**
 * Validates and normalizes EPUB processor options
 * @param {EpubProcessorOptions} options - Raw options
 * @returns {EpubProcessorOptions} Normalized options
 */
export function normalizeEpubProcessorOptions(options = {}) {
    const {
        pageWidth = 800,
        backgroundColor = '#ffffff'
    } = options;

    if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
        throw new Error('pageWidth must be a positive number');
    }

    return { pageWidth, backgroundColor };
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
 * Creates enriched HTML pages from EPUB content
 * @param {Object} book - EPUB book object
 * @param {EpubProcessorOptions} options - Processing options
 * @returns {Promise<Array<{backgroundImage: string, enrichmentHtml: string}>>}
 */
async function createEnrichedPages(book, options) {
    const { pageWidth, backgroundColor } = options;

    // Calculate height based on 16:9 ratio
    const pageHeight = Math.round(pageWidth * (16 / 9));

    const pages = [];
    const spineItems = book.spine.spineItems;

    // Process each spine item (chapter/section)
    for (let i = 0; i < spineItems.length; i++) {
        const item = spineItems[i];
        try {
            const doc = await item.load(book.load.bind(book));
            let bodyContent = doc.body ? doc.body.innerHTML : doc.innerHTML || '';

            // Load and embed images as data URLs
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = bodyContent;

            const images = tempDiv.querySelectorAll('img');
            for (const img of images) {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                    try {
                        // Resolve relative image path
                        const imgUrl = item.href ?
                            new URL(src, new URL(item.href, 'http://localhost')).pathname.substring(1) :
                            src;

                        // Load image from EPUB archive
                        const imgData = await book.archive.getBase64(imgUrl);

                        // Determine image type from extension
                        const ext = imgUrl.split('.').pop().toLowerCase();
                        const mimeTypes = {
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'png': 'image/png',
                            'gif': 'image/gif',
                            'svg': 'image/svg+xml',
                            'webp': 'image/webp'
                        };
                        const mimeType = mimeTypes[ext] || 'image/jpeg';

                        // Set image source to data URL
                        img.setAttribute('src', `data:${mimeType};base64,${imgData}`);

                        // Add max-width to prevent images from overflowing
                        const currentStyle = img.getAttribute('style') || '';
                        img.setAttribute('style', `${currentStyle}; max-width: 100%; height: auto;`);
                    } catch (imgError) {
                        console.warn(`Failed to load image ${src}:`, imgError);
                    }
                }
            }

            bodyContent = tempDiv.innerHTML;

            // Sanitize HTML content (after embedding images)
            const sanitizedHtml = sanitizeEpubHtml(bodyContent);

            // Create enrichment HTML with EPUB content
            const enrichmentHtml = `
                <div class="epub-content" style="
                    width: 100%;
                    height: 100%;
                    padding: 40px;
                    box-sizing: border-box;
                    overflow: auto;
                    font-family: Georgia, serif;
                    font-size: 16px;
                    line-height: 1.6;
                    color: #000000;
                ">
                    ${sanitizedHtml}
                </div>
            `;

            // Create a simple background image (1x1 colored pixel as data URL)
            const bgImage = `data:image/svg+xml,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}">
                    <rect width="100%" height="100%" fill="${backgroundColor}"/>
                </svg>
            `)}`;

            pages.push({
                backgroundImage: bgImage,
                enrichmentHtml: enrichmentHtml
            });

        } catch (error) {
            console.warn(`Failed to load page ${i}:`, error);

            // Create error page
            const errorHtml = `
                <div class="epub-content" style="
                    width: 100%;
                    height: 100%;
                    padding: 40px;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: Georgia, serif;
                    color: #666;
                ">
                    <p>Error loading content: ${error.message}</p>
                </div>
            `;

            const bgImage = `data:image/svg+xml,${encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}">
                    <rect width="100%" height="100%" fill="${backgroundColor}"/>
                </svg>
            `)}`;

            pages.push({
                backgroundImage: bgImage,
                enrichmentHtml: errorHtml
            });
        }
    }

    return pages;
}

/**
 * Processes an EPUB file and returns page data for flipbook generation
 * @param {File|ArrayBuffer} input - The EPUB file or array buffer to process
 * @param {EpubProcessorOptions} options - Processing options
 * @returns {Promise<{pageCount: number, pages: Array}>}
 */
export async function processEpub(input, options = {}) {
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
    const enrichedPages = await createEnrichedPages(book, normalizedOptions);

    return {
        pageCount: enrichedPages.length,
        pages: enrichedPages
    };
}
