/**
 * Main Application Controller
 * Orchestrates PDF processing, flipbook generation, UI management, and Cloudflare Publishing
 */

import { processPdf } from './processor/pdf/processor.js';
import { processEpub } from './processor/epub/processor.js';
import { generateFlipbookHtml } from './generator.js';
import { sanitizeTitle, slugifyTitle } from './processor/common/sanitizer.js';
import pageFlipJs from 'page-flip/dist/js/page-flip.browser.js?raw';
import flipbookCss from './flipbook.css?raw';
import utilsJs from './js/flipbook/utils.js?raw';
import stateJs from './js/flipbook/state.js?raw';
import navigationJs from './js/flipbook/navigation.js?raw';
import scalingJs from './js/flipbook/scaling.js?raw';
import zoomJs from './js/flipbook/zoom.js?raw';
import pageflipJsMod from './js/flipbook/pageflip.js?raw';
import uiJs from './js/flipbook/ui.js?raw';
import linksJs from './js/flipbook/links.js?raw';
import mainJs from './js/flipbook/main.js?raw';

import { WORKER_URL } from './js/app/config.js';
import { ModalManager } from './js/app/ui/modals.js';
import { publishFlipbook } from './js/app/services/publish.js';
import { downloadHtml, downloadZip } from './js/app/services/download.js';
import { processPdfLoop, generateAllVersions } from './js/app/core/processor-ui.js';

const flipbookJs = [
  utilsJs, stateJs, navigationJs, scalingJs,
  zoomJs, pageflipJsMod, uiJs, linksJs, mainJs
].join('\n');

import JSZip from 'jszip';
import legalEn from '../assets/legal/en.html?raw';
import legalFr from '../assets/legal/fr.html?raw';

class FlipbookApp {
  constructor() {
    this.initializeElements();
    this.modalManager = new ModalManager(this);
    this.setupEventListeners();

    this.currentHtml = null;
    this.currentFolderData = null; // { html, assets }
    this.detectedTitle = ''; // Title auto-detected from PDF/EPUB metadata
    this.pendingFile = null; // File waiting for build confirmation
    this.currentLegalLang = 'en';

    this.assetPack = {
      loadCss: async () => flipbookCss,
      loadJs: async () => flipbookJs,
      loadPageFlipJs: async () => pageFlipJs
    };
  }

