# Pages

Pages allows you to create static websites from PDF or EPUB.

## Features

### General

1. These sites have the form of digital flip books: the user can easily navigate the site by turning the pages interactively.

2. All the code is free: it belongs to you and you have the legal right to sell books that you create using Pages

3. You can publish the book online using my server

4. Pure Client-Side Processing: No server required - all processing happens in your browser

5. Ability to download the book as a single html file that can be opened by any machine. Just click on it.

6. Fluid zoom that forces the browser to display the images to the highest possible definition

7. Full screen and portrait mode for mobile

8. Discreet control panel to navigate to a specific page/zoom

9. Dynamic table of contents automatically generated from the document's structure

10. The page number is in the URL
	1. Ability to share/save a specific page
	2. Reloading the page doesn’t make you come back to the beginning of the book
	3. If your book has 30 pages and you published it on the internet, there’s a 30 times more chance that the gods of the algorithm will make you rich and famous

### PDF
- enable "Multi-scales" to scan the pdf document at multiple resolutions for extremely high quality
- "Double-spread" mode to cut each page into 2 (Use if your PDF is a scan of a book with two pages of the book per pdf page)
### EPUB
- edit font size
- internal links to specific pages work
- external links to URLs also work


*PS: You never need to create an account, share your email, or other shit of the kind to use the service*

  
  

## Philosophy

  

