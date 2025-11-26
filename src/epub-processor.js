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
import JSZip from 'jszip';
import { sanitizeEpubHtml } from './sanitizer.js';

/**
 * Validates and normalizes EPUB processor options
 * @param {EpubProcessorOptions} options - Raw options
 * @returns {EpubProcessorOptions} Normalized options
 */
export function normalizeEpubProcessorOptions(options = {}) {
    const {
        pageWidth = 600,
        backgroundColor = '#ffffff'
    } = options;

    let { pageHeight } = options;

    if (!Number.isFinite(pageWidth) || pageWidth <= 0) {
        throw new Error('pageWidth must be a positive number');
    }

    if (pageHeight === undefined) {
        // Default aspect ratio 2:3 (portrait)
        pageHeight = Math.round(pageWidth * 1.5);
    } else if (!Number.isFinite(pageHeight) || pageHeight <= 0) {
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
 * @param {JSZip} zip - JSZip instance containing the EPUB files
 * @param {EpubProcessorOptions} options - Processing options
 * @returns {Promise<Array<{backgroundImage: string, enrichmentHtml: string}>>}
 */
async function createEnrichedPages(book, zip, options) {
    const { pageWidth, pageHeight, backgroundColor } = options;
    const pages = [];
    const spineItems = book.spine.spineItems;

    // Determine the Base Path (directory containing the OPF file)
    const opfPath = book.packageUrl || ''; // e.g. "OEBPS/content.opf"
    const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    console.log('=== EPUB PATH DEBUG ===');
    console.log('Package URL:', opfPath);
    console.log('Calculated Base Path:', basePath);

    const PAGE_STYLES = {
        padding: '40px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        lineHeight: '1.6',
        color: '#000000',
        textAlign: 'justify'
    };

    const measureContainer = document.createElement('div');
    measureContainer.style.position = 'absolute';
    measureContainer.style.left = '-9999px';
    measureContainer.style.top = '-9999px';
    measureContainer.style.width = `${pageWidth}px`;
    measureContainer.style.height = `${pageHeight}px`;
    Object.assign(measureContainer.style, PAGE_STYLES);
    measureContainer.style.visibility = 'hidden';
    document.body.appendChild(measureContainer);

    // Helper to find a file in the zip case-insensitively or with URL decoding
    const findFileInZip = (path) => {
        const files = Object.keys(zip.files);

        // 1. Try exact match
        if (zip.file(path)) return zip.file(path);

        // 2. Try URL decoded path
        const decoded = decodeURIComponent(path);
        if (zip.file(decoded)) return zip.file(decoded);

        // 3. Try case-insensitive search (slower but robust)
        const lowerPath = path.toLowerCase();
        for (const file of files) {
            if (file.toLowerCase() === lowerPath) return zip.file(file);
        }

        // 4. Try URL decoded case-insensitive
        const lowerDecoded = decoded.toLowerCase();
        for (const file of files) {
            if (file.toLowerCase() === lowerDecoded) return zip.file(file);
        }

        // 5. Try finding by basename (ignoring directory) - Fallback for messy paths
        const targetBasename = path.split('/').pop().toLowerCase();
        for (const file of files) {
            const fileBasename = file.split('/').pop().toLowerCase();
            if (fileBasename === targetBasename) {
                console.log(`Found file by basename match: ${file} (requested: ${path})`);
                return zip.file(file);
            }
        }

        return null;
    };

    try {
        for (let i = 0; i < spineItems.length; i++) {
            const item = spineItems[i];
            try {
                // console.log(`Processing Chapter ${i + 1}/${spineItems.length}: ${item.href}`);

                const doc = await item.load(book.load.bind(book));
                let bodyContent = doc.body ? doc.body.innerHTML : doc.innerHTML || '';

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = bodyContent;

                // 1. Resolve Images using JSZip directly
                const images = tempDiv.querySelectorAll('img');
                for (const img of images) {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                        try {
                            // Calculate absolute path within the zip
                            // item.href is relative to the OPF file location (basePath)
                            // src is relative to item.href

                            // Get the directory of the current chapter file
                            // item.href e.g. "Text/chapter1.xhtml" -> "Text/"
                            // If item.href is just "chapter1.xhtml", dir is ""
                            const chapterUrl = item.href;
                            const chapterDir = chapterUrl.includes('/') ? chapterUrl.substring(0, chapterUrl.lastIndexOf('/') + 1) : '';

                            // Combine base path (OPF loc), chapter dir, and src
                            // But wait, item.href is usually relative to the package root (OPF location)?
                            // Actually, in epub.js:
                            // book.packageUrl is the OPF path (e.g. OEBPS/content.opf)
                            // item.href is relative to the OPF folder.

                            // So full path in zip = basePath + (resolve src relative to item.href)

                            // Let's use URL object for robust relative path resolution
                            // We construct a fake base URL to handle the resolution
                            const fakeBase = 'http://fake.root/';
                            const chapterBaseUrl = new URL(basePath + item.href, fakeBase);
                            const resolvedUrl = new URL(src, chapterBaseUrl);

                            // Extract the path relative to the fake root (remove leading /)
                            let zipPath = resolvedUrl.pathname.substring(1);

                            // console.log(`Resolving image: ${src}`);
                            // console.log(`  Chapter href: ${item.href}`);
                            // console.log(`  Base path: ${basePath}`);
                            // console.log(`  Calculated Zip Path: ${zipPath}`);

                            const file = findFileInZip(zipPath);

                            if (file) {
                                const base64 = await file.async('base64');

                                // Determine MIME type
                                const ext = zipPath.split('.').pop().toLowerCase();
                                const mimeTypes = {
                                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                                    'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml'
                                };
                                const mimeType = mimeTypes[ext] || 'application/octet-stream';

                                const dataUrl = `data:${mimeType};base64,${base64}`;
                                img.setAttribute('src', dataUrl);
                            } else {
                                console.warn(`Image file not found in zip: ${zipPath}`);
                                console.warn('Available files in zip:', Object.keys(zip.files));
                                img.setAttribute('alt', `[Missing Image: ${src}]`);
                            }

                        } catch (imgError) {
                            console.warn(`Failed to load image ${src}:`, imgError);
                            img.removeAttribute('src');
                            img.setAttribute('alt', `[Broken Image: ${src}]`);
                        }
                    }

                    // Always apply styles
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.margin = '1em auto';
                }

                // 2. Resolve CSS (Simplified - mostly works with epub.js default, but we can enhance if needed)
                // For now, we'll leave CSS loading as is or rely on inline styles which are common in EPUBs
                // If external CSS fails, we might need a similar zip-based approach, but images are the priority.
                const links = tempDiv.querySelectorAll('link[rel="stylesheet"]');
                for (const link of links) {
                    const href = link.getAttribute('href');
                    if (href) {
                        const chapterBaseUrl = new URL(item.href, 'http://epub-internal/');
                        const resolvedUrl = new URL(href, chapterBaseUrl);
                        const relativePath = decodeURIComponent(resolvedUrl.pathname.substring(1));
                        const absolutePath = basePath + relativePath;

                        // Attempt to load CSS using epub.js's book.load (which uses the internal zip reader)
                        // This is kept for now as it generally works for CSS.
                        try {
                            const cssData = await book.load(absolutePath);
                            if (typeof cssData === 'string') {
                                const style = document.createElement('style');
                                style.textContent = cssData;
                                link.parentNode.replaceChild(style, link);
                            } else {
                                link.remove();
                            }
                        } catch (cssError) {
                            console.warn(`Failed to load CSS ${href} from ${absolutePath}:`, cssError);
                            link.remove();
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
                stagingContainer.style.position = 'absolute';
                stagingContainer.style.left = '-9999px';
                stagingContainer.style.top = '-9999px';
                stagingContainer.style.width = `${pageWidth}px`;
                stagingContainer.style.opacity = '0'; // Visible to browser, invisible to user
                stagingContainer.style.pointerEvents = 'none';
                Object.assign(stagingContainer.style, PAGE_STYLES);

                stagingContainer.appendChild(tempDiv);
                document.body.appendChild(stagingContainer);

                // Force layout/reflow
                stagingContainer.offsetHeight;

                // Wait for all images to decode
                const stagingImages = Array.from(tempDiv.querySelectorAll('img'));
                await Promise.all(stagingImages.map(img => {
                    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                        setTimeout(resolve, 5000);
                    });
                }));

                // Force another layout pass
                stagingContainer.offsetHeight;

                // Lock dimensions using natural dimensions (most reliable)
                stagingImages.forEach(img => {
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        // Use natural dimensions for final HTML
                        img.setAttribute('width', img.naturalWidth);
                        img.setAttribute('height', img.naturalHeight);
                        img.style.width = `${img.naturalWidth}px`;
                        img.style.height = `${img.naturalHeight}px`;
                        img.style.maxWidth = 'none';
                    }
                });

                // 5. Sanitize and Paginate
                const sanitizedHtml = sanitizeEpubHtml(tempDiv.innerHTML);
                document.body.removeChild(stagingContainer);
                const contentPages = await paginateContent(sanitizedHtml, measureContainer, pageHeight);

                // 6. Create Page Objects
                for (const pageContent of contentPages) {
                    const commonStyles = Object.entries(PAGE_STYLES)
                        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
                        .join('; ');

                    const enrichmentHtml = `
                        <div class="epub-content" style="
                            width: ${pageWidth}px;
                            height: ${pageHeight}px;
                            ${commonStyles};
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

    // Load zip directly for asset extraction
    const zip = await JSZip.loadAsync(arrayBuffer);

    const enrichedPages = await createEnrichedPages(book, zip, normalizedOptions);

    return {
        pageCount: enrichedPages.length,
        pages: enrichedPages,
        pageWidth: normalizedOptions.pageWidth,
        pageHeight: normalizedOptions.pageHeight
    };
}