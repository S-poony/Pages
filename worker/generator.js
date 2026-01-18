/**
 * Cloudflare Worker Flipbook Generator
 * 
 * Server-side flipbook HTML generator that creates complete standalone flipbooks
 * from page images, links, and bookmarks. Designed to run in Cloudflare Workers.
 * 
 * This is a self-contained version that includes all necessary CSS inline.
 * The JavaScript is loaded from the published flipbook assets.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapeMap[char]);
}

/**
 * Escapes characters for safe use in HTML attributes
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeAttr(str) {
    if (typeof str !== 'string') return '';
    const attrEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '\n': '&#10;',
        '\r': '&#13;',
        '\t': '&#9;'
    };
    return str.replace(/[&<>"'\n\r\t]/g, char => attrEscapeMap[char]);
}

/**
 * Renders links as absolute positioned <a> tags
 * @param {Array} links - Array of link objects
 * @returns {string} HTML string of links
 */
function renderLinks(links) {
    if (!links || links.length === 0) return '';

    return links.map(link => {
        // Support both percentage and pixel formats
        const top = typeof link.rect.y === 'number' ? `${link.rect.y}%` : link.rect.y;
        const left = typeof link.rect.x === 'number' ? `${link.rect.x}%` : link.rect.x;
        const width = typeof link.rect.width === 'number' ? `${link.rect.width}%` : link.rect.width;
        const height = typeof link.rect.height === 'number' ? `${link.rect.height}%` : link.rect.height;

        const style = `top: ${top}; left: ${left}; width: ${width}; height: ${height}; position: absolute;`;

        let attr = '';
        if (link.type === 'external' && link.url) {
            attr = `href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer"`;
        } else if (link.type === 'internal' && link.targetPage) {
            attr = `href="javascript:void(0)" data-target-page="${link.targetPage}"`;
        }

        const title = link.title || (link.type === 'external' ? link.url : `Go to page ${link.targetPage}`);

        return `<a class="pdf-link" style="${style}" ${attr} title="${escapeAttr(title)}" data-source-top="${top}" data-source-left="${left}" data-source-width="${width}" data-source-height="${height}"></a>`;
    }).join('');
}

/**
 * Generates HTML for individual pages
 * @param {Array} pages - Array of page objects with imageUrl and optional links
 * @param {boolean} doubleSpread - Whether in double spread mode
 * @returns {string} HTML string for all pages
 */
function generatePagesHtml(pages, doubleSpread = false) {
    return pages.map((page, i) => {
        const pageNum = i + 1;
        const imageUrl = page.imageUrl || page.imageData;
        const links = page.links || [];

        const objectPosition = doubleSpread ? (pageNum % 2 === 0 ? 'left' : 'right') : 'center';
        const imgStyle = doubleSpread ? `style="object-position: ${objectPosition} center;"` : '';

        return `
<!-- =================================================================== -->
<!-- PAGE ${pageNum} -->
<!-- =================================================================== -->
<div class="page-container" data-density="soft">
  <img class="page-image" src="${escapeAttr(imageUrl)}" alt="" loading="eager" ${imgStyle} />
  <div class="enrichment-layer">
    ${renderLinks(links)}
  </div>
</div>
<!-- PAGE ${pageNum} END -->
<!-- =================================================================== -->`;
    }).join('');
}

/**
 * The CSS for the flipbook - embedded directly
 */
