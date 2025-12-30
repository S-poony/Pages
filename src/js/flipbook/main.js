/**
 * Flipbook Main Entry Point
 * Coordinates the initialization of all modular components and handles the primary application flow.
 */
// Initialize StPageFlip and all controls
document.addEventListener('DOMContentLoaded', () => {
    const config = window.FLIPBOOK_CONFIG || {};
    const pageCount = config.pageCount || 0;
    const isDoubleSpread = config.doubleSpread || false;

    if (!pageCount) {
        console.error('No page count found');
        return;
    }

    // Check if there's an initial page in the URL hash
    const initialPage = getPageFromHash(pageCount);

    if (typeof St === 'undefined' || !St.PageFlip) {
        console.error('StPageFlip not loaded');
        return;
    }

    const wrapper = document.getElementById('flipbook-wrapper');
    const flipbookEl = document.getElementById('flipbook');

    // Initial calculation
    const dims = calculateDimensions(wrapper, config);
    BOOK_WIDTH_AT_1X = dims.width;
    BOOK_HEIGHT_AT_1X = dims.height;

    // Container size matches book size (at 1x)
    const container = document.getElementById('flipbook-container');
    if (container) {
        container.style.width = `${BOOK_WIDTH_AT_1X}px`;
        container.style.height = `${BOOK_HEIGHT_AT_1X}px`;
    }

    // Store original pages for re-initialization
    const originalPages = Array.from(document.querySelectorAll('.page-container')).map(node => node.cloneNode(true));

    // Ensure flipbook element exists and is clean
    if (!flipbookEl) {
        const newFlipbookEl = document.createElement('div');
        newFlipbookEl.id = 'flipbook';
        document.getElementById('flipbook-container').appendChild(newFlipbookEl);
        flipbookEl = newFlipbookEl;
    }
    flipbookEl.innerHTML = ''; // Clear previous content

    // Re-append pages
    originalPages.forEach(page => {
        const isSingleMode = window.innerHeight > window.innerWidth;
        page.style.width = (isSingleMode ? BOOK_WIDTH_AT_1X : BOOK_WIDTH_AT_1X / 2) + 'px';
        page.style.height = BOOK_HEIGHT_AT_1X + 'px';
        page.style.overflow = 'hidden';
        flipbookEl.appendChild(page.cloneNode(true));
    });

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            initStPageFlip();
        });
    });

    function initStPageFlip() {
        const isSingleMode = window.innerHeight > window.innerWidth;
        pageFlip = new St.PageFlip(flipbookEl, {
            width: isSingleMode ? BOOK_WIDTH_AT_1X : BOOK_WIDTH_AT_1X / 2,
            height: BOOK_HEIGHT_AT_1X,
            size: 'stretch',
            minWidth: 100,
            maxWidth: 10000,
            minHeight: 100,
            maxHeight: 10000,
            autoSize: false,
            showCover: false,
            usePortrait: false,
            startPage: initialPage ? initialPage - 1 : 0,
            drawShadow: true,
            maxShadowOpacity: 0.5,
            flippingTime: 500,
            useMouseEvents: true,
            swipeDistance: 30,
            mobileScrollSupport: false,
            display: window.innerHeight > window.innerWidth ? 'single' : 'double',
            flippingShadow: true,
            flippingShadowOpacity: 0.5,
            flippingShadowWidthOffset: 50,
            flippingShadowWidthScale: 1.5,
            flippingShadowStartAlpha: .7,
            flippingShadowEndAlpha: 0,
            otherShadowOpacityScale: .5,
        });

        updateEpubContentScale();
        pageFlip.loadFromHTML(document.querySelectorAll('.page-container'));
        window.pageFlip = pageFlip;

        // Initialize UI and Links AFTER pageFlip is ready
        setupUI(pageCount, pageInput, zoomSlider, zoomText, controlsPanel, topControlsPanel, fullscreenBtn, wrapper, tocBtn, tableOfContents, tocModal, tocList, tocCloseBtn, tocOverlay, prevPageBtn, nextPageBtn, pageLinksBtn, linksModal, linksList, linksCloseBtn);
        if (typeof setupLinks === 'function') {
            setupLinks(pageFlip, config);
        }

        pageFlip.on('flip', (e) => {
            const pageNum = e.data + 1;
            if (pageInput) pageInput.value = pageNum;
            if (!isUpdatingFromHash) {
                setPageInHash(pageNum);
            }
            updateImageSizes();
            updateEpubContentScale();
            preloadNextSpread(e.data);

            if (typeof updateLinksButtonVisibility === 'function') {
                updateLinksButtonVisibility();
            }
            if (typeof window.updateActiveTOC === 'function') {
                window.updateActiveTOC(pageNum);
            }
        });

        pageFlip.on('init', () => {
            updateImageSizes();
            updateEpubContentScale();
            preloadNextSpread(0);

            // Hide loading screen
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.remove();
                }, 600);
            }
        });
    }

    // Cache control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomText = document.getElementById('zoom-level');
    const pageInput = document.getElementById('page-input');
    const controlsPanel = document.getElementById('controls-panel');
    const topControlsPanel = document.getElementById('top-controls-panel');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    // TOC Elements
    const tocBtn = document.getElementById('toc-btn');
    const tocModal = document.getElementById('toc-modal');
    const tocList = document.getElementById('toc-list');
    const tocCloseBtn = document.getElementById('toc-close-btn');
    const tocOverlay = document.querySelector('.toc-overlay');
    const tableOfContents = config.tableOfContents || [];

    // Page Links Elements
    const pageLinksBtn = document.getElementById('page-links-btn');
    const linksModal = document.getElementById('links-modal');
    const linksList = document.getElementById('links-list');
    const linksCloseBtn = document.getElementById('links-close-btn');


    // Initial setup
    updateTransform();

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.isProgrammaticResize) return;
        const dims = calculateDimensions(wrapper, config);
        BOOK_WIDTH_AT_1X = dims.width;
        BOOK_HEIGHT_AT_1X = dims.height;

        const container = document.getElementById('flipbook-container');
        if (container) {
            container.style.width = `${BOOK_WIDTH_AT_1X}px`;
            container.style.height = `${BOOK_HEIGHT_AT_1X}px`;
        }
        panX = 0;
        panY = 0;
        updateTransform();
    });

    // Prevent pinch-zoom and trackpad zoom
    document.addEventListener('wheel', function (e) {
        if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
    });

    // Handle URL hash changes
    window.addEventListener('hashchange', () => {
        handleZoomNavigation(() => {
            const targetPage = getPageFromHash(pageCount);
            if (targetPage !== null && pageFlip) {
                isUpdatingFromHash = true;
                pageFlip.flip(targetPage - 1);
                setTimeout(() => {
                    isUpdatingFromHash = false;
                }, 100);
            }
        });
    });

    // Set initial URL hash if not present
    if (!window.location.hash && initialPage === null) {
        setPageInHash(1);
    }
});
