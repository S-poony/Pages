# src/generation/static_generator.py
from pathlib import Path
import os
import shutil
import webbrowser
import json

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
    Returns True on success, False if the output_dir already exists or on error.
    """
    if output_dir.exists():
        print(f"Error: The output directory '{output_dir}' exists. Please delete it or change the name.")
        return False

    try:
        output_dir.mkdir(parents=False)
        (output_dir / "css").mkdir()
        (output_dir / "js").mkdir()
        (output_dir / "images").mkdir()   # For optimized PDF pages and EPUB-copied assets
        (output_dir / "assets").mkdir()   # optional bucket for future use
        print(f"Structure created in '{output_dir}'")
        return True
    except OSError as e:
        print(f"Error creating directory structure: {e}")
        return False


def generate_css(output_dir: Path, is_epub: bool):
    """Creates a minimalist CSS file for the background and flipbook container,
    setting up the 3D context and initial page state. Keeps EPUB tweaks optional.
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
}

/* Front face is upright and must disappear when rotated away */
.page-face-front {
    transform: rotateY(0deg);
    z-index: 2;
    backface-visibility: hidden; /* applied to front so it disappears when rotated 180deg */
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

/* EPUB-specific tweaks will be appended below if requested by caller */
"""
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
    line-height: 1.4;
}
.page img {
    max-width: 100%;
    height: auto;
}
"""

    css_path = output_dir / "css" / CSS_FILENAME
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css_content)
    print(f"CSS written to {css_path}")


def generate_js_flipbook(output_dir: Path, page_count: int):
    """
    Generates the core JavaScript code handling the page-turning effect and state.
    This implementation supports both image (PDF) mode and EPUB mode (HTML snippets).
    The logic for flipping is intentionally close to the original behaviour.
    """
    transition_ms = 800

    # The JS contains a conditional in loadFaceContent to either insert an <img> (PDF)
    # or inject the EPUB snippet (if window.IS_EPUB is true and EPUB_SNIPPETS is defined).
    js_content = f"""
// --- {FLIPBOOK_JS_FILENAME} ---
// Core flipbook behavior (supports PDF image mode and EPUB HTML-snippet mode)

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
         * Clears and loads the content into a specific face of a page element.
         * If window.IS_EPUB is true and window.EPUB_SNIPPETS exists, use the snippet.
         * Otherwise fallback to the image mode (PDF).
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

            // EPUB mode: use pre-injected snippets
            try {{
                if (window.IS_EPUB && Array.isArray(window.EPUB_SNIPPETS)) {{
                    const snippet = window.EPUB_SNIPPETS[pageIndex - 1] || '';
                    // Insert snippet as-is. Caller (server-side) decided not to sanitize.
                    faceEl.innerHTML = snippet;
                    return;
                }}
            }} catch (e) {{
                // If anything goes wrong, fall back to image mode below.
                console.warn('EPUB snippet injection failed, falling back to image mode.', e);
            }}

            // PDF/image fallback: write the image tag (lazy loading)
            const newSrc = 'images/page_' + pageIndex + '.jpeg';
            // Only replace if content different to preserve state
            const currentHtml = faceEl.innerHTML || '';
            const expectedHtml = '<img src="' + newSrc + '" alt="Page ' + pageIndex + '" loading="lazy" />';
            if (currentHtml !== expectedHtml) {{
                faceEl.innerHTML = expectedHtml;
            }}
        }}

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
            const backFace = pageEl.querySelector('.page-face-back');
            if (backFace) backFace.innerHTML = '';

            // Position and set pivot depending on odd/even
            if (pageIndex % 2 !== 0) {{ // odd -> left side
                pageEl.style.left = '0%';
                pageEl.style.transformOrigin = 'right center';
            }} else {{ // even -> right side
                pageEl.style.left = '50%';
                pageEl.style.transformOrigin = 'left center';
            }}
        }}

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

        turnNext() {{
            if (this.currentPage >= this.totalPages - 1 || this.isTurning) return;
            this.isTurning = true;

            const turningPageIndex = this.currentPage + 1;  // right page (even)
            const versoPageIndex = this.currentPage + 2;    // the page that should appear on the back of turning page
            const revealedPageIndex = this.currentPage + 3; // page to preload on the far right

            const turningPage = this.pages[turningPageIndex - 1];
            const leftPage = this.pages[this.currentPage - 1]; // current left page (odd)

            // 1) Preload the revealed page (N+3) so it is ready
            if (revealedPageIndex <= this.totalPages) {{
                this.setupPageForDisplay(revealedPageIndex);
                this.pages[revealedPageIndex - 1].classList.add('visible');
            }}

            // 2) Preload the back of the turning page with N+2
            this.loadFaceContent(versoPageIndex, 'back', turningPage);

            // Schedule clearing of the front at half the rotation
            const frontFace = turningPage.querySelector('.page-face-front');
            if (frontFace) {{
                setTimeout(() => {{
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

    js_path = output_dir / "js" / FLIPBOOK_JS_FILENAME
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Flipbook JS written to {js_path}")


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
            console.log(`Footnote link clicked for ID: ${targetId} - Display Modal.`);
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
    js_path = output_dir / "js" / INTERACTIVE_JS_FILENAME
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Interactive JS written to {js_path}")


def generate_html(output_dir: Path, title: str, page_count: int, content_html=None, is_epub: bool = False):
    """
    Creates the index.html file, inserts pages/content, and loads scripts.

    content_html:
      - None -> PDF/image mode (generate empty pages; client JS will insert images)
      - list[str] -> EPUB mode: list of HTML snippets (one per simulated page)
    """
    # Prepare the page containers (same markup for both modes)
    pages_html_list = []
    for i in range(1, page_count + 1):
        page_html = f"""
            <div class="page" id="page-{i}">
                <div class="page-face page-face-front"></div>
                <div class="page-face page-face-back" id="page-{i}-back"></div>
            </div>
        """
        pages_html_list.append(page_html)
    book_pages_html = ''.join(pages_html_list)

    # If EPUB, serialize the snippets to a JS variable. We expect content_html to be a list.
    epub_snippets_script = ""
    if is_epub and content_html:
        try:
            # content_html is expected to be a list of strings (snippets)
            # JSON-serialize safely for embedding into JS
            snippets_json = json.dumps(content_html, ensure_ascii=False)
            epub_snippets_script = f"<script>window.IS_EPUB = true; window.EPUB_SNIPPETS = {snippets_json};</script>"
        except Exception as e:
            print(f"Warning: failed to serialize EPUB snippets to JSON for injection: {e}")
            # Fall back to empty array
            epub_snippets_script = "<script>window.IS_EPUB = true; window.EPUB_SNIPPETS = [];</script>"
    else:
        epub_snippets_script = "<script>window.IS_EPUB = false; window.EPUB_SNIPPETS = [];</script>"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <link rel="stylesheet" href="css/{CSS_FILENAME}" />
    {epub_snippets_script}
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

    index_path = output_dir / INDEX_HTML_FILENAME
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"index.html written to {index_path}")


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