  /* ----------  UI initialisation  ---------- */
  initializeElements() {
    this.uploadArea = document.getElementById('upload-area');
    this.fileInput = document.getElementById('file-input');
    this.doubleSpreadToggle = document.getElementById('double-spread-toggle');
    this.multiScaleToggle = document.getElementById('multi-scale-toggle');
    this.epubFontSizeInput = document.getElementById('epub-font-size-input');
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.progressText = document.getElementById('progress-text');
    this.resultContainer = document.getElementById('result-container');
    this.previewIframe = document.getElementById('preview-iframe');

    // Build Step Elements
    this.buildContainer = document.getElementById('build-container');
    this.buildBtn = document.getElementById('build-btn');
    this.removeFileBtn = document.getElementById('remove-file-btn');
    this.selectedFilename = document.getElementById('selected-filename');

    // Buttons
    this.publishBtn = document.getElementById('publish-btn');
    this.downloadBtn = document.getElementById('download-btn');
    this.downloadZipBtn = document.getElementById('download-zip-btn');
    this.openTabBtn = document.getElementById('open-tab-btn');
    this.resetBtn = document.getElementById('reset-btn');

    this.errorMessage = document.getElementById('error-message');

    // Restore UI state
    const savedDoubleSpread = localStorage.getItem('doubleSpread');
    if (savedDoubleSpread !== null) this.doubleSpreadToggle.checked = savedDoubleSpread === 'true';
    const savedMultiScale = localStorage.getItem('multiScale');
    if (savedMultiScale !== null) this.multiScaleToggle.checked = savedMultiScale === 'true';

    this.handleDoubleSpreadToggle();
    this.handleMultiScaleToggle();

    // Modal Elements (passed to ModalManager)
    this.modal = document.getElementById('success-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.modalDoneBtn = document.getElementById('modal-done-btn');
    this.copyUrlBtn = document.getElementById('copy-url-btn');
    this.publishedUrlInput = document.getElementById('published-url');

    this.infoBtn = document.getElementById('info-btn');
    this.infoModal = document.getElementById('info-modal');
    this.infoCloseBtn = document.getElementById('info-close-btn');

    this.legalBtn = document.getElementById('legal-btn');
    this.legalModal = document.getElementById('legal-modal');
    this.legalCloseBtn = document.getElementById('legal-close-btn');
    this.legalLangEn = document.getElementById('legal-lang-en');
    this.legalLangFr = document.getElementById('legal-lang-fr');
    this.legalContent = document.getElementById('legal-content');

    this.configBtn = document.getElementById('config-btn');
    this.configModal = document.getElementById('config-modal');
    this.configCloseBtn = document.getElementById('config-close-btn');
    this.configDoneBtn = document.getElementById('config-done-btn');
    this.customTitleInput = document.getElementById('custom-title-input');
    this.configButtonContainer = document.querySelector('.config-button-container');
    this.configItems = document.querySelectorAll('.config-item');

    // Check Config Elements
    this.checkConfigBtn = document.getElementById('check-config-btn');
    this.checkConfigModal = document.getElementById('check-config-modal');
    this.checkConfigCloseBtn = document.getElementById('check-config-close-btn');
    this.checkConfigDoneBtn = document.getElementById('check-config-done-btn');
    this.checkConfigList = document.getElementById('check-config-list');
  }

  setupEventListeners() {
    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', e => this.handleFileSelect(e));

    ['dragover', 'dragleave', 'drop'].forEach(evt =>
      this.uploadArea.addEventListener(evt, e => this[`handle${evt.charAt(0).toUpperCase() + evt.slice(1)}`](e))
    );
    if (this.doubleSpreadToggle) this.doubleSpreadToggle.addEventListener('change', () => this.handleDoubleSpreadToggle());
    if (this.multiScaleToggle) this.multiScaleToggle.addEventListener('change', () => this.handleMultiScaleToggle());

    this.buildBtn.addEventListener('click', () => this.startProcessing());
    this.publishBtn.addEventListener('click', () => this.publish());
    this.downloadBtn.addEventListener('click', () => this.download());
    if (this.downloadZipBtn) this.downloadZipBtn.addEventListener('click', () => this.downloadZip());
    if (this.openTabBtn) this.openTabBtn.addEventListener('click', () => this.openInNewTab());
    this.resetBtn.addEventListener('click', () => this.reset());
    if (this.removeFileBtn) this.removeFileBtn.addEventListener('click', () => this.reset());

    this.epubFontSizeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    if (this.checkConfigBtn) this.checkConfigBtn.addEventListener('click', () => this.showCheckConfigModal());
    if (this.checkConfigCloseBtn) this.checkConfigCloseBtn.addEventListener('click', () => this.hideCheckConfigModal());
    if (this.checkConfigDoneBtn) this.checkConfigDoneBtn.addEventListener('click', () => this.hideCheckConfigModal());
  }

  handleDragOver(e) { e.preventDefault(); this.uploadArea.classList.add('dragover'); }
  handleDragLeave(e) { e.preventDefault(); this.uploadArea.classList.remove('dragover'); }
  handleDrop(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
    this.routeFileProcessing(e.dataTransfer.files[0]);
  }
  handleFileSelect(e) { this.routeFileProcessing(e.target.files[0]); }

  routeFileProcessing(file) {
    if (!file) return;
    const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf || isEpub) {
      this.pendingFile = file;
      this.selectedFilename.textContent = file.name;
      this.uploadArea.classList.add('hidden');
      this.buildContainer.classList.remove('hidden');
      if (this.configButtonContainer) this.configButtonContainer.classList.remove('hidden');
      this.updateConfigVisibility(isPdf ? 'pdf' : 'epub');
    } else {
      this.showError('Please drop a valid PDF or EPUB file.');
    }
  }

