# Modifying page-flip Library

This project uses [`patch-package`](https://github.com/ds300/patch-package) to maintain custom modifications to the `page-flip` library.

## 📝 Making Changes

### 1. **Modify the library files** in `node_modules/page-flip/`

For example, to adjust shadow gradients:
```bash
# Edit the file directly
code node_modules/page-flip/src/Render/CanvasRender.ts
```

### 2. **Create a patch**

After making your changes:
```bash
npx patch-package page-flip
```

This creates a patch file in `patches/page-flip+2.0.7.patch`

### 3. **Commit the patch**

```bash
git add patches/
git commit -m "feat: customize page-flip shadow gradients"
```

## 🔄 How It Works

- The `postinstall` script in `package.json` automatically applies patches after `npm install`
- Patches are stored in the `patches/` directory (tracked in git)
- Anyone who clones the repo and runs `npm install` will get your customizations

## 📂 Key Files to Modify

### Shadow/Gradient Logic:
- **Canvas mode**: `node_modules/page-flip/src/Render/CanvasRender.ts`
  - Lines 57-84: Center book shadow
  - Lines 86-117: Outer flip shadow
  - Lines 119-161: Inner flip shadow

- **HTML mode**: `node_modules/page-flip/src/Render/HTMLRender.ts`
  - Lines 74-135: Hard page shadows
  - Lines 140-199: Soft page inner shadows
  - Lines 204-262: Soft page outer shadows

## ⚠️ Important Notes

1. **Always rebuild after TypeScript changes:**
   ```bash
   cd node_modules/page-flip
   npm run build
   cd ../..
   npx patch-package page-flip
   ```

2. **Add comments** to your modifications:
   ```typescript
   // CUSTOM: Reduced shadow opacity for cleaner appearance
   outerGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
   ```

3. **Updating the library:**
   ```bash
   npm update page-flip
   # Your patches will be re-applied automatically
   # If conflicts occur, resolve them and recreate the patch
   ```

## 🧪 Testing Changes

After modifying and patching:
```bash
npm run dev
# Test your flipbook to verify the changes
\`\`\`

### 4. Custom Flipping Shadow (Canvas Mode)

To implement the custom flipping shadow in Canvas mode, replace the \`drawFlippingShadow\` method in \`node_modules/page-flip/src/Render/CanvasRender.ts\` with the following code. This uses the custom settings defined in \`src/flipbook.js\`.

\`\`\`typescript
    private drawFlippingShadow(): void {
        // ... (CanvasRender implementation) ...
        if (shadow.direction === FlipDirection.FORWARD) {
            this.ctx.translate(-shadow.width, -100);
            outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + endAlpha + ')');
            outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + startAlpha + ')');
        } else {
            this.ctx.translate(0, -100);
            outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + startAlpha + ')');
            outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + endAlpha + ')');
        }
        // ...
    }
```

## Custom Shadow Settings

This patch adds precise control over the flipping shadow (the shadow cast by the turning page onto the underlying spread):

### New Settings in `Settings.ts`:

```typescript
{
    flippingShadow: boolean;              // Enable/disable the flipping shadow
    flippingShadowOpacity: number;        // Base opacity (0-1), independent of flip progress
    flippingShadowWidth: number;          // Shadow width in pixels
    flippingShadowStartAlpha: number;     // Gradient start opacity (0-1)
    flippingShadowEndAlpha: number;       // Gradient end opacity (0-1)
    otherShadowOpacityScale: number;      // Scale factor for other shadows (0-1)
}
```

**Key Changes:**
- `flippingShadowOpacity`: Constant opacity that doesn't fade with flip progress (replaces `shadow.opacity * maxShadowOpacity`)
- `flippingShadowWidth`: Fixed shadow width in pixels (replaces `shadow.width`)
- The shadow now remains consistent throughout the flip animation

### 4. Update CanvasRender.ts

You must also apply similar changes to `node_modules/page-flip/src/Render/HTMLRender.ts` if you are using HTML mode.

```typescript
    private drawFlippingShadow(): void {
        // ...
        let shadowDirection = 'to left'; // Default
        let shadowTranslate = 0;

        if (shadow.direction === FlipDirection.FORWARD) {
            shadowDirection = 'to left';
            shadowTranslate = shadow.width; 
        } else {
            shadowDirection = 'to right';
            shadowTranslate = 0;
        }
        // ...
    }
```

    private drawOuterShadow(): void {
        // ... existing code ...
        // Update opacity to use otherShadowOpacityScale
        if (this.shadow.direction === FlipDirection.FORWARD) {
            this.ctx.translate(0, -100);
            outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + this.shadow.opacity * this.getSettings().otherShadowOpacityScale + ')');
            outerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
            this.ctx.translate(-this.shadow.width, -100);
            outerGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + this.shadow.opacity * this.getSettings().otherShadowOpacityScale + ')');
        }
        // ... existing code ...
    }

    private drawInnerShadow(): void {
        // ... existing code ...
        // Update opacity to use otherShadowOpacityScale
        if (this.shadow.direction === FlipDirection.FORWARD) {
            this.ctx.translate(-isw, -100);
            innerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + this.shadow.opacity * this.getSettings().otherShadowOpacityScale + ')');
            innerGradient.addColorStop(0.9, 'rgba(0, 0, 0, 0.05)');
            innerGradient.addColorStop(0.7, 'rgba(0, 0, 0, ' + this.shadow.opacity * this.getSettings().otherShadowOpacityScale + ')');
            innerGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        } else {
            this.ctx.translate(0, -100);
            innerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + this.shadow.opacity * this.getSettings().otherShadowOpacityScale + ')');
            innerGradient.addColorStop(0.1, 'rgba(0, 0, 0, 0.05)');
            innerGradient.addColorStop(0.3, 'rgba(0, 0, 0, ' + this.shadow.opacity * this.getSettings().otherShadowOpacityScale + ')');
            innerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }
        // ... existing code ...
    }
```
```

> [!NOTE]
> Ensure your `node_modules/page-flip/src/Settings.ts` includes the custom settings (`flippingShadow`, `flippingShadowStartAlpha`, etc.) in the `FlipSetting` interface and default values.

---

## 🔧 Single Page Display Mode Patch

### Overview

This patch adds support for single page display mode, allowing the flipbook to show one page at a time instead of the default two-page spread.

### Script: `add_single_page_display.py`

This automated script modifies the page-flip library to add a new `display` option.

**Features:**
- ✅ Well-documented and easy to modify
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

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `display` | `'single'` \| `'double'` | `'double'` | Display mode: single page or double-page spread |

### What Gets Modified

#### `Settings.ts`
- Adds `DisplayType` enum
- Adds `display: DisplayType` to `FlipSetting` interface
- Sets default value to `DisplayType.DOUBLE`

#### `PageCollection.ts`
- Imports `DisplayType` from Settings
- Modifies landscape spread creation logic to create single-page spreads when `display: 'single'`
- Maintains backward compatibility (default is still double-page)

### Testing

The script has been configured in `src/flipbook.js` with:
```javascript
display: 'single', // TEST: Single page display mode
```

Remove or change this line to switch between single and double page modes.

### Maintenance

To modify the patch behavior, edit `add_single_page_display.py`:
- All modifications are clearly documented in the script
- Each function handles a specific part of the patch
- Easy to adjust logic or add new features

Re-run the script after any modifications to regenerate the patch.
