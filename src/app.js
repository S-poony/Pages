/**
 * Main Application Controller
 * Orchestrates PDF processing, flipbook generation, and UI management
 */

import { processPdf } from './processor.js';
import { generateFlipbookHtml, wrapFlipbookJs } from './generator.js';
import turnCss from './turn.css?raw';
import turnJs from './lib/turn.min.js?raw';
import jqueryJs from './lib/jquery.min.js?raw';
import flipbookCss from './flipbook.css?raw';
import flipbookJs from './flipbook.js?raw';

class FlipbookApp {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.currentHtml = null;
    this.enableResponsive = true; // passez à false pour le mode legacy
  }

  /* ----------  UI initialisation  ---------- */
  initializeElements() {
    this.uploadArea        = document.getElementById('upload-area');
    this.fileInput         = document.getElementById('file-input');
    this.doubleSpreadToggle= document.getElementById('double-spread-toggle');
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar       = document.getElementById('progress-bar');
    this.progressText      = document.getElementById('progress-text');
    this.resultContainer   = document.getElementById('result-container');
    this.previewIframe     = document.getElementById('preview-iframe');
    this.downloadBtn       = document.getElementById('download-btn');
    this.openTabBtn        = document.getElementById('open-tab-btn');
    this.resetBtn          = document.getElementById('reset-btn');
    this.errorMessage      = document.getElementById('error-message');
  }

  setupEventListeners() {
    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', e => this.handleFileSelect(e));
    ['dragover','dragleave','drop'].forEach(evt =>
      this.uploadArea.addEventListener(evt, e => this[`handle${evt.charAt(0).toUpperCase()+evt.slice(1)}`](e))
    );
    this.downloadBtn.addEventListener('click', () => this.downloadFlipbook());
    this.openTabBtn .addEventListener('click', () => this.openInNewTab());
    this.resetBtn   .addEventListener('click', () => this.reset());
  }

  handleDragOver(e)  { e.preventDefault(); this.uploadArea.classList.add('dragover'); }
  handleDragLeave(e){ e.preventDefault(); this.uploadArea.classList.remove('dragover'); }
  handleDrop(e){
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') this.processFile(file);
    else this.showError('Please drop a valid PDF file.');
  }
  handleFileSelect(e){
    const file = e.target.files[0];
    if (file?.type === 'application/pdf') this.processFile(file);
    else this.showError('Please select a valid PDF file.');
  }

  /* ----------  PDF processing  ---------- */
  async processFile(file){
    this.hideError();
    this.showProgress(0,'Loading PDF…');

    try{
      const doubleSpread = !!this.doubleSpreadToggle?.checked;

      const opts = this.enableResponsive
        ? { scales:[1.5,3,5], format:'image/jpeg', quality:0.92, doubleSpread }
        : { scale:2,        format:'image/jpeg', quality:0.92, doubleSpread };

      const {pageCount, renderPage, renderPageVariants} = await processPdf(file, opts);

      this.showProgress(10, `Processing ${pageCount} pages…`);

      const useVariants = this.enableResponsive && renderPageVariants;
      const pageImages  = [];
      const slowThreshold = 2000;
      const slowPages   = [];

      for (let i=1; i<=pageCount; i++){
        const progress = 10 + (i/pageCount*80);
        this.showProgress(progress, `Rendering page ${i} of ${pageCount}…`);

        const start = (typeof performance!=='undefined'?performance.now():Date.now());

        if (useVariants){
          const variants = await renderPageVariants(i);
          pageImages.push(variants);
        }else{
          const url = await renderPage(i);
          pageImages.push(url);
        }

        const dur = ((typeof performance!=='undefined'?performance.now():Date.now()) - start);
        if (dur > slowThreshold){
          slowPages.push({index:i, ms:Math.round(dur)});
          console.warn(`Slow render: page ${i} took ${Math.round(dur)}ms`);
        }
      }

      this.showProgress(95,'Generating flipbook…');
      const html = await generateFlipbookHtml(pageImages, {
        title: file.name.replace(/\.pdf$/i,''),
        doubleSpread
      }, {
        loadCss: async() => flipbookCss,
        loadTurnCss: async() => turnCss,
        loadJs: async() => wrapFlipbookJs(flipbookJs),
        loadTurnJs: async() => turnJs,     // NEW
        loadJqueryJs: async() => jqueryJs  // NEW
      });

      this.currentHtml = html;
      this.showProgress(100,'Complete!');
      setTimeout(()=>this.showResult(html), 500);

    }catch(err){
      console.error('Error processing PDF:', err);
      this.showError(`Failed to process PDF: ${err.message}`);
      this.reset();
    }
  }

  /* ----------  UI helpers  ---------- */
  showProgress(pct, txt){
    this.progressContainer.classList.remove('hidden');
    this.uploadArea.classList.add('hidden');
    this.progressBar.style.width = `${pct}%`;
    this.progressText.textContent = txt;
  }
  showResult(html){
    this.progressContainer.classList.add('hidden');
    this.resultContainer.classList.remove('hidden');
    const blob = new Blob([html], {type:'text/html'});
    this.previewIframe.src = URL.createObjectURL(blob);
  }
  downloadFlipbook(){
    if (!this.currentHtml) return;
    const blob = new Blob([this.currentHtml], {type:'text/html'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    Object.assign(a, {href:url, download:'flipbook.html', style:'display:none'});
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  openInNewTab(){
    if (!this.currentHtml) return;
    const blob = new Blob([this.currentHtml], {type:'text/html'});
    window.open(URL.createObjectURL(blob), '_blank');
  }
  reset(){
    this.uploadArea.classList.remove('hidden');
    [this.progressContainer, this.resultContainer, this.errorMessage].forEach(el=>el.classList.add('hidden'));
    this.fileInput.value = '';
    this.currentHtml = null;
  }
  showError(msg){ this.errorMessage.textContent = msg; this.errorMessage.classList.remove('hidden'); }
  hideError()   { this.errorMessage.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => new FlipbookApp());