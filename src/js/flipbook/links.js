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
    document.addEventListener('click', (e) => {
        // 1. Find the closest link element
        const link = e.target.closest('a');
        if (!link) return;

        console.log('Link clicked:', {
            href: link.getAttribute('href'),
            epubHref: link.getAttribute('data-epub-href'),
            targetPage: link.getAttribute('data-target-page')
        });

        // 2. Handle EPUB Internal Links (Legacy attribute)
        const epubHref = link.getAttribute('data-epub-href');
        if (epubHref) {
            e.preventDefault();
            e.stopPropagation(); // Prevent StPageFlip from seeing the click
            const linkMap = config.linkMap || {};

            // Try direct match
            let targetPage = linkMap[epubHref];

            // Try fuzzy match if direct fails
            if (!targetPage) {
                const matchingKeys = Object.keys(linkMap).filter(key =>
                    key.includes(epubHref) || epubHref.includes(key)
                );
                if (matchingKeys.length > 0) {
                    targetPage = linkMap[matchingKeys[0]];
                }
            }

            if (targetPage && pageFlip) {
                console.log('EPUB Link clicked (capture): Target Page =', targetPage);
                // Zoom out before jumping if needed
                if (typeof zoom !== 'undefined' && zoom > 1) {
                    zoom = 1;
                    panX = 0;
                    panY = 0;
                    const slider = document.getElementById('zoom-slider');
                    if (slider) slider.value = 1;
                    const zoomText = document.getElementById('zoom-level');
                    if (zoomText) zoomText.textContent = '1x';
                    if (typeof updateTransform === 'function') updateTransform();

                    // Small delay to allow zoom-out animation to start
                    setTimeout(() => pageFlip.flip(targetPage - 1), 150);
                } else {
                    pageFlip.flip(targetPage - 1);
                }
            } else {
                console.warn('EPUB Link click: Could not resolve target', { epubHref, hasLinkMap: !!linkMap.length });
            }
            return;
        }

        // 3. Handle Unified Internal Links (New attribute)
        const targetPage = link.getAttribute('data-target-page');
        if (targetPage) {
            e.preventDefault();
            e.stopPropagation(); // Prevent StPageFlip from seeing the click

            const pageNum = parseInt(targetPage, 10);
            if (!isNaN(pageNum) && pageFlip) {
                console.log('PDF Link clicked (capture): Target Page =', pageNum);
                // Zoom out before jumping if needed
                if (typeof zoom !== 'undefined' && zoom > 1) {
                    zoom = 1;
                    panX = 0;
                    panY = 0;
                    const slider = document.getElementById('zoom-slider');
                    if (slider) slider.value = 1;
                    const zoomText = document.getElementById('zoom-level');
                    if (zoomText) zoomText.textContent = '1x';
                    if (typeof updateTransform === 'function') updateTransform();

                    // Small delay to allow zoom-out animation to start
                    setTimeout(() => pageFlip.flip(pageNum - 1), 150);
                } else {
                    pageFlip.flip(pageNum - 1);
                }
            } else {
                console.warn('PDF Link click: Could not navigate', { pageNum, hasPageFlip: !!pageFlip });
            }
            return;
        }

        // 4. Handle External Links
        const href = link.getAttribute('href');
        if (href && (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:'))) {
            // Stop StPageFlip from flipping when clicking external links
            e.stopPropagation();
        }
    }, true); // useCapture = true to intercept before others
}
