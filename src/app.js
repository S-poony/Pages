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

    // Create a virtual file list to upload
    // We need to upload index.html AND all assets
    // The current backend API seems to support single file upload (PUT /upload) or multipart (PUT /upload/part)
    // But it treats the whole thing as ONE object (key).
    // If we want to host a folder, we need to upload multiple files.
    // DOES THE WORKER SUPPORT MULTI-FILE / FOLDER HOSTING?
    // The code suggests: `PUT ${WORKER_URL}/upload` with body.
    // This usually uploads a SINGLE file to a key.
    // If the worker serves a site, it probably expects `index.html` at the root.
    // But if we upload `images/page-1.jpg`, that's a separate file.

    // CRITICAL: If the backend only supports single-file upload, we CANNOT use the folder strategy for publishing
    // UNLESS the backend unzips it? Or unless we change the backend?
    // The user said: "If the user publishes the site, we publish the folder version"
    // This implies the backend CAN handle it, OR we need to upload multiple files.

    // Let's assume we need to upload multiple files.
    // But the current API `PUT /upload` returns a `url`.
    // This looks like a "pastebin" style host: 1 upload = 1 URL.
    // If so, we can't upload a folder unless we zip it and the server unzips it.

    // However, since I cannot change the backend (I don't see worker code), 
    // I have to assume the user knows what they are asking for, OR I need to shim it.
    // If I upload `index.html`, it works.
    // If I upload `images/page-1.jpg`, it might work if I get a URL back?
    // But `index.html` needs to know the URLs of the images.

    // WAIT. If the backend is a simple KV/R2 wrapper that serves files by key...
    // We might need to upload each file.
    // But the `upload/init` endpoint suggests a multipart upload for a SINGLE large file (S3 style).

    // HYPOTHESIS: The backend DOES NOT support folder hosting natively via this API.
    // BUT the user explicitly asked for it.
    // "If the user publishes the site, we publish the folder version"

    // Maybe I should upload the ZIP?
    // If I upload the ZIP, the browser can't read it directly.

    // Let's try to upload the Single File version for now to avoid breaking it, 
    // BUT the user specifically said "lazy loading works as intended".
    // This implies separate files.

    // If I can't change the backend, I might be stuck.
    // BUT, maybe I can upload the images first, get their URLs, and bake them into the HTML?
    // That would work!
    // 1. Upload all images -> Get URLs.
    // 2. Replace `images/page-1.jpg` in HTML with `https://worker.com/assets/...`
    // 3. Upload HTML.

    // Let's try to implement this "Upload Assets First" strategy if possible.
    // But I don't know if the backend returns a predictable URL or a random one.
    // `data.url` suggests a random ID.

    // If I upload 100 images, I get 100 random URLs.
    // I would need to map them.

    // Let's alert the user about this limitation if I can't verify it.
    // For now, I will implement the ZIP download which is definitely possible.
    // For publishing, I will stick to the Single File version TEMPORARILY but add a TODO/Comment
    // or try to upload the ZIP if the user insists, but that won't work in browser.

    // RE-READING USER REQUEST: "If the user publishes the site, we publish the folder version"
    // This is a strong requirement.
    // I will assume the backend supports it or I should try to upload multiple files.
    // But without backend docs, it's risky.

    // Actually, if I look at `publishFlipbook` in `app.js`:
    // It does `PUT /upload` with `Content-Type: text/html`.
    // It returns `data.url`.

    // If I upload an image, I get a URL.
    // So I CAN do the "Upload Assets First" strategy!
    // It will be slow (100 requests), but it achieves the goal.

    // Strategy:
    // 1. Iterate through `assets`.
    // 2. Upload each asset. Store the resulting URL.
    // 3. Replace local paths in `html` with remote URLs.
    // 4. Upload `html`.

    // Let's try this.

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