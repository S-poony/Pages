/**
 * EPUB Processor Module
 * Uses epubjs to parse EPUB files and create HTML-enriched flipbook pages
 * Preserves interactive links and images by using enrichment layers
 *
 * @typedef {Object} EpubProcessorOptions
 * @property {number} pageWidth - Base page width in pixels (default: 800)
 * @property {number} [pageHeight] - Base page height in pixels (optional, default calculated from ratio)
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
        pageWidth = 200,
        pageHeight = 200,
        backgroundColor = '#ffffff'
    } = options;

    if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
        throw new Error('pageWidth must be a positive number');
    }

    if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
        throw new Error('pageHeight must be a positive number');
    }

    return { pageWidth, pageHeight, backgroundColor };
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
    const { pageWidth, pageHeight, backgroundColor } = options;
    const pages = [];
    const spineItems = book.spine.spineItems;

    // Define common styles to ensure consistency between measurement and rendering
    const PAGE_STYLES = {
        width: '100%',
        height: '100%',
        padding: '40px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#000000',
        textAlign: 'justify'
    };

    // Create a temporary container for measuring content
    const measureContainer = document.createElement('div');
    measureContainer.style.position = 'absolute';
    measureContainer.style.left = '-9999px';
    measureContainer.style.top = '-9999px';
    measureContainer.style.width = `${pageWidth}px`;
    measureContainer.style.height = `${pageHeight}px`;
    measureContainer.style.visibility = 'hidden';

    // Apply common styles to measure container
    Object.assign(measureContainer.style, PAGE_STYLES);

    document.body.appendChild(measureContainer);

    try {
        for (let i = 0; i < spineItems.length; i++) {
            const item = spineItems[i];
            try {
                const doc = await item.load(book.load.bind(book));
                let bodyContent = doc.body ? doc.body.innerHTML : doc.innerHTML || '';

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = bodyContent;

                // 1. Resolve and Inline CSS
                // We need to find all link tags and replace them with style tags
                // This fixes the "stylesheet not loaded" errors and ensures correct layout
                const links = tempDiv.querySelectorAll('link[rel="stylesheet"]');
                for (const link of links) {
                    const href = link.getAttribute('href');
                    if (href) {
                        try {
                            // Resolve relative path
                            const cssUrl = item.href ?
                                new URL(href, new URL(item.href, 'http://localhost')).pathname.substring(1) :
                                href;

                            const cssContent = await book.archive.getText(cssUrl);
                            if (cssContent) {
                                const style = document.createElement('style');
                                style.textContent = cssContent;
                                link.parentNode.replaceChild(style, link);
                            } else {
                                link.parentNode.removeChild(link); // Remove if empty/not found to avoid errors
                            }
                        } catch (cssError) {
                            console.warn(`Failed to inline CSS ${href}:`, cssError);
                            link.parentNode.removeChild(link); // Remove failed links
                        }
                    }
                }

                // 2. Resolve Images
                const images = tempDiv.querySelectorAll('img');
                for (const img of images) {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                        try {
                            const imgUrl = item.href ?
                                new URL(src, new URL(item.href, 'http://localhost')).pathname.substring(1) :
                                src;

                            const imgData = await book.archive.getBase64(imgUrl);
                            if (imgData) {
                                const ext = imgUrl.split('.').pop().toLowerCase();
                                const mimeTypes = {
                                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                                    'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp'
                                };
                                const mimeType = mimeTypes[ext] || 'image/jpeg';
                                img.setAttribute('src', `data:${mimeType};base64,${imgData}`);
                            }

                            img.style.maxWidth = '100%';
                            img.style.height = 'auto';
                            img.style.display = 'block';
                            img.style.margin = '1em auto';
                        } catch (imgError) {
                            console.warn(`Failed to load image ${src}:`, imgError);
                        }
                    }
                }

                // 3. Resolve Links
                const anchors = tempDiv.querySelectorAll('a');
                for (const link of anchors) {
                    const href = link.getAttribute('href');
                    if (href && href.startsWith('http')) {
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'noopener noreferrer');
                    }
                }

                // 4. Pre-render to calculate image dimensions
                const stagingContainer = document.createElement('div');
                Object.assign(stagingContainer.style, {
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px',
                    width: `${pageWidth}px`,
                    visibility: 'hidden'
                });
                // Apply same page styles to staging to ensure correct flow
                Object.assign(stagingContainer.style, PAGE_STYLES);

                stagingContainer.appendChild(tempDiv);
                document.body.appendChild(stagingContainer);

                // Wait for images to load
                const stagingImages = Array.from(tempDiv.querySelectorAll('img'));
                if (stagingImages.length > 0) {
                    await Promise.all(stagingImages.map(img => {
                        if (img.complete) return Promise.resolve();
                        return new Promise(resolve => {
                            img.onload = resolve;
                            img.onerror = resolve;
                            setTimeout(resolve, 2000);
                        });
                    }));
                }

                // Lock dimensions
                stagingImages.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        img.style.width = `${rect.width}px`;
                        img.style.height = `${rect.height}px`;
                        img.style.maxWidth = 'none';
                    }
                });

                // 5. Sanitize and Paginate
                const sanitizedHtml = sanitizeEpubHtml(tempDiv.innerHTML);
                document.body.removeChild(stagingContainer);

                const contentPages = await paginateContent(sanitizedHtml, measureContainer, pageHeight);

                // 6. Create Page Objects
                for (const pageContent of contentPages) {
                    // Convert PAGE_STYLES object to CSS string
                    const styleString = Object.entries(PAGE_STYLES)
                        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
                        .join('; ');

                    const enrichmentHtml = `
                        <div class="epub-content" style="${styleString}">
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
                console.warn(`Failed to load chapter ${i}:`, error);
                pages.push({
                    backgroundImage: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}"><rect width="100%" height="100%" fill="${backgroundColor}"/></svg>`)}`,
                    enrichmentHtml: `<div style="padding: 40px; color: red;">Error loading chapter: ${error.message}</div>`
                });
            }
        }
    } finally {
        if (measureContainer.parentNode) {
            measureContainer.parentNode.removeChild(measureContainer);
        }
    }

    return pages;
}

/**
 * Paginates HTML content using a recursive DOM walker
 * Ensures content fits within pageHeight without cutting text or images
 * @param {string} html - HTML content to paginate
 * @param {HTMLElement} measureContainer - Hidden container for measuring
 * @param {number} pageHeight - Target height for each page
 * @returns {Promise<Array<string>>} Array of HTML strings for each page
 */
