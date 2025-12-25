/**
 * PDF Bookmarks Extraction Module
 * Recursively traverses the PDF's internal outline/bookmarks structure to build
 * a hierarchical and page-mapped Table of Contents.
 */

/**
 * Extract bookmarks (outline) from a PDF document
 * @param {PDFDocumentProxy} pdf - PDF.js document proxy
 * @returns {Promise<Array>} Array of TOC entries with {title, page, level, children}
 */
export async function extractBookmarks(pdf) {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) {
        return [];
    }

    /**
     * Recursively process outline items
     * @param {Array} items - Outline items from PDF.js
     * @param {number} level - Current nesting level
     * @returns {Promise<Array>} Processed TOC entries
     */
    async function processOutline(items, level = 0) {
        const result = [];

        for (const item of items) {
            try {
                // Get destination
                let dest = item.dest;

                // If dest is a string, resolve it
                if (typeof dest === 'string') {
                    dest = await pdf.getDestination(dest);
                }

                if (!dest) {
                    console.warn('Could not resolve destination for bookmark:', item.title);
                    continue;
                }

                // First element of dest is the page reference
                const pageRef = dest[0];

                // Get page index (0-based)
                const pageIndex = await pdf.getPageIndex(pageRef);

                // Create TOC entry (1-based page number for display)
                const tocEntry = {
                    title: item.title,
                    page: pageIndex + 1,
                    level
                };

                // Process children recursively if they exist
                if (item.items && item.items.length > 0) {
                    tocEntry.children = await processOutline(item.items, level + 1);
                }

                result.push(tocEntry);
            } catch (error) {
                console.warn(`Failed to process bookmark "${item.title}":`, error);
            }
        }

        return result;
    }

    return processOutline(outline);
}

/**
 * Flatten nested TOC structure (optional utility)
 * @param {Array} toc - Hierarchical TOC array
 * @param {number} maxLevel - Maximum level to include (null for all)
 * @returns {Array} Flattened TOC array
 */
export function flattenTOC(toc, maxLevel = null) {
    const result = [];

    function flatten(items, currentLevel = 0) {
        for (const item of items) {
            if (maxLevel === null || currentLevel <= maxLevel) {
                result.push({
                    title: item.title,
                    page: item.page,
                    level: item.level
                });
            }

            if (item.children && item.children.length > 0) {
                flatten(item.children, currentLevel + 1);
            }
        }
    }

    flatten(toc);
    return result;
}