By creating an eBook with Pages, you have the source code. This means several things:

   1. You can enrich your e-book with any feature that exists on a website: add music, allow readers to draw on pages, or even put a big popup that asks people to give you money. You may think these examples require programming knowledge, but you will find it easy to implement with current AI tools if you let them analyze the html file inside the zip folder. (Editing the single html is a bit trickier because it is heavier and therefore you may not be able to upload it directly to an AI, and need to use tools like Google's [Antigravity](https://antigravity.google/) to edit it)

   2. You can create a book from an extremely heavy PDF or EPUB, with very high quality images, without worrying about loading time: if the file is present in your computer, everything will load instantly

   3. If Pages ceases to exist one day, you keep the file of your book that will remain functional for eternity, and that you can publish elsewhere.

***

  

## Develop Pages

### What You Need

- **Node.js** (version 16 or higher)

  - Download from [nodejs.org](https://nodejs.org/)

  - Verify installation by running: `node --version`

- **npm** (comes with Node.js)

  - Verify installation by running: `npm --version`

- **A modern web browser**: Chrome, Firefox, Safari, or Edge

  

## Quick Start

### Step 1: Install Dependencies

  

Open a terminal in the project directory and run:

  

```bash

npm install

```

  

This will install all required dependencies including pdf.js for PDF processing.

  

### Step 2: Start the Development Server

  

Run the following command to start the development server:

  

```bash

npm start

```

  

The application will:

1. Build the project for production

2. Start a web server on port 3000

3. Display the URL in the terminal

  

You should see output like:

```

  VITE v5.4.21  ready in 200ms

  

  ➜  Local:   http://localhost:3000/

  ➜  Network: http://192.168.x.x:3000/

  ➜  press h to show help

```

  

### Step 4: Open in Browser

  

Open your web browser and navigate to:

```

http://localhost:3000

```

  

You'll see the Flipbook Generator interface ready to use!

  

### Step 4: Create Your Flipbook

  

1. **Upload a PDF**:

   - Drag and drop a PDF file onto the upload area, OR

   - Click the upload area and browse for a PDF file

  

2. **Wait for Processing**:

   - Watch the progress bar as pages are rendered

   - This may take a minute or two depending on your PDF size

  

3. **Preview & Download**:

   - The flipbook will appear in the preview window

   - Use arrow keys or click pages to navigate

   - Click "Download HTML" to save the file

   - Or "Open in New Tab" to view it full screen

  

## Development

  

### Development Mode

  

For development with hot-reload and faster build times:

  

```bash

npm run dev

```

  

This starts Vite's development server which:

- Provides instant server start

- Hot Module Replacement (HMR) for fast updates

- Opens the browser automatically at `http://localhost:8008`

  

### Building for Production

  

To build the project for production deployment:

  

```bash

npm run build

```

  

This creates an optimized `dist/` folder containing all files ready for deployment to any web server.

  

### Preview Production Build

  

To preview the production build locally:

  

```bash

npm run preview

```

  

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

2. **Render Pages**: Each page is rendered to an HTML canvas element using pdf.js

3. **Convert to Images**: Canvas content is converted to JPEG images (base64-encoded)

4. **Store**: All images are stored in memory for instant access

  

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

  

## Troubleshooting

  

### "Command not found: npm"

  

You need to install Node.js. Download it from [nodejs.org](https://nodejs.org/) and run the installer.

  

### "Cannot find module" errors after npm install

  

Try deleting `node_modules/` and `package-lock.json`, then run:

```bash

npm install

```

  

### Port 8008 already in use

  

Change the port in `package.json`:

```json

"start": "http-server dist -p 3000 -c-1"

```

  

Or use environment variable:

```bash

PORT=3000 npm start

```

  

### PDF Processing Fails

  

- Make sure the PDF file is not corrupted

- Try with a smaller PDF first

- Make sure it's a real PDF file (not just renamed .doc or .txt)

- Check browser console for errors (F12 → Console tab)

  

### Browser Shows Blank Page

  

- Make sure JavaScript is enabled (should be by default)

- Try refreshing the page

- Check browser console for errors (F12 → Console tab)

- Try a different browser

- Verify the build completed: check if `dist/` folder exists

  

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

  

## Deployment

  

To deploy this application:

  

1. **Build for production**:

   ```bash

   npm run build

   ```

  

2. **Deploy the `dist/` folder** to any static hosting service:

  - GitHub Pages

  - Netlify

  - Vercel

  - AWS S3

  - Any web server

  

3. That's it! The `dist/` folder contains everything needed.

  

## FAQ

  

**Q: Do I need to install anything to use the generated flipbook?**  

A: No! The generated HTML file is completely standalone. Just double-click it to open in any browser.

  

**Q: Will the generated flipbook work offline?**  

A: Yes! The generated HTML file contains everything it needs and works completely offline.

  

**Q: Can I deploy this to a web server?**  

A: Yes! Run `npm run build` and deploy the `dist/` folder to any static hosting service.

  

**Q: How large are the generated files?**  

A: Approximately 50-100KB per PDF page. A 20-page PDF creates a ~1-2MB HTML file.

  

**Q: Can I edit the generated flipbook?**  

A: YES. The generated HTML is designed to be easily editable

  

**Q: Does this work on mobile?**  

A: The interface works, but PDF processing may be slow due to mobile hardware limitations.

  

**Q: Why do I need Node.js if it's client-side?**  

A: Node.js is only needed for development and building. The end-users of your flipbooks don't need anything - they just open the HTML file!

  

## Contributing

  

This is a simple, standalone application. Feel free to:

  

- Fork the code

- Modify for your needs

- Share improvements

- Report issues

  

## License

  

MIT License - feel free to use this in your own projects.

  

## Credits

Pages is built with the following open-source libraries:

- **[StPageFlip](https://nodlik.github.io/StPageFlip/)**: The core page-turning engine. Pages uses a highly customized local version maintained in `src/lib/StPageFlip-master` to support specific features like enhanced shadows and performance optimizations.
- **[pdf.js](https://mozilla.github.io/pdf.js/)**: Mozilla's powerful PDF rendering engine.
- **[epubjs](https://github.com/futurepress/epub.js)**: The foundation for EPUB parsing and manipulation.
- **[JSZip](https://stuk.github.io/jszip/)**: Used for high-speed asset extraction from compressed formats.
- **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling and build system.
- **Vanilla JavaScript**: Built with pure JS to ensure maximum performance and zero framework overhead.

