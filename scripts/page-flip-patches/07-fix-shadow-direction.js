/**
 * Shadow Direction Patch for page-flip library
 * 
 * This script patches the CanvasRender.ts file to fix shadow direction.
 * Much easier to read and modify than the raw patch file!
 * 
 * Usage:
 *   node patches/apply-shadow-fix.js
 * 
 * After running:
 *   cd node_modules/page-flip && npm run build
 *   npx patch-package page-flip
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION - Change these values to experiment!
// =============================================================================

// If true, swap FORWARD/BACK logic (treats forward as back and vice versa)
const REVERSE_DIRECTION = true;

// If true, add extra Math.PI to rotation (flips shadow 180°)
const ADD_EXTRA_ROTATION = false;

// =============================================================================
// PATCH LOGIC
// =============================================================================

const filePath = path.join(__dirname, '../node_modules/page-flip/src/Render/CanvasRender.ts');

console.log('Reading CanvasRender.ts...');
let content = fs.readFileSync(filePath, 'utf8');

// Store original for comparison
const original = content;

// The key insight: FlipDirection.FORWARD = 0, FlipDirection.BACK = 1
// When flipping right-to-left (forward), shadow should appear on LEFT
// When flipping left-to-right (back), shadow should appear on RIGHT

if (REVERSE_DIRECTION) {
    console.log('Applying: REVERSE_DIRECTION = true');

    // Replace all instances of direction checks
    // This swaps which code runs for FORWARD vs BACK

    // Pattern: if (this.shadow.direction === FlipDirection.FORWARD)
    // Replace with: if (this.shadow.direction === FlipDirection.BACK)

    content = content.replace(
        /if \(this\.shadow\.direction === FlipDirection\.FORWARD\)/g,
        'if (this.shadow.direction === FlipDirection.BACK /* PATCHED: was FORWARD */)'
    );
}

if (ADD_EXTRA_ROTATION) {
    console.log('Applying: ADD_EXTRA_ROTATION = true');

    // Add extra Math.PI to the rotation calculation
    content = content.replace(
        /this\.ctx\.rotate\(Math\.PI \+ this\.shadow\.angle \+ Math\.PI \/ 2\)/g,
        'this.ctx.rotate(Math.PI + this.shadow.angle + Math.PI / 2 + Math.PI /* PATCHED: extra PI */)'
    );
}

// Check if anything changed
if (content === original) {
    console.log('No changes made - file may already be patched or patterns not found.');
} else {
    fs.writeFileSync(filePath, content);
    console.log('✓ Patched successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. cd node_modules/page-flip');
    console.log('  2. npm run build');
    console.log('  3. cd ../..');
    console.log('  4. npx patch-package page-flip');
}
