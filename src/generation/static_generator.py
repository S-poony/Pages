# src/generation/static_generator.py

from pathlib import Path
import os
import shutil
import webbrowser 

# Import necessary constants from the sibling module 'config'
from config import (
    FLIPBOOK_JS_FILENAME, 
    INTERACTIVE_JS_FILENAME, 
    CSS_FILENAME,
    INDEX_HTML_FILENAME
)


def create_structure(output_dir: Path) -> bool:
    """
    Creates the main directories (assets) for the static site.
    """
    if output_dir.exists():
        print(f"Error: The output directory '{output_dir}' exists. Please delete it or change the name.")
        return False
    
    try:
        output_dir.mkdir()
        (output_dir / "css").mkdir()
        (output_dir / "js").mkdir()
        (output_dir / "images").mkdir() # For optimized PDF pages
        (output_dir / "assets").mkdir() # For EPUB-specific assets (fonts, extra images)
        
        print(f"Structure created in '{output_dir}'")
        return True
    except OSError as e:
        print(f"Error creating directory structure: {e}")
        return False


def generate_css(output_dir: Path, is_epub: bool):
    """Creates a minimalist CSS file for the background and flipbook container,
    setting up the 3D context and initial page state.
    """
    css_content = """
/* Base reset and viewport */
body {
    margin: 0;
    padding: 0;
    overflow-x: hidden; /* avoid horizontal scrollbar */
    background-color: #333;
    font-family: sans-serif;
}

/* Wrapper establishes the central viewport for the book */
#flipbook-wrapper {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    perspective: 2000px; /* overall page perspective */
}

/* Book container that holds the pages and serves as the 3D rotation pivot. */
#book-container {
    width: 90vw;
    height: 90vh;
    position: relative;
    transform-style: preserve-3d;
    perspective: 1500px;
    perspective-origin: center center;
}

/* Base styles for a single page (each page is a 3D object made of two faces) */
.page {
    width: 50%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;

    background-color: white;
    box-shadow: 0 5px 25px rgba(0, 0, 0, 0.5);
    overflow: hidden; /* contain face content */
    padding: 0;
    box-sizing: border-box;

    transform-style: preserve-3d;    /* keep children in 3D space */
    transform-origin: left center;   /* default pivot for odd (left) pages */
    transform: rotateY(0deg);
    transition: transform 0.8s ease-in-out;

    backface-visibility: visible;    /* allow page parent to be rendered when flipped */
    visibility: hidden;              /* visibility controlled by .visible */
}

/* Make the visible pages visible */
.page.visible {
    visibility: visible;
}

/* Flipped states: turning right (even pages) and turning left (odd pages) */
.page.turned, .page.turned-back {
    z-index: 1000 !important;
    visibility: visible !important;
}
.page.turned {
    transform: rotateY(-180deg) !important;
}
.page.turned-back {
    transform: rotateY(180deg) !important;
}

/* Styles for the individual faces of the page */
.page-face {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;

    overflow: hidden;
    transform-style: preserve-3d; /* ensure faces are 3D children */
    /* backface-visibility property is REMOVED from here to fix the bug */
}

/* Front face is upright and must disappear when rotated away */
.page-face-front {
    transform: rotateY(0deg);
    z-index: 2;
    backface-visibility: hidden; /* <--- Applied ONLY here, so it disappears when rotated 180deg */
}

/* Back face must be rotated opposite to the page rotation so it comes into view
   during the second half of the page turn. */
.page-face-back {
    transform: rotateY(-180deg);
    z-index: 1;
}

/* Ensure images fill their face without distortion */
.page-face img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}

/* Small utility to ensure the book middle shadow (optional) */
.book-spine {
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 100%;
    transform: translateX(-50%);
    box-shadow: inset 0 0 30px rgba(0,0,0,0.6);
    pointer-events: none;
}
/* DEBUG: Removed problematic and confusing debug block that overwrote correct transform */

/* EPUB-specific tweaks will be appended below if requested by caller */
"""

    # EPUB-specific CSS adjustments (retained for flexibility)
    if is_epub:
        css_content += """
/* EPUB specific adjustments for better text readability */
.page { 
    overflow-y: auto;
    padding: 15px;
}
.page h1, .page h2, .page p { 
    max-width: 100%; 
    margin: 10px auto;
}
"""

    # Write the CSS file
    with open(output_dir / "css" / CSS_FILENAME, "w", encoding="utf-8") as f:
        f.write(css_content)


