# Pages

Pages allows you to create static websites from PDF or EPUB. 

1. These sites have the form of e-books: the user can easily navigate the site by turning the pages interactively.
2. All the code is free: it belongs to you and you have the legal right to sell books that you create using Pages
3. Ability to download the source code or publish the book online
4. Ability to download the book as a single html file that can be opened by any machine by clicking on it
5. Fluid zoom that forces the browser to display the images to the highest possible definition
6. Support for internal links (link to a specific page/appendix) and external links (link to a website) in the document (EPUB only for the moment)
7. Dual-page mode to cut each page into 2 (Use if your PDF is a scan of a book with two pages of the book per pdf page)
8. Full screen and portrait mode for mobile
9. Discreet control panel to navigate to a specific page/zoomer
10. The page number is in the URL
	1. Ability to share/save a specific page
	2. Reloading the page doesn’t make you come back to the beginning of the book
	3. If your book has 30 pages and you published it on the internet, there’s a 30 times more chance that the gods of the algorithm will make you rich and famous 

*PS: You never need to create an account, share your email, or other shit of the kind to use the service*


# Philosophy

By creating an eBook with Pages, you have the source code. This means several things:
	1. You can enrich your e-book with any feature that exists on a website: add music, allow readers to draw on pages, or even put a big popup that asks people to give you money. [Demo of all this in 2 minutes, it's easy to do I promise you]
	2. You can create a book from an extremely heavy PDF or EPUB, with very high quality images, without worrying about loading time: if the file is present in your computer, everything will load instantly
	3. If Pages ceases to exist one day, you keep the file of your book that will remain functional for eternity, and that you can publish elsewhere.


## Features

- **Pure Client-Side Processing**: No server required - all processing happens in your browser
- **Drag & Drop Interface**: Simply drop your PDF or click to browse
- **Page Turning**: Uses a patched version of St Page Flip lib (MIT License)
- **Standalone Output**: Generate a single self-contained HTML file
- **Keyboard & Click Navigation**: Use arrow keys or click pages to navigate
- **Download**: Open your flipbook in a new tab, or save it either as standalone html or zip
- **Publish**: You can publish your flipbook on my server (STILL IN TESTING, ALL CONTENT PUBLISHED FOR NOW MAY BE DELETED LATER)

## Prerequisites

### What You Need

- **Node.js** (version 16 or higher)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation by running: `node --version`
- **npm** (comes with Node.js)
  - Verify installation by running: `npm --version`
- **A modern web browser**: Chrome, Firefox, Safari, or Edge

### Browser Compatibility

This application works on all modern browsers, and is optimized for mobile too.

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
  VITE v5.4.21  ready in 200ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
  ➜  press h to show help
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

## Project Structure

```
Pages/
├── index.html              # Main HTML file
├── package.json            # NPM configuration and dependencies
├── vite.config.js         # Vite build configuration
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── node_modules/          # Installed dependencies (gitignored)
├── dist/                  # Build output (gitignored)
├── test/                  # Test files
│   ├── fixtures/          # Test fixtures
│   │   └── test-pdf.js    # Test PDF data
│   ├── generator.test.js  # HTML generator tests
│   └── processor.test.js  # PDF processor tests
├── src/                   # Source code directory
│   ├── app.js             # Main application controller
│   ├── processor.js       # PDF processing with pdf.js
│   ├── generator.js       # Flipbook HTML generator
│   ├── flipbook.css       # Flipbook page styling
│   └── flipbook.js        # 3D page turning logic
└── styles/                # App interface styling
    └── main.css           # UI design and layout
```

### What Each File Does

- **index.html**: The main web page with upload interface
- **src/app.js**: Main application controller - handles UI, file uploads, and orchestrates processing
- **src/processor.js**: Processes PDFs using pdf.js library, converts pages to images
- **src/generator.js**: Generates standalone HTML files with embedded assets
- **src/flipbook.css**: Styles the flipbook pages and 3D effects
- **src/flipbook.js**: Handles page navigation and 3D flip animations
- **styles/main.css**: Styles the main application interface

## How It Works

### PDF Processing

The application uses [pdf.js](https://mozilla.github.io/pdf.js/), Mozilla's PDF rendering library, which is included as an npm dependency:

1. **Load PDF**: The PDF file is loaded from disk into browser memory
2. **Render Pages**: Each page is rendered to an HTML canvas element using pdf.js
3. **Convert to Images**: Canvas content is converted to JPEG images (base64-encoded)
4. **Store**: All images are stored in memory for instant access

### Flipbook Generation

The generator creates a complete, standalone HTML file containing:

- **Embedded CSS**: All styling is inlined within `<style>` tags
- **Embedded JavaScript**: All interactivity is inlined within `<script>` tags
- **Base64-encoded Images**: All pages are embedded as data URLs
- **Result**: Single `.html` file - completely self-contained!

### Lazy Loading & Performance

To handle large PDF files gracefully, the application uses:

- **Progressive Loading**: Pages load on-demand as you navigate
- **Pre-loading**: Anticipates page turns and preloads adjacent pages
- **Image Caching**: Loaded pages are cached to prevent re-downloads
- **Smooth Transitions**: Loading placeholders keep animations fluid
- **Efficient Rendering**: Only renders what's needed, when it's needed

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

### The Generated File is Too Large

Large PDFs with many pages create large HTML files. This is normal because all pages are embedded. The application optimizes loading:

- Only visible pages load initially
- Remaining pages load progressively
- Images are compressed (quality: 92%)

## Dependencies

The project uses the following main dependencies:

### Production

- **pdfjs-dist** (^5.4.296): Mozilla's PDF rendering library

### Development

- **vite** (^7.1.12): Build tool and development server

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

## Tips for Best Results

1. **Use High-Quality PDFs**: Better source PDFs = better flipbooks
2. **Keep PDFs Under 50 Pages**: Larger PDFs take longer to process
3. **Test with Small Files First**: Start with a 5-10 page PDF to verify everything works
4. **Check File Size**: Large PDFs create large HTML files (this is normal)
5. **Share via Cloud Storage**: Generated HTML files can be shared via Dropbox, Google Drive, etc.

## Privacy & Security

- **100% Client-Side**: All processing happens in your browser - nothing is uploaded to any server
- **No Internet Required**: After initial page load, everything works offline
- **Self-Contained Output**: Generated HTML files work completely offline
- **No Tracking**: No analytics, no tracking, no data collection
- **No Build Process Required for Users**: End-users don't need npm - they just open the generated HTML file

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

Built with:
- [pdf.js](https://mozilla.github.io/pdf.js/) v5.4.296 - Mozilla's PDF rendering engine
- [Vite](https://vitejs.dev/) v7.1.12 - Next generation frontend tooling
- Vanilla JavaScript - No frameworks, just pure JS
- Modern CSS - 3D transforms for realistic page turns
