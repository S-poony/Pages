# AGENTS.md

Client-side PDF→3D flipbook converter. Vanilla JS + pdf.js → standalone HTML files.

## Setup

`npm install` | `npm run dev` (port 8000) | `npm run build` → dist/ | `npm test` | `npm start` (build+preview port 3000)

## Architecture

3-tier: processor.js (PDF→canvas→base64 JPEG via pdf.js) → generator.js (embeds CSS/JS/images into single HTML) → app.js (UI/upload/progress). Output: flipbook.js (3D page-turning, lazy load, keyboard/mouse nav), flipbook.css (3D transforms), main.css (UI).

## Code style

ES6 modules, JSDoc types, async/await, no frameworks, individual exports, validate inputs at entry.

## Testing

Node test runner. Tests in test/, fixtures in test/fixtures/. Mock asset loaders. Run before commits.

## Implementation notes

processor.js: Lazy-loads pdf.js (browser=regular, Node=legacy for DOMMatrix). Scale 2x, JPEG 0.92. Returns {pageCount, renderPage}.

generator.js: wrapFlipbookJs() injects page data replacing dataset with window globals. generateFlipbookHtml() accepts assetLoader. Uses ?raw imports for CSS/JS strings.

flipbook.js: Two-page spread (odd=left, even=right), lazy loading with placeholders, 800ms transitions, z-index stacking, arrow keys + click nav.

vite.config.js: Base ./, pdf.js in separate chunk, chunk limit 1000KB, server 8000, preview 3000.

## Dependencies

index.html → app.js → processor.js + generator.js + flipbook.css?raw + flipbook.js?raw. processor.js → pdfjs-dist. Generated HTML embeds all assets as base64.

## Known issues

Large PDFs = large HTML (all pages base64 embedded). Browser limit ~100-200 pages. pdf.js worker needs Vite path resolution. Tests use legacy pdf.js for Node DOM compat.
