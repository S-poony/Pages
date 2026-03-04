/**
 * PDF Text Extraction Module
 * Extracts text content from a PDF page and normalizes its position
 * to percentage-based coordinates for the flipbook's enrichment layer.
 */

/**
 * Extracts text content from a PDF page
 * @param {Object} page - PDF.js page object
 * @returns {Promise<Array>} Array of text items with absolute-positioned { top, left, fontSize, scaleX, str }
 */
export async function extractPageText(page) {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const { width: pageWidth, height: pageHeight } = viewport;

    return textContent.items.map(item => {
        const { transform, str, width, height, fontName } = item;
        // transform: [scaleX, skewY, skewX, scaleY, translateX, translateY]
        const scaleX = transform[0];
        const scaleY = transform[3];
        const translateX = transform[4];
        const translateY = transform[5];

        // Font style lookup with fallback logic
        const style = textContent.styles[fontName];
        let fontFamily = 'sans-serif';

        if (style && style.fontFamily) {
            // Robust Fallback: If font family starts with 'g_d0_' or similar, it's likely an internal PDF name
            if (!style.fontFamily.startsWith('g_d')) {
                fontFamily = style.fontFamily;
            }
        }

        // PDF.js coordinates are bottom-up (translateY is the baseline)
        // We need to convert to top-down percentage
        // To align correctly with HTML 'top', we subtract the font height (scaleY)
        const left = (translateX / pageWidth) * 100;
        const top = ((pageHeight - translateY - scaleY) / pageHeight) * 100;

        // Font size is usually the scaleY in the transform
        // Ensure it's a valid positive number
        const fontSizeVal = Math.max(0, scaleY);
        const fontSize = (fontSizeVal / pageHeight) * 100;

        return {
            str,
            top: `${top.toFixed(4)}%`,
            left: `${left.toFixed(4)}%`,
            fontSize: fontSize.toFixed(4),
            fontFamily,
            scaleX: scaleX / scaleY, // Ratio to handle font-stretch-like behavior if needed
            width: (width / pageWidth) * 100,
            height: (height / pageHeight) * 100
        };
    });
}
