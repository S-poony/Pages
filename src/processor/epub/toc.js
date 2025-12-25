/**
 * EPUB TOC Extraction Module
 */

/**
 * Extracts the Table of Contents from the EPUB and maps it to page numbers
 * @param {Object} book - EPUB book object
 * @param {Object} linkMap - Map of paths to page numbers
 * @returns {Array} Structured Table of Contents
 */
export function extractTableOfContents(book, linkMap) {
    const toc = book.navigation.toc;
    if (!toc || toc.length === 0) return [];

    function processItems(items) {
        const result = [];
        for (const item of items) {
            const href = decodeURIComponent(item.href);
            // Try exact match first
            let page = linkMap[href];

            // If not found, try to find by checking if it's a chapter path
            if (!page) {
                // Sometimes TOC href has ../ prefix or different base
                // We'll try to find a matching key in linkMap
                // This is a simple heuristic
                const normalizedHref = href.replace(/^\.\.\//, ''); // Remove leading ../

                // Try to find if any key ends with this href
                const key = Object.keys(linkMap).find(k => k.endsWith(normalizedHref));
                if (key) {
                    page = linkMap[key];
                }
            }

            if (page) {
                const entry = {
                    title: item.label.trim(),
                    page: page
                };

                if (item.subitems && item.subitems.length > 0) {
                    const children = processItems(item.subitems);
                    if (children.length > 0) {
                        entry.children = children;
                    }
                }

                result.push(entry);
            }
        }
        return result;
    }

    return processItems(toc);
}
