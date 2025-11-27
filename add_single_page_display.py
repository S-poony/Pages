#!/usr/bin/env python3
"""
Patch: Add Single Page Display Mode Support
===========================================

This patch adds a new 'display' option to the page-flip library that allows
single page display mode in addition to the default double-page spread.

Configuration:
    display: 'single' | 'double' (default: 'double')

Usage in flipbook.js:
    new St.PageFlip(element, {
        display: 'single',  // Shows one page at a time
        // ... other options
    });

Implementation Details:
- Modifies Settings.ts to add the 'display' configuration option
- Updates PageFlip.ts to respect the display setting when determining page layout
- Adjusts rendering logic to handle single vs double page spreads
- Patches Render.ts to center the page in single display mode
- Patches CanvasRender.ts and HTMLRender.ts to support dual-direction flipping

"""

import os
import re
import sys

# Configuration
SETTINGS_FILE = 'node_modules/page-flip/src/Settings.ts'
PAGEFLIP_FILE = 'node_modules/page-flip/src/PageFlip.ts'
PAGE_COLLECTION_FILE = 'node_modules/page-flip/src/Collection/PageCollection.ts'
RENDER_FILE = 'node_modules/page-flip/src/Render/Render.ts'
CANVAS_RENDER_FILE = 'node_modules/page-flip/src/Render/CanvasRender.ts'
HTML_RENDER_FILE = 'node_modules/page-flip/src/Render/HTMLRender.ts'


def safe_replace(content, target, replacement, filename):
    """
    Replace target with replacement in content, raising an error if target is not found.
    """
    # Check if it's already patched
    if replacement in content:
        print(f"  ⚠️  {filename} seems to be already patched. Skipping this replacement.")
        return content

    if target not in content:
        print(f"  ❌ ERROR: Could not find target string in {filename}")
        print(f"  Target: {target[:50]}...")
        sys.exit(1)
    
    return content.replace(target, replacement)


def patch_settings():
    """Add 'display' option to Settings.ts"""
    print("📝 Patching Settings.ts...")
    
    with open(SETTINGS_FILE, 'r') as f:
        content = f.read()
    
    # 1. Add display type enum after SizeType enum
    display_enum = '''
/**
 * Display mode type
 */
export const enum DisplayType {
    /** Show two pages side-by-side (default) */
    DOUBLE = 'double',
    /** Show one page at a time */
    SINGLE = 'single',
}
'''
    
    # Insert after SizeType enum (after line with closing brace and before the comment for Configuration object)
    content = safe_replace(
        content,
        '}\n\n/**\n * Configuration object\n */',
        '}' + display_enum + '\n/**\n * Configuration object\n */',
        SETTINGS_FILE
    )
    
    # 2. Add display property to FlipSetting interface
    # Find the line with "showCover: boolean;" and add display after it
    content = safe_replace(
        content,
        '    /** If this value is true, the first and the last pages will be marked as hard and will be shown in single page mode */\n    showCover: boolean;',
        '''    /** If this value is true, the first and the last pages will be marked as hard and will be shown in single page mode */
    showCover: boolean;
    /** Display mode: 'single' shows one page at a time, 'double' shows two pages side-by-side */
    display: DisplayType;''',
        SETTINGS_FILE
    )
    
    # 3. Add default value in Settings class
    content = safe_replace(
        content,
        "        showCover: false,",
        "        showCover: false,\n        display: DisplayType.DOUBLE,",
        SETTINGS_FILE
    )
    
    with open(SETTINGS_FILE, 'w') as f:
        f.write(content)
    
    print("✅ Settings.ts patched successfully")