  startProcessing() {
    if (!this.pendingFile) return;
    const file = this.pendingFile;
    this.buildContainer.classList.add('hidden');
    if (file.name.toLowerCase().endsWith('.pdf')) this.processFile(file);
    else this.processEpubFile(file);
  }

  handleDoubleSpreadToggle() { localStorage.setItem('doubleSpread', this.doubleSpreadToggle.checked); }
  handleMultiScaleToggle() { localStorage.setItem('multiScale', this.multiScaleToggle.checked); }

  updateConfigVisibility(fileType) {
    if (!this.configItems) return;
    this.configItems.forEach(item => {
      const allowedStr = item.getAttribute('data-config-for') || '';
      const allowed = allowedStr.split(' ');
      const shouldShow = !fileType || allowed.includes('all') || allowed.includes(fileType);
      item.classList.toggle('hidden', !shouldShow);
    });
  }

  showCheckConfigModal() {
    this.checkConfigList.innerHTML = '';
    const fileType = this.pendingFile ? (this.pendingFile.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub') : null;

    this.configItems.forEach(item => {
      // Check visibility logic again to be safe, or check class 'hidden'
      if (item.classList.contains('hidden')) return;

      const label = item.querySelector('.input-label')?.textContent || item.querySelector('.label-text')?.textContent;
      let valueHtml = '';
      let isEnabled = false;

      // Check for checkbox
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox) {
        isEnabled = checkbox.checked;
        valueHtml = isEnabled
          ? `<span class="config-summary-value enabled"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg> Enabled</span>`
          : `<span class="config-summary-value disabled">Disabled</span>`;
      }

      // Check for text/number input
      const input = item.querySelector('input[type="text"], input[type="number"]');
      if (input) {
        const val = input.value.trim();
        valueHtml = `<span class="config-summary-value">${val || 'Default'}</span>`;
      }

      if (label) {
        const li = document.createElement('li');
        li.className = 'config-summary-item';
        li.innerHTML = `
          <span class="config-summary-label">${label}</span>
          ${valueHtml}
        `;
        this.checkConfigList.appendChild(li);
      }
    });

    this.checkConfigModal.classList.remove('hidden');
  }

  hideCheckConfigModal() {
    this.checkConfigModal.classList.add('hidden');
  }

  getEffectiveTitle() {
    return sanitizeTitle(this.customTitleInput?.value || '') || this.detectedTitle || 'flipbook';
  }
  getFilenameBase() { return this.getEffectiveTitle().replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'flipbook'; }
  getUrlSlug() { return slugifyTitle(this.getEffectiveTitle()) || 'flipbook'; }

  async processFile(file) {
    this.hideError();
    this.showProgress(0, 'Loading PDF…');
    try {
      const doubleSpread = !!this.doubleSpreadToggle?.checked;
      const multiScale = !!this.multiScaleToggle?.checked;
      const opts = { scales: multiScale ? [1, 2, 3] : null, format: 'image/jpeg', quality: 0.92, doubleSpread };

      const result = await processPdf(file, opts);
      this.detectedTitle = result.title || file.name.replace(/\.pdf$/i, '');

      const pageImages = await processPdfLoop(result.pageCount, result.renderPageVariants, result.renderPage, this.showProgress.bind(this));
      this.showProgress(95, 'Generating flipbook…');

      const versions = await generateAllVersions(pageImages, {
        title: this.getEffectiveTitle(),
        doubleSpread,
        tableOfContents: result.tableOfContents
      }, this.assetPack, [], result.pageLinks);

      this.currentHtml = versions.htmlSingle;
      this.currentFolderData = versions.folderData;
      this.showResult(this.currentHtml);
    } catch (err) {
      this.showError(`Failed to process PDF: ${err.message}`);
      this.reset();
    }
  }

