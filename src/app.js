/**
 * Main Application Controller
 * Orchestrates PDF processing, flipbook generation, UI management, and Cloudflare Publishing
 */

import { processPdf } from './processor.js';
import { processEpub } from './epub-processor.js';
import { generateFlipbookHtml } from './generator.js';
import { sanitizeTitle, slugifyTitle } from './sanitizer.js';
import pageFlipJs from 'page-flip/dist/js/page-flip.browser.js?raw';
import flipbookCss from './flipbook.css?raw';
import flipbookJs from './flipbook.js?raw';
import JSZip from 'jszip';

// --- CONFIGURATION ---
const WORKER_URL = 'https://content.lojkine.art'; // Your Cloudflare Worker Domain
const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300MB
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB


class FlipbookApp {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();

    this.currentHtml = null;
    this.currentFolderData = null; // { html, assets }
    this.detectedTitle = ''; // Title auto-detected from PDF/EPUB metadata
  }

  /* ----------  UI initialisation  ---------- */
  initializeElements() {
    this.uploadArea = document.getElementById('upload-area');
    this.fileInput = document.getElementById('file-input');
    this.doubleSpreadToggle = document.getElementById('double-spread-toggle');
    this.blankPageToggle = document.getElementById('blank-page-toggle');
    this.blankPageOption = document.getElementById('blank-page-option');
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.progressText = document.getElementById('progress-text');
    this.resultContainer = document.getElementById('result-container');
    this.previewIframe = document.getElementById('preview-iframe');

    // Buttons
    this.publishBtn = document.getElementById('publish-btn');
    this.downloadBtn = document.getElementById('download-btn');
    this.downloadZipBtn = document.getElementById('download-zip-btn'); // New button
    this.openTabBtn = document.getElementById('open-tab-btn');
    this.resetBtn = document.getElementById('reset-btn');

    this.errorMessage = document.getElementById('error-message');

    // Restore and initialize UI state
    const savedDoubleSpread = localStorage.getItem('doubleSpread');
    if (savedDoubleSpread !== null) {
      this.doubleSpreadToggle.checked = savedDoubleSpread === 'true';
    }
    this.handleDoubleSpreadToggle();


    // Modal Elements
    this.modal = document.getElementById('success-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.modalDoneBtn = document.getElementById('modal-done-btn');
    this.copyUrlBtn = document.getElementById('copy-url-btn');
    this.publishedUrlInput = document.getElementById('published-url');

    // Info Modal Elements
    this.infoBtn = document.getElementById('info-btn');
    this.infoModal = document.getElementById('info-modal');
    this.infoCloseBtn = document.getElementById('info-close-btn');

    // Config Modal Elements
    this.configBtn = document.getElementById('config-btn');
    this.configModal = document.getElementById('config-modal');
    this.configCloseBtn = document.getElementById('config-close-btn');
    this.customTitleInput = document.getElementById('custom-title-input');
    this.configButtonContainer = document.querySelector('.config-button-container');
  }

  setupEventListeners() {
    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', e => this.handleFileSelect(e));

    // Zoom Slider Listener
    if (this.zoomInput) {
      this.zoomInput.addEventListener('input', (e) => {
        const zoom = parseFloat(e.target.value);
        this.updateZoom(zoom);
      });
    }

    ['dragover', 'dragleave', 'drop'].forEach(evt =>
      this.uploadArea.addEventListener(evt, e => this[`handle${evt.charAt(0).toUpperCase() + evt.slice(1)}`](e))
    );
    this.doubleSpreadToggle.addEventListener('change', () => this.handleDoubleSpreadToggle());

    // Button Listeners
    this.publishBtn.addEventListener('click', () => this.publishFlipbook());
    this.downloadBtn.addEventListener('click', () => this.downloadFlipbook());
    if (this.downloadZipBtn) this.downloadZipBtn.addEventListener('click', () => this.downloadFlipbookZip());
    if (this.openTabBtn) this.openTabBtn.addEventListener('click', () => this.openInNewTab());
    this.resetBtn.addEventListener('click', () => this.reset());

    // Modal Listeners
    if (this.modalCloseBtn) this.modalCloseBtn.addEventListener('click', () => this.closeModal());
    if (this.modalDoneBtn) this.modalDoneBtn.addEventListener('click', () => this.closeModal());
    if (this.copyUrlBtn) this.copyUrlBtn.addEventListener('click', () => this.copyUrl());

    // Info Modal Listeners
    if (this.infoBtn) this.infoBtn.addEventListener('click', () => this.openInfoModal());
    if (this.infoCloseBtn) this.infoCloseBtn.addEventListener('click', () => this.closeInfoModal());

    // Config Modal Listeners
    if (this.configBtn) this.configBtn.addEventListener('click', () => this.openConfigModal());
    if (this.configCloseBtn) this.configCloseBtn.addEventListener('click', () => this.closeConfigModal());
  }



  handleDragOver(e) { e.preventDefault(); this.uploadArea.classList.add('dragover'); }
  handleDragLeave(e) { e.preventDefault(); this.uploadArea.classList.remove('dragover'); }

  handleDrop(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    this.routeFileProcessing(file);
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    this.routeFileProcessing(file);
  }

  // Routes to PDF or EPUB processor
  routeFileProcessing(file) {
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      this.processFile(file);
    } else if (file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub')) {
      this.processEpubFile(file);
    } else {
      this.showError('Please drop a valid PDF or EPUB file.');
    }
  }



  handleDoubleSpreadToggle() {
    const isChecked = this.doubleSpreadToggle.checked;
    localStorage.setItem('doubleSpread', isChecked);
    // Blank page option is now always visible (removed visibility toggle)
  }

  /* ----------  Title helpers  ---------- */
  getEffectiveTitle() {
    const customTitle = sanitizeTitle(this.customTitleInput?.value || '');
    if (customTitle) return customTitle;
    if (this.detectedTitle) return this.detectedTitle;
    return 'flipbook';
  }

  getFilenameBase() {
    return this.getEffectiveTitle().replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'flipbook';
  }

  getUrlSlug() {
    return slugifyTitle(this.getEffectiveTitle()) || 'flipbook';
  }

  /* ----------  PDF processing  ---------- */
  async processFile(file) {
    this.hideError();
    this.showProgress(0, 'Loading PDF…');

    try {
      const doubleSpread = !!this.doubleSpreadToggle?.checked;
      const addBlankPage = !!this.blankPageToggle?.checked;

      const opts = { scales: [1, 2, 3], format: 'image/jpeg', quality: 0.92, doubleSpread };

      const result = await processPdf(file, opts);
      const { pageCount, renderPage, renderPageVariants, tableOfContents } = result;

      // Store detected title from PDF metadata
      this.detectedTitle = result.title || file.name.replace(/\.pdf$/i, '');

      this.showProgress(10, `Processing ${pageCount} pages…`);

      const pageImages = [];
      const slowThreshold = 2000;
      const slowPages = [];

      for (let i = 1; i <= pageCount; i++) {
        const progress = 10 + (i / pageCount * 80);
        this.showProgress(progress, `Rendering page ${i} of ${pageCount}…`);

        const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        // Always use variants since we are using multi-scale
        if (renderPageVariants) {
          const variants = await renderPageVariants(i);
          pageImages.push(variants);
        } else {
          // Fallback if something goes wrong, though it shouldn't with scales set
          const url = await renderPage(i);
          pageImages.push(url);
        }

        const dur = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start);
        if (dur > slowThreshold) {
          slowPages.push({ index: i, ms: Math.round(dur) });
          console.warn(`Slow render: page ${i} took ${Math.round(dur)}ms`);
        }
      }

      this.showProgress(95, 'Generating flipbook…');

      // Generate Single File Version (for preview and simple download)
      const effectiveTitle = this.getEffectiveTitle();
      const htmlSingle = await generateFlipbookHtml(pageImages, {
        title: effectiveTitle,
        doubleSpread,
        addBlankPage,
        mode: 'single',
        tableOfContents
      }, {
        loadCss: async () => flipbookCss,
        loadJs: async () => flipbookJs,
        loadPageFlipJs: async () => pageFlipJs
      });

      // Generate Folder Version (for ZIP download and publishing)
      const folderData = await generateFlipbookHtml(pageImages, {
        title: effectiveTitle,
        doubleSpread,
        addBlankPage,
        mode: 'folder',
        tableOfContents
      }, {
        loadCss: async () => flipbookCss,
        loadJs: async () => flipbookJs,
        loadPageFlipJs: async () => pageFlipJs
      });

      this.currentHtml = htmlSingle;
      this.currentFolderData = folderData;

      this.showProgress(100, 'Complete!');
      setTimeout(() => this.showResult(htmlSingle), 500);

    } catch (err) {
      console.error('Error processing PDF:', err);
      this.showError(`Failed to process PDF: ${err.message}`);
      this.reset();
    }
  }

  async processEpubFile(file) {
    this.hideError();
    this.showProgress(0, 'Loading EPUB…');

    try {
      const doubleSpread = !!this.doubleSpreadToggle?.checked;
      const addBlankPage = !!this.blankPageToggle?.checked;

      // Use processEpub, then pass results to generateFlipbookHtml
      const epubResult = await processEpub(file, {
        pageWidth: 800,
        backgroundColor: '#ffffff'
      });

      // Store detected title from EPUB metadata
      this.detectedTitle = epubResult.title || file.name.replace(/\.epub$/i, '');

      this.showProgress(50, 'Generating flipbook…');

      // Extract background images and enrichment HTML
      const pageImages = epubResult.pages.map(p => p.backgroundImage);
      const enrichmentHtmlList = epubResult.pages.map(p => p.enrichmentHtml);

      // Generate Single File Version (for preview and simple download)
      const effectiveTitle = this.getEffectiveTitle();
      const htmlSingle = await generateFlipbookHtml(
        pageImages,
        {
          title: effectiveTitle,
          doubleSpread,
          addBlankPage,
          mode: 'single',
          extraCss: epubResult.css,
          linkMap: epubResult.linkMap,
          tableOfContents: epubResult.tableOfContents
        },
        {
          loadCss: async () => flipbookCss,
          loadJs: async () => flipbookJs,
          loadPageFlipJs: async () => pageFlipJs
        },
        enrichmentHtmlList
      );

      // Generate Folder Version (for ZIP download and publishing)
      const folderData = await generateFlipbookHtml(
        pageImages,
        {
          title: effectiveTitle,
          doubleSpread,
          addBlankPage,
          mode: 'folder',
          extraCss: epubResult.css,
          linkMap: epubResult.linkMap,
          tableOfContents: epubResult.tableOfContents
        },
        {
          loadCss: async () => flipbookCss,
          loadJs: async () => flipbookJs,
          loadPageFlipJs: async () => pageFlipJs
        },
        enrichmentHtmlList
      );

      this.currentHtml = htmlSingle;
      this.currentFolderData = folderData;

      this.showProgress(100, 'Complete!');
      setTimeout(() => this.showResult(htmlSingle), 500);

    } catch (err) {
      console.error('Error processing EPUB:', err);
      this.showError(`Failed to process EPUB: ${err.message}`);
      this.reset();
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  }

  /* ----------  Cloudflare Publishing  ---------- */
  async publishFlipbook() {
    if (!this.currentFolderData) return;

    // Publish the FOLDER version for performance
    const { html, assets } = this.currentFolderData;
    const originalText = this.publishBtn.innerHTML;
    this.publishBtn.disabled = true;
    this.publishBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Preparing assets...`;

    try {
      // 1. Upload Assets
      const assetUrls = new Map();
      const totalAssets = assets.length;

      for (let i = 0; i < totalAssets; i++) {
        const asset = assets[i];
        this.publishBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Uploading asset ${i + 1}/${totalAssets}...`;

        // Determine content type
        const ext = asset.filename.split('.').pop().toLowerCase();
        let contentType = 'application/octet-stream';
        if (ext === 'jpg' || ext === 'jpeg') {
          contentType = 'image/jpeg';
        } else if (ext === 'png') {
          contentType = 'image/png';
        } else if (ext === 'svg') {
          contentType = 'image/svg+xml';
        } else if (ext === 'webp') {
          contentType = 'image/webp';
        }

        // Convert data URL to Blob
        let blob;
        if (asset.data.includes(';base64,')) {
          // Base64-encoded (JPEG, PNG, etc.)
          const byteCharacters = atob(asset.data.split(',')[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: contentType });
        } else {
          // URL-encoded (SVG)
          const urlEncodedData = asset.data.split(',')[1];
          const decodedData = decodeURIComponent(urlEncodedData);
          blob = new Blob([decodedData], { type: contentType });
        }

        // Upload
        // We append the filename so the worker can save it with the correct extension
        const response = await fetch(`${WORKER_URL}/upload/${asset.filename}`, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob
        });

        if (!response.ok) throw new Error(`Failed to upload asset ${asset.filename}`);
        const data = await response.json();
        assetUrls.set(asset.filename, data.url);
      }

      // 2. Rewrite HTML
      let finalHtml = html;
      for (const [filename, url] of assetUrls.entries()) {
        // Replace "images/page-X.jpg" with "https://..."
        // We need to be careful with replacing.
        // The generator uses `src="images/page-..."`
        // We can do a global replace.
        finalHtml = finalHtml.split(filename).join(url);
      }

      // 3. Upload HTML with slug-based URL
      this.publishBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Publishing HTML...`;

      const slug = this.getUrlSlug();
      const blob = new Blob([finalHtml], { type: 'text/html' });
      const response = await fetch(`${WORKER_URL}/upload/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/html' },
        body: blob
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      // Show success modal
      this.showSuccessModal(data.url);

    } catch (err) {
      console.error(err);
      alert(`Failed to publish: ${err.message}`);
      // Re-enable button on error
      this.publishBtn.disabled = false;
      this.publishBtn.innerHTML = originalText;
    }
  }

  showSuccessModal(url) {
    // Disable button and change text
    this.publishBtn.disabled = true;
    this.publishBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Published
    `;
    this.publishBtn.classList.add('btn-success'); // Optional: add a success class if you want to style it green

    // Populate Modal
    this.publishedUrlInput.value = url;
    this.modal.classList.remove('hidden');

    // Auto-copy
    this.copyUrl();
  }

  closeModal() {
    this.modal.classList.add('hidden');
  }

  openInfoModal() {
    this.infoModal.classList.remove('hidden');
  }

  closeInfoModal() {
    this.infoModal.classList.add('hidden');
  }

  openConfigModal() {
    this.configModal.classList.remove('hidden');
  }

  closeConfigModal() {
    this.configModal.classList.add('hidden');
  }

  async copyUrl() {
    try {
      await navigator.clipboard.writeText(this.publishedUrlInput.value);
      const originalText = this.copyUrlBtn.innerText;
      this.copyUrlBtn.innerText = 'Copied!';
      this.copyUrlBtn.classList.add('btn-primary');
      this.copyUrlBtn.classList.remove('btn-secondary');

      setTimeout(() => {
        this.copyUrlBtn.innerText = originalText;
        this.copyUrlBtn.classList.remove('btn-primary');
        this.copyUrlBtn.classList.add('btn-secondary');
      }, 2000);
    } catch (err) {
      // Auto-copy often fails due to browser security (lack of user interaction after await)
      // We ignore this error for the auto-copy attempt, as the user can still click the button.
      if (err.name !== 'NotAllowedError' && err.name !== 'SecurityError') {
        console.warn('Clipboard write failed:', err);
      }
    }
  }

  /* ----------  UI helpers  ---------- */
  showProgress(pct, txt) {
    this.progressContainer.classList.remove('hidden');
    this.uploadArea.classList.add('hidden');
    if (this.configButtonContainer) this.configButtonContainer.classList.add('hidden');
    this.progressBar.style.width = `${pct}%`;
    this.progressText.textContent = txt;
  }
  showResult(html) {
    this.progressContainer.classList.add('hidden');
    this.resultContainer.classList.remove('hidden');
    if (this.configButtonContainer) this.configButtonContainer.classList.add('hidden');
    const blob = new Blob([html], { type: 'text/html' });
    this.previewIframe.src = URL.createObjectURL(blob);
  }
  downloadFlipbook() {
    if (!this.currentHtml) return;
    const filename = `${this.getFilenameBase()}.html`;
    const blob = new Blob([this.currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async downloadFlipbookZip() {
    if (!this.currentFolderData) return;

    const zip = new JSZip();
    const { html, assets } = this.currentFolderData;

    // Add HTML
    zip.file("index.html", html);

    // Add Assets
    assets.forEach(asset => {
      // Detect if data URL is base64-encoded or URL-encoded
      // SVG data URLs are URL-encoded: "data:image/svg+xml,<svg>...</svg>"
      // JPEG/PNG are base64-encoded: "data:image/jpeg;base64,..."

      if (asset.data.includes(';base64,')) {
        // Base64-encoded (JPEG, PNG, WebP, etc.)
        const base64Data = asset.data.split(',')[1];
        zip.file(asset.filename, base64Data, { base64: true });
      } else {
        // URL-encoded (SVG)
        // Extract content after the comma and decode
        const urlEncodedData = asset.data.split(',')[1];
        const decodedData = decodeURIComponent(urlEncodedData);
        zip.file(asset.filename, decodedData);
      }
    });

    // Generate ZIP
    const filename = `${this.getFilenameBase()}.zip`;
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  openInNewTab() {
    if (!this.currentHtml) return;
    const blob = new Blob([this.currentHtml], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  }
  reset() {
    this.uploadArea.classList.remove('hidden');
    if (this.configButtonContainer) this.configButtonContainer.classList.remove('hidden');
    [this.progressContainer, this.resultContainer, this.errorMessage].forEach(el => el.classList.add('hidden'));
    this.fileInput.value = '';
    this.currentHtml = null;
    this.currentFolderData = null;
    this.detectedTitle = '';
  }
  showError(msg) { this.errorMessage.textContent = msg; this.errorMessage.classList.remove('hidden'); }
  hideError() { this.errorMessage.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => new FlipbookApp());