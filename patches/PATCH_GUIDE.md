# PATCH_GUIDE.md – updated to use the **angle-only** (Option A) shadow-direction fix and the new `apply-all-patches.js` helper.

---

# Modifying the `page-flip` Library

This project keeps every change to the `page-flip` npm package under version control with [`patch-package`](https://github.com/ds300/patch-package).

| What you touch | What stays |
|----------------|------------|
| `scripts/page-flip-patches/*.py / *.js` | patch sources (committed) |
| `patches/page-flip+*.patch` | patch file (committed) |
| `node_modules/page-flip/src/…` | temporary working copy (git-ignored) |

Anyone who runs `npm install` later gets the same customised library automatically.

---

## Quick start – apply everything

```bash
# 1. run every patch in order and rebuild
node scripts/apply-all-patches.js

# 2. optional – update the patch file (only if you changed a patch)
npx patch-package page-flip

# 3. commit the result
git add patches/
git commit -m "update page-flip patches"
```

That is **all** you need if you only want the shadows flipped, single-page mode, etc.

---

## One-by-one patching (advanced)

Patch scripts live in `scripts/page-flip-patches/`.  
They must be run **in alphabetical order** because later ones depend on earlier ones.

```bash
# example: add only single-page mode
python scripts/page-flip-patches/01-single-page-display.py

# rebuild afterwards
cd node_modules/page-flip && npm run build && cd ../..
```


## Manual edits (only if you skip the scripts)

| Target file | Typical change |
|-------------|----------------|
| `Settings.ts` | add keys to `FlipSetting` interface + `_default` object |
| `CanvasRender.ts` | use new settings / tweak angle |
| `HTMLRender.ts` | same for DOM mode |
| `Render.ts` | single-page geometry (already done by 01) |

After any hand edit:

```bash
cd node_modules/page-flip && npm run build && cd ../..
npx patch-package page-flip
```

---

## Testing

```bash
npm run dev      # or your usual start command
```

Flip a few pages – shadow should now appear on the **opposite** side without breaking double-page mode.

---

## Updating the library later

```bash
npm update page-flip
# patches are re-applied automatically by the post-install hook
```

If a patch conflicts, delete `patches/page-flip+*.patch`, re-run the scripts, and commit the new patch file.
