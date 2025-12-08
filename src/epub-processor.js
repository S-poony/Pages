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
import EPUB_DEFAULTS_CSS_RAW from './epub-defaults.css?raw';

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
 * @returns {Promise<{pages: Array<{backgroundImage: string, enrichmentHtml: string}>, linkMap: Object}>}
 */
export async function createEnrichedPages(book, zip, options) {
    const { pageWidth, pageHeight, backgroundColor } = options;
    const pages = [];
    const linkMap = {}; // Global map of "path/to/chapter.xhtml#anchor" -> globalPageIndex
    let globalPageIndex = 0;
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
    measureContainer.className = 'epub-content epub-measure-container'; // Match final class for exact styling
    measureContainer.style.position = 'absolute';
    measureContainer.style.left = '-9999px';
    measureContainer.style.top = '-9999px';
    measureContainer.style.width = `${pageWidth}px`;
    measureContainer.style.height = 'auto'; // Allow container to grow to measure content
    Object.assign(measureContainer.style, PAGE_STYLES);
    measureContainer.style.visibility = 'hidden';

    // Inject default styles to ensure measurement matches final output
    // We append to document.head to ensure it persists even when measureContainer.innerHTML is cleared
    const styleEl = document.createElement('style');
    styleEl.textContent = EPUB_DEFAULTS_CSS;
    document.head.appendChild(styleEl);

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
                return zip.file(file);
            }
        }

        return null;
    };

    try {
        // Ensure fonts are loaded before measuring to avoid layout shifts
        await document.fonts.ready;

        for (let i = 0; i < spineItems.length; i++) {
            const item = spineItems[i];
            try {

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
                    // REMOVED: img.style.display = 'block';
                    // REMOVED: img.style.margin = '1em auto';
                    // Allow images to be inline (default) or whatever the EPUB CSS specifies
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
                    if (href) {
                        if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('data:')) {
                            link.setAttribute('target', '_blank');
                            link.setAttribute('rel', 'noopener noreferrer');
                        } else {
                            // Internal Link
                            // Resolve href relative to current spine item
                            // item.href is relative to OPF.
                            // We want a canonical path for the linkMap.
                            // Let's use the path relative to the OPF root as the key.

                            try {
                                const chapterBaseUrl = new URL(item.href, 'http://epub-internal/');
                                const resolvedUrl = new URL(href, chapterBaseUrl);
                                // pathname has leading slash, remove it
                                const resolvedPath = decodeURIComponent(resolvedUrl.pathname.substring(1));
                                const hash = resolvedUrl.hash; // includes #

                                const fullLink = resolvedPath + hash;

                                link.setAttribute('data-epub-href', fullLink);
                                link.setAttribute('href', 'javascript:void(0)'); // Disable default nav
                                link.style.cursor = 'pointer';
                            } catch (e) {
                                console.warn('Failed to resolve internal link', href, e);
                            }
                        }
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

                // Paginate and get anchors
                const { pages: contentPages, anchors: pageAnchors } = await paginateContent(sanitizedHtml, measureContainer, pageHeight);

                // Register Chapter Start
                // item.href is the path relative to OPF root
                linkMap[decodeURIComponent(item.href)] = globalPageIndex + 1; // 1-based index

                // Register Anchors
                for (const [anchorId, localPageIndex] of Object.entries(pageAnchors)) {
                    const fullKey = decodeURIComponent(item.href) + '#' + anchorId;
                    linkMap[fullKey] = globalPageIndex + localPageIndex + 1; // 1-based index
                }

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

                globalPageIndex += contentPages.length;

            } catch (error) {
                console.warn(`Failed to load chapter ${i}:`, error);
                pages.push({
                    backgroundImage: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}"><rect width="100%" height="100%" fill="${backgroundColor}"/></svg>`)}`,
                    enrichmentHtml: `<div style="padding: 40px; color: red;">Error loading chapter: ${error.message}</div>`
                });
                globalPageIndex++;
            }
        }
    } finally {
        if (measureContainer.parentNode) {
            measureContainer.parentNode.removeChild(measureContainer);
        }
        if (styleEl && styleEl.parentNode) {
            styleEl.parentNode.removeChild(styleEl);
        }
    }

    return { pages, linkMap };
}

/**
 * Paginates HTML content using a recursive DOM walker
 * Ensures content fits within pageHeight without cutting text or images
 * @param {string} html - HTML content to paginate
 * @param {HTMLElement} measureContainer - Hidden container for measuring
 * @param {number} pageHeight - Target height for each page
 * @returns {Promise<{pages: Array<string>, anchors: Object}>} Array of HTML strings for each page and anchor map
 */
