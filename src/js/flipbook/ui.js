/**
 * Flipbook UI Module
 * Manages all UI event listeners, controls (zoom, full-screen, TOC), and user input handling.
 */
function setupUI(pageCount, pageInput, zoomSlider, zoomText, controlsPanel, topControlsPanel, fullscreenBtn, wrapper, tocBtn, tableOfContents, tocModal, tocList, tocCloseBtn, tocOverlay, prevPageBtn, nextPageBtn) {
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
