/**
 * EPUB Enrichment Module
 * Heavily modifies the raw EPUB content by resolving internal asset paths (images, CSS),
 * sanitizing HTML, and mapping internal chapter links to the generated flipbook pages.
 */

import { sanitizeEpubHtml } from '../common/sanitizer.js';
import { paginateContent } from './pagination.js';

/**
 * Helper to find a file in the zip case-insensitively or with URL decoding
 */
export const findFileInZip = (zip, path) => {
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

/**
 * Creates enriched HTML pages from EPUB content with proper pagination
 * @param {Object} book - EPUB book object
 * @param {JSZip} zip - JSZip instance containing the EPUB files
 * @param {EpubProcessorOptions} options - Processing options
 * @param {string} epubDefaultsCss - Default CSS to inject
 * @returns {Promise<{pages: Array<{backgroundImage: string, enrichmentHtml: string}>, linkMap: Object}>}
 */
export async function createEnrichedPages(book, zip, options, epubDefaultsCss = '') {
    const { pageWidth, pageHeight, backgroundColor, fontSize } = options;
    const pages = [];
    const linkMap = {}; // Global map of "path/to/chapter.xhtml#anchor" -> globalPageIndex
    let globalPageIndex = 0;
    const spineItems = book.spine.spineItems;

    // Determine the Base Path (directory containing the OPF file)
    const opfPath = book.packageUrl || ''; // e.g. "OEBPS/content.opf"
    const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    const PAGE_STYLES = {
        padding: '40px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'Georgia, serif',
        fontSize: `${fontSize}px`,
        lineHeight: '1.6',
        color: '#000000',
        textAlign: 'justify'
    };

    // Inject Font Size Override into the main document (mostly for measurement)
    let styleOverride = document.getElementById('epub-font-size-override');
    if (!styleOverride) {
        styleOverride = document.createElement('style');
        styleOverride.id = 'epub-font-size-override';
        document.head.appendChild(styleOverride);
    }
    styleOverride.textContent = `
        .epub-staging-container, .epub-measure-container, .epub-content {
            font-size: ${fontSize}px !important;
        }
        .epub-staging-container *, .epub-measure-container *, .epub-content * {
            font-size: 1em !important;
        }
    `;

    // Use a single measure container for the entire process
    let measureContainer = document.querySelector('.epub-measure-container');
    if (!measureContainer) {
        measureContainer = document.createElement('div');
        measureContainer.className = 'epub-content epub-measure-container';
        measureContainer.style.position = 'absolute';
        measureContainer.style.left = '-9999px';
        measureContainer.style.top = '-9999px';
        measureContainer.style.visibility = 'hidden';
        document.body.appendChild(measureContainer);
    }
    measureContainer.style.width = `${pageWidth}px`;
    measureContainer.style.height = 'auto';
    Object.assign(measureContainer.style, PAGE_STYLES);

    // Inject default styles once
    let styleEl = document.getElementById('epub-default-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'epub-default-styles';
        document.head.appendChild(styleEl);
    }
    if (epubDefaultsCss && styleEl.textContent !== epubDefaultsCss) {
        styleEl.textContent = epubDefaultsCss;
    }

    try {
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
                            const chapterUrl = item.href;
                            const chapterBaseUrl = new URL(basePath + chapterUrl, 'http://fake.root/');
                            const resolvedUrl = new URL(src, chapterBaseUrl);
                            let zipPath = resolvedUrl.pathname.substring(1);

                            const file = findFileInZip(zip, zipPath);
                            if (file) {
                                const base64 = await file.async('base64');
                                const ext = zipPath.split('.').pop().toLowerCase();
                                const mimeTypes = {
                                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
                                    'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml'
                                };
                                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                                img.setAttribute('src', `data:${mimeType};base64,${base64}`);
                            } else {
                                img.setAttribute('alt', `[Missing Image: ${src}]`);
                            }
                        } catch (imgError) {
                            console.warn(`Failed to load image ${src}:`, imgError);
                            img.removeAttribute('src');
                            img.setAttribute('alt', `[Broken Image: ${src}]`);
                        }
                    }
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                }

                // 2. Resolve CSS
                const links = tempDiv.querySelectorAll('link[rel="stylesheet"]');
                for (const link of links) {
                    const href = link.getAttribute('href');
                    if (href) {
                        const chapterBaseUrl = new URL(item.href, 'http://epub-internal/');
                        const resolvedUrl = new URL(href, chapterBaseUrl);
                        const relativePath = decodeURIComponent(resolvedUrl.pathname.substring(1));
                        const absolutePath = basePath + relativePath;

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
                            try {
                                const chapterBaseUrl = new URL(item.href, 'http://epub-internal/');
                                const resolvedUrl = new URL(href, chapterBaseUrl);
                                const resolvedPath = decodeURIComponent(resolvedUrl.pathname.substring(1));
                                const hash = resolvedUrl.hash;
                                const fullLink = resolvedPath + hash;

                                link.setAttribute('data-epub-href', fullLink);
                                link.setAttribute('href', 'javascript:void(0)');
                                link.style.cursor = 'pointer';
                            } catch (e) {
                                console.warn('Failed to resolve internal link', href, e);
                            }
                        }
                    }
                }

                // 4. Pre-render to calculate dimensions
                let stagingContainer = document.querySelector('.epub-staging-container');
                if (!stagingContainer) {
                    stagingContainer = document.createElement('div');
                    stagingContainer.className = 'epub-staging-container';
                    stagingContainer.style.position = 'absolute';
                    stagingContainer.style.left = '-9999px';
                    stagingContainer.style.top = '-9999px';
                    stagingContainer.style.opacity = '0';
                    stagingContainer.style.pointerEvents = 'none';
                    document.body.appendChild(stagingContainer);
                }
                stagingContainer.style.width = `${pageWidth}px`;
                Object.assign(stagingContainer.style, PAGE_STYLES);
                stagingContainer.innerHTML = '';
                stagingContainer.appendChild(tempDiv);
                stagingContainer.offsetHeight;

                const stagingImages = Array.from(tempDiv.querySelectorAll('img'));
                await Promise.all(stagingImages.map(img => {
                    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                    return new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                        setTimeout(resolve, 5000);
                    });
                }));
                stagingContainer.offsetHeight;

                stagingImages.forEach(img => {
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        img.setAttribute('width', img.naturalWidth);
                        img.setAttribute('height', img.naturalHeight);
                        img.style.width = `${img.naturalWidth}px`;
                        img.style.height = `${img.naturalHeight}px`;
                        img.style.maxWidth = 'none';
                    }
                });

                // 5. Sanitize and Paginate
                const sanitizedHtml = sanitizeEpubHtml(tempDiv.innerHTML);
                stagingContainer.innerHTML = '';

                // Chapter-start selectors to force a new page
                const forceBreakSelector = 'h1, h2, h3, .chapter, [style*="page-break-before: always"]';

                const { pages: contentPages, anchors: pageAnchors } = await paginateContent(
                    sanitizedHtml,
                    measureContainer,
                    pageHeight,
                    forceBreakSelector
                );

                linkMap[decodeURIComponent(item.href)] = globalPageIndex + 1;
                for (const [anchorId, localPageIndex] of Object.entries(pageAnchors)) {
                    const fullKey = decodeURIComponent(item.href) + '#' + anchorId;
                    linkMap[fullKey] = globalPageIndex + localPageIndex + 1;
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
        if (measureContainer) measureContainer.innerHTML = '';
    }

    return { pages, linkMap };
}
