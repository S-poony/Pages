/**
 * Main Application Controller
 * Orchestrates PDF processing, flipbook generation, UI management, and Cloudflare Publishing
 */

import { processPdf } from './processor.js';
import { generateFlipbookHtml, wrapFlipbookJs } from './generator.js';
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
    this.optionsContainer = document.querySelector('.options-container');

    // Restore and initialize UI state
    const savedDoubleSpread = localStorage.getItem('doubleSpread');
    if (savedDoubleSpread !== null) {
      this.doubleSpreadToggle.checked = savedDoubleSpread === 'true';
    }
    this.handleDoubleSpreadToggle();


  }

  setupEventListeners() {
    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', e => this.handleFileSelect(e));
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

  // Routes to PDF processor or HTML loader
  routeFileProcessing(file) {
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      this.processFile(file);
    } else {
      this.showError('Please drop a valid PDF file.');
    }
  }



  handleDoubleSpreadToggle() {
    const isChecked = this.doubleSpreadToggle.checked;
    localStorage.setItem('doubleSpread', isChecked);
    this.blankPageOption.classList.toggle('visible', isChecked);
  }

  /* ----------  PDF processing  ---------- */
  async processFile(file) {
    this.hideError();
    this.showProgress(0, 'Loading PDF…');

    try {
      const doubleSpread = !!this.doubleSpreadToggle?.checked;
      const addBlankPage = doubleSpread && !!this.blankPageToggle?.checked;

      const opts = { scales: [1, 2, 3], format: 'image/jpeg', quality: 0.92, doubleSpread };

      const { pageCount, renderPage, renderPageVariants } = await processPdf(file, opts);

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
      const htmlSingle = await generateFlipbookHtml(pageImages, {
        title: file.name.replace(/\.pdf$/i, ''),
        doubleSpread,
        addBlankPage,
        mode: 'single'
      }, {
        loadCss: async () => flipbookCss,
        loadJs: async () => wrapFlipbookJs(flipbookJs),
        loadPageFlipJs: async () => pageFlipJs
      });

      // Generate Folder Version (for ZIP download and publishing)
      const folderData = await generateFlipbookHtml(pageImages, {
        title: file.name.replace(/\.pdf$/i, ''),
        doubleSpread,
        addBlankPage,
        mode: 'folder'
      }, {
        loadCss: async () => flipbookCss,
        loadJs: async () => wrapFlipbookJs(flipbookJs),
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
        const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';

        // Convert base64 to Blob
        const byteCharacters = atob(asset.data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });

        // Upload
        const response = await fetch(`${WORKER_URL}/upload`, {
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

      // 3. Upload HTML
      this.publishBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Publishing HTML...`;

      const blob = new Blob([finalHtml], { type: 'text/html' });
      const response = await fetch(`${WORKER_URL}/upload`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/html' },
        body: blob
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();

      // Show success
      alert(`🚀 Site Published Successfully!\n\nPublic URL: ${data.url}`);
      window.open(data.url, '_blank');

    } catch (err) {
      console.error(err);
      alert(`Failed to publish: ${err.message}`);
    } finally {
      this.publishBtn.disabled = false;
      this.publishBtn.innerHTML = originalText;
    }
  }

  /* ----------  UI helpers  ---------- */
  showProgress(pct, txt) {
    this.progressContainer.classList.remove('hidden');
    this.uploadArea.classList.add('hidden');
    this.optionsContainer.classList.add('hidden');
    this.progressBar.style.width = `${pct}%`;
    this.progressText.textContent = txt;
  }
  showResult(html) {
    this.progressContainer.classList.add('hidden');
    this.resultContainer.classList.remove('hidden');
    this.optionsContainer.classList.add('hidden');
    const blob = new Blob([html], { type: 'text/html' });
    this.previewIframe.src = URL.createObjectURL(blob);
  }
  downloadFlipbook() {
    if (!this.currentHtml) return;
    const blob = new Blob([this.currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: 'flipbook.html', style: 'display:none' });
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
      // asset.data is base64 data URL: "data:image/jpeg;base64,..."
      const base64Data = asset.data.split(',')[1];
      zip.file(asset.filename, base64Data, { base64: true });
    });

    // Generate ZIP
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: 'flipbook.zip', style: 'display:none' });
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
    this.optionsContainer.classList.remove('hidden');
    [this.progressContainer, this.resultContainer, this.errorMessage].forEach(el => el.classList.add('hidden'));
    this.fileInput.value = '';
    this.currentHtml = null;
    this.currentFolderData = null;
    this.blankPageOption.classList.remove('visible');

  }
  showError(msg) { this.errorMessage.textContent = msg; this.errorMessage.classList.remove('hidden'); }
  hideError() { this.errorMessage.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => new FlipbookApp());