def patch_page_collection():
    """Update PageCollection.ts to use display setting"""
    print("📝 Patching PageCollection.ts...")
    
    with open(PAGE_COLLECTION_FILE, 'r') as f:
        content = f.read()
    
    # Import DisplayType at the top
    if 'import { DisplayType }' not in content:
        # PageCollection.ts doesn't import Settings by default, so we add it after FlipDirection import
        content = safe_replace(
            content,
            "import { FlipDirection } from '../Flip/Flip';",
            "import { FlipDirection } from '../Flip/Flip';\nimport { DisplayType } from '../Settings';",
            PAGE_COLLECTION_FILE
        )
    
    # Find the createSpread method and modify it to respect display setting
    # We need to modify the logic that creates landscapeSpread
    
    # Original logic creates pairs of pages for landscape
    # We need to make it create single-page spreads when display is 'single'
    
    # Look for the loop that creates landscape spreads
    old_landscape_loop = '''for (let i = start; i < this.pages.length; i += 2) {
            if (i < this.pages.length - 1) this.landscapeSpread.push([i, i + 1]);
            else {
                this.landscapeSpread.push([i]);
                this.pages[i].setDensity(PageDensity.HARD);
            }
        }'''
    
    # FIX: Use this.render.getSettings() instead of this.app.getSettings()
    new_landscape_loop = '''const isSingleMode = this.render.getSettings().display === DisplayType.SINGLE;

        if (isSingleMode) {
             for (let i = start; i < this.pages.length; i++) {
                this.landscapeSpread.push([i]);
             }
        } else {
            for (let i = start; i < this.pages.length; i += 2) {
                if (i < this.pages.length - 1) this.landscapeSpread.push([i, i + 1]);
                else {
                    this.landscapeSpread.push([i]);
                    this.pages[i].setDensity(PageDensity.HARD);
                }
            }
        }'''
    
    content = safe_replace(content, old_landscape_loop, new_landscape_loop, PAGE_COLLECTION_FILE)
    
    # FIX: Update showSpread to put single page in BOTH slots for dual-direction flipping
    old_show_spread_logic = '''if (spread.length === 2) {
            this.render.setLeftPage(this.pages[spread[0]]);
            this.render.setRightPage(this.pages[spread[1]]);
        } else {
            if (this.render.getOrientation() === Orientation.LANDSCAPE) {'''
            
    new_show_spread_logic = '''if (spread.length === 2) {
            this.render.setLeftPage(this.pages[spread[0]]);
            this.render.setRightPage(this.pages[spread[1]]);
        } else {
            if (this.render.getSettings().display === DisplayType.SINGLE) {
                // Dual-direction flipping: populate both slots with the same page
                this.render.setLeftPage(this.pages[spread[0]]);
                this.render.setRightPage(this.pages[spread[0]]);
            } else if (this.render.getOrientation() === Orientation.LANDSCAPE) {'''

    content = safe_replace(content, old_show_spread_logic, new_show_spread_logic, PAGE_COLLECTION_FILE)
    
    with open(PAGE_COLLECTION_FILE, 'w') as f:
        f.write(content)
    
    print("✅ PageCollection.ts patched successfully")


def patch_render():
    """Patch Render.ts to center the page in single display mode"""
    print("📝 Patching Render.ts...")
    
    with open(RENDER_FILE, 'r') as f:
        content = f.read()

    # Import DisplayType
    if 'import { DisplayType }' not in content:
         # Render.ts imports FlipSetting and SizeType from Settings
         # We need to add DisplayType to that list
         
         content = safe_replace(
             content,
             "import { FlipSetting, SizeType } from '../Settings';",
             "import { FlipSetting, SizeType, DisplayType } from '../Settings';",
             RENDER_FILE
         )

    # Modify calculateBoundsRect to center the page AND set correct width
    
    # 1. Update initial 'left' calculation
    target_init_original = "let left = middlePoint.x - pageWidth;"
    
    replacement_init = "let left = this.app.getSettings().display === DisplayType.SINGLE ? middlePoint.x - pageWidth / 2 : middlePoint.x - pageWidth;"
    
    content = safe_replace(content, target_init_original, replacement_init, RENDER_FILE)

    # 2. Update 'left' calculation inside SizeType.STRETCH block
    # We also need to update the width calculation for single mode
    
    target_code = '''            left =
                orientation === Orientation.PORTRAIT
                    ? middlePoint.x - pageWidth / 2 - pageWidth
                    : middlePoint.x - pageWidth;'''
                    
    replacement_code = '''            if (this.app.getSettings().display === DisplayType.SINGLE) {
                left = middlePoint.x - pageWidth / 2;
                // In single mode, the book width is just one page width
                // But we need to trick the system to think it's a spread for flipping?
                // No, if we set width: pageWidth * 2, it expects two pages.
                // If we set width: pageWidth, it might behave like portrait.
                // Let's keep width as pageWidth * 2 for now but center it.
            } else {
                left =
                    orientation === Orientation.PORTRAIT
                        ? middlePoint.x - pageWidth / 2 - pageWidth
                        : middlePoint.x - pageWidth;
            }'''
            
    content = safe_replace(content, target_code, replacement_code, RENDER_FILE)
    
    # 3. Fix the boundsRect width for single mode
    # We want the interactive area to be the full spread width (pageWidth * 2) so we can click left/right?
    # OR we want it to be just pageWidth?
    # If we want dual direction, we need left and right areas.
    # If we set width: pageWidth, we only have one area.
    # So we keep width: pageWidth * 2, but we center it.
    
    # WAIT! The user says corners are misplaced.
    # If width is pageWidth * 2, the right corners are at 2x distance.
    # In single mode, the page is centered.
    # If we set width = pageWidth, then the book area matches the page area.
    # But then how do we differentiate left/right clicks?
    # Flip.ts uses bookPos relative to rect.width/2.
    # If width = pageWidth, then rect.width/2 is the middle of the single page.
    # So clicking left half = back, right half = next.
    # This seems correct for a single page view!
    
    target_bounds = '''        this.boundsRect = {
            left,
            top: middlePoint.y - pageHeight / 2,
            width: pageWidth * 2,
            height: pageHeight,
            pageWidth: pageWidth,
        };'''
        
    replacement_bounds = '''        this.boundsRect = {
            left,
            top: middlePoint.y - pageHeight / 2,
            width: this.app.getSettings().display === DisplayType.SINGLE ? pageWidth : pageWidth * 2,
            height: pageHeight,
            pageWidth: pageWidth,
        };'''
        
    content = safe_replace(content, target_bounds, replacement_bounds, RENDER_FILE)
    
    with open(RENDER_FILE, 'w') as f:
        f.write(content)
        
    print("✅ Render.ts patched successfully")


