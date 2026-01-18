/**
 * Build script for flipbook assets
 * 
 * Creates bundled JS and CSS files for the flipbook that can be hosted on Cloudflare R2
 * 
 * Usage: node scripts/build-flipbook-assets.js
 * Output: dist/flipbook.bundle.js and dist/flipbook.bundle.css
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// JS files in the order they need to be loaded
const jsFiles = [
    'src/js/flipbook/state.js',
    'src/js/flipbook/utils.js',
    'src/js/flipbook/navigation.js',
    'src/js/flipbook/scaling.js',
    'src/js/flipbook/zoom.js',
    'src/js/flipbook/pageflip.js',
    'src/js/flipbook/ui.js',
    'src/js/flipbook/links.js',
    'src/js/flipbook/main.js'
];

// CSS file
const cssFile = 'src/flipbook.css';

// Also need the StPageFlip library
const pageFlipFile = 'src/lib/StPageFlip-master/dist/js/page-flip.browser.js';

function build() {
    // Create dist folder if it doesn't exist
    const distDir = join(rootDir, 'dist');
    if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
    }

    // Build JS bundle
    console.log('Building JavaScript bundle...');
    let jsBundle = '// Flipbook JavaScript Bundle\n// Generated: ' + new Date().toISOString() + '\n\n';

    // Include StPageFlip library first
    try {
        const pageFlipContent = readFileSync(join(rootDir, pageFlipFile), 'utf-8');
        jsBundle += '// === StPageFlip Library ===\n' + pageFlipContent + '\n\n';
        console.log('  ✓ Included StPageFlip library');
    } catch (e) {
        console.error('  ✗ Could not find StPageFlip library at', pageFlipFile);
        console.log('    Make sure to run: npm install');
    }

    // Include flipbook JS files
    for (const file of jsFiles) {
        const filePath = join(rootDir, file);
        try {
            const content = readFileSync(filePath, 'utf-8');
            jsBundle += `// === ${file} ===\n${content}\n\n`;
            console.log('  ✓ Included', file);
        } catch (e) {
            console.error('  ✗ Could not read', file);
        }
    }

    writeFileSync(join(distDir, 'flipbook.bundle.js'), jsBundle);
    console.log('✓ Created dist/flipbook.bundle.js\n');

    // Build CSS bundle
    console.log('Building CSS bundle...');
    try {
        const cssContent = readFileSync(join(rootDir, cssFile), 'utf-8');
        const cssBundle = '/* Flipbook CSS Bundle\n   Generated: ' + new Date().toISOString() + ' */\n\n' + cssContent;
        writeFileSync(join(distDir, 'flipbook.bundle.css'), cssBundle);
        console.log('  ✓ Included', cssFile);
        console.log('✓ Created dist/flipbook.bundle.css\n');
    } catch (e) {
        console.error('  ✗ Could not read', cssFile);
    }

    console.log('Build complete!');
    console.log('\nNext steps:');
    console.log('1. Upload dist/flipbook.bundle.js and dist/flipbook.bundle.css to your Cloudflare R2 bucket');
    console.log('2. Set FLIPBOOK_JS_URL and FLIPBOOK_CSS_URL environment variables in your Cloudflare Worker');
}

build();
