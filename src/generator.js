/**
 * Flipbook HTML Generator
 * Creates a standalone HTML file with embedded CSS, JavaScript, and page images
 *
 * @typedef {Object} GeneratorOptions
 * @property {string} title - Title of the flipbook
 */

/**
 * Interface for loading CSS and JS content
 * @typedef {Object} AssetLoader
 * @property {Function} loadCss - Function to load CSS content
 * @property {Function} loadJs - Function to load JS content
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

    // Replace the initialization code to inject pageCount and pageImages
    let modifiedJs = jsContent.replace(
        'const totalPages = parseInt(document.getElementById(\'book-container\').dataset.pageCount);',
        'const totalPages = window.__PAGE_COUNT__;'
    );

    modifiedJs = modifiedJs.replace(
        'const pageImages = JSON.parse(document.getElementById(\'book-container\').dataset.pageImages);',
        'const pageImages = window.__PAGE_IMAGES__;'
    );

    return modifiedJs;
}

/**
 * Generates HTML for individual pages
 * @param {number} pageCount - Total number of pages
 * @returns {string} HTML string for all pages
 */
export function generatePagesHtml(pageCount) {
    if (!Number.isInteger(pageCount) || pageCount < 1) {
        throw new Error('pageCount must be a positive integer');
    }

    const pagesHtml = Array.from({ length: pageCount }, (_, i) => {
        const pageNum = i + 1;
        return `            <div class="page" id="page-${pageNum}">
                <div class="page-face page-face-front"></div>
                <div class="page-face page-face-back" id="page-${pageNum}-back"></div>
            </div>`;
    }).join('');

    return pagesHtml;
}

/**
 * Generates the complete HTML structure for the flipbook
 * @param {number} pageCount - Total number of pages
 * @param {string[]} pageImages - Array of base64 image data URLs
 * @param {GeneratorOptions} options - Generator options
 * @param {AssetLoader} assetLoader - Asset loader (optional, defaults to file loader)
 * @returns {Promise<string>} Complete HTML document
 */
export async function generateFlipbookHtml(pageCount, pageImages, options = {}, assetLoader = defaultAssetLoader) {
    if (!Number.isInteger(pageCount) || pageCount < 1) {
        throw new Error('pageCount must be a positive integer');
    }

    if (!Array.isArray(pageImages)) {
        throw new Error('pageImages must be an array');
    }

    if (pageImages.length !== pageCount) {
        throw new Error('pageImages length must match pageCount');
    }

    const { title = 'Flipbook' } = options;

    const [css, js] = await Promise.all([
        assetLoader.loadCss().catch(() => ''),
        assetLoader.loadJs().catch(() => '')
    ]);

    const pagesHtml = generatePagesHtml(pageCount);

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
        <div id="book-container">
            ${pagesHtml}
        </div>
    </div>
    <script>
        window.__PAGE_COUNT__ = ${pageCount};
        window.__PAGE_IMAGES__ = ${JSON.stringify(pageImages)};
    </script>
    <script>${js}</script>
</body>
</html>`;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateFlipbookHtml with assetLoader parameter instead
 */
export async function generateFlipbookHtmlLegacy(pageCount, pageImages, options = {}) {
    return generateFlipbookHtml(pageCount, pageImages, options, defaultAssetLoader);
}

