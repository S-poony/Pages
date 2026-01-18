/**
 * Calculates page normalization parameters to contain a page within a target aspect ratio.
 * 
 * @param {Object} viewport - The original PDF page viewport
 * @param {Object} options - Processing options containing targetAspectRatio, standardWidth, standardHeight
 * @param {number} scale - Current render scale
 * @returns {Object} Normalization result { canvasWidth, canvasHeight, xOffset, yOffset, contentScale, isNormalized }
 */
export function calculateNormalization(viewport, options, scale) {
    // Check if we need to normalize
    if (!options.targetAspectRatio || Math.abs((viewport.width / viewport.height) - options.targetAspectRatio) <= 0.01) {
        return {
            canvasWidth: Math.round(viewport.width),
            canvasHeight: Math.round(viewport.height),
            xOffset: 0,
            yOffset: 0,
            contentScale: 1,
            isNormalized: false
        };
    }

    let canvasWidth, canvasHeight;

    if (options.standardWidth && options.standardHeight) {
        // Use standard dimensions if available (most robust)
        canvasWidth = Math.round(options.standardWidth * scale);
        canvasHeight = Math.round(options.standardHeight * scale);
    } else {
        // Fallback: derive from ratio and current height
        canvasHeight = Math.round(viewport.height);
        canvasWidth = Math.round(canvasHeight * options.targetAspectRatio);
    }

    // Calculate fit (contain)
    const scaleX = canvasWidth / viewport.width;
    const scaleY = canvasHeight / viewport.height;
    const contentScale = Math.min(scaleX, scaleY);

    const drawnWidth = viewport.width * contentScale;
    const drawnHeight = viewport.height * contentScale;

    // Calculate offsets (Right Align, Vertically Center)
    const xOffset = canvasWidth - drawnWidth;
    const yOffset = (canvasHeight - drawnHeight) / 2;

    return {
        canvasWidth,
        canvasHeight,
        xOffset,
        yOffset,
        contentScale,
        isNormalized: true
    };
}