const FLIPBOOK_CSS = `
:root {
    --color-cream: #FDFBF8;
    --color-warm-gray: #E8E4D9;
    --color-charcoal: #2A2A2A;
    --color-terracotta: #C9785B;
    --color-terracotta-hover: #B8684F;
    --color-shadow: rgba(0, 0, 0, 0.04);
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: var(--color-cream);
    font-family: var(--font-sans);
    color: var(--color-charcoal);
}

#flipbook-wrapper {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    justify-content: center;
    align-items: center;
    perspective: 2000px;
    cursor: default;
}

#flipbook-container {
    position: relative;
    transition: transform 0.15s ease-out;
    transform-origin: center center;
    flex-shrink: 0;
    min-width: 100px;
    min-height: 100px;
}

#flipbook {
    position: relative;
    width: 100%;
    height: 100%;
}

.page-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    -webkit-user-drag: none;
    user-select: none;
    pointer-events: none;
}

.page-container {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 1500;
    background-color: white;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
}

.enrichment-layer {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    z-index: 1510;
    overflow: hidden;
}

.pdf-link {
    display: block;
    cursor: pointer;
    z-index: 1520;
    pointer-events: auto;
}

.pdf-link:hover {
    background-color: rgba(255, 255, 0, 0.2);
}

#controls-panel {
    position: fixed;
    bottom: max(24px, env(safe-area-inset-bottom, 0px) + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 12px 24px;
    border-radius: 30px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.05);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    justify-items: center;
    gap: 16px;
    z-index: 2000;
    opacity: 0.3;
    transition: opacity 0.3s ease, transform 0.3s ease;
    max-width: calc(100vw - 32px);
    min-width: 180px;
}

#toc-btn { grid-column: 1; justify-self: start; }
.page-input-container { grid-column: 2; }
#page-links-btn { grid-column: 3; justify-self: end; }

#controls-panel:hover, #controls-panel.active {
    opacity: 1;
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 4px;
    background: var(--color-warm-gray);
    border-radius: 2px;
    outline: none;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-terracotta);
    cursor: pointer;
    transition: 0.2s;
}

#page-input {
    width: 40px;
    text-align: center;
    border: 1px solid var(--color-warm-gray);
    border-radius: 4px;
    padding: 4px;
    font-family: var(--font-sans);
    color: var(--color-charcoal);
    font-size: 14px;
    -moz-appearance: textfield;
    appearance: textfield;
}

#page-input::-webkit-outer-spin-button,
#page-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
}

.page-input-container {
    display: flex;
    align-items: center;
    gap: 4px;
}

.page-nav-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--color-charcoal);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
}

.page-nav-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
    color: var(--color-terracotta);
}

#top-controls-panel {
    position: fixed;
    top: max(24px, env(safe-area-inset-top, 0px) + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 8px 16px;
    border-radius: 30px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    gap: 16px;
    z-index: 2000;
    opacity: 0.3;
    transition: opacity 0.3s ease, transform 0.3s ease;
}

#top-controls-panel:hover, #top-controls-panel.active {
    opacity: 1;
    transform: translateX(-50%) translateY(2px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.zoom-controls {
    display: flex;
    align-items: center;
    gap: 12px;
}

.icon-btn, #fullscreen-btn {
    background: none;
    border: none;
    color: var(--color-charcoal);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    border-radius: 4px;
}

.icon-btn:hover, #fullscreen-btn:hover {
    color: var(--color-terracotta);
    background-color: rgba(0, 0, 0, 0.05);
}

.toc-modal {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.toc-modal.hidden { display: none; }

.toc-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
}

.toc-content {
    position: relative;
    background: white;
    width: 90vw;
    max-width: 400px;
    max-height: 85dvh;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.toc-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-warm-gray);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-cream);
}

.toc-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-charcoal);
}

#toc-close-btn, #links-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-charcoal);
    padding: 4px;
    border-radius: 4px;
}

.toc-list {
    padding: 10px 0;
    overflow-y: auto;
    flex: 1;
}

#links-modal .toc-content { max-width: 550px; }

.toc-item {
    padding: 10px 20px;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 15px;
    color: var(--color-charcoal);
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-decoration: none;
}

.toc-item:hover { color: var(--color-terracotta); }

#zoom-level, .page-count {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-charcoal);
    min-width: 3em;
    text-align: center;
}

#loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background-color: var(--color-cream);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: opacity 0.5s ease-out;
}

#loading-screen.hidden {
    opacity: 0;
    pointer-events: none;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-warm-gray);
    border-top: 4px solid var(--color-terracotta);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

.loading-text {
    color: var(--color-terracotta);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.5px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.link-preview-container {
    width: 25vw;
    max-width: 180px;
    max-height: 108px;
    border-radius: 6px;
    overflow: hidden;
    margin-right: 12px;
    border: 1px solid var(--color-warm-gray);
    flex-shrink: 0;
    background: #fcfcfc;
    position: relative;
}

.toc-item-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 2px;
}

.toc-item-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
}

.toc-item-page {
    font-size: 11px;
    color: #888;
}
`;

