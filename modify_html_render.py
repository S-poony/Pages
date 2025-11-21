
import os

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Import FlipCorner
if "import { FlipDirection } from '../Flip/Flip';" in content:
    content = content.replace("import { FlipDirection } from '../Flip/Flip';", "import { FlipDirection, FlipCorner } from '../Flip/Flip';")

# 2. Add flippingShadow property
if "private hardInnerShadow: HTMLElement = null;" in content:
    content = content.replace("private hardInnerShadow: HTMLElement = null;", "private hardInnerShadow: HTMLElement = null;\n    private flippingShadow: HTMLElement = null;")

# 3. Update createShadows
if '<div class="stf__hardInnerShadow"></div>' in content:
    content = content.replace('<div class="stf__hardInnerShadow"></div>', '<div class="stf__hardInnerShadow"></div>\n             <div class="stf__flippingShadow"></div>')

if "this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');" in content:
    content = content.replace("this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');", "this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');\n        this.flippingShadow = this.element.querySelector('.stf__flippingShadow');")

# 4. Update clearShadow
if "this.hardInnerShadow.style.cssText = 'display: none';" in content:
    content = content.replace("this.hardInnerShadow.style.cssText = 'display: none';", "this.hardInnerShadow.style.cssText = 'display: none';\n        this.flippingShadow.style.cssText = 'display: none';")

# 5. Implement drawFlippingShadow
draw_flipping_shadow_method = """
    /**
     * Draw shadow below the flipping page
     */
    private drawFlippingShadow(): void {
        const rect = this.getRect();
        const shadow = this.shadow;
        
        // Calculate Static Corner (Start of Gradient)
        let startPoint = { x: 0, y: 0 };
        if (shadow.direction === FlipDirection.FORWARD) {
            if (shadow.corner === FlipCorner.TOP) {
                startPoint = { x: rect.left + rect.pageWidth * 2, y: rect.top };
            } else {
                startPoint = { x: rect.left + rect.pageWidth * 2, y: rect.top + rect.height };
            }
        } else {
            if (shadow.corner === FlipCorner.TOP) {
                startPoint = { x: rect.left, y: rect.top };
            } else {
                startPoint = { x: rect.left, y: rect.top + rect.height };
            }
        }

        // Calculate Dynamic Corner (End of Gradient)
        let endPoint = { x: 0, y: 0 };
        // We need global coordinates for the page rect to match startPoint which is global-ish (relative to book)
        // Actually getRect() returns coordinates relative to the container?
        // convertRectToGlobal converts pageRect to global.
        const globalPageRect = this.convertRectToGlobal(this.pageRect);
        
        if (shadow.direction === FlipDirection.FORWARD) {
             if (shadow.corner === FlipCorner.TOP) {
                 endPoint = globalPageRect.topRight;
             } else {
                 endPoint = globalPageRect.bottomRight;
             }
        } else {
             if (shadow.corner === FlipCorner.TOP) {
                 endPoint = globalPageRect.topLeft;
             } else {
                 endPoint = globalPageRect.bottomLeft;
             }
        }
        
        // Calculate angle for linear-gradient
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = (angleRad * 180 / Math.PI) + 90; // Convert to CSS deg (0 is up, 90 is right) -> wait.
        // Math: 0 is Right, 90 is Down.
        // CSS: 0 is Top, 90 is Right, 180 is Bottom.
        // So Math 0 (Right) = CSS 90.
        // Math 90 (Down) = CSS 180.
        // CSS = Math + 90.
        
        const cssAngle = angleDeg;

        const newStyle = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 4).toString(10)};
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: linear-gradient(${cssAngle}deg, rgba(0, 0, 0, ${shadow.opacity}) 0%, rgba(0, 0, 0, 0) 100%);
            left: ${rect.left}px;
            top: ${rect.top}px;
            position: absolute;
            pointer-events: none;
        `;
        
        this.flippingShadow.style.cssText = newStyle;
    }
"""

# Insert method before drawFrame
if "protected drawFrame(): void {" in content:
    content = content.replace("protected drawFrame(): void {", draw_flipping_shadow_method + "\n    protected drawFrame(): void {")

# 6. Call drawFlippingShadow in drawFrame
# We want to call it before flippingPage.draw() but after bottomPage.draw()
# And specifically, we want to call it if shadow is not null.
# Existing code:
#         this.drawBottomPage();
#
#         if (this.flippingPage != null) {
#             (this.flippingPage as HTMLPage).getElement().style.zIndex = (
#                 this.getSettings().startZIndex + 5
#             ).toString(10);
#
#             this.flippingPage.draw();
#         }

call_shadow = """
        this.drawBottomPage();

        if (this.shadow != null) {
            this.drawFlippingShadow();
        }

        if (this.flippingPage != null) {"""

if "this.drawBottomPage();" in content and "if (this.flippingPage != null) {" in content:
    # Use a more specific replacement to avoid issues
    content = content.replace("this.drawBottomPage();", call_shadow.replace("this.drawBottomPage();", "").strip())
    # Wait, string replacement is tricky with indentation.
    
    # Let's try to find the block
    block_start = "this.drawBottomPage();"
    block_end = "if (this.flippingPage != null) {"
    
    # Construct the replacement
    replacement = """this.drawBottomPage();

        if (this.shadow != null) {
            this.drawFlippingShadow();
        }

        if (this.flippingPage != null) {"""
        
    content = content.replace(block_start + "\n\n        " + block_end, replacement)
    # Also try without extra newline
    content = content.replace(block_start + "\n        " + block_end, replacement)

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts modified successfully")