def generate_js_flipbook(output_dir: Path, page_count: int):
    """Generates the core JavaScript code handling the page-turning effect and state.
    This version keeps the front face visible until half the transition, then clears it
    to avoid mirrored artifacts, and does NOT hide correct pages at the end of the animation.
    """
    # transition duration (must match CSS .page transition)
    transition_ms = 800

    js_content = f"""
// --- {FLIPBOOK_JS_FILENAME} ---

document.addEventListener('DOMContentLoaded', () => {{
    const totalPages = {page_count};
    const container = document.getElementById('book-container');
    const pages = Array.from(document.querySelectorAll('.page'));
    const TRANSITION_MS = {transition_ms};

    class Flipbook {{
        constructor(totalPages, pages) {{
            this.totalPages = totalPages;
            this.pages = pages;
            // currentPage represents the index of the ODD page on the screen's LEFT side (1-based)
            this.currentPage = 1;
            this.isTurning = false;

            this.updateSpread(this.currentPage);
            this.setupListeners();
        }}

        /**
         * Clears and loads the image into a specific face of a page element.
         */
        loadFaceContent(pageIndex, faceType, pageEl) {{
            if (pageIndex < 1 || pageIndex > this.totalPages) {{
                if (pageEl) {{
                    const face = pageEl.querySelector('.page-face-' + faceType);
                    if (face) face.innerHTML = '';
                }}
                return;
            }}

            if (!pageEl) {{
                pageEl = this.pages[pageIndex - 1];
            }}
            if (!pageEl) return;

            const faceEl = pageEl.querySelector('.page-face-' + faceType);
            if (!faceEl) return;

            // Only replace content if different — keeps things stable
            const newSrc = 'images/page_' + pageIndex + '.jpeg';
            // For simplicity, write the image tag (lazy loading)
            faceEl.innerHTML = '<img src="' + newSrc + '" alt="Page ' + pageIndex + '" loading="lazy" />';
        }}

        /**
         * Sets up a single page with correct geometry and front content.
         */
        setupPageForDisplay(pageIndex) {{
            if (pageIndex < 1 || pageIndex > this.totalPages) return;
            const pageEl = this.pages[pageIndex - 1];
            if (!pageEl) return;

            // Reset state for this page (but don't remove visible content unnecessarily)
            pageEl.classList.remove('turned', 'turned-back');
            pageEl.style.transform = 'rotateY(0deg)';

            // Z-index so closer pages sit above
            pageEl.style.zIndex = this.totalPages - pageIndex;

            // Load the front face content (the visible face when the page is not flipped)
            this.loadFaceContent(pageIndex, 'front', pageEl);

            // Ensure back face is cleared here; back will be set on demand before a flip.
            pageEl.querySelector('.page-face-back').innerHTML = '';

            // Position and set pivot depending on odd/even
            if (pageIndex % 2 !== 0) {{ // odd -> left side
                pageEl.style.left = '0%';
                pageEl.style.transformOrigin = 'right center';
            }} else {{ // even -> right side
                pageEl.style.left = '50%';
                pageEl.style.transformOrigin = 'left center';
            }}

            // Make sure visible flag is managed by caller
        }}

        /**
         * Update visible spread (left = index, right = index+1)
         */
        updateSpread(index) {{
            // Hide all pages visually first (but do not clear their content)
            this.pages.forEach(p => {{
                p.classList.remove('visible', 'turned', 'turned-back');
            }});

            // Left (odd)
            const oddPageIndex = index;
            if (oddPageIndex >= 1 && oddPageIndex <= this.totalPages) {{
                this.setupPageForDisplay(oddPageIndex);
                this.pages[oddPageIndex - 1].classList.add('visible');
            }}

            // Right (even)
            const evenPageIndex = index + 1;
            if (evenPageIndex >= 1 && evenPageIndex <= this.totalPages) {{
                this.setupPageForDisplay(evenPageIndex);
                this.pages[evenPageIndex - 1].classList.add('visible');
            }}
        }}

        /**
         * Turn to the next spread (right page turns to the left).
         * Front of turning page stays visible until half-rotation, then is cleared.
         */
        turnNext() {{
            if (this.currentPage >= this.totalPages - 1 || this.isTurning) return;
            this.isTurning = true;

            const turningPageIndex = this.currentPage + 1;  // right page (even)
            const versoPageIndex = this.currentPage + 2;    // the page that should appear on the back of turning page
            const revealedPageIndex = this.currentPage + 3; // page to preload on the far right

            const turningPage = this.pages[turningPageIndex - 1];
            const leftPage = this.pages[this.currentPage - 1]; // current left page (odd)

            // DEBUG: report start state for turnNext
            console.log('[Flipbook Debug] turnNext start', {{
                currentPage: this.currentPage,
                turningPageIndex: turningPageIndex,
                versoPageIndex: versoPageIndex,
                revealedPageIndex: revealedPageIndex,
                frontHasContent: !!(turningPage.querySelector('.page-face-front') && turningPage.querySelector('.page-face-front').innerHTML),
                backHasContent: !!(turningPage.querySelector('.page-face-back') && turningPage.querySelector('.page-face-back').innerHTML)
            }});


            // 1) Preload the revealed page (N+3) so it is ready
            if (revealedPageIndex <= this.totalPages) {{
                this.setupPageForDisplay(revealedPageIndex);
                this.pages[revealedPageIndex - 1].classList.add('visible');
            }}

            // 2) Preload the back of the turning page with N+2
            this.loadFaceContent(versoPageIndex, 'back', turningPage);

            // IMPORTANT: do NOT clear the front immediately.
            // Schedule clearing at half the transition so the front remains visible until ~90deg.
            const frontFace = turningPage.querySelector('.page-face-front');
            if (frontFace) {{
                setTimeout(() => {{
                console.log('[Flipbook Debug] about to clear front (turnNext)', {{
                frontBeforeClear: !!(turningPage.querySelector('.page-face-front') && turningPage.querySelector('.page-face-front').innerHTML),
                backAtClearTime: !!(turningPage.querySelector('.page-face-back') && turningPage.querySelector('.page-face-back').innerHTML)
            }});

                    // Clear front to avoid mirrored artifacts for second half of the flip
                    frontFace.innerHTML = '';
                }}, Math.round(TRANSITION_MS / 2));
            }}

            // 3) Ensure left page sits on top visually while flipping
            if (leftPage) {{
                leftPage.style.zIndex = this.totalPages + 1;
            }}

            // 4) Start the animation: this will show the back after ~90deg because back face is rotated 180deg
            turningPage.classList.add('turned');

            // 5) After full transition, update logical state. DO NOT clear visible content here.
            setTimeout(() => {{
                this.currentPage += 2;
                this.updateSpread(this.currentPage);
                this.isTurning = false;
            }}, TRANSITION_MS);
        }}

        /**
         * Turn to the previous spread (left page turns to the right).
         * Similar symmetry to turnNext.
         */
        turnPrev() {{
            if (this.currentPage === 1 || this.isTurning) return;
            this.isTurning = true;

            const turningPageIndex = this.currentPage;       // left page (odd)
            const versoPageIndex = this.currentPage - 1;     // the page that should appear on the back of turning page
            const revealedPageIndex = this.currentPage - 2;  // page to preload on the far left

            const turningPage = this.pages[turningPageIndex - 1];
            const rightPage = this.pages[this.currentPage]; // current right page (even)

            // 1) Preload the revealed page (N-2)
            if (revealedPageIndex >= 1) {{
                this.setupPageForDisplay(revealedPageIndex);
                this.pages[revealedPageIndex - 1].classList.add('visible');
            }}

            // 2) Preload the back of the turning page with N-1
            this.loadFaceContent(versoPageIndex, 'back', turningPage);

            // Delay clearing of the front face to half the transition
            const frontFace = turningPage.querySelector('.page-face-front');
            if (frontFace) {{
                setTimeout(() => {{
                    frontFace.innerHTML = '';
                }}, Math.round(TRANSITION_MS / 2));
            }}

            // 3) Ensure right page sits on top visually while flipping
            if (rightPage) {{
                rightPage.style.zIndex = this.totalPages + 1;
            }}

            // 4) Start the animation: left page rotates right
            turningPage.classList.add('turned-back');

            // 5) After transition, update state but DO NOT clear content
            setTimeout(() => {{
                this.currentPage -= 2;
                this.updateSpread(this.currentPage);
                this.isTurning = false;
            }}, TRANSITION_MS);
        }}

        setupListeners() {{
            document.addEventListener('keydown', (e) => {{
                if (e.key === 'ArrowRight') {{
                    this.turnNext();
                }} else if (e.key === 'ArrowLeft') {{
                    this.turnPrev();
                }}
            }});

            // Click to turn depending on left/right half of container
            container.addEventListener('click', (e) => {{
                if (this.isTurning) return;
                const rect = container.getBoundingClientRect();
                if (e.clientX > rect.left + rect.width / 2) {{
                    this.turnNext();
                }} else {{
                    this.turnPrev();
                }}
            }});
        }}
    }}

    // Initialize Flipbook
    window.flipbook = new Flipbook(totalPages, pages);
    console.log('Flipbook initialized. Use Arrow keys or click to turn pages.');
}});
"""
    with open(output_dir / "js" / FLIPBOOK_JS_FILENAME, "w", encoding="utf-8") as f:
        f.write(js_content)


