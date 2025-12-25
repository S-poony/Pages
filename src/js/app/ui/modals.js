/**
 * Modal Management Module
 */
export class ModalManager {
    constructor(app) {
        this.app = app;
        this.setupListeners();
    }

    setupListeners() {
        const {
            modalCloseBtn, modalDoneBtn, copyUrlBtn,
            infoBtn, infoCloseBtn,
            legalBtn, legalCloseBtn, legalLangEn, legalLangFr,
            configBtn, configCloseBtn, configDoneBtn
        } = this.app;

        if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => this.closeModal());
        if (modalDoneBtn) modalDoneBtn.addEventListener('click', () => this.closeModal());
        if (copyUrlBtn) copyUrlBtn.addEventListener('click', () => this.app.copyUrl());

        if (infoBtn) infoBtn.addEventListener('click', () => this.openInfoModal());
        if (infoCloseBtn) infoCloseBtn.addEventListener('click', () => this.closeInfoModal());

        if (legalBtn) legalBtn.addEventListener('click', () => this.openLegalModal());
        if (legalCloseBtn) legalCloseBtn.addEventListener('click', () => this.closeLegalModal());
        if (legalLangEn) legalLangEn.addEventListener('click', () => this.app.switchLegalLanguage('en'));
        if (legalLangFr) legalLangFr.addEventListener('click', () => this.app.switchLegalLanguage('fr'));

        if (configBtn) configBtn.addEventListener('click', () => this.openConfigModal());
        if (configCloseBtn) configCloseBtn.addEventListener('click', () => this.closeConfigModal());
        if (configDoneBtn) configDoneBtn.addEventListener('click', () => this.closeConfigModal());
    }

    showSuccessModal(url) {
        const { publishBtn, publishedUrlInput, modal } = this.app;
        publishBtn.disabled = true;
        publishBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Published
    `;
        publishBtn.classList.add('btn-success');
        publishedUrlInput.value = url;
        modal.classList.remove('hidden');
        this.app.copyUrl(true);
    }

    closeModal() {
        this.app.modal.classList.add('hidden');
    }

    openInfoModal() {
        this.app.infoModal.classList.remove('hidden');
    }

    closeInfoModal() {
        this.app.infoModal.classList.add('hidden');
    }

    openLegalModal() {
        this.app.legalModal.classList.remove('hidden');
        this.app.switchLegalLanguage(this.app.currentLegalLang);

        const modalBody = this.app.legalModal.querySelector('.modal-body');
        const modalHeader = this.app.legalModal.querySelector('.modal-header');

        if (modalBody && modalHeader) {
            modalBody.scrollTop = 0;
            const updateIndicators = () => {
                const isScrolled = modalBody.scrollTop > 5;
                modalHeader.classList.toggle('scrolled', isScrolled);
            };
            modalBody.addEventListener('scroll', updateIndicators);
            setTimeout(updateIndicators, 50);
            window.addEventListener('resize', updateIndicators);
        }
    }

    closeLegalModal() {
        this.app.legalModal.classList.add('hidden');
    }

    openConfigModal() {
        this.app.configModal.classList.remove('hidden');
        const modalBody = this.app.configModal.querySelector('.modal-body');
        const modalHeader = this.app.configModal.querySelector('.modal-header');
        const modalFooter = this.app.configModal.querySelector('.modal-footer');

        if (modalBody && modalHeader && modalFooter) {
            const updateIndicators = () => {
                const isScrolled = modalBody.scrollTop > 5;
                const canScrollMore = modalBody.scrollHeight > modalBody.clientHeight + modalBody.scrollTop + 5;
                modalHeader.classList.toggle('scrolled', isScrolled);
                modalFooter.classList.toggle('can-scroll', canScrollMore);
            };
            modalBody.addEventListener('scroll', updateIndicators);
            setTimeout(updateIndicators, 50);
            window.addEventListener('resize', updateIndicators);
        }
    }

    closeConfigModal() {
        this.app.configModal.classList.add('hidden');
    }
}
