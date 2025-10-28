/**
 * Main Application Controller
 * Orchestrates PDF processing, flipbook generation, and UI management
 */

import { processPdf } from './processor.js';
import { generateFlipbookHtml, wrapFlipbookJs } from './generator.js';
import flipbookCss from './flipbook.css?raw';
import flipbookJs from './flipbook.js?raw';

class FlipbookApp {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.currentHtml = null;
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.progressContainer = document.getElementById('progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.resultContainer = document.getElementById('result-container');
        this.previewIframe = document.getElementById('preview-iframe');
        this.downloadBtn = document.getElementById('download-btn');
        this.openTabBtn = document.getElementById('open-tab-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.errorMessage = document.getElementById('error-message');
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        this.downloadBtn.addEventListener('click', () => this.downloadFlipbook());
        this.openTabBtn.addEventListener('click', () => this.openInNewTab());
        this.resetBtn.addEventListener('click', () => this.reset());
    }

    /**
     * Handle file input selection
     * @param {Event} e - Input change event
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            this.processFile(file);
        } else {
            this.showError('Please select a valid PDF file.');
        }
    }

    /**
     * Handle drag over event
     * @param {Event} e - Drag event
     */
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    /**
     * Handle drag leave event
     * @param {Event} e - Drag event
     */
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    /**
     * Handle drop event
     * @param {Event} e - Drag event
     */
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            this.processFile(file);
        } else {
            this.showError('Please drop a valid PDF file.');
        }
    }

    /**
     * Process the PDF file
     * @param {File} file - The PDF file to process
     */
    async processFile(file) {
        this.hideError();
        this.showProgress(0, 'Loading PDF...');

        try {
            const { pageCount, renderPage } = await processPdf(file, {
                scale: 2,
                format: 'image/jpeg',
                quality: 0.92
            });

            this.showProgress(10, `Processing ${pageCount} pages...`);
            const pageImages = [];
            
            for (let i = 1; i <= pageCount; i++) {
                const progress = 10 + (i / pageCount * 80);
                this.showProgress(progress, `Rendering page ${i} of ${pageCount}...`);
                
                const imageDataUrl = await renderPage(i);
                pageImages.push(imageDataUrl);
            }

            this.showProgress(95, 'Generating flipbook...');
            
            const assetLoader = {
                loadCss: async () => flipbookCss,
                loadJs: async () => wrapFlipbookJs(flipbookJs)
            };
            
            const html = await generateFlipbookHtml(pageCount, pageImages, {
                title: file.name.replace('.pdf', '')
            }, assetLoader);
            
            this.currentHtml = html;
            
            this.showProgress(100, 'Complete!');
            setTimeout(() => this.showResult(html), 500);
            
        } catch (error) {
            console.error('Error processing PDF:', error);
            this.showError(`Failed to process PDF: ${error.message}`);
            this.reset();
        }
    }

    /**
     * Show progress bar and status text
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} text - Status text to display
     */
    showProgress(percent, text) {
        this.progressContainer.classList.remove('hidden');
        this.uploadArea.classList.add('hidden');
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = text;
    }

    /**
     * Show the result view with preview iframe
     * @param {string} html - The generated HTML content
     */
    showResult(html) {
        this.progressContainer.classList.add('hidden');
        this.resultContainer.classList.remove('hidden');
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        this.previewIframe.src = url;
    }

    /**
     * Download the generated flipbook HTML file
     */
    downloadFlipbook() {
        if (!this.currentHtml) return;
        
        const blob = new Blob([this.currentHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flipbook.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Open the flipbook in a new tab
     */
    openInNewTab() {
        if (!this.currentHtml) return;
        
        const blob = new Blob([this.currentHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    /**
     * Reset the application to initial state
     */
    reset() {
        this.uploadArea.classList.remove('hidden');
        this.progressContainer.classList.add('hidden');
        this.resultContainer.classList.add('hidden');
        this.hideError();
        this.fileInput.value = '';
        this.currentHtml = null;
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    /**
     * Hide error message
     */
    hideError() {
        this.errorMessage.classList.add('hidden');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new FlipbookApp();
});

