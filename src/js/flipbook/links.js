/**
 * Flipbook Link Handling Module
 * Centralizes all link-related interactions (EPUB, PDF, and external links)
 * into a single unified event listener.
 * 
 * NOTE: Link previews are restricted to PDF (image-based) documents only.
 */

/**
 * Sets up a centralized click listener for all flipbook links
 * @param {Object} pageFlip - StPageFlip instance
 * @param {Object} config - Flipbook configuration
 * @param {HTMLElement} wrapper - Flipbook wrapper element
 */
function setupLinks(pageFlip, config, wrapper) {
    console.log('Setting up flipbook links handle...', { hasLinkMap: !!config.linkMap });

    let previewElement = null;
    let showTimeout = null;
    let hideTimeout = null;
    let currentPreviewPage = null;
    let currentLink = null;

    const createPreviewElement = () => {
        const el = document.createElement('div');
        el.className = 'link-hover-preview';
        (wrapper || document.body).appendChild(el);

        // Allow user to interact with the preview (scroll it)
        el.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });
        el.addEventListener('mouseleave', () => {
            hidePreview(0);
        });

        return el;
    };

    const showPreview = (targetPageNum, mouseX, mouseY) => {
        if (!previewElement) previewElement = createPreviewElement();

        // Use persistent pages if available, otherwise fallback to DOM
        const pageContainers = window.FLIPBOOK_PAGES || document.querySelectorAll('.page-container');
        const targetPageEl = pageContainers[targetPageNum - 1];

        if (!targetPageEl) return;

        if (currentPreviewPage !== targetPageNum || !previewElement.classList.contains('visible')) {
            previewElement.innerHTML = '';
            const previewContent = document.createElement('div');
            previewContent.className = 'preview-content';

            // Strictly PDF Logic: Only clone the <img> tag
            const img = targetPageEl.querySelector('img.page-image');
            if (img) {
                const previewImg = img.cloneNode(false);
                previewImg.src = img.src;
                if (img.srcset) previewImg.srcset = img.srcset;
                if (img.sizes) previewImg.sizes = img.sizes;
                previewImg.style.pointerEvents = 'none';
                previewImg.style.width = '100%';
                previewImg.style.height = 'auto';
                previewContent.appendChild(previewImg);
            }

            previewElement.appendChild(previewContent);
            currentPreviewPage = targetPageNum;
            previewElement.scrollTop = 0;
        }

        updatePosition(mouseX, mouseY);
        previewElement.classList.add('visible');
    };

    const updatePosition = (mouseX, mouseY) => {
        if (!previewElement) return;

        const margin = 15;
        // Measure real dimensions for accurate boundary check
        const previewW = previewElement.offsetWidth || 300;
        const previewH = previewElement.offsetHeight || 400;

        const rect = wrapper ? wrapper.getBoundingClientRect() : {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight
        };

        let left = mouseX - rect.left + margin;
        let top = mouseY - rect.top + margin;

        // Viewport boundaries (relative to wrapper)
        if (left + previewW > rect.width) {
            left = (mouseX - rect.left) - previewW - margin;
        }
        if (top + previewH > rect.height) {
            top = rect.height - previewH - margin;
        }

        // Final safety check for top/left
        if (top < margin) top = margin;
        if (left < margin) left = margin;

        previewElement.style.left = `${left}px`;
        previewElement.style.top = `${top}px`;
    };

    const hidePreview = (delay = 400) => {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            if (previewElement) {
                previewElement.classList.remove('visible');
            }
            currentLink = null;
            currentPreviewPage = null; // Reset to force re-render if needed
        }, delay);
    };

    // Initialize missing hrefs for internal links so native right-click/ctrl-click works
    const internalLinks = (wrapper || document.body).querySelectorAll('a[data-target-page], a[data-epub-href]');
    internalLinks.forEach(link => {
        if (!link.getAttribute('href') || link.getAttribute('href') === 'javascript:void(0)') {
            let targetPage = link.getAttribute('data-target-page');
            const epubHref = link.getAttribute('data-epub-href');

            if (epubHref) {
                const linkMap = config.linkMap || {};
                let key = epubHref.split('#')[0];
                targetPage = linkMap[key];

                if (!targetPage) {
                    const matchingKeys = Object.keys(linkMap).filter(k => k.includes(key) || key.includes(k));
                    if (matchingKeys.length > 0) {
                        targetPage = linkMap[matchingKeys[0]];
                    }
                }
            }

            if (targetPage) {
                link.setAttribute('href', `#page=${targetPage}`);
            }
        }
    });

    // Centralized event listener for taps/clicks to hide preview
    document.addEventListener('pointerdown', (e) => {
        if (previewElement && previewElement.classList.contains('visible')) {
            const isInsidePreview = previewElement.contains(e.target);
            const isLink = e.target.closest('a[data-target-page], a[data-epub-href]');

            if (!isInsidePreview && !isLink) {
                hidePreview(0);
            }
        }
    }, true);

    // Centralized event listener for navigation clicks
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        // Navigation works for BOTH formats
        const epubHref = link.getAttribute('data-epub-href');
        const targetPageAttr = link.getAttribute('data-target-page');

        if (epubHref) {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            const linkMap = config.linkMap || {};
            let key = epubHref.split('#')[0]; // Robust lookup
            let targetPage = linkMap[key];

            if (!targetPage) {
                const matchingKeys = Object.keys(linkMap).filter(k =>
                    k.includes(key) || key.includes(k)
                );
                if (matchingKeys.length > 0) {
                    targetPage = linkMap[matchingKeys[0]];
                }
            }

            if (targetPage && pageFlip) {
                handleZoomNavigation(() => pageFlip.flip(targetPage - 1));
            }
            return;
        }

        if (targetPageAttr) {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            const pageNum = parseInt(targetPageAttr, 10);
            if (!isNaN(pageNum) && pageFlip) {
                handleZoomNavigation(() => pageFlip.flip(pageNum - 1));
            }
            return;
        }

        const href = link.getAttribute('href');
        if (href && (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:'))) {
            e.stopPropagation();
        }
    }, true);

    // Hide preview on page flip
    if (pageFlip) {
        pageFlip.on('flip', () => {
            hidePreview(0);
        });
    }

    // Disable context menu on internal links (for mobile long-press)
    // Removed to allow native right-click natively.
    // document.addEventListener('contextmenu', (e) => {
    //     const link = e.target.closest('a');
    //     if (link && (link.hasAttribute('data-target-page') || link.hasAttribute('data-epub-href'))) {
    //         e.preventDefault();
    //     }
    // }, true);

    // Hover listeners
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        // PREVIEW logic: not epub because pages are html. Works with flipbooks generated from api
        // We explicitly ignore data-epub-href for previews
        const targetPageAttr = link.getAttribute('data-target-page');
        if (!targetPageAttr) return;

        // Clear hide timeout when over a valid preview-enabled link
        clearTimeout(hideTimeout);

        if (link === currentLink && previewElement && previewElement.classList.contains('visible')) {
            updatePosition(e.clientX, e.clientY);
            return;
        }

        currentLink = link;
        const targetPageNum = parseInt(targetPageAttr, 10);

        if (targetPageNum && !isNaN(targetPageNum)) {
            clearTimeout(showTimeout);
            showTimeout = setTimeout(() => {
                showPreview(targetPageNum, e.clientX, e.clientY);
            }, 150);
        }
    });

    document.addEventListener('mouseout', (e) => {
        const link = e.target.closest('a');
        if (link && (!e.relatedTarget || !link.contains(e.relatedTarget))) {
            clearTimeout(showTimeout);
            hidePreview(400);
        }
    });
}
