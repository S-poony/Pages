# Pages

Pages allows you to create static websites from PDF or EPUB.


1. These sites have the form of digital flip books: the user can easily navigate the site by turning the pages interactively.

2. All the code is free: it belongs to you and you have the legal right to sell books that you create using Pages

3. You can publish the book online using my server

4. Pure Client-Side Processing: No server required - all processing happens in your browser

5. Ability to download the book as a single html file that can be opened by any machine. Just click on it.

6. Fluid zoom that forces the browser to display the images to the highest possible definition

7. Full screen and portrait mode for mobile

8. Discreet control panel to navigate to a specific page/zoom
9. **Page Links List**: A dedicated UI button that dynamically appears to list all internal and external links found on the current visible page(s).
10. Dynamic table of contents automatically generated from the document's structure
11. The page number is in the URL
	1. Ability to share/save a specific page
	2. Reloading the page doesn’t make you come back to the beginning of the book
	3. If your book has 30 pages and you published it on the internet, there’s a 30 times more chance that the gods of the algorithm will make you rich and famous

- enable "Multi-scales" to scan the pdf document at multiple resolutions for extremely high quality
- "Double-spread" mode to cut each page into 2 (Use if your PDF is a scan of a book with two pages of the book per pdf page)
- **Automatic Link Extraction**: Internal links (bookmarks, cross-references) and external URLs are automatically detected and functional.
### EPUB
- edit font size
- **Chapter Page Breaks**: Chapters always start at the top of a new page for a professional layout.
- internal links to specific pages work
- external links to URLs also work



  

## Available NPM Scripts

  

| Script | Description |

|--------|-------------|

| `npm install` | Install all dependencies |

| `npm test` | Run tests using Node.js built-in test runner |

| `npm start` | Build and start production server on port 3000 |

| `npm run dev` | Start development server with hot reload |

| `npm run build` | Build for production (creates `dist/` folder) |

| `npm run preview` | Preview the production build locally |

  

## Testing

  

This project uses Node.js's built-in test runner for testing. Tests are written using the native `node:test` module and assertions.

  

### Running Tests

  

```bash

npm test

```

  

### Test Structure

  

Tests are located in the `test/` directory:

- `test/generator.test.js` - Tests for HTML generation functionality

- `test/processor.test.js` - Tests for PDF processing functionality

- `test/fixtures/test-pdf.js` - Test PDF data and utilities

  

### Test Coverage

  

The test suite covers:

- **JavaScript wrapping**: `wrapFlipbookJs` function

- **Page HTML generation**: `generatePagesHtml` function

- **Complete HTML generation**: `generateFlipbookHtml` function

- **Input validation**: Error handling for invalid inputs

- **Asset loading**: Mock asset loaders for testing

- **PDF processing**: Document loading, option validation, page rendering setup

- **PDF utilities**: Option normalization, document loading, renderer creation

  
## How It Works

### EPUB Processing

The EPUB processing engine uses a sophisticated pipeline to transform reflowable text into fixed-layout flipbook pages while preserving interactivity:

1.  **Asset Extraction**: Uses [JSZip](https://stuk.github.io/jszip/) to extract images and CSS directly from the EPUB container.
2.  **DOM Pooling & Measurement**: Uses a dedicated, hidden measurement container in the DOM to pre-render and calculate the dimensions of elements before placement.
3.  **Recursive Pagination**: Employs a custom recursive DOM walker algorithm that splits content across pages. This ensure that:
    - Text is never cut in half.
    - Images and atomic elements are kept whole or moved to the next page.
    - Formatting (headers, lists, etc.) is preserved across page breaks.
4.  **Styling**: Injects `src/epub-defaults.css` to ensure consistent typography and layout across different EPUB source files. It also automatically hides common EPUB artifacts like hardcoded page numbers.
5.  **Interactivity**: Preserves internal chapter links and external URLs by mapping them to the generated page numbers.

### PDF Processing

The application uses [pdf.js](https://mozilla.github.io/pdf.js/), Mozilla's PDF rendering library, which is included as an npm dependency:

  

1. **Load PDF**: The PDF file is loaded from disk into browser memory
2. **Extract Links**: Annotations are scanned to identify internal navigation and external URLs.
3. **Render Pages**: Each page is rendered to an HTML canvas element using pdf.js
4. **Convert to Images**: Canvas content is converted to JPEG images (base64-encoded)
5. **Store**: All images are stored in memory for instant access

  

### Flipbook Generation

  

The generator (in `src/generator.js`) creates flipbooks in two primary formats:

- **Single HTML (Standalone)**: Creates a single `.html` file where all CSS, JavaScript, and images (as Base64 data URLs) are embedded. This is perfect for sharing as a single file.
- **Zip HTML (Folder Mode)**: Creates a ZIP file containing an `index.html` and an `images/` folder. This mode is more efficient for very large books as it uses external image files instead of heavy Base64 strings, making the final site load faster and easier to index if it is published online. **When you publish the book using the publish button, the ZIP HTML mode is used.**

  

### Performance

To handle large PDF files gracefully, the application uses:

- **Pre-loading**: Anticipates page turns and preloads adjacent pages
- **Image Caching**: Loaded pages are cached to prevent re-downloads
- **Smooth Transitions**: Loading placeholders keep animations fluid
- **Lazy Loading**: Only renders what's needed, when it's needed

## Architecture & Modules

The project is structured into two main decoupled systems: the **Processors** (which prepare the document) and the **Flipbook** (which displays it).

### Processors (`src/processor/`)
Processors handle the heavy lifting of parsing documents and generating flipbook-ready content.

- **EPUB Processor (`src/processor/epub/`)**:
  - `loader.js`: Initializes epub.js and loads the file.
  - `pagination.js`: Handles recursive DOM-based pagination to ensure perfect page breaks.
  - `enrichment.js`: Resolves internal assets (images, CSS) and maps interactive elements.
  - `toc.js`: Extracts the Table of Contents.
  - `defaults.css`: Baseline styles for rendered EPUB content.
- **PDF Processor (`src/processor/pdf/`)**:
  - `loader.js`: Initializes pdf.js and handles worker setup.
  - `renderer.js`: Manages high-resolution rendering and double-spread logic.
  - `canvas.js`: Implements canvas pooling to minimize memory footprint.
  - `bookmarks.js`: Extracts PDF bookmarks for the Table of Contents.
- **Common (`src/processor/common/`)**:
  - `sanitizer.js`: Shared HTML sanitization utilities.

### Flipbook Engine (`src/js/flipbook/`)
The flipbook engine is responsible for the interactive 3D turning experience and UI controls.

- `main.js`: The application orchestrator.
- `pageflip.js`: Low-level integration with the StPageFlip library.
- `zoom.js`: Logic for physical high-res zoom and panning.
- `scaling.js`: Dynamic resizing of images and EPUB content.
- `ui.js`: Management of all buttons, overlays, and event listeners.
- `navigation.js`: URL hash synchronization.
- `state.js`: Centralized reactive state.
- `utils.js`: Shared performance helpers (debounce, etc.).

### Builder Application (`src/app.js` & `src/js/app/`)
The builder UI is a modular application that coordinates the document processing and publishing workflow.

- `app.js`: Main application entry point and orchestration.
- `config.js`: Centralized configuration constants.
- `ui/modals.js`: Management of UI modals (Info, Legal, Config, Success).
- `services/publish.js`: Cloudflare Worker integration for one-click publishing.
- `services/download.js`: Local HTML and ZIP generation.
- `core/processor-ui.js`: Orchestrates the rendering loops and progress updates.


## Dependencies

  

The project uses the following main dependencies:

  

### Production

- **pdfjs-dist** (^5.4.296): Mozilla's PDF rendering library
- **epubjs** (^0.3.93): EPUB parsing and rendering
- **jszip** (^3.10.1): ZIP file handling for EPUB assets
- **dompurify** (^3.3.0): Sanitizing HTML content
- **html2canvas** (^1.4.1): Creating page previews
- **page-flip** (local): Custom build of the StPageFlip library

### Development

- **vite** (^7.1.12): Build tool and development server
- **patch-package** (^8.0.1): Managing custom library patches


## Credits

Pages is built with the following open-source libraries:

- **[StPageFlip](https://nodlik.github.io/StPageFlip/)**: The core page-turning engine. Pages uses a highly customized local version maintained in `src/lib/StPageFlip-master` to support specific features like enhanced shadows and performance optimizations.
- **[pdf.js](https://mozilla.github.io/pdf.js/)**: Mozilla's powerful PDF rendering engine.
- **[epubjs](https://github.com/futurepress/epub.js)**: The foundation for EPUB parsing and manipulation.
- **[JSZip](https://stuk.github.io/jszip/)**: Used for high-speed asset extraction from compressed formats.
- **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling and build system.
- **Vanilla JavaScript**: Built with pure JS to ensure maximum performance and zero framework overhead.

