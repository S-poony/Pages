/**
 * Flipbook Link Handling Module
 * Centralizes all link-related interactions (EPUB, PDF, and external links)
 * into a single unified event listener.
 */

/**
 * Sets up a centralized click listener for all flipbook links
 * @param {Object} pageFlip - StPageFlip instance
 * @param {Object} config - Flipbook configuration
 */
function setupLinks(pageFlip, config) {
    console.log('Setting up flipbook links handle...', { hasLinkMap: !!config.linkMap });

    let previewElement = null;
    let showTimeout = null;
    let hideTimeout = null;
    let currentPreviewPage = null;
    let currentLink = null;

    const createPreviewElement = () => {
        const el = document.createElement('div');
        el.className = 'link-hover-preview';
        document.body.appendChild(el);

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

        // Performance: Don't re-render if it's the same page
        if (currentPreviewPage !== targetPageNum) {
            const pageContainers = document.querySelectorAll('.page-container');
            const targetPageEl = pageContainers[targetPageNum - 1];

            if (!targetPageEl) return;

            // Clear and build ultra-light content
            previewElement.innerHTML = '';
            const previewContent = document.createElement('div');
            previewContent.className = 'preview-content';

            const img = targetPageEl.querySelector('img.page-image');
            if (img) {
                // Cloning <img> is lightweight as it reuses browser cache
                const previewImg = img.cloneNode(false);
                previewImg.src = img.src;
                if (img.srcset) previewImg.srcset = img.srcset;
                if (img.sizes) previewImg.sizes = img.sizes;
                previewImg.style.pointerEvents = 'none';
                previewContent.appendChild(previewImg);
            }

            // IGNORE enrichment layer in preview for absolute maximum performance
            // unless specifically requested. Cloned images are enough for 99% of cases.

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
        const previewW = 300;
        const previewH = Math.min(400, window.innerHeight - 40);

        let left = mouseX + margin;
        let top = mouseY + margin;

        if (left + previewW > window.innerWidth) {
            left = mouseX - previewW - margin;
        }
        if (top + previewH > window.innerHeight) {
            top = window.innerHeight - previewH - margin;
        }
        if (top < margin) top = margin;

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

    // Centralized event listener for clicks
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const epubHref = link.getAttribute('data-epub-href');
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

        const targetPage = link.getAttribute('data-target-page');
        if (targetPage) {
            e.preventDefault();
            e.stopPropagation();

            const pageNum = parseInt(targetPage, 10);
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

        // CRITICAL FIX: Always clear hide timeout when entering any link area
        clearTimeout(hideTimeout);

        if (link === currentLink) {
            if (previewElement && previewElement.classList.contains('visible')) {
                updatePosition(e.clientX, e.clientY);
            }
            return;
        }

        const epubHref = link.getAttribute('data-epub-href');
        const targetPage = link.getAttribute('data-target-page');

        if (!epubHref && !targetPage) return; // Not an internal link

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
        } else if (targetPage) {
            targetPageNum = parseInt(targetPage, 10);
        }

        if (targetPageNum && !isNaN(targetPageNum)) {
            clearTimeout(showTimeout);
            showTimeout = setTimeout(() => {
                showPreview(targetPageNum, e.clientX, e.clientY);
            }, 150); // Slightly faster response
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