  async processEpubFile(file) {
    this.hideError();
    this.showProgress(0, 'Loading EPUB…');
    try {
      let fontSize = parseInt(this.epubFontSizeInput?.value, 10) || 16;
      fontSize = Math.max(1, Math.min(100, fontSize));

      const epub = await processEpub(file, { pageWidth: 800, backgroundColor: '#ffffff', fontSize });
      this.detectedTitle = epub.title || file.name.replace(/\.epub$/i, '');
      this.showProgress(50, 'Generating flipbook…');

      const pageImages = epub.pages.map(p => p.backgroundImage);
      const enrichment = epub.pages.map(p => p.enrichmentHtml);

      const versions = await generateAllVersions(pageImages, {
        title: this.getEffectiveTitle(),
        doubleSpread: !!this.doubleSpreadToggle?.checked,
        extraCss: epub.css,
        linkMap: epub.linkMap,
        tableOfContents: epub.tableOfContents
      }, this.assetPack, enrichment);

      this.currentHtml = versions.htmlSingle;
      this.currentFolderData = versions.folderData;
      this.showResult(this.currentHtml);
    } catch (err) {
      this.showError(`Failed to process EPUB: ${err.message}`);
      this.reset();
    }
  }

  async publish() {
    try {
      const data = await publishFlipbook(this.currentFolderData, this.getUrlSlug.bind(this), this.publishBtn);
      this.modalManager.showSuccessModal(data.url);
    } catch (err) {
      alert(`Failed to publish: ${err.message}`);
    }
  }

  download() { if (this.currentHtml) downloadHtml(this.currentHtml, `${this.getFilenameBase()}.html`); }
  downloadZip() { if (this.currentFolderData) downloadZip(this.currentFolderData, `${this.getFilenameBase()}.zip`); }

  openInNewTab() {
    if (!this.currentHtml) return;
    const blob = new Blob([this.currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  switchLegalLanguage(lang) {
    this.currentLegalLang = lang;
    if (this.legalLangEn) this.legalLangEn.classList.toggle('active', lang === 'en');
    if (this.legalLangFr) this.legalLangFr.classList.toggle('active', lang === 'fr');
    this.legalContent.innerHTML = lang === 'fr' ? legalFr : legalEn;
  }

  async copyUrl(isAuto = false) {
    const text = this.publishedUrlInput.value;
    let success = false;
    try {
      this.publishedUrlInput.select();
      success = document.execCommand('copy');
    } catch (e) { }

    if (!success && navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); success = true; } catch (e) { }
    }

    if (success) {
      const original = this.copyUrlBtn.innerText;
      this.copyUrlBtn.innerText = 'Copied!';
      setTimeout(() => this.copyUrlBtn.innerText = original, 2000);
    }
  }

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
    this.previewIframe.src = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  }

  reset() {
    this.uploadArea.classList.remove('hidden');
    this.buildContainer.classList.add('hidden');
    if (this.configButtonContainer) this.configButtonContainer.classList.remove('hidden');
    [this.progressContainer, this.resultContainer, this.errorMessage].forEach(el => el.classList.add('hidden'));
    this.fileInput.value = '';
    this.currentHtml = null;
    this.currentFolderData = null;
    this.detectedTitle = '';
    this.pendingFile = null;
    this.updateConfigVisibility(null);

    // Reset publish button so a new book can be published
    if (this.publishBtn) {
      this.publishBtn.disabled = false;
      this.publishBtn.classList.remove('btn-success');
      this.publishBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.2 15c.7 0 1.2.5 1.2 1.2v3.6c0 .7-.5 1.2-1.2 1.2H2.8c-.7 0-1.2-.5-1.2-1.2v-3.6c0-.7.5-1.2 1.2-1.2"></path>
          <path d="M12 3v13"></path>
          <path d="M16 7l-4-4-4 4"></path>
        </svg>
        Publish Online
      `;
    }
  }

  showError(msg) { this.errorMessage.textContent = msg; this.errorMessage.classList.remove('hidden'); }
  hideError() { this.errorMessage.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new FlipbookApp();
});