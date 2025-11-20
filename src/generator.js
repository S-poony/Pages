/**
 * Flipbook HTML Generator
 * Creates a standalone HTML file with embedded CSS, JavaScript, and page images
 * Supports both legacy format (array of data URLs) and responsive format (array of variants)
 *
 * @typedef {Object} GeneratorOptions
 * @property {string} title - Title of the flipbook
 * @property {boolean} doubleSpread - Whether to enable double spread mode
 * @property {boolean} addBlankPage - Whether to add a blank page at start (only applies when doubleSpread is true)
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
            console.warn('Could not load flipbook.css, using fallback');
            return '';
        }
    },

    async loadPageFlipJs() {
        try {
            // In dev mode, we might not be able to fetch from node_modules easily via fetch in the browser context
            // if it's not served. But the default loader is mostly for standalone or dev.
            // For the app, we pass the content directly.
            // If we need a fallback for the default loader:
            return '';
        } catch {
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

        const isLegacyFormat = typeof pageData === 'string';

        let imgTag;
        if (isLegacyFormat) {
            const imgSrc = pageData.replace(/"/g, '&quot;') || '';
            imgTag = `<img src="${imgSrc}" alt="Page ${pageNum}" loading="lazy" />`;
        } else {
            const variants = pageData;
            if (!Array.isArray(variants) || variants.length === 0) {
                throw new Error(`Page ${pageNum} has no image variants`);
            }

            const src = variants[0].dataUrl.replace(/"/g, '&quot;');
            const srcset = generateSrcset(variants);
            const sizes = generateSizes(doubleSpread);
            const objectPosition = doubleSpread ? (pageNum % 2 === 0 ? 'left' : 'right') : 'center';

            imgTag = `<img src="${src}" srcset="${srcset}" sizes="${sizes}" alt="Page ${pageNum}" loading="lazy" style="object-position: ${objectPosition} center;" />`;
        }

        return `
<!-- =================================================================== -->
<!-- PAGE ${pageNum} - ENRICHMENT ZONE -->
<!-- Keep the <img> tag. Add interactive elements INSIDE enrichment-layer -->
<!-- =================================================================== -->
<div class="page-container">
  ${imgTag}
  <div class="enrichment-layer">
    <!-- PASTE YOUR CODE HERE -->
  </div>
</div>
<!-- PAGE ${pageNum} END -->
<!-- =================================================================== -->`;
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
export async function generateFlipbookHtml(pageImages, options = {},
    assetLoader = defaultAssetLoader) {
    if (!Array.isArray(pageImages)) {
        throw new Error('pageImages must be an array');
    }

    if (pageImages.length < 1) {
        throw new Error('pageImages must contain at least one image');
    }

    const { title = 'Flipbook', doubleSpread = false, addBlankPage = false } = options;
    const [baseCss, js, pageFlipJs] = await Promise.all([
        assetLoader.loadCss().catch(() => ''),
        assetLoader.loadJs().catch(() => ''),
        assetLoader.loadPageFlipJs().catch(() => '')
    ]);

    // Construct the array of pages conditionally
    const pagesArray = [];

    // Add blank cover (single page, right side) only if both doubleSpread AND addBlankPage are true
    if (doubleSpread && addBlankPage) {
        pagesArray.push(
            '<div class="page-container" style="background-color: white;"></div>'
        );
    }

    // Add content pages
    pagesArray.push(
        generatePagesHtml(pageImages, doubleSpread)
    );

    // Join all page HTML
    const pagesHtml = pagesArray.join('');

    const actualPageCount = pageImages.length;

    // Calculate aspect ratio from the first page's first variant
    let aspectRatio = 0.707; // Default fallback (A4-ish)
    if (pageImages.length > 0) {
        const firstPage = pageImages[0];
        if (Array.isArray(firstPage) && firstPage.length > 0) {
            const firstVariant = firstPage[0];
            if (firstVariant.width && firstVariant.height) {
                aspectRatio = firstVariant.width / firstVariant.height;
            }
        }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
        <style>
        /* --- ENRICHMENT UTILITIES --- */
        .page-container {
        position: relative;
        width: 100%;
        height: 100%;
        }

        .page-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        }

        .enrichment-layer {
        position: absolute;
        inset: 0;
        pointer-events: auto;
        z-index: 10;
        }
        /* --- END UTILITIES --- */

        ${baseCss}
        </style>
</head>
<body>

<!-- 
ENRICHMENT GUIDE:
1. Find the PAGE number you want to edit (search for "PAGE 5 - ENRICHMENT ZONE")
2. Add elements inside <div class="enrichment-layer">
3. Use absolute positioning: style="top: 100px; left: 150px;"
4. See CSS classes defined in <style> for building blocks
-->

    <div id="flipbook-wrapper">
        <div id="flipbook-container">
            <div id="flipbook" data-double-spread="${doubleSpread}">${pagesHtml}</div>
        </div>
        <div id="controls-panel">
            <input type="number" id="page-input" min="2" max="${actualPageCount}" value="2">
            <input type="range" id="zoom-slider" min="1" max="3" step="0.05" value="1">
            <div id="zoom-level">100%</div>
        </div>
    </div>
    <script>
        window.__PAGE_COUNT__ = ${actualPageCount};
        window.__DOUBLE_SPREAD__ = ${doubleSpread};
        window.__PAGE_ASPECT_RATIO__ = ${aspectRatio};
    </script>
    <script>${pageFlipJs}</script>
    <script>${js}</script>
</body>
</html>`;
}