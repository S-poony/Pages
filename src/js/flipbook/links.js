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
                console.log('Flipping to EPUB page:', targetPage);
                pageFlip.flip(targetPage - 1);
            } else {
                console.warn('Could not resolve EPUB link:', epubHref);
            }
            return;
        }

        // 3. Handle Unified Internal Links (New attribute)
        const targetPage = link.getAttribute('data-target-page');
        if (targetPage) {
            e.preventDefault();
            const pageNum = parseInt(targetPage, 10);
            if (!isNaN(pageNum) && pageFlip) {
                console.log('Flipping to PDF page:', pageNum);
                pageFlip.flip(pageNum - 1);
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
