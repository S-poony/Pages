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
 * Creates enriched HTML pages from EPUB content with proper pagination
 * @param {Object} book - EPUB book object
 * @param {EpubProcessorOptions} options - Processing options
 * @returns {Promise<Array<{backgroundImage: string, enrichmentHtml: string}>>}
 */
async function createEnrichedPages(book, options) {
    const { pageWidth, backgroundColor } = options;

    // Calculate height based on 16:9 ratio
    const pageHeight = Math.round(pageWidth * (9 / 16));

    const pages = [];
    const spineItems = book.spine.spineItems;

    // Create a temporary container for measuring content
    const measureContainer = document.createElement('div');
    measureContainer.style.position = 'absolute';
    measureContainer.style.left = '-9999px';
    measureContainer.style.top = '-9999px';
    measureContainer.style.width = `${pageWidth - 80}px`; // Account for 40px padding on each side
    measureContainer.style.fontFamily = 'Georgia, serif';
    measureContainer.style.fontSize = '14px';
    measureContainer.style.lineHeight = '1.5';
    measureContainer.style.visibility = 'hidden';
    document.body.appendChild(measureContainer);

    try {
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

                // Split content into pages that fit within page height
                const contentPages = await paginateContent(sanitizedHtml, measureContainer, pageHeight - 80); // Account for padding

                for (const pageContent of contentPages) {
                    const enrichmentHtml = `
                        <div class="epub-content" style="
                            width: 100%;
                            height: 100%;
                            padding: 40px;
                            box-sizing: border-box;
                            overflow: hidden;
                            font-family: Georgia, serif;
                            font-size: 14px;
                            line-height: 1.5;
                            color: #000000;
                        ">
                            ${pageContent}
                        </div>
                    `;

                    const bgImage = `data:image/svg+xml,${encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}">
                            <rect width="100%" height="100%" fill="${backgroundColor}"/>
                        </svg>
                    `)}`;

                    pages.push({
                        backgroundImage: bgImage,
                        enrichmentHtml: enrichmentHtml
                    });
                }

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
                        overflow: hidden;
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
    } finally {
        document.body.removeChild(measureContainer);
    }

    return pages;
}

/**
 * Paginates HTML content using a viewport-based approach
 * Treats images and large blocks atomically to prevent splitting
 * @param {string} html - Sanitized HTML content
 * @param {HTMLElement} container - Container for measuring
 * @param {number} maxHeight - Maximum height per page in pixels
 * @returns {Promise<Array<string>>} Array of HTML strings, one per page
 */
async function paginateContent(html, container, maxHeight) {
    container.innerHTML = html;

    const totalHeight = container.scrollHeight;
    console.log('Paginating content. Max height per page:', maxHeight, 'Total content height:', totalHeight);

    // If content fits in one page, return it
    if (totalHeight <= maxHeight) {
        console.log('Content fits in one page');
        return [html];
    }

    // Get all block-level elements with their positions
    const elements = Array.from(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, img, ul, ol, blockquote, pre, table, figure'));

    if (elements.length === 0) {
        // No block elements found, return as single page
        return [html];
    }

    // Measure each element's position and height
    const elementData = elements.map(el => {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
            element: el,
            top: rect.top - containerRect.top,
            bottom: rect.bottom - containerRect.top,
            height: rect.height,
            isImage: el.tagName === 'IMG' || el.querySelector('img') !== null
        };
    });

    console.log(`Found ${elementData.length} block elements to paginate`);

    const pages = [];
    let currentPageStart = 0;
    let pageNumber = 1;

    while (currentPageStart < totalHeight) {
        const currentPageEnd = currentPageStart + maxHeight;
        const pageElements = [];

        // Find elements that should be on this page
        for (const data of elementData) {
            // Element starts before or within current page
            if (data.top >= currentPageStart && data.top < currentPageEnd) {
                // Check if element fits on current page
                if (data.bottom <= currentPageEnd) {
                    // Element fits completely
                    pageElements.push(data.element);
                } else {
                    // Element would overflow
                    if (data.isImage || data.height > maxHeight * 0.8) {
                        // Image or large block - keep atomic
                        if (pageElements.length === 0) {
                            // No elements on page yet, include this one even if it overflows
                            pageElements.push(data.element);
                            // Move past this element for next page
                            currentPageStart = data.bottom;
                        } else {
                            // Already have elements, save current page and put this on next page
                            break;
                        }
                    } else {
                        // Regular text block that overflows - include it anyway (will be clipped)
                        pageElements.push(data.element);
                    }
                }
            } else if (data.top >= currentPageEnd) {
                // This and all following elements are beyond current page
                break;
            }
        }

        // Create page from collected elements
        if (pageElements.length > 0) {
            const pageHtml = pageElements.map(el => el.outerHTML).join('');
            pages.push(pageHtml);
            console.log(`Page ${pageNumber}: ${pageElements.length} elements, viewport: ${currentPageStart}-${currentPageEnd}px`);
        }

        // Move to next page
        if (pageElements.length > 0) {
            // Find the bottom of the last element on this page
            const lastElementData = elementData.find(d => d.element === pageElements[pageElements.length - 1]);
            if (lastElementData && currentPageStart < lastElementData.bottom) {
                currentPageStart = lastElementData.bottom;
            } else {
                currentPageStart = currentPageEnd;
            }
        } else {
            // No elements fit, move viewport down
            currentPageStart = currentPageEnd;
        }

        pageNumber++;

        // Safety check to prevent infinite loops
        if (pageNumber > 10000) {
            console.error('Too many pages, stopping pagination');
            break;
        }
    }

    console.log(`Total pages created: ${pages.length}`);
    return pages.length > 0 ? pages : [html];
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
