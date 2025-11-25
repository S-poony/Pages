/**
 * Flipbook HTML Generator
 * Creates a standalone HTML file with embedded CSS, JavaScript, and page images
 * Supports both legacy format (array of data URLs) and responsive format (array of variants)
 *
 * @typedef {Object} GeneratorOptions
 * @property {string} title - Title of the flipbook
 * @property {boolean} doubleSpread - Whether to enable double spread mode
 * @property {boolean} addBlankPage - Whether to add a blank page at start
 * @property {'single'|'folder'} mode - Generation mode: 'single' (embedded base64) or 'folder' (external images)
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
            //The lib is already included in ${js}
            return '';
        } catch {
            return '';
        }
    },

    async loadJs() {
        try {
            const response = await fetch('./src/flipbook.js');
            return await response.text();
        } catch (error) {
            console.warn('Could not load JS file, using fallback');
            return '';
        }
    }
};

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
 * Handles quotes, ampersands, and other special characters that could break attribute boundaries
 * @param {string} str - String to escape for HTML attribute
 * @returns {string} Escaped string safe for HTML attributes
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
 * Generates srcset string from image variants
 * @param {Array<RenderVariant>} variants - Array of image variants
 * @param {string} [basePath] - Optional base path for external images (e.g. 'images/')
 * @param {number} [pageIndex] - Page index for naming
 * @returns {string} srcset attribute value
 */
function generateSrcset(variants, basePath = '', pageIndex = 0) {
    if (!variants || variants.length === 0) return '';

    return variants
        .map((v, i) => {
            // Escape data URLs for safe use in srcset attribute
            const src = basePath ? `${basePath}page-${pageIndex + 1}-${v.width}w.jpg` : escapeAttr(v.dataUrl);
            return `${src} ${v.width}w`;
        })
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
 * @param {'single'|'folder'} mode - Generation mode
 * @returns {string} HTML string for all pages
 */
export function generatePagesHtml(pageImages, doubleSpread = false, mode = 'single') {
    if (!Array.isArray(pageImages)) {
        throw new Error('pageImages must be an array');
    }

    const pagesHtml = Array.from({ length: pageImages.length }, (_, i) => {
        const pageNum = i + 1;
        const pageData = pageImages[i];

        const isLegacyFormat = typeof pageData === 'string';

        let imgTag;
        if (isLegacyFormat) {
            // Legacy format only supports single mode (embedded) effectively
            // or we'd need to save the string as file.
            // For folder mode, we assume we'll save this dataUrl as a file.
            const src = mode === 'folder' ? `images/page-${pageNum}.jpg` : escapeAttr(pageData);
            imgTag = `<img src="${src}" alt="Page ${pageNum}" loading="lazy" />`;
        } else {
            const variants = pageData;
            if (!Array.isArray(variants) || variants.length === 0) {
                throw new Error(`Page ${pageNum} has no image variants`);
            }

            let src, srcset;
            if (mode === 'folder') {
                // Use external files
                // We assume the largest variant is the main src, or the first one
                src = `images/page-${pageNum}-${variants[0].width}w.jpg`;
                srcset = generateSrcset(variants, 'images/', i);
            } else {
                // Use embedded data URLs - properly escape for HTML attributes
                src = escapeAttr(variants[0].dataUrl);
                srcset = generateSrcset(variants);
            }

            const sizes = generateSizes(doubleSpread);
            const objectPosition = doubleSpread ? (pageNum % 2 === 0 ? 'left' : 'right') : 'center';

            imgTag = `<img src="${src}" srcset="${srcset}" sizes="${sizes}" alt="Page ${pageNum}" loading="lazy" style="object-position: ${objectPosition} center;" />`;
        }

        return `
<!-- =================================================================== -->
<!-- PAGE ${pageNum} - ENRICHMENT ZONE -->
<!-- Keep the <img> tag. Add interactive elements INSIDE enrichment-layer -->
<!-- =================================================================== -->
<div class="page-container" data-density="soft">
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
 * @returns {Promise<string|{html: string, assets: Array}>} Complete HTML document or object with assets
 */
export async function generateFlipbookHtml(pageImages, options = {},
    assetLoader = defaultAssetLoader) {
    if (!Array.isArray(pageImages)) {
        throw new Error('pageImages must be an array');
    }

    if (pageImages.length < 1) {
        throw new Error('pageImages must contain at least one image');
    }

    const { title = 'Flipbook', doubleSpread = false, addBlankPage = false, mode = 'single' } = options;
    const [baseCss, js, pageFlipJs] = await Promise.all([
        assetLoader.loadCss().catch(() => ''),
        assetLoader.loadJs().catch(() => ''),
        assetLoader.loadPageFlipJs().catch(() => '')
    ]);

    // Construct the array of pages conditionally
    const pagesArray = [];

    // Add blank cover (single page, right side) if addBlankPage is true
    if (addBlankPage) {
        pagesArray.push(
            '<div class="page-container" style="background-color: white;"></div>'
        );
    }

    // Add content pages
    pagesArray.push(
        generatePagesHtml(pageImages, doubleSpread, mode)
    );

    // Add blank page at end if odd number of pages
    // This prevents the last page from appearing alone and being treated as a hardcover
    let totalPageCount = pageImages.length;
    if (addBlankPage) {
        totalPageCount += 1; // Account for the blank cover we added
    }

    if (totalPageCount % 2 !== 0) {
        pagesArray.push(
            '<div class="page-container" data-density="soft" style="background-color: white;"></div>'
        );
    }

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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
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
        // Flipbook Configuration
        // This object is injected before the application scripts run
        // and provides all necessary configuration to the flipbook
        window.FLIPBOOK_CONFIG = {
            pageCount: ${actualPageCount},
            doubleSpread: ${doubleSpread},
            pageAspectRatio: ${aspectRatio}
        };
    </script>
    <script>${pageFlipJs}</script>
    <script>${js}</script>
</body>
</html>`;

    if (mode === 'single') {
        return html;
    } else {
        // Folder mode: Return HTML + Assets
        const assets = [];

        // Extract assets from pageImages
        pageImages.forEach((pageData, i) => {
            const pageNum = i + 1;
            if (typeof pageData === 'string') {
                // Legacy data URL
                assets.push({
                    filename: `images/page-${pageNum}.jpg`,
                    data: pageData // Base64 string
                });
            } else {
                // Variants
                pageData.forEach(v => {
                    assets.push({
                        filename: `images/page-${pageNum}-${v.width}w.jpg`,
                        data: v.dataUrl
                    });
                });
            }
        });

        return { html, assets };
    }
}