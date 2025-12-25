/**
 * PDF Bookmarks Extraction Module
 * Recursively traverses the PDF's internal outline/bookmarks structure to build
 * a hierarchical and page-mapped Table of Contents.
 */

/**
 * Extracts links (annotations) from a PDF page
 * @param {Object} page - PDF.js page object
 * @returns {Promise<Array>} Array of link objects { rect, url, dest, pageNumber }
 */
export async function extractPageLinks(page) {
    const annotations = await page.getAnnotations();
    const links = [];

    for (const annot of annotations) {
        if (annot.subtype === 'Link') {
            const link = {
                rect: annot.rect, // [x1, y1, x2, y2]
                title: annot.title || ''
            };

            if (annot.url) {
                link.url = annot.url;
            } else if (annot.dest) {
                link.dest = annot.dest;
            }

            links.push(link);
        }
    }

    return links;
}

/**
 * Resolves link destinations to page numbers
 * @param {Object} pdf - PDF.js document object
 * @param {Array} links - Array of extracted links
 * @returns {Promise<Array>} Links with resolved page numbers
 */
export async function resolveLinkDestinations(pdf, links) {
    const resolvedLinks = [];

    for (const link of links) {
        if (link.dest) {
            try {
                let dest = link.dest;
                if (typeof dest === 'string') {
                    dest = await pdf.getDestination(dest);
                }

                if (dest && dest[0]) {
                    const pageIndex = await pdf.getPageIndex(dest[0]);
                    link.pageNumber = pageIndex + 1;
                }
            } catch (e) {
                console.warn('Failed to resolve PDF link destination:', e);
            }
        }
        resolvedLinks.push(link);
    }

    return resolvedLinks;
}

/**
 * Normalizes link rectangles to percentage-based coordinates
 * @param {Array} links - Array of resolved links
 * @param {number} pageWidth - Page width in PDF points
 * @param {number} pageHeight - Page height in PDF points
 * @returns {Array} Links with percentage-based { top, left, width, height }
 */
export function normalizeLinkRects(links, pageWidth, pageHeight) {
    return links.map(link => {
        const [x1, y1, x2, y2] = link.rect;

        // PDF coordinates are usually bottom-up
        // top = (pageHeight - y2) / pageHeight
        const top = ((pageHeight - Math.max(y1, y2)) / pageHeight) * 100;
        const left = (Math.min(x1, x2) / pageWidth) * 100;
        const width = (Math.abs(x2 - x1) / pageWidth) * 100;
        const height = (Math.abs(y2 - y1) / pageHeight) * 100;

        return {
            ...link,
            top: `${top.toFixed(4)}%`,
            left: `${left.toFixed(4)}%`,
            width: `${width.toFixed(4)}%`,
            height: `${height.toFixed(4)}%`
        };
    });
}
