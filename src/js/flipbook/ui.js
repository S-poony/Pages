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
            handleZoomNavigation(() => pageFlip.flipPrev());
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            handleZoomNavigation(() => pageFlip.flipNext());
        });
    }

    // Page input handler
    if (pageInput) {
        pageInput.addEventListener('change', e => {
            const targetPage = parseInt(e.target.value);
            if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= pageCount) {
                handleZoomNavigation(() => pageFlip.flip(targetPage - 1));
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
                // Add data-page attribute for Active TOC logic
                itemEl.setAttribute('data-page', item.page);

                itemEl.innerHTML = `<span class="toc-item-title">${item.title}</span><span class="toc-item-page">${item.page}</span>`;
                itemEl.addEventListener('click', () => {
                    if (pageFlip) {
                        handleZoomNavigation(() => {
                            pageFlip.flip(item.page - 1);
                            closeTOC();
                        });
                    }
                });
                container.appendChild(itemEl);
                if (item.children && item.children.length > 0) {
                    renderTOC(item.children, container, level + 1);
                }
            });
        }
        renderTOC(tableOfContents, tocList);

        // Active TOC Logic
        window.updateActiveTOC = (currentPage) => {
            const items = tocList.querySelectorAll('.toc-item');
            let activeItem = null;

            items.forEach(item => {
                item.classList.remove('active');
                const itemPage = parseInt(item.getAttribute('data-page'), 10);
                if (itemPage <= currentPage) {
                    activeItem = item;
                }
            });

            if (activeItem) {
                activeItem.classList.add('active');
                // Only scroll if TOC is visible to avoid unnecessary layout calculations
                if (!tocModal.classList.contains('hidden')) {
                    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        };

        const openTOC = () => {
            tocModal.classList.remove('hidden');
            // Update active item when opening just in case
            if (window.pageFlip) {
                window.updateActiveTOC(window.pageFlip.getCurrentPageIndex() + 1);
            }
        };
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
            const display = (pageFlip.getSettings() && pageFlip.getSettings().display) || 'double';

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
                    const isExternal = href && (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:'));

                    // Skip links that have no destination
                    if (!isExternal && !targetPage) return;

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
                    targetText = link.url.length > 60 ? link.url.substring(0, 57) + '...' : link.url;
                } else if (link.targetPage) {
                    targetText = `Page ${link.targetPage}`;
                }

                let previewHtml = '';
                if (link.sourceArea && !isNaN(link.sourceArea.top)) {
                    const pageContainers = document.querySelectorAll('.page-container');
                    const sourcePageEl = pageContainers[link.sourcePageIndex];
                    if (sourcePageEl) {
                        const sourceImg = sourcePageEl.querySelector('img.page-image');
                        if (sourceImg) {
                            const { top, left, width, height } = link.sourceArea;
                            // Replicate CSS logic for preview dimensions to ensure JS math matches exactly
                            let previewW = Math.min(window.innerWidth * 0.25, 180); // max-width: 180px
                            let previewH = previewW * 0.6;

                            // Check media query equivalent (max-height: 600px)
                            if (window.innerHeight <= 600) {
                                previewH = Math.min(window.innerHeight * 0.15, 108); // max-height: 108px
                                previewW = previewH * 1.666;
                            }

                            const previewAspect = previewW / previewH;
                            const centerX = left + width / 2;
                            const centerY = top + height / 2;

                            // Calculate zoom: fill the preview box as much as possible but cap resolution
                            // To avoid blurriness, we cap the background-size.
                            const zoom = Math.min(800, Math.max(200, 100 / Math.max(width / 100, height * previewAspect / 100)));
                            const zoomFactor = zoom / 100;

                            const aspect = sourceImg.naturalWidth / sourceImg.naturalHeight || 0.707;
                            const imgW = previewW * zoomFactor;
                            const imgH = imgW / aspect;

                            // Calculate pixel offset to center the link in the box
                            const posX = (previewW / 2) - (centerX / 100) * imgW;
                            const posY = (previewH / 2) - (centerY / 100) * imgH;

                            const highlightWidth = width * (zoomFactor);
                            const highlightHeight = height * (zoomFactor);


                            // Create offscreen canvas for the thumbnail
                            const canvas = document.createElement('canvas');
                            // Scale for high DPI
                            const pixelRatio = window.devicePixelRatio || 1;
                            canvas.width = previewW * pixelRatio;
                            canvas.height = previewH * pixelRatio;

                            const ctx = canvas.getContext('2d');
                            ctx.scale(pixelRatio, pixelRatio);

                            // Draw the image at the exact position calculated for CSS
                            // CSS 'backgound-position: Xpx Ypx' corresponds to drawing at (X, Y)
                            ctx.drawImage(sourceImg, posX, posY, imgW, imgH);

                            // Export to low-quality JPEG for memory efficiency
                            const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);

                            previewHtml = `
                                <div class="link-preview-container">
                                    <div class="link-preview-viewport" style="
                                        background-image: url('${thumbUrl}');
                                        background-position: center;
                                        background-size: 100% 100%;
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
                            handleZoomNavigation(() => pageFlip.flip(pageNum - 1));
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
        if (isZoomed()) {
            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
            return;
        }
        if (pageFlip) {
            if (e.key === 'ArrowRight') pageFlip.flipNext();
            else if (e.key === 'ArrowLeft') pageFlip.flipPrev();
        }
    });

    // Panning helper
    let isActuallyPanning = false;
    let mouseDownX = 0;
    let mouseDownY = 0;
    const PAN_THRESHOLD = 5;

    const onStart = (clientX, clientY) => {
        if (isZoomed()) {
            isPanning = true;
            window.isPanning = true; // Expose globally for scaling.js check
            isActuallyPanning = false;
            mouseDownX = clientX;
            mouseDownY = clientY;
            startX = clientX - panX;
            startY = clientY - panY;
            wrapper.style.cursor = 'grabbing';
        }
    };
    const onMove = (clientX, clientY) => {
        if (isPanning && isZoomed()) {
            const dist = getDistance(mouseDownX, mouseDownY, clientX, clientY);
            if (!isActuallyPanning && dist > PAN_THRESHOLD) {
                isActuallyPanning = true;
            }

            if (isActuallyPanning) {
                panX = clientX - startX;
                panY = clientY - startY;
                updateTransform(true); // Optimization: Pan only
            }
        }
    };
    const onEnd = () => {
        isPanning = false;
        window.isPanning = false;
        isActuallyPanning = false;
        if (isZoomed()) {
            wrapper.style.cursor = 'grab';
            // Trigger quality update now that panning has stopped
            debouncedUpdateImageSizes();
        }
    };

    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('#controls-panel') || e.target.closest('#top-controls-panel')) return;
        onStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
        if (isPanning) {
            if (isActuallyPanning) {
                e.preventDefault();
            }
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
            if (isActuallyPanning && e.cancelable) {
                e.preventDefault();
            }
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onEnd);
}
