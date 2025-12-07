/**
 * Shadow Direction Fix – OPTION A
 * Adds Math.PI to the shadow angle so the gradient vector is reversed
 * but leaves all FlipDirection tests in the library unchanged.
 *
 * Usage:
 *   node patches/07-fix-shadow-direction-angle.js
 *   cd node_modules/page-flip && npm run build
 *   npx patch-package page-flip
 */

const fs   = require('fs');
const path = require('path');

const file = path.join(__dirname,
          '../node_modules/page-flip/src/Render/CanvasRender.ts');

console.log('Reading CanvasRender.ts …');
let src = fs.readFileSync(file, 'utf8');
const orig = src;

/* ----------------------------------------------------------
 * 1.  Find the line that creates the linear-gradient angle
 *     (two possible spellings exist in the lib)
 * ---------------------------------------------------------- */
const patterns = [
  /(const\s+angle\s*=\s*this\.shadow\.angle)(\s*;)/,                       // const angle = this.shadow.angle;
  /(this\.ctx\.rotate\()(Math\.PI\s*\+\s*this\.shadow\.angle\s*\+\s*Math\.PI\s*\/\s*2)(\);)/ // existing rotate line
];

/* ----------------------------------------------------------
 * 2.  Patch 1 – add π to the *angle* variable
 * ---------------------------------------------------------- */
if (patterns[0].test(src)) {
  src = src.replace(patterns[0], '$1 + Math.PI$2');
  console.log('✓ Added + Math.PI to shadow angle');
} else {
  console.log('⚠  Angle declaration not found – skipping');
}

/* ----------------------------------------------------------
 * 3.  Patch 2 – (optional safety) add π inside rotate() as well
 *     Only if the old patch hadn’t already touched it.
 * ---------------------------------------------------------- */
if (!/shadow\.angle.*\+.*Math\.PI.*\/.*2.*\+.*Math\.PI/.test(src)) {
  src = src.replace(patterns[1], '$1$2 + Math.PI$3');
  console.log('✓ Added + Math.PI inside rotate()');
}

/* ----------------------------------------------------------
 * 4.  Write back if we changed anything
 * ---------------------------------------------------------- */
if (src === orig) {
  console.log('No changes made – file already patched or patterns missing');
} else {
  fs.writeFileSync(file, src);
  console.log('✅ CanvasRender.ts patched (angle + π)');
  console.log('');
  console.log('Next:');
  console.log('  1. cd node_modules/page-flip');
  console.log('  2. npm run build');
  console.log('  3. npx patch-package page-flip');
}