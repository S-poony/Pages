
import os

file_path = 'node_modules/page-flip/src/Render/CanvasRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Replacement 1: Import FlipCorner
old_import = "import { FlipDirection } from '../Flip/Flip';"
new_import = "import { FlipDirection, FlipCorner } from '../Flip/Flip';"
content = content.replace(old_import, new_import)

# Replacement 2: Call drawFlippingShadow in drawFrame
old_drawFrame = """        this.drawBookShadow();

        if (this.flippingPage != null) this.flippingPage.draw();"""
new_drawFrame = """        this.drawBookShadow();

        if (this.shadow != null) {
            this.drawFlippingShadow();
        }

        if (this.flippingPage != null) this.flippingPage.draw();"""
content = content.replace(old_drawFrame, new_drawFrame)

# Replacement 3: Add drawFlippingShadow method (before drawBookShadow)
old_method_start = "    private drawBookShadow(): void {"
new_method = """    private drawFlippingShadow(): void {
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
        
        this.ctx.save();
        
        this.ctx.beginPath();
        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);
        this.ctx.clip();
        
        const gradient = this.ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, ' + (shadow.opacity) + ')');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        
        this.ctx.restore();
    }

    private drawBookShadow(): void {"""

content = content.replace(old_method_start, new_method)

with open(file_path, 'w') as f:
    f.write(content)

print("CanvasRender.ts modified successfully")
