
import os

file_path = 'node_modules/page-flip/src/Render/Render.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Replacement 1: Import FlipCorner
old_import = "import { FlipDirection } from '../Flip/Flip';"
new_import = "import { FlipDirection, FlipCorner } from '../Flip/Flip';"
content = content.replace(old_import, new_import)

# Replacement 2: Update shadow property
old_shadow = """    protected shadow: {
        pos: Point;
        angle: number;
        width: number;
        opacity: number;
        direction: FlipDirection;
        progress: number;
    };"""
new_shadow = """    protected shadow: {
        pos: Point;
        angle: number;
        width: number;
        opacity: number;
        direction: FlipDirection;
        progress: number;
        corner: FlipCorner;
    };"""
content = content.replace(old_shadow, new_shadow)

# Replacement 3: Update setShadowData
old_method = """    public setShadowData(
        pos: Point,
        angle: number,
        progress: number,
        direction: FlipDirection
    ): void {
        if (!this.app.getSettings().drawShadow) return;

        const maxShadowOpacity = 100 * this.getSettings().maxShadowOpacity;

        this.shadow = {
            pos,
            angle,
            width: (((this.getRect().pageWidth * 3) / 4) * progress) / 100,
            opacity: ((100 - progress) * maxShadowOpacity) / 100 / 100,
            direction,
            progress: progress * 2,
        };
    }"""
new_method = """    public setShadowData(
        pos: Point,
        angle: number,
        progress: number,
        direction: FlipDirection,
        corner: FlipCorner
    ): void {
        if (!this.app.getSettings().drawShadow) return;

        const maxShadowOpacity = 100 * this.getSettings().maxShadowOpacity;

        this.shadow = {
            pos,
            angle,
            width: (((this.getRect().pageWidth * 3) / 4) * progress) / 100,
            opacity: ((100 - progress) * maxShadowOpacity) / 100 / 100,
            direction,
            progress: progress * 2,
            corner,
        };
    }"""
content = content.replace(old_method, new_method)

with open(file_path, 'w') as f:
    f.write(content)

print("Render.ts modified successfully")
