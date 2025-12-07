# Modifying page-flip Library

This project uses [`patch-package`](https://github.com/ds300/patch-package) to maintain custom modifications to the `page-flip` library.

## 📂 Patch Scripts

All patch scripts are located in **`scripts/page-flip-patches/`**

See [scripts/page-flip-patches/README.md](scripts/page-flip-patches/README.md) for the full list and usage instructions.

## 📝 Quick Reference

### Apply a patch script:
```bash
python scripts/page-flip-patches/01-single-page-display.py
```

### Rebuild after changes:
```bash
cd node_modules/page-flip && npm run build && cd ../..
```

### Save changes to patch file:
```bash
npx patch-package page-flip
```

### Commit:
```bash
git add patches/
git commit -m "Update page-flip patches"
```

## 🔄 How It Works

- The `postinstall` script in `package.json` automatically applies patches after `npm install`
- Patches are stored in `patches/` (tracked in git)
- Anyone who clones the repo and runs `npm install` gets the customizations

---

## 🎨 Shadow Direction Fix

To experiment with shadow projection direction:

```bash
# Edit the config options at the top:
code scripts/page-flip-patches/07-fix-shadow-direction.js

# Run the script:
node scripts/page-flip-patches/07-fix-shadow-direction.js

# Rebuild and update patch:
cd node_modules/page-flip && npm run build && cd ../..
npx patch-package page-flip
```

**Configuration options:**

| Option | Default | Description |
|--------|---------|-------------|
| `REVERSE_DIRECTION` | `true` | Swap FORWARD/BACK shadow logic |
| `ADD_EXTRA_ROTATION` | `false` | Add 180° to shadow rotation |

### Manual Editing

Edit `node_modules/page-flip/src/Render/CanvasRender.ts` directly.

Key sections:
- **Line ~125**: `drawOuterShadow()` rotation and gradient
- **Line ~165**: `drawInnerShadow()` rotation and gradient

This patch adds precise control over the flipping shadow (the shadow cast by the turning page onto the underlying spread).

### New Settings

Add these to `Settings.ts` in the `FlipSetting` interface:

| Setting | Type | Description |
|---------|------|-------------|
| `flippingShadow` | `boolean` | Enable/disable the flipping shadow |
| `flippingShadowOpacity` | `number` | Base opacity (0-1), independent of flip progress |
| `flippingShadowWidthOffset` | `number` | Base width in pixels (minimum shadow width) |
| `flippingShadowWidthScale` | `number` | Width scale factor (multiplier of base shadow width) |
| `flippingShadowStartAlpha` | `number` | Gradient start opacity (0-1) |
| `flippingShadowEndAlpha` | `number` | Gradient end opacity (0-1) |
| `otherShadowOpacityScale` | `number` | Scale factor for other shadows (0-1) |

### Usage in flipbook.js

```javascript
pageFlip = new St.PageFlip(flipbookEl, {
    // ... other options ...
    
    // Custom shadow settings
    flippingShadow: true,
    flippingShadowOpacity: 0.5,
    flippingShadowWidthOffset: 50,
    flippingShadowWidthScale: 1.5,
    flippingShadowStartAlpha: 0.7,
    flippingShadowEndAlpha: 0,
    otherShadowOpacityScale: 0.5,
});
```

### Files to Modify

#### `node_modules/page-flip/src/Settings.ts`
- Add settings to `FlipSetting` interface
- Add default values

#### `node_modules/page-flip/src/Render/CanvasRender.ts`
- **`drawFlippingShadow()`** - Uses custom opacity/width/gradient settings
- **`drawOuterShadow()`** - Uses `otherShadowOpacityScale`
- **`drawInnerShadow()`** - Uses `otherShadowOpacityScale`

#### `node_modules/page-flip/src/Render/HTMLRender.ts`
Apply similar changes if using HTML mode.

> [!NOTE]
> Add `// CUSTOM:` comments to your modifications for easy identification.

---

## 📖 Single Page Display Mode Patch

This patch adds support for single page display mode, allowing the flipbook to show one page at a time instead of the default two-page spread.

### Script: `add_single_page_display.py`

This automated script modifies the page-flip library to add a new `display` option.

**Features:**
- ✅ Adds `DisplayType` enum with `'single'` and `'double'` modes
- ✅ Updates `Settings.ts` interface and default values
- ✅ Modifies `PageCollection.ts` to respect display mode
- ✅ Auto-generates the patch file

### Usage

1. **Run the patch script:**
   ```bash
   python3 add_single_page_display.py
   ```

2. **Use in your flipbook:**
   ```javascript
   new St.PageFlip(element, {
       display: 'single',  // Shows one page at a time
       // ... other options
   });
   ```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `display` | `'single'` \| `'double'` | `'double'` | Display mode: single page or double-page spread |

### What Gets Modified

| File | Changes |
|------|---------|
| `Settings.ts` | Adds `DisplayType` enum, `display` to interface, default value |
| `PageCollection.ts` | Imports `DisplayType`, modifies spread creation logic |

---

## 📂 Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `node_modules/page-flip/src/Render/CanvasRender.ts` | Canvas mode shadows | 57-161 |
| `node_modules/page-flip/src/Render/HTMLRender.ts` | HTML mode shadows | 74-262 |
| `node_modules/page-flip/src/Settings.ts` | Configuration interface | - |
| `node_modules/page-flip/src/Page/PageCollection.ts` | Page spread logic | - |

---

## 🧪 Testing Changes

After modifying and patching:
```bash
npm run dev
# Test your flipbook to verify the changes
```

## ⚠️ Updating the Library

```bash
npm update page-flip
# Your patches will be re-applied automatically
# If conflicts occur, resolve them and recreate the patch
```
