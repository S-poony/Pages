/**
 * Flipbook Scaling Module
 * Handles dynamic image source updates (srcset) and EPUB content scaling for responsive layouts.
 */
/**
 * Update img sizes attribute based on zoom level for currently visible pages
 */
function updateImageSizes() {
    // Optimization: Skip expensive quality update if user is actively panning
    if (window.isPanning) return;

    const zoomLevel = window.currentZoom || 1;
    const images = document.querySelectorAll('.page-image');

    images.forEach((img) => {
        if (img && img.hasAttribute('srcset')) {
            const baseSize = 50;
            const zoomedSize = Math.round(baseSize * zoomLevel);
            const newSizes = `${zoomedSize}vw`;

            if (img.sizes !== newSizes) {
                img.sizes = newSizes;
                if (zoomLevel > 1) {
                    const srcset = img.srcset;
                    img.srcset = '';
                    img.srcset = srcset;
                }
            }

            if (zoomLevel > 1) {
                img.style.transform = 'translateZ(0)';
            } else {
                img.style.transform = '';
            }
        }
    });
}

const debouncedUpdateImageSizes = debounce(updateImageSizes, 200);

/**
 * Scale EPUB content to fit the page container
 * This ensures fixed-dimension content (from pagination) fits the responsive page
 */
function updateEpubContentScale() {
    // Use requestAnimationFrame to ensure StPageFlip has finished resizing its elements
    // and the browser has recalculated the layout before we measure clientWidth/Height.
    requestAnimationFrame(() => {
        const epubContents = document.querySelectorAll('.epub-content');
        epubContents.forEach(content => {
            const parent = content.closest('.page-container');
            if (!parent) return;

            // Get fixed dimensions from inline styles (set during pagination)
            const fixedWidth = parseFloat(content.style.width);
            const fixedHeight = parseFloat(content.style.height);

            if (!fixedWidth || !fixedHeight) return;

            const parentWidth = parent.clientWidth;
            const parentHeight = parent.clientHeight;

            if (parentWidth === 0 || parentHeight === 0) return;

            const scaleX = parentWidth / fixedWidth;
            const scaleY = parentHeight / fixedHeight;

            // Use the smaller scale to ensure it fits without cropping
            const scale = Math.min(scaleX, scaleY);

            content.style.transform = `scale(${scale})`;
            content.style.transformOrigin = 'top left';
        });
    });
}
