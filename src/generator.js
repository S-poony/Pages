/**
 * Flipbook HTML Generator
 * Creates a standalone HTML file with embedded CSS, JavaScript, and page images
 * Supports both legacy format (array of data URLs) and responsive format (array of variants)
 *
 * @typedef {Object} GeneratorOptions
 * @property {string} title - Title of the flipbook
 * @property {boolean} doubleSpread - Whether to enable double spread mode
 */

/**
 * Interface for loading CSS and JS content
 * @typedef {Object} AssetLoader
 * @property {Function} loadCss - Function to load CSS content
 * @property {Function} loadJs - Function to load JS content
 */

/**
 * @typedef {Object} RenderVariant
 * @property {number} scale - The scale factor used
 * @property {number} width - Image width in pixels
 * @property {number} height - Image height in pixels
 * @property {string} dataUrl - The data URL for this variant
 */

/**
 * Default asset loader that fetches from files
 */
export const defaultAssetLoader = {
    async loadCss() {
        try {
            const response = await fetch('./src/flipbook.css');
            return await response.text();
        } catch (error) {
            console.warn('Could not load CSS file, using fallback');
            return '';
        }
    },

    async loadJs() {
        try {
            const response = await fetch('./src/flipbook.js');
            const jsContent = await response.text();
            return wrapFlipbookJs(jsContent);
        } catch (error) {
            console.warn('Could not load JS file, using fallback');
            return '';
        }
    }
};

/**
 * Wraps the flipbook JavaScript to inject page data
 * @param {string} jsContent - Original JavaScript content
 * @returns {string} Wrapped JavaScript
 */
export function wrapFlipbookJs(jsContent) {
    if (typeof jsContent !== 'string') {
        throw new Error('jsContent must be a string');
    }

    let modifiedJs = jsContent.replace(
        'const totalPages = parseInt(document.getElementById(\'book-container\').dataset.pageCount);',
        'const totalPages = window.__PAGE_COUNT__;'
    );

    return modifiedJs;
}

/**
 * Generates srcset string from image variants
 * @param {Array<RenderVariant>} variants - Array of image variants
 * @returns {string} srcset attribute value
 */
function generateSrcset(variants) {
    if (!variants || variants.length === 0) return '';
    
    return variants
        .map(v => `${v.dataUrl} ${v.width}w`)
        .join(', ');
}

/**
 * Generates sizes string based on layout mode
 * @param {boolean} doubleSpread - Whether in double spread mode
 * @returns {string} sizes attribute value
 */
function generateSizes(doubleSpread) {
    // In double spread mode, each half-page takes roughly half the viewport
    return doubleSpread ? '50vw' : '100vw';
}

/**
 * Generates HTML for individual pages
 * @param {Array<string|Array<RenderVariant>>} pageImages - Array of either data URLs or variant arrays
 * @param {boolean} doubleSpread - Whether in double spread mode
 * @returns {string} HTML string for all pages
 */
export function generatePagesHtml(pageImages, doubleSpread = false) {
    if (!Array.isArray(pageImages)) {
        throw new Error('pageImages must be an array');
    }

    const pagesHtml = Array.from({ length: pageImages.length }, (_, i) => {
        const pageNum = i + 1;
        const pageData = pageImages[i];
        
        // Format detection: string (legacy) vs array (responsive)
        const isLegacyFormat = typeof pageData === 'string';
        
        let imgTag;
        if (isLegacyFormat) {
            // Legacy format: simple img with src
            const imgSrc = pageData.replace(/"/g, '&quot;') || '';
            imgTag = `<img src="${imgSrc}" alt="Page ${pageNum}" loading="lazy" />`;
        } else {
            // Responsive format: img with srcset
            const variants = pageData;
            if (!Array.isArray(variants) || variants.length === 0) {
                throw new Error(`Page ${pageNum} has no image variants`);
            }
            
            // Use the smallest image as src fallback
            const src = variants[0].dataUrl.replace(/"/g, '&quot;');
            const srcset = generateSrcset(variants);
            const sizes = generateSizes(doubleSpread);
            
            imgTag = `<img src="${src}" srcset="${srcset}" sizes="${sizes}" alt="Page ${pageNum}" loading="lazy" />`;
        }
        
        const sideClass = (pageNum % 2 === 1) ? 'left' : 'right';
        return `            <div class="page ${sideClass}" id="page-${pageNum}">
            ${imgTag}
        </div>`;
    }).join('');
    
    return pagesHtml;
}

/**
 * Generates the complete HTML structure for the flipbook
 * @param {Array<string|Array<RenderVariant>>} pageImages - Array of either data URLs or variant arrays
 * @param {GeneratorOptions} options - Generator options
 * @param {AssetLoader} assetLoader - Asset loader (optional, defaults to file loader)
 * @returns {Promise<string>} Complete HTML document
 */
export async function generateFlipbookHtml(pageImages, options = {}, assetLoader = defaultAssetLoader) {
    if (!Array.isArray(pageImages)) {
        throw new Error('pageImages must be an array');
    }

    if (pageImages.length < 1) {
        throw new Error('pageImages must contain at least one image');
    }

    const { title = 'Flipbook', doubleSpread = false } = options;

    const [css, js] = await Promise.all([
        assetLoader.loadCss().catch(() => ''),
        assetLoader.loadJs().catch(() => '')
    ]);

    const pagesHtml = generatePagesHtml(pageImages, doubleSpread);
    const actualPageCount = pageImages.length;
    
    // Remove duplicate flipbook-wrapper that was in original code
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${css}</style>
</head>
<body>
    <div id="flipbook-wrapper">
        <div id="book-container" data-page-count="${actualPageCount}" data-double-spread="${doubleSpread}">
            ${pagesHtml}
        </div>
        <div id="controls-panel">
            <label for="page-input">Page:</label>
            <input type="number" id="page-input" min="1" max="${actualPageCount}" value="1" style="width: 50px; text-align: center;">
            
            <input type="range" id="zoom-slider" min="1" max="3" step="0.05" value="1" title="Zoom">
            <div id="zoom-level">100%</div>
        </div>
    </div>
    <script>
        window.__PAGE_COUNT__ = ${actualPageCount};
        window.__DOUBLE_SPREAD__ = ${doubleSpread};
    </script>
    <script>${js}</script>
</body>
</html>`;
}