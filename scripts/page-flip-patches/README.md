# Page-Flip Library Patches

Scripts for customizing the `page-flip` library behavior.

## Quick Start

```bash
# Run a specific patch
python scripts/page-flip-patches/01-single-page-display.py

# Rebuild after patching
cd node_modules/page-flip && npm run build && cd ../..

# Save changes to patch file
npx patch-package page-flip
```

## Available Patches

| # | Script | Description |
|---|--------|-------------|
| 01 | `01-single-page-display.py` | Adds single-page display mode option |
| 02 | `02-add-shadow-settings.py` | Adds custom shadow settings to Settings.ts |
| 03 | `03-use-shadow-settings.py` | Makes HTMLRender use the shadow settings |
| 04 | `04-adjust-shadow-fadein.py` | Slows down shadow fade-in animation |
| 05 | `05-add-css-transition.py` | Adds CSS transition for smooth opacity |
| 06 | `06-fix-opacity-transition.py` | Fixes opacity transition behavior |
| 07 | `07-growing-shadow.py` | Adds growing shadow effect |

## Patch Order

Run patches in numerical order if starting fresh:
```bash
python scripts/page-flip-patches/01-single-page-display.py
python scripts/page-flip-patches/02-add-shadow-settings.py
python scripts/page-flip-patches/03-use-shadow-settings.py
# ... etc
```

## After Making Changes

1. Rebuild the library:
   ```bash
   cd node_modules/page-flip
   npm run build
   cd ../..
   ```

2. Update the patch file:
   ```bash
   npx patch-package page-flip
   ```

3. Commit the patch:
   ```bash
   git add patches/
   git commit -m "Update page-flip patches"
   ```