# The rest of the file (generate_js_interactive, generate_html, open_output_in_browser) remains unchanged.
def generate_js_interactive(output_dir: Path, is_epub: bool):
    """Placeholder for evolutionary JavaScript code (links, ActivityPub, EPUB features)."""
    js_content = f"""
// --- {INTERACTIVE_JS_FILENAME} ---
// Reserved for future and interactive functionalities.

function handleInternalLink(targetAnchor) {{
    // Logic to navigate to an internal page/anchor.
    console.log(`Attempting to navigate to anchor: ${{targetAnchor}}`);
    // window.flipbook.goToPage(pageIndexForAnchor);
}}
"""
    if is_epub:
        js_content += """
// EPUB specific interactive features (e.g., footnote popups/modals)
document.addEventListener('click', (event) => {
    // Basic detection for footnote links (a[href^='#fn'])
    if (event.target.tagName === 'A' && event.target.href && event.target.href.includes('#')) {
        const url = new URL(event.target.href);
        const targetId = url.hash.substring(1); // Remove the '#'
        
        if (targetId.startsWith('fn')) { // Common EPUB footnote ID structure
            event.preventDefault();
            // TODO: Fetch the content of the element with ID=targetId and display it in a modal.
            console.log(`Footnote link clicked for ID: ${{targetId}} - Display Modal.`);
        }
    }
});
"""

    js_content += """
function initializeActivityPub() {
    // TODO: Add ActivityPub client/server logic here for commenting/sharing.
    console.log("ActivityPub support is ready to be coded.");
}

// initializeActivityPub();
"""
    with open(output_dir / "js" / INTERACTIVE_JS_FILENAME, "w", encoding="utf-8") as f:
        f.write(js_content)


