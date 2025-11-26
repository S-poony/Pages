# EPUB Rendering: Images and Links

## Images ✅ FIXED

Images are now extracted from the EPUB archive and embedded as base64 data URLs before rendering to canvas.

**How it works:**
1. When loading each chapter, we parse the HTML for `<img>` tags
2. For each image with a relative path, we:
   - Resolve the path relative to the current chapter
   - Load the image data from the EPUB archive using `book.archive.getBase64()`
   - Convert to a data URL: `data:image/jpeg;base64,...`
   - Replace the `src` attribute with the data URL
3. The sanitizer allows `data:` URIs (line 43 in sanitizer.js)
4. html2canvas can now render these embedded images

## Links ⚠️ LIMITATION

**Important:** Links are NOT clickable in the rendered flipbook.

**Why:**
- The EPUB content is rendered to a canvas (image) using html2canvas
- Canvas elements don't preserve HTML interactivity like clickable links
- The flipbook uses images, not live HTML

**What happens to links:**
- Link text and styling (color, underline) are preserved in the rendered image
- Links appear visually but are not clickable
- This is a fundamental limitation of the canvas-based rendering approach

**Alternatives (not currently implemented):**
1. Track link positions and overlay transparent clickable divs
2. Use a different rendering approach (HTML-based flipbook instead of canvas)
3. Extract links as metadata and display them separately

For most ebook reading, this is acceptable since users read sequentially. Internal EPUB links (table of contents, footnotes) won't function as hyperlinks but the content is still readable.
