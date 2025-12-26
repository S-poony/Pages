/**
 * Flipbook UI Module
 * Manages all UI event listeners, controls (zoom, full-screen, TOC), and user input handling.
 */
function setupUI(pageCount, pageInput, zoomSlider, zoomText, controlsPanel, topControlsPanel, fullscreenBtn, wrapper, tocBtn, tableOfContents, tocModal, tocList, tocCloseBtn, tocOverlay, prevPageBtn, nextPageBtn, pageLinksBtn, linksModal, linksList, linksCloseBtn) {
    // Mobile-friendly control panel activation (both panels share state)
    let controlsPanelTimeout = null;
    let isUsingSlider = false;

    const activateControlPanel = () => {
        if (controlsPanel) controlsPanel.classList.add('active');
        if (topControlsPanel) topControlsPanel.classList.add('active');

        // Clear any existing timeout
        if (controlsPanelTimeout) {
            clearTimeout(controlsPanelTimeout);
            controlsPanelTimeout = null;
        }
    };

    const deactivateControlPanel = () => {
        if (isUsingSlider) return;
        controlsPanelTimeout = setTimeout(() => {
            if (controlsPanel) controlsPanel.classList.remove('active');
            if (topControlsPanel) topControlsPanel.classList.remove('active');
        }, 1000);
    };

    if (controlsPanel) {
        controlsPanel.addEventListener('click', () => {
            activateControlPanel();
            deactivateControlPanel();
        });
    }

    if (topControlsPanel) {
        topControlsPanel.addEventListener('click', () => {
            activateControlPanel();
            deactivateControlPanel();
        });
    }

    // Fullscreen button handler
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                wrapper.requestFullscreen().catch(err => {
                    console.error('Error attempting to enable fullscreen:', err);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Deactivate controls when clicking outside
    document.addEventListener('click', (e) => {
        const isClickInsideControls = controlsPanel && controlsPanel.contains(e.target);
        const isClickInsideTopControls = topControlsPanel && topControlsPanel.contains(e.target);
        if (isUsingSlider) return;
        if (!isClickInsideControls && !isClickInsideTopControls) {
            if (controlsPanel) controlsPanel.classList.remove('active');
            if (topControlsPanel) topControlsPanel.classList.remove('active');
            if (controlsPanelTimeout) {
                clearTimeout(controlsPanelTimeout);
                controlsPanelTimeout = null;
            }
        }
    });

    // Zoom Slider
    if (zoomSlider) {
        zoomSlider.addEventListener('mousedown', () => {
            isUsingSlider = true;
            activateControlPanel();
        });
        zoomSlider.addEventListener('touchstart', () => {
            isUsingSlider = true;
            activateControlPanel();
        });
        zoomSlider.addEventListener('mouseup', () => {
            isUsingSlider = false;
            deactivateControlPanel();
        });
        zoomSlider.addEventListener('touchend', () => {
            isUsingSlider = false;
            deactivateControlPanel();
        });
        zoomSlider.addEventListener('input', e => {
            zoom = parseFloat(e.target.value);
            if (zoomText) {
                zoomText.textContent = Number.isInteger(zoom) ? `${zoom}x` : `${zoom.toFixed(2)}x`;
            }
            updateTransform();
            debouncedUpdateImageSizes();
        });
        zoomSlider.addEventListener('keydown', e => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
    }

    // Page navigation buttons
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (zoom > 1) return;
            pageFlip.flipPrev();
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (zoom > 1) return;
            pageFlip.flipNext();
        });
    }

    // Page input handler (REMAINS CORRECTLY IMPLEMENTED AS REQUESTED)
    if (pageInput) {
        pageInput.addEventListener('change', e => {
            if (zoom > 1) return;
            const targetPage = parseInt(e.target.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= pageCount) {
                pageFlip.flip(targetPage - 1);
            }
        });
    }

    // Table of Contents
    if (tocBtn && tableOfContents.length > 0) {
        tocBtn.style.display = 'flex';
        function renderTOC(items, container, level = 0) {
            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = `toc-item toc-level-${level}`;
                itemEl.innerHTML = `<span class="toc-item-title">${item.title}</span><span class="toc-item-page">${item.page}</span>`;
                itemEl.addEventListener('click', () => {
                    if (pageFlip) {
                        pageFlip.flip(item.page - 1);
                        closeTOC();
                    }
                });
                container.appendChild(itemEl);
                if (item.children && item.children.length > 0) {
                    renderTOC(item.children, container, level + 1);
                }
            });
        }
        renderTOC(tableOfContents, tocList);
        const openTOC = () => tocModal.classList.remove('hidden');
        const closeTOC = () => tocModal.classList.add('hidden');
        tocBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTOC();
        });
        if (tocCloseBtn) tocCloseBtn.addEventListener('click', closeTOC);
        if (tocOverlay) tocOverlay.addEventListener('click', closeTOC);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !tocModal.classList.contains('hidden')) {
                closeTOC();
            }
        });
    }

    // Page Links List
    if (pageLinksBtn && linksModal && linksList) {
        const isExternalUrl = (url) => url && (url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('tel:'));

        const getLinksFromVisiblePages = () => {
            if (!pageFlip) return [];
            const activeIndex = pageFlip.getCurrentPageIndex();
            const display = pageFlip.getOrientation() === 'landscape' ? 'double' : 'single';

            const pageContainers = document.querySelectorAll('.page-container');
            const indices = [activeIndex];
            if (display === 'double') indices.push(activeIndex + 1);

            const links = [];
            indices.forEach(idx => {
                const page = pageContainers[idx];
                if (!page) return;

                // Query all links in the enrichment layer
                const pageLinks = page.querySelectorAll('.enrichment-layer a');
                pageLinks.forEach(a => {
                    const epubHref = a.getAttribute('data-epub-href');
                    let targetPage = a.getAttribute('data-target-page');

                    // Resolve EPUB link for the list title/target if possible
                    if (epubHref) {
                        const linkMap = (window.FLIPBOOK_CONFIG && window.FLIPBOOK_CONFIG.linkMap) || {};
                        targetPage = linkMap[epubHref];
                    }

                    const href = a.getAttribute('href');
                    const isExternal = isExternalUrl(href);

                    links.push({
                        title: a.getAttribute('title') || a.textContent.trim() || (isExternal ? 'External Link' : 'Internal Link'),
                        url: isExternal ? href : null,
                        targetPage: targetPage,
                        epubHref: epubHref,
                        sourceArea: {
                            top: parseFloat(a.getAttribute('data-source-top')),
                            left: parseFloat(a.getAttribute('data-source-left')),
                            width: parseFloat(a.getAttribute('data-source-width')),
                            height: parseFloat(a.getAttribute('data-source-height'))
                        },
                        sourcePageIndex: idx
                    });
                });
            });
            return links;
        };

        const updateLinksButtonVisibility = () => {
            const links = getLinksFromVisiblePages();
            if (links.length > 0) {
                pageLinksBtn.style.display = 'flex';
            } else {
                pageLinksBtn.style.display = 'none';
                closeLinks();
            }
        };

        const renderLinks = (links) => {
            linksList.innerHTML = '';
            links.forEach(link => {
                const itemEl = document.createElement('div');
                itemEl.className = 'toc-item';

                let targetText = '';
                if (link.url) {
                    targetText = link.url.length > 30 ? link.url.substring(0, 27) + '...' : link.url;
                } else if (link.targetPage) {
                    targetText = `Page ${link.targetPage}`;
                }

                // let previewHtml = ''; // This line is replaced by the new logic
                if (link.sourceArea && !isNaN(link.sourceArea.top)) {
                    const pageContainers = document.querySelectorAll('.page-container');
                    const sourcePageEl = pageContainers[link.sourcePageIndex];
                    if (sourcePageEl) {
                        const sourceImg = sourcePageEl.querySelector('img.page-image');
                        if (sourceImg) {
                            const { top, left, width, height } = link.sourceArea;
                            // Calculate zoom: fill the preview box as much as possible but cap resolution
                            // Preview box is ~100x60 (1.66 aspect)
                            // We want to center the link.
                            const centerX = left + width / 2;
                            const centerY = top + height / 2;

                            // To avoid blurriness, we cap the background-size.
                            // Container is 100x60. We use a zoom factor.
                            const zoom = Math.min(800, Math.max(200, 100 / Math.max(width / 100, height * 1.66 / 100)));
                            const zoomFactor = zoom / 100;

                            const aspect = sourceImg.naturalWidth / sourceImg.naturalHeight || 0.707;
                            const imgW = 100 * zoomFactor;
                            const imgH = imgW / aspect;

                            // Calculate pixel offset to center the link in the 100x60 box
                            const posX = 50 - (centerX / 100) * imgW;
                            const posY = 30 - (centerY / 100) * imgH;

                            const highlightWidth = width * (zoomFactor);
                            const highlightHeight = height * (zoomFactor);

                            previewHtml = `
                                <div class="link-preview-container">
                                    <div class="link-preview-viewport" style="
                                        background-image: url('${sourceImg.src}');
                                        background-position: ${posX}px ${posY}px;
                                        background-size: ${imgW}px ${imgH}px;
                                    "></div>
                                    <div class="link-preview-highlight" style="
                                        width: ${highlightWidth}px;
                                        height: ${highlightHeight}px;
                                        left: calc(50% - ${highlightWidth / 2}px);
                                        top: calc(50% - ${highlightHeight / 2}px);
                                    "></div>
                                </div>
                            `;
                        }
                    }
                }

                itemEl.innerHTML = `
                    ${previewHtml}
                    <div class="toc-item-text">
                        <span class="toc-item-title">${link.title}</span>
                        <span class="toc-item-page">${targetText}</span>
                    </div>
                `;

                itemEl.addEventListener('click', () => {
                    if (link.url) {
                        window.open(link.url, '_blank');
                    } else if (link.targetPage) {
                        const pageNum = parseInt(link.targetPage, 10);
                        if (!isNaN(pageNum)) {
                            console.log('Links Modal: Flipping to page', pageNum);
                            pageFlip.flip(pageNum - 1);
                        }
                    }
                    closeLinks();
                });
                linksList.appendChild(itemEl);
            });
        };

        const openLinks = () => {
            const links = getLinksFromVisiblePages();
            renderLinks(links);
            linksModal.classList.remove('hidden');
        };
        const closeLinks = () => linksModal.classList.add('hidden');

        pageLinksBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openLinks();
        });
        if (linksCloseBtn) linksCloseBtn.addEventListener('click', closeLinks);

        // Expose to window for main.js to call
        window.updateLinksButtonVisibility = updateLinksButtonVisibility;

        // Initial check
        setTimeout(updateLinksButtonVisibility, 500);
    }

    // Keyboard navigation
    document.addEventListener('keydown', e => {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        if (zoom > 1) {
            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
            return;
        }
        if (pageFlip) {
            if (e.key === 'ArrowRight') pageFlip.flipNext();
            else if (e.key === 'ArrowLeft') pageFlip.flipPrev();
        }
    });

    // Panning helper
    const onStart = (clientX, clientY) => {
        if (zoom > 1) {
            isPanning = true;
            startX = clientX - panX;
            startY = clientY - panY;
            wrapper.style.cursor = 'grabbing';
        }
    };
    const onMove = (clientX, clientY) => {
        if (isPanning && zoom > 1) {
            panX = clientX - startX;
            panY = clientY - startY;
            updateTransform();
        }
    };
    const onEnd = () => {
        isPanning = false;
        if (zoom > 1) wrapper.style.cursor = 'grab';
    };

    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('#controls-panel') || e.target.closest('#top-controls-panel')) return;
        onStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            e.preventDefault();
            onMove(e.clientX, e.clientY);
        }
    });
    window.addEventListener('mouseup', onEnd);
    wrapper.addEventListener('touchstart', (e) => {
        if (e.target.closest('#controls-panel') || e.target.closest('#top-controls-panel')) return;
        if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (isPanning && e.touches.length === 1) {
            if (e.cancelable) e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onEnd);
}