export async function paginateContent(html, measureContainer, pageHeight) {
    const pages = [];
    const anchors = {}; // Map of anchorId -> pageIndex (0-based within this chapter)
    const sourceDiv = document.createElement('div');
    sourceDiv.innerHTML = html;

    let currentPageDiv = document.createElement('div');
    currentPageDiv.style.display = 'flow-root'; // Contain child margins
    measureContainer.innerHTML = '';
    measureContainer.appendChild(currentPageDiv);

    const checkOverflow = () => {
        // Use offsetHeight of the container which includes padding and content
        // Since measureContainer has height: auto, it grows with content
        const currentHeight = measureContainer.offsetHeight;

        // Target height is the fixed page height
        // We subtract the safety margin from the page height
        const safetyMargin = 100;

        return currentHeight > (pageHeight - safetyMargin);
    };

    const startNewPage = () => {
        if (currentPageDiv.childNodes.length > 0) {
            pages.push(currentPageDiv.innerHTML);
        }
        currentPageDiv = document.createElement('div');
        currentPageDiv.style.display = 'flow-root'; // Contain child margins
        measureContainer.innerHTML = '';
        measureContainer.appendChild(currentPageDiv);
    };

    const processNodeRecursive = (node, targetParent, ancestors) => {
        const deepClone = node.cloneNode(true);
        targetParent.appendChild(deepClone);

        // Track ID if present
        if (node.nodeType === Node.ELEMENT_NODE && node.id) {
            anchors[node.id] = pages.length; // Current page index
        }

        // FIX: Use precise overflow check
        const fits = !checkOverflow();

        if (fits) {
            return;
        }

        targetParent.removeChild(deepClone);

        // FIX: Don't treat text nodes as atomic - split them instead
        const isAtomic = node.nodeType === Node.ELEMENT_NODE &&
            ['IMG', 'BR', 'HR', 'VIDEO', 'AUDIO', 'INPUT', 'TABLE'].includes(node.tagName);

        if (isAtomic) {
            startNewPage();
            let currentNewParent = currentPageDiv;
            for (const ancestor of ancestors) {
                const ancestorClone = ancestor.cloneNode(false);
                currentNewParent.appendChild(ancestorClone);
                currentNewParent = ancestorClone;
            }
            currentNewParent.appendChild(deepClone);
            return { pageBroken: true };
        }

        // Handle text nodes by splitting at word boundaries
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            const words = text.split(/(\s+)/); // Split preserving spaces

            let currentParent = targetParent;
            let hasBrokenPage = false;

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (!word) continue;

                const textNode = document.createTextNode(word);
                currentParent.appendChild(textNode);

                // Check fit with precise overflow
                if (checkOverflow()) {
                    textNode.remove();

                    // If the page is empty, we MUST accept the word to avoid infinite loop
                    if (currentParent.childNodes.length === 0) {
                        currentParent.appendChild(textNode);
                        continue;
                    }

                    // Page is not empty, so break page
                    startNewPage();
                    hasBrokenPage = true;

                    // Recreate ancestor path on new page
                    let newParent = currentPageDiv;
                    for (const ancestor of ancestors) {
                        const clone = ancestor.cloneNode(false);
                        newParent.appendChild(clone);
                        newParent = clone;
                    }

                    currentParent = newParent;
                    currentParent.appendChild(textNode);
                }
            }

            if (hasBrokenPage) {
                return { pageBroken: true };
            }
            return;
        }

        // Container splitting for element nodes
        const shallowClone = node.cloneNode(false);
        targetParent.appendChild(shallowClone);
        const childAncestors = [...ancestors, node];
        let currentTarget = shallowClone;

        for (const child of Array.from(node.childNodes)) {
            const result = processNodeRecursive(child, currentTarget, childAncestors);
            if (result && result.pageBroken) {
                let pointer = currentPageDiv;
                for (const ancestor of childAncestors) {
                    if (pointer.lastElementChild) {
                        pointer = pointer.lastElementChild;
                    } else {
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
        processNodeRecursive(child, currentPageDiv, []);
    }

    if (currentPageDiv.childNodes.length > 0) {
        pages.push(currentPageDiv.innerHTML);
    }

    return { pages, anchors };
}

/**
 * Extracts the Table of Contents from the EPUB and maps it to page numbers
 * @param {Object} book - EPUB book object
 * @param {Object} linkMap - Map of paths to page numbers
 * @returns {Array} Structured Table of Contents
 */
export function extractTableOfContents(book, linkMap) {
    const toc = book.navigation.toc;
    if (!toc || toc.length === 0) return [];

    function processItems(items) {
        const result = [];
        for (const item of items) {
            const href = decodeURIComponent(item.href);
            // Try exact match first
            let page = linkMap[href];

            // If not found, try to find by checking if it's a chapter path
            if (!page) {
                // Sometimes TOC href has ../ prefix or different base
                // We'll try to find a matching key in linkMap
                // This is a simple heuristic
                const normalizedHref = href.replace(/^\.\.\//, ''); // Remove leading ../

                // Try to find if any key ends with this href
                const key = Object.keys(linkMap).find(k => k.endsWith(normalizedHref));
                if (key) {
                    page = linkMap[key];
                }
            }

            if (page) {
                const entry = {
                    title: item.label.trim(),
                    page: page
                };

                if (item.subitems && item.subitems.length > 0) {
                    const children = processItems(item.subitems);
                    if (children.length > 0) {
                        entry.children = children;
                    }
                }

                result.push(entry);
            }
        }
        return result;
    }

    return processItems(toc);
}

/**
 * Processes an EPUB file and returns page data for flipbook generation
 * @param {File|ArrayBuffer} input - The EPUB file or array buffer to process
 * @param {EpubProcessorOptions} options - Processing options
 * @returns {Promise<{pageCount: number, pages: Array, pageHeight: number, linkMap: Object, tableOfContents: Array}>}
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

    // Extract title from EPUB metadata
    let epubTitle = '';
    try {
        epubTitle = book.package?.metadata?.title || '';
    } catch (e) {
        console.warn('Failed to extract EPUB title:', e);
    }

    // Load zip directly for asset extraction
    const zip = await JSZip.loadAsync(arrayBuffer);

    const { pages: enrichedPages, linkMap } = await createEnrichedPages(book, zip, normalizedOptions);

    // Extract TOC
    const tableOfContents = extractTableOfContents(book, linkMap);

    return {
        pageCount: enrichedPages.length,
        pages: enrichedPages,
        pageWidth: normalizedOptions.pageWidth,
        pageHeight: normalizedOptions.pageHeight,
        css: EPUB_DEFAULTS_CSS, // Return the CSS so it can be injected into the final flipbook
        linkMap,
        tableOfContents,
        title: epubTitle
    };
}

const EPUB_DEFAULTS_CSS = EPUB_DEFAULTS_CSS_RAW;