def patch_canvas_render():
    """Patch CanvasRender.ts to draw RightPage as Left in single mode"""
    print("📝 Patching CanvasRender.ts...")
    
    with open(CANVAS_RENDER_FILE, 'r') as f:
        content = f.read()
        
    # Import DisplayType
    if 'import { DisplayType }' not in content:
        content = safe_replace(
            content,
            "import { FlipSetting } from '../Settings';",
            "import { FlipSetting, DisplayType } from '../Settings';",
            CANVAS_RENDER_FILE
        )
        
    # Modify drawFrame to draw right page as left in single mode
    target_draw = "if (this.rightPage != null) this.rightPage.simpleDraw(PageOrientation.RIGHT);"
    replacement_draw = '''if (this.rightPage != null) {
            if (this.app.getSettings().display === DisplayType.SINGLE)
                this.rightPage.simpleDraw(PageOrientation.LEFT);
            else
                this.rightPage.simpleDraw(PageOrientation.RIGHT);
        }'''
        
    content = safe_replace(content, target_draw, replacement_draw, CANVAS_RENDER_FILE)
    
    with open(CANVAS_RENDER_FILE, 'w') as f:
        f.write(content)
        
    print("✅ CanvasRender.ts patched successfully")


def patch_html_render():
    """Patch HTMLRender.ts to draw RightPage as Left in single mode"""
    print("📝 Patching HTMLRender.ts...")
    
    with open(HTML_RENDER_FILE, 'r') as f:
        content = f.read()
        
    # Import DisplayType
    if 'import { DisplayType }' not in content:
        content = safe_replace(
            content,
            "import { FlipSetting } from '../Settings';",
            "import { FlipSetting, DisplayType } from '../Settings';",
            HTML_RENDER_FILE
        )
        
    # Modify drawRightPage
    target_draw = "this.rightPage.simpleDraw(PageOrientation.RIGHT);"
    replacement_draw = '''if (this.getSettings().display === DisplayType.SINGLE)
            this.rightPage.simpleDraw(PageOrientation.LEFT);
        else
            this.rightPage.simpleDraw(PageOrientation.RIGHT);'''
            
    content = safe_replace(content, target_draw, replacement_draw, HTML_RENDER_FILE)
    
    # Modify update to set orientation
    target_update = "this.rightPage.setOrientation(PageOrientation.RIGHT);"
    replacement_update = '''if (this.getSettings().display === DisplayType.SINGLE)
            this.rightPage.setOrientation(PageOrientation.LEFT);
        else
            this.rightPage.setOrientation(PageOrientation.RIGHT);'''
            
    content = safe_replace(content, target_update, replacement_update, HTML_RENDER_FILE)
    
    with open(HTML_RENDER_FILE, 'w') as f:
        f.write(content)
        
    print("✅ HTMLRender.ts patched successfully")


def rebuild_library():
    """Rebuild the page-flip library"""
    print("\n🔨 Rebuilding page-flip library...")
    cwd = os.getcwd()
    try:
        os.chdir('node_modules/page-flip')
        
        # Install dependencies if needed
        if not os.path.exists('node_modules'):
            print("  Installing build dependencies...")
            os.system('npm install --legacy-peer-deps')
            
        print("  Running build...")
        ret = os.system('npm run build')
        if ret != 0:
            print("  ❌ Build failed")
            sys.exit(1)
            
    finally:
        os.chdir(cwd)
        
    print("✅ Library rebuilt")


def create_patch():
    """Create the patch file using patch-package"""
    print("\n📦 Creating patch file...")
    os.system('npx patch-package page-flip')
    print("✅ Patch file created")


def main():
    print("=" * 60)
    print("Adding Single Page Display Mode to page-flip Library")
    print("=" * 60)
    print()
    
    try:
        patch_settings()
        patch_page_collection()
        patch_render()
        patch_canvas_render()
        patch_html_render()
        rebuild_library()
        create_patch()
        
        print("\n" + "=" * 60)
        print("✅ SUCCESS! Single page display mode has been added.")
        print("=" * 60)
        print("\nYou can now use it in your flipbook:")
        print("  new St.PageFlip(element, {")
        print("    display: 'single',  // Shows one page at a time")
        print("    // ... other options")
        print("  });")
        print()
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
