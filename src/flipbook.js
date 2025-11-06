class Flipbook {
    constructor(totalPages, pages, transitionMs = 800) {
        this.totalPages = totalPages;
        this.pages = pages;
        this.transitionMs = transitionMs;
        this.currentPage = 1;
        // Flag to prevent concurrent animations
        this.isTurning = false; 

        this.updateSpread(this.currentPage);
        this.setupListeners();
    }

    updateSpread(pageIndex) {
        this.pages.forEach(p => {
            p.classList.remove('visible', 'turning-forward', 'turning-backward', 'immediate');
        });

        const leftPage = this.pages[pageIndex - 1];
        const rightPage = this.pages[pageIndex];

        if (leftPage) leftPage.classList.add('visible');
        if (rightPage) rightPage.classList.add('visible');
    }

    turnNext() {
        // Return early if an animation is in progress
        if (this.isTurning || this.currentPage >= this.totalPages - 1) return;
        
        const oldRightPage = this.pages[this.currentPage];
        const newLeftPage = this.pages[this.currentPage + 1];
        const newRightPage = this.pages[this.currentPage + 2];

        if (!oldRightPage || !newLeftPage) return;

        // Set flag to true to start the animation lock
        this.isTurning = true;

        if (newRightPage) {
            newRightPage.classList.add('visible', 'immediate');
        }

        newLeftPage.classList.add('visible');
        oldRightPage.classList.add('turning-forward');
        newLeftPage.classList.add('turning-forward');

        oldRightPage.addEventListener('transitionend', () => {
            this.currentPage += 2;
            this.updateSpread(this.currentPage);
            // **Modification:** Reset flag when animation is complete
            this.isTurning = false; 
        }, { once: true });
    }

    turnPrev() {
        // **Modification:** Return early if an animation is in progress
        if (this.isTurning || this.currentPage === 1) return;

        const oldLeftPage = this.pages[this.currentPage - 1];
        const newRightPage = this.pages[this.currentPage - 2];
        const newLeftPage = this.pages[this.currentPage - 3];

        if (!oldLeftPage || !newRightPage) return;

        // Set flag to true to start the animation lock
        this.isTurning = true;

        if (newLeftPage) {
            newLeftPage.classList.add('visible', 'immediate');
        }

        newRightPage.classList.add('visible');
        oldLeftPage.classList.add('turning-backward');
        newRightPage.classList.add('turning-backward');

        oldLeftPage.addEventListener('transitionend', () => {
            this.currentPage -= 2;
            this.updateSpread(this.currentPage);
            // Reset flag when animation is complete
            this.isTurning = false;
        }, { once: true });
    }

    setupListeners() {
        const container = document.getElementById('book-container');
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                this.turnNext();
            } else if (e.key === 'ArrowLeft') {
                this.turnPrev();
            }
        });

        container.addEventListener('click', (e) => {
            const rect = container.getBoundingClientRect();
            if (e.clientX > rect.left + rect.width / 2) {
                this.turnNext();
            } else {
                this.turnPrev();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('book-container');
    const totalPages = parseInt(container?.dataset.pageCount) || window.__PAGE_COUNT__;
    const pages = Array.from(document.querySelectorAll('.page'));
    
    window.flipbook = new Flipbook(totalPages, pages);
    console.log('Flipbook initialized. Use Arrow keys or click to turn pages.');
});