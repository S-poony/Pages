/**
 * EPUB Pagination Module
 * Implements a recursive DOM walker that splits reflowable HTML content into
 * discrete pages based on height constraints, while avoiding cutting text or images.
 */

/**
 * Paginates HTML content using a recursive DOM walker
 * Ensures content fits within pageHeight without cutting text or images
 * @param {string} html - HTML content to paginate
 * @param {HTMLElement} measureContainer - Hidden container for measuring
 * @param {number} pageHeight - Target height for each page
 * @returns {Promise<{pages: Array<string>, anchors: Object}>} Array of HTML strings for each page and anchor map
 */
export async function paginateContent(html, measureContainer, pageHeight) {
    const pages = [];
    const anchors = {}; // Map of anchorId -> pageIndex (0-based within this chapter)
    const sourceDiv = document.createElement('div');
    sourceDiv.innerHTML = html;

    let currentPageDiv = document.createElement('div');
    currentPageDiv.style.display = 'flow-root'; // Contain child margins
    measureContainer.innerHTML = '';
    measureContainer.appendChild(currentPageDiv);

    const checkOverflow = () => {
        // Use offsetHeight of the container which includes padding and content
        const currentHeight = measureContainer.offsetHeight;
        // Target height is the fixed page height. No safety margin needed with precision splitting.
        return currentHeight > pageHeight;
    };

    const startNewPage = () => {
        if (currentPageDiv.childNodes.length > 0) {
            pages.push(currentPageDiv.innerHTML);
        }
        currentPageDiv = document.createElement('div');
        currentPageDiv.style.display = 'flow-root';
        measureContainer.innerHTML = '';
        measureContainer.appendChild(currentPageDiv);
    };

    const processNodeRecursive = (node, targetParent, ancestors) => {
        const deepClone = node.cloneNode(true);
        targetParent.appendChild(deepClone);

        if (node.nodeType === Node.ELEMENT_NODE && node.id) {
            anchors[node.id] = pages.length;
        }

        if (!checkOverflow()) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const elementsWithId = deepClone.querySelectorAll('[id]');
                for (const el of elementsWithId) {
                    anchors[el.id] = pages.length;
                }
            }
            return;
        }

        targetParent.removeChild(deepClone);

        const isAtomic = node.nodeType === Node.ELEMENT_NODE &&
            ['IMG', 'BR', 'HR', 'VIDEO', 'AUDIO', 'INPUT', 'TABLE'].includes(node.tagName);

        if (isAtomic) {
            startNewPage();
            let currentNewParent = currentPageDiv;
            for (const ancestor of ancestors) {
                const ancestorClone = ancestor.cloneNode(false);
                currentNewParent.appendChild(ancestorClone);
                currentNewParent = ancestorClone;
            }
            currentNewParent.appendChild(deepClone);
            return { pageBroken: true };
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const fullText = node.textContent || '';
            if (!fullText.trim()) return;

            let low = 0;
            let high = fullText.length;
            let bestSplit = 0;

            // Manual binary search for best character split point
            const probeNode = document.createTextNode('');
            targetParent.appendChild(probeNode);

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                probeNode.textContent = fullText.substring(0, mid);

                if (checkOverflow()) {
                    high = mid - 1;
                } else {
                    bestSplit = mid;
                    low = mid + 1;
                }
            }

            // If even the first character doesn't fit and the page is empty, we must accept it to prevent infinite loops
            if (bestSplit === 0 && targetParent.childNodes.length === 1 && !ancestors.some(a => a.previousSibling)) {
                bestSplit = 1;
            }

            // Find nearest space before bestSplit to avoid cutting words
            let splitPoint = bestSplit;
            if (splitPoint < fullText.length && splitPoint > 0) {
                const lastSpace = fullText.lastIndexOf(' ', splitPoint);
                if (lastSpace > 0) {
                    splitPoint = lastSpace + 1; // Include the space on this page
                }
            }

            // Apply split to current page
            probeNode.textContent = fullText.substring(0, splitPoint);

            // Handle remainder
            const remainder = fullText.substring(splitPoint).trimStart();
            if (remainder) {
                startNewPage();
                let currentNewParent = currentPageDiv;
                for (const ancestor of ancestors) {
                    const ancestorClone = ancestor.cloneNode(false);
                    currentNewParent.appendChild(ancestorClone);
                    currentNewParent = ancestorClone;
                }
                const remainderNode = document.createTextNode(remainder);
                currentNewParent.appendChild(remainderNode);
                return { pageBroken: true };
            }
            return;
        }

        // Container splitting for element nodes
        const shallowClone = node.cloneNode(false);
        targetParent.appendChild(shallowClone);
        const childAncestors = [...ancestors, node];
        let currentTarget = shallowClone;

        for (const child of Array.from(node.childNodes)) {
            const result = processNodeRecursive(child, currentTarget, childAncestors);
            if (result && result.pageBroken) {
                let pointer = currentPageDiv;
                for (const ancestor of childAncestors) {
                    // Navigate to the deepest nested clone on the new page
                    if (pointer.lastElementChild) {
                        pointer = pointer.lastElementChild;
                    } else {
                        const aClone = ancestor.cloneNode(false);
                        pointer.appendChild(aClone);
                        pointer = aClone;
                    }
                }
                currentTarget = pointer;
            }
        }
    };

    for (const child of Array.from(sourceDiv.childNodes)) {
        processNodeRecursive(child, currentPageDiv, []);
    }

    if (currentPageDiv.childNodes.length > 0) {
        pages.push(currentPageDiv.innerHTML);
    }

    return { pages, anchors };
}
