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
```
