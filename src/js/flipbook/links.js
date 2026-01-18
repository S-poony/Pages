/**
 * Flipbook Link Handling Module
 * Centralizes all link-related interactions (EPUB, PDF, and external links)
 * into a single unified event listener.
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

        if (!targetPageEl) {
            console.warn('Link Preview: Target page not found', targetPageNum);
            return;
        }

        if (currentPreviewPage !== targetPageNum || !previewElement.classList.contains('visible')) {
            previewElement.innerHTML = '';
            const previewContent = document.createElement('div');
            previewContent.className = 'preview-content';

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

        if (left + previewW > rect.width) {
            left = (mouseX - rect.left) - previewW - margin;
        }
        if (top + previewH > rect.height) {
            top = rect.height - previewH - margin;
        }

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
            currentPreviewPage = null;
        }, delay);
    };

    // Centralized event listener for clicks
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const epubHref = link.getAttribute('data-epub-href');
        const targetPageAttr = link.getAttribute('data-target-page');

        if (epubHref) {
            e.preventDefault();
            e.stopPropagation();
            const linkMap = config.linkMap || {};
            let targetPage = linkMap[epubHref];

            if (!targetPage) {
                const matchingKeys = Object.keys(linkMap).filter(key =>
                    key.includes(epubHref) || epubHref.includes(key)
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

    // Hover listeners
    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const epubHref = link.getAttribute('data-epub-href');
        const targetPageAttr = link.getAttribute('data-target-page');
        if (!epubHref && !targetPageAttr) return;

        // CRITICAL: Always clear hide timeout when over an internal link
        clearTimeout(hideTimeout);

        // If same link, just update position IF the preview is already showing.
        // If it's NOT showing (e.g. we re-entered during grace period), we proceed to trigger show.
        if (link === currentLink && previewElement && previewElement.classList.contains('visible')) {
            updatePosition(e.clientX, e.clientY);
            return;
        }

        currentLink = link;
        let targetPageNum = null;

        if (epubHref) {
            const linkMap = config.linkMap || {};
            targetPageNum = linkMap[epubHref];
            if (!targetPageNum) {
                const matchingKeys = Object.keys(linkMap).filter(key =>
                    key.includes(epubHref) || epubHref.includes(key)
                );
                if (matchingKeys.length > 0) {
                    targetPageNum = linkMap[matchingKeys[0]];
                }
            }
        } else if (targetPageAttr) {
            targetPageNum = parseInt(targetPageAttr, 10);
        }

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
