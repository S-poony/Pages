/**
 * Main Application Controller
 * Orchestrates PDF processing, flipbook generation, UI management, and Cloudflare Publishing
 */

import { processPdf } from './processor.js';
import { generateFlipbookHtml, wrapFlipbookJs } from './generator.js';
import turnCss from './turn.css?raw';
import turnJs from './lib/turn.min.js?raw';
import jqueryJs from './lib/jquery.min.js?raw';
import flipbookCss from './flipbook.css?raw';
import flipbookJs from './flipbook.js?raw';

// --- CONFIGURATION ---
const WORKER_URL = 'https://content.lojkine.art'; // Your Cloudflare Worker Domain
const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300MB


class FlipbookApp {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();

    this.currentHtml = null;
    this.enableResponsive = true;
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
    this.publishBtn = document.getElementById('publish-btn'); // NEW
    this.downloadBtn = document.getElementById('download-btn');
    this.openTabBtn = document.getElementById('open-tab-btn'); // Might be removed in HTML, but keeping ref is safe
    this.resetBtn = document.getElementById('reset-btn');

    this.errorMessage = document.getElementById('error-message');
    this.optionsContainer = document.querySelector('.options-container');

    // Restore and initialize UI state
    const savedDoubleSpread = localStorage.getItem('doubleSpread');
    if (savedDoubleSpread !== null) {
      this.doubleSpreadToggle.checked = savedDoubleSpread === 'true';
    }
    this.handleDoubleSpreadToggle();

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

  // NEW: Routes to PDF processor or HTML loader
  routeFileProcessing(file) {
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      this.processFile(file); // Original PDF logic
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

      const opts = this.enableResponsive
        ? { scales: [1.5, 3, 5], format: 'image/jpeg', quality: 0.92, doubleSpread }
        : { scale: 2, format: 'image/jpeg', quality: 0.92, doubleSpread };

      const { pageCount, renderPage, renderPageVariants } = await processPdf(file, opts);

      this.showProgress(10, `Processing ${pageCount} pages…`);

      const useVariants = this.enableResponsive && renderPageVariants;
      const pageImages = [];
      const slowThreshold = 2000;
      const slowPages = [];

      for (let i = 1; i <= pageCount; i++) {
        const progress = 10 + (i / pageCount * 80);
        this.showProgress(progress, `Rendering page ${i} of ${pageCount}…`);

        const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        if (useVariants) {
          const variants = await renderPageVariants(i);
          pageImages.push(variants);
        } else {
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
      const html = await generateFlipbookHtml(pageImages, {
        title: file.name.replace(/\.pdf$/i, ''),
        doubleSpread,
        addBlankPage
      }, {
        loadCss: async () => flipbookCss,
        loadTurnCss: async () => turnCss,
        loadJs: async () => wrapFlipbookJs(flipbookJs),
        loadTurnJs: async () => turnJs,
        loadJqueryJs: async () => jqueryJs
      });

      this.currentHtml = html;
      this.showProgress(100, 'Complete!');
      setTimeout(() => this.showResult(html), 500);

    } catch (err) {
      console.error('Error processing PDF:', err);
      this.showError(`Failed to process PDF: ${err.message}`);
      this.reset();
    }
  }

  /* ----------  Cloudflare Publishing  ---------- */
  async publishFlipbook() {
    if (!this.currentHtml) return;

    // Check size limit
    const blob = new Blob([this.currentHtml], { type: 'text/html' });
    if (blob.size > MAX_SIZE_BYTES) {
      alert(`File too large! Maximum size is 300MB. Your file is ${(blob.size / (1024 * 1024)).toFixed(2)}MB.`);
      return;
    }

    const originalText = this.publishBtn.innerHTML;
    this.publishBtn.disabled = true;
    this.publishBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Publishing...`;

    try {

      const headers = {
        'Content-Type': 'text/html',
      };

      const response = await fetch(`${WORKER_URL}/upload`, {
        method: 'PUT',
        headers: headers,
        body: this.currentHtml
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      // Show success
      alert(`🚀 Site Published Successfully!\n\nPublic URL: ${data.url}`);

      window.open(data.url, '_blank');

    } catch (err) {
      console.error(err);
      alert('Failed to publish. Please try again.');
      this.publishBtn.innerHTML = originalText;
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
    this.blankPageOption.classList.remove('visible');
    // We do NOT clear localStorage token here, because users might want to create a new PDF 
    // but still update the SAME site identity. 
    // If you want "Reset" to mean "New Site Identity", add: localStorage.removeItem(STORAGE_KEY);
  }
  showError(msg) { this.errorMessage.textContent = msg; this.errorMessage.classList.remove('hidden'); }
  hideError() { this.errorMessage.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => new FlipbookApp());