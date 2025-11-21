
import os

file_path = 'node_modules/page-flip/src/Render/CanvasRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Update drawFlippingShadow to reverse gradient and add logging
old_method = """    private drawFlippingShadow(): void {
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
    }"""

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
        
        // console.log('Shadow:', shadow.direction, shadow.corner, startPoint, endPoint, shadow.opacity);

        this.ctx.save();
        
        this.ctx.beginPath();
        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);
        this.ctx.clip();
        
        const gradient = this.ctx.createLinearGradient(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        // Reversed gradient: Dark at Static Corner -> Transparent at Dynamic Corner
        gradient.addColorStop(0, 'rgba(0, 0, 0, ' + (shadow.opacity) + ')');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        
        this.ctx.restore();
    }"""

content = content.replace(old_method, new_method)

with open(file_path, 'w') as f:
    f.write(content)

print("CanvasRender.ts modified successfully")