async function paginateContent(html, measureContainer, pageHeight) {
    const pages = [];

    const sourceDiv = document.createElement('div');
    sourceDiv.innerHTML = html;

    let currentPageDiv = document.createElement('div');
    measureContainer.innerHTML = '';
    measureContainer.appendChild(currentPageDiv);

    const startNewPage = () => {
        if (currentPageDiv.childNodes.length > 0) {
            pages.push(currentPageDiv.innerHTML);
        }
        currentPageDiv = document.createElement('div');
        measureContainer.innerHTML = '';
        measureContainer.appendChild(currentPageDiv);
    };

    /**
     * Appends a node to the current page, handling overflow by splitting or moving to next page.
     * @param {Node} node - The node to process (from source)
     * @param {HTMLElement} targetParent - The element on the current page to append to
     * @param {Array<HTMLElement>} ancestors - Stack of ancestor elements to recreate on new page
     */
    const processNodeRecursive = (node, targetParent, ancestors) => {
        // Try to fit the whole node (deep clone) first
        const deepClone = node.cloneNode(true);
        targetParent.appendChild(deepClone);

        // Use clientHeight instead of pageHeight to account for padding
        // clientHeight = height - padding (with box-sizing: border-box)
        const fits = measureContainer.scrollHeight <= measureContainer.clientHeight;

        if (fits) {
            return;
        }

        targetParent.removeChild(deepClone);

        const isAtomic = node.nodeType === Node.TEXT_NODE ||
            (node.nodeType === Node.ELEMENT_NODE && ['IMG', 'BR', 'HR', 'VIDEO', 'AUDIO', 'INPUT', 'TABLE'].includes(node.tagName));

        if (isAtomic) {
            startNewPage();

            // Re-create ancestor path on the new page
            let currentNewParent = currentPageDiv;
            for (const ancestor of ancestors) {
                const ancestorClone = ancestor.cloneNode(false);
                currentNewParent.appendChild(ancestorClone);
                currentNewParent = ancestorClone;
            }

            currentNewParent.appendChild(deepClone);
            return { pageBroken: true };
        }

        // Container splitting
        const shallowClone = node.cloneNode(false);
        targetParent.appendChild(shallowClone);

        const childAncestors = [...ancestors, node];
        let currentTarget = shallowClone;

        for (const child of Array.from(node.childNodes)) {
            const result = processNodeRecursive(child, currentTarget, childAncestors);

            if (result && result.pageBroken) {
                // Find the new insertion point on the new page
                let pointer = currentPageDiv;
                for (const ancestor of childAncestors) {
                    if (pointer.lastElementChild) {
                        pointer = pointer.lastElementChild;
                    } else {
                        // Fallback: recreate path if missing (should not happen if logic is correct)
                        const aClone = ancestor.cloneNode(false);
                        pointer.appendChild(aClone);
                        pointer = aClone;
                    }
                }
                currentTarget = pointer;
            }
        }
    };

    for (const child of Array.from(sourceDiv.childNodes)) {
        const result = processNodeRecursive(child, currentPageDiv, []);
        // If page broke at top level, currentPageDiv is already updated
    }

    if (currentPageDiv.childNodes.length > 0) {
        pages.push(currentPageDiv.innerHTML);
    }

    return pages;
}

/**
 * Processes an EPUB file and returns page data for flipbook generation
 * @param {File|ArrayBuffer} input - The EPUB file or array buffer to process
 * @param {EpubProcessorOptions} options - Processing options
 * @returns {Promise<{pageCount: number, pages: Array, pageHeight: number}>}
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
        pages: enrichedPages,
        pageWidth: normalizedOptions.pageWidth,
        pageHeight: normalizedOptions.pageHeight
    };
}
