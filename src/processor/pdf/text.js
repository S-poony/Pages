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
        // translateX, translateY are in PDF "user space" (0,0 is bottom-left)
        const translateX = transform[4];
        const translateY = transform[5];
        const scaleY = transform[3];

        // Use PDF.js viewport to convert user space to viewport space (pixels, 0,0 is top-left)
        // This handles rotation and complex transformations correctly.
        // convertToViewportPoint returns [x, y] in pixels
        const [pixelX, pixelY] = viewport.convertToViewportPoint(translateX, translateY);

        // Font style lookup with fallback logic
        const style = textContent.styles[fontName];
        let fontFamily = 'sans-serif';

        if (style && style.fontFamily) {
            // Robust Fallback: If font family starts with 'g_d0_' or similar, it's likely an internal PDF name
            if (!style.fontFamily.startsWith('g_d')) {
                fontFamily = style.fontFamily;
            }
        }

        // Convert pixel coordinates to percentages
        const left = (pixelX / pageWidth) * 100;

        // PDF.js translateY is the baseline. In CSS 'top', we need the top of the line.
        // viewport.convertToViewportPoint for scaleY helps get the correct vertical offset
        // but for simplicity and since we normalize to 1.0 scale, we can use the scaleY directly.
        // We subtract scaleY because CSS top is top-down and PDF is bottom-up.
        const top = ((pixelY - scaleY) / pageHeight) * 100;

        // Font size is usually the scaleY in the transform
        // Ensure it's a valid positive number
        const fontSizeVal = Math.max(0, scaleY);
        // We use the raw fontSize value for cqh conversion later
        const fontSize = (fontSizeVal / pageHeight) * 100;

        return {
            str,
            top: `${top.toFixed(4)}%`,
            left: `${left.toFixed(4)}%`,
            fontSize: fontSize.toFixed(4), // This will be used as cqh
            fontFamily,
            scaleX: transform[0] / scaleY, // Ratio to handle font-stretch-like behavior
            width: (width / pageWidth) * 100,
            height: (height / pageHeight) * 100
        };
    });
}
