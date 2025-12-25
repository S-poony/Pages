/**
 * Flipbook PageFlip Module
 * Controls the low-level StPageFlip integration, page preloading, and dimension calculations.
 */
/**
 * Preload images for the next spread to ensure smooth flipping
 * @param {number} currentIndex - Current page index (0-based)
 */
function preloadNextSpread(currentIndex) {
    const config = window.FLIPBOOK_CONFIG || {};
    const isDoubleSpread = config.doubleSpread;
    const pageCount = config.pageCount;

    // Calculate next pages to preload
    let pagesToPreload = [];

    if (isDoubleSpread) {
        pagesToPreload = [
            currentIndex + 1,
            currentIndex + 2,
            currentIndex + 3,
            currentIndex + 4
        ];
    } else {
        pagesToPreload = [currentIndex + 1, currentIndex + 2];
    }

    pagesToPreload.forEach(idx => {
        if (idx < pageCount) {
            const allImages = document.querySelectorAll('.page-image');
            if (allImages[idx]) {
                const img = allImages[idx];
                if (img.src) {
                    const preloader = new Image();
                    preloader.src = img.src;
                    if (img.srcset) preloader.srcset = img.srcset;

                    // Calculate correct sizes matching updateImageSizes logic
                    const zoomLevel = window.currentZoom || 1;
                    const baseSize = 50;
                    const zoomedSize = Math.round(baseSize * zoomLevel);
                    preloader.sizes = `${zoomedSize}vw`;
                }
            }
        }
    });
}

function calculateDimensions(wrapper, config) {
    const wrapperWidth = wrapper.clientWidth;
    const wrapperHeight = wrapper.clientHeight;
    // Use injected aspect ratio or fallback to A4-ish (0.707)
    const pageAspectRatio = config.pageAspectRatio || 0.707;

    // Detect display mode
    const isSingleMode = window.innerHeight > window.innerWidth;

    let width, height;

    if (isSingleMode) {
        width = wrapperWidth;
        height = width / pageAspectRatio;

        if (height > wrapperHeight) {
            height = wrapperHeight;
            width = height * pageAspectRatio;
        }
    } else {
        const targetAspectRatio = pageAspectRatio * 2;
        width = wrapperWidth;
        height = width / targetAspectRatio;

        if (height > wrapperHeight) {
            height = wrapperHeight;
            width = height * targetAspectRatio;
        }
    }

    return {
        width: Math.floor(width),
        height: Math.floor(height)
    };
}
