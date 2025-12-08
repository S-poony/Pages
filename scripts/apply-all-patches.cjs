#!/usr/bin/env node
/**
 * apply-all-patches.js
 * Runs every patch inside scripts/page-flip-patches in alphabetical order,
 * rebuilds page-flip, and updates the patch-package file.
 *
 * Usage:
 *   node scripts/apply-all-patches.js
 *      (optionally set env-var NO_PATCH=1 to skip patch-package step)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// -----------------------------------------------------------
// CONFIG
// -----------------------------------------------------------
const PATCH_DIR = path.join(__dirname, 'page-flip-patches'); // scripts/page-flip-patches
const LIB_ROOT = path.join(__dirname, '../../node_modules/page-flip'); // adjust if necessary

// -----------------------------------------------------------
// UTILS
// -----------------------------------------------------------
function log(msg) { console.log(`\n[apply-all-patches] ${msg}`); }
function die(msg) { console.error(msg); process.exit(1); }

function run(cmd, args = [], cwd = process.cwd()) {
  const r = spawnSync(cmd, args, { cwd, shell: true, stdio: 'inherit' });
  if (r.status !== 0) die(`Command failed: ${cmd} ${args.join(' ')}`);
}

// -----------------------------------------------------------
// MAIN
// -----------------------------------------------------------
function main() {
  if (!fs.existsSync(PATCH_DIR)) die(`Patch directory not found: ${PATCH_DIR}`);

  const patches = fs.readdirSync(PATCH_DIR)
    .filter(f => /\.(py|js)$/i.test(f))
    .sort(); // 01-foo.py, 02-bar.py … 99-zot.js

  if (!patches.length) die('No .py or .js patches found.');


  log(`Found ${patches.length} patch(es): ${patches.join(', ')}`);

  patches.forEach(file => {
    const full = path.join(PATCH_DIR, file);
    log(`Applying ${file} …`);
    if (file.endsWith('.py')) {
      run('python', [full]);
    } else {
      run('node', [full]);
    }
  });

  log('Rebuilding page-flip …');
  // run('npm', ['install', '--legacy-peer-deps'], LIB_ROOT); // ensure deps - MOVED TO START
  run('npm', ['run', 'build'], LIB_ROOT);

  if (process.env.NO_PATCH) {
    log('NO_PATCH set – skipping patch-package step.');
  } else {
    log('Updating patch-package file …');
    run('npx', ['patch-package', 'page-flip'], path.join(__dirname, '../..'));
  }

  log('All done ✅');
}

main();