/**
 * Generates a complete flipbook HTML document
 * 
 * @param {Object} options - Generation options
 * @param {string} options.title - Flipbook title
 * @param {boolean} options.doubleSpread - Double spread mode
 * @param {Array} options.pages - Array of page objects with imageUrl and links
 * @param {Array} options.bookmarks - Array of bookmark objects for TOC
 * @param {string} options.jsUrl - URL to the flipbook JavaScript bundle
 * @returns {string} Complete HTML document
 */
export function generateFlipbookHtml(options) {
    const {
        title = 'Flipbook',
        doubleSpread = false,
        pages = [],
        bookmarks = [],
        jsUrl = ''
    } = options;

    if (!Array.isArray(pages) || pages.length < 1) {
        throw new Error('pages must be an array with at least one page');
    }

    const pagesHtml = generatePagesHtml(pages, doubleSpread);
    const actualPageCount = pages.length;

    // Add blank page at end if odd number of pages
    const needsBlankPage = actualPageCount % 2 !== 0;
    const blankPageHtml = needsBlankPage
        ? '<div class="page-container" data-density="soft" style="background-color: white;"></div>'
        : '';

    // Calculate aspect ratio from first page if dimensions provided
    let aspectRatio = 0.707; // Default A4-ish
    if (pages[0].width && pages[0].height) {
        aspectRatio = pages[0].width / pages[0].height;
    }

    // Build table of contents data
    const tocData = bookmarks.map(b => ({
        title: b.title,
        page: b.page
    }));

    // Build page links data for the links modal
    const pageLinks = pages.map((p, i) => ({
        pageNum: i + 1,
        links: (p.links || []).map(link => ({
            type: link.type,
            title: link.title || (link.type === 'external' ? link.url : `Page ${link.targetPage}`),
            url: link.url,
            targetPage: link.targetPage,
            rect: link.rect
        }))
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>${FLIPBOOK_CSS}</style>
</head>
<body>
    <div id="loading-screen">
        <div class="spinner"></div>
        <div class="loading-text">Loading Pages...</div>
    </div>

    <div id="flipbook-wrapper">
        <div id="flipbook-container">
            <div id="flipbook" data-double-spread="${doubleSpread}">${pagesHtml}${blankPageHtml}</div>
        </div>
        <div id="top-controls-panel">
            <div class="zoom-controls">
                <input type="range" id="zoom-slider" min="1" max="3" step="0.05" value="1" aria-label="Zoom">
                <div id="zoom-level">1x</div>
            </div>
            <button id="fullscreen-btn" aria-label="Toggle Fullscreen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
            </button>
        </div>
        <div id="controls-panel">
            <button id="toc-btn" class="icon-btn" aria-label="Table of Contents" style="${tocData.length > 0 ? '' : 'display: none;'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M3 12h18M3 18h18"/>
                </svg>
            </button>

            <div class="page-input-container">
                <button id="prev-page-btn" class="page-nav-btn" aria-label="Previous Page">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <input type="number" id="page-input" min="2" max="${actualPageCount}" value="2">
                <button id="next-page-btn" class="page-nav-btn" aria-label="Next Page">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </button>
            </div>
            
            <button id="page-links-btn" class="icon-btn" aria-label="Page Links" style="display: none;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </button>
        </div>

        <div id="toc-modal" class="toc-modal hidden">
            <div class="toc-overlay"></div>
            <div class="toc-content">
                <div class="toc-header">
                    <h2>Table of Contents</h2>
                    <button id="toc-close-btn" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="toc-list" class="toc-list"></div>
            </div>
        </div>

        <div id="links-modal" class="toc-modal hidden">
            <div class="toc-overlay"></div>
            <div class="toc-content">
                <div class="toc-header">
                    <h2>Page Links</h2>
                    <button id="links-close-btn" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="links-list" class="toc-list"></div>
            </div>
        </div>
    </div>
    <script>
        window.FLIPBOOK_CONFIG = {
            pageCount: ${actualPageCount},
            doubleSpread: ${doubleSpread},
            pageAspectRatio: ${aspectRatio},
            linkMap: {},
            tableOfContents: ${JSON.stringify(tocData)},
            pageLinks: ${JSON.stringify(pageLinks)}
        };
    </script>
    <script src="${escapeAttr(jsUrl)}"></script>
</body>
</html>`;
}