def generate_html(output_dir: Path, title: str, page_count: int, content_html: str = None, is_epub: bool = False):
    """Creates the index.html file, inserts pages/content, and loads scripts."""

    if content_html:
        # EPUB Mode: Content is the structured HTML returned by source_handler
        book_pages_html = content_html
    else:
        # PDF/Image Mode: Generate page wrappers with face divs for dynamic content loading
        pages_html_list = []
        for i in range(1, page_count + 1): 
            # FIX: Corrected the typo 'class.' to 'class="' on the back face div
            page_html = f"""
            <div class="page" id="page-{i}">
                <div class="page-face page-face-front">
                    </div>
                <div class="page-face page-face-back" id="page-{i}-back">
                    </div>
            </div>
            """
            pages_html_list.append(page_html)
        book_pages_html = ''.join(pages_html_list)


    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="css/{CSS_FILENAME}">
    <script defer src="js/{FLIPBOOK_JS_FILENAME}"></script>
    <script defer src="js/{INTERACTIVE_JS_FILENAME}"></script>
</head>
<body>
    <div id="flipbook-wrapper">
        <div id="book-container">
            {book_pages_html}
        </div>
    </div>
</body>
</html>
"""
    with open(output_dir / INDEX_HTML_FILENAME, "w", encoding="utf-8") as f:
        f.write(html_content)


# --- Open resulting book ---
def open_output_in_browser(output_dir: Path):
    """Opens the generated index.html file in the default web browser."""
    html_path = output_dir / INDEX_HTML_FILENAME
    if html_path.exists():
        # webbrowser.open_new_tab() requires a file URL, not a simple path string
        url = 'file:///' + str(html_path.resolve()).replace('\\', '/')
        webbrowser.open_new_tab(url)
        print(f"\n✅ Automatically opened: {html_path.name} in browser.")
    else:
        print(f"\n⚠️ Cannot open browser: File not found at {html_path.resolve()}")