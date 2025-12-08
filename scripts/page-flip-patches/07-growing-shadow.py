#!/usr/bin/env python3
"""
Patch 07 – Growing Flipping Shadow  (clipped version)
Adds a widening shadow under the flipping page and clips it to the book outline.
Compatible with patches 01-06;  no new Settings keys required.
"""

import os
import re

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def patch_file(path, name, operations):
    print(f"Patching {name} ({path})...")
    if not os.path.exists(path):
        print(f"  ERROR: File not found – skipping {name}")
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    modified = False
    for op in operations:
        desc = op["desc"]
        if "replace" in op:
            old, new = op["replace"]
            if old in content:
                content = content.replace(old, new)
                print(f"  - {desc}: Success")
                modified = True
            elif new in content:
                print(f"  - {desc}: Already applied – skipping")
            else:
                print(f"  - {desc}: FAILED – pattern not found")
        elif "regex" in op:
            pat, repl = op["regex"]
            if re.search(pat, content):
                content = re.sub(pat, repl, content)
                print(f"  - {desc}: Success")
                modified = True
            else:
                print(f"  - {desc}: FAILED – regex pattern not found")

    if modified:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Saved {name}\n")
    else:
        print(f"  No changes made to {name}\n")


# ------------------------------------------------------------------
# 1. Settings.ts  –  add full shadow-customisation interface
# ------------------------------------------------------------------
settings_ops = [
    {
        "desc": "Add new interface members",
        "replace": (
            "    /** Scale factor for other shadows (0-1) */\n    otherShadowOpacityScale: number;\n\n}",
            "    /** Scale factor for other shadows (0-1) */\n    otherShadowOpacityScale: number;\n\n    /** Enable/disable the growing flipping shadow */\n    growingShadow?: boolean;\n    /** Base width of flipping shadow (px) */\n    flippingShadowWidthOffset: number;\n    /** Width multiplier vs progress */\n    flippingShadowWidthScale: number;\n    /** Base opacity (0-1) */\n    flippingShadowOpacity: number;\n    /** Gradient start alpha (0-1) */\n    flippingShadowStartAlpha: number;\n    /** Gradient end alpha (0-1) */\n    flippingShadowEndAlpha: number;\n\n}"
        ),
    },
    {
        "desc": "Add default values",
        "replace": (
            "        otherShadowOpacityScale: 0.7,\n    };",
            "        otherShadowOpacityScale: 0.7,\n        growingShadow: true,\n        flippingShadowWidthOffset: 50,\n        flippingShadowWidthScale: 2,\n        flippingShadowOpacity: 0.5,\n        flippingShadowStartAlpha: 0.7,\n        flippingShadowEndAlpha: 0,\n    };"
        ),
    },
]

# ------------------------------------------------------------------
# 2. HTMLRender.ts  –  give growing shadow its OWN node
# ------------------------------------------------------------------
html_ops = [
    {
        "desc": "Inject dedicated growing-shadow DIV",
        "replace": (
            '             <div class="stf__hardInnerShadow"></div>`',
            '             <div class="stf__hardInnerShadow"></div>\n             <div class="stf__growingShadow"></div>`'
        ),
    },
    {
        "desc": "Cache growingShadow element",
        "replace": (
            "        this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');",
            "        this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');\n        this.growingShadow = this.element.querySelector('.stf__growingShadow');"
        ),
    },
    {
        "desc": "Hide growingShadow in clearShadow()",
        "replace": (
            "        this.hardInnerShadow.style.cssText = 'display: none';",
            "        this.hardInnerShadow.style.cssText = 'display: none';\n        this.growingShadow.style.cssText = 'opacity: 0; pointer-events: none;';"
        ),
    },
    {
        "desc": "Insert drawGrowingShadow method (clipped)",
        "replace": (
            "    protected drawFrame(): void {",
            """    private buildClipPolygonForShadow(pageCornersGlobal: any, shadowPos: any, angle: number, originX: number, height: number): string {
        const pts: string[] = [];
        for (const p of [pageCornersGlobal.topLeft, pageCornersGlobal.topRight, pageCornersGlobal.bottomRight, pageCornersGlobal.bottomLeft]) {
            if (!p) continue;
            const rel = { x: (this.getDirection() === 1 ? -p.x + shadowPos.x : p.x - shadowPos.x), y: p.y - shadowPos.y };
            const rot = { x: rel.x * Math.cos(angle) + rel.y * Math.sin(angle) + originX,
                          y: rel.y * Math.cos(angle) - rel.x * Math.sin(angle) + 100 };
            pts.push(`${rot.x}px ${rot.y}px`);
        }
        return `polygon(${pts.join(', ')})`;
    }

    private drawGrowingShadow(): void {
        const rect = this.getRect();
        const shadow = this.shadow;

        if (!this.getSettings().flippingShadow) {
            this.growingShadow.style.display = 'none';
            return;
        }

        const shadowPos = this.convertToGlobal({ x: shadow.pos.x, y: shadow.pos.y });
        const angle = shadow.angle + 3 * Math.PI / 2;
        const progress = shadow.progress / 100;

        const width = this.getSettings().flippingShadowWidthOffset +
                      shadow.width * this.getSettings().flippingShadowWidthScale * progress;

        const opacity = this.getSettings().flippingShadowOpacity;
        const startAlpha = this.getSettings().flippingShadowStartAlpha * opacity;
        const endAlpha = this.getSettings().flippingShadowEndAlpha * opacity;

        const direction = shadow.direction === 0 ? 'to left' : 'to right';
        const translateX = shadow.direction === 0 ? width : 0;

        const pageCornersGlobal = this.convertRectToGlobal(this.pageRect);
        const clipPoly = this.buildClipPolygonForShadow(pageCornersGlobal, shadowPos, angle, translateX, 4 * rect.height);

        const style = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 4).toString(10)};
            width: ${width}px;
            height: ${4 * rect.height}px;
            background: linear-gradient(${direction}, rgba(0, 0, 0, ${startAlpha}), rgba(0, 0, 0, ${endAlpha}));
            left: ${rect.left}px;
            top: ${rect.top}px;
            position: absolute;
            transform-origin: ${translateX}px ${rect.height}px;
            transform: translate3d(${shadowPos.x - translateX - rect.left}px, ${shadowPos.y - rect.height - rect.top}px, 0) rotate(${angle}rad);
            pointer-events: none;
            clip-path: ${clipPoly};
            -webkit-clip-path: ${clipPoly};
        `;

        this.growingShadow.style.cssText = style;
    }

    protected drawFrame(): void {"""
        ),
    },
    {
        "desc": "Call drawGrowingShadow inside drawFrame",
        "replace": (
            "        if (this.shadow != null && this.flippingPage !== null && this.getSettings().flippingShadow) {",
            "        if (this.shadow != null && this.getSettings().flippingShadow) this.drawGrowingShadow();\n\n        if (this.shadow != null && this.flippingPage !== null && this.getSettings().flippingShadow) {"
        ),
    },
]

# ------------------------------------------------------------------
# 3. CanvasRender.ts  –  add method (no clipping needed, canvas already clips)
# ------------------------------------------------------------------
canvas_ops = [
    {
        "desc": "Insert drawFlippingShadow method before drawBookShadow",
        "replace": (
            "    private drawBookShadow(): void {",
            """    private drawFlippingShadow(): void {
        if (!this.app.getSettings().flippingShadow) return;
        if (!this.flippingPage) return;

        const rect = this.getRect();
        const shadow = this.shadow;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);
        this.ctx.clip();

        const shadowPos = this.convertToGlobal({ x: shadow.pos.x, y: shadow.pos.y });
        this.ctx.translate(shadowPos.x, shadowPos.y);
        this.ctx.rotate(Math.PI + shadow.angle + Math.PI / 2);

        const progress = shadow.progress / 100;
        const width = this.app.getSettings().flippingShadowWidthOffset +
                      shadow.width * this.app.getSettings().flippingShadowWidthScale * progress;

        const opacity = this.app.getSettings().flippingShadowOpacity;
        const startAlpha = this.app.getSettings().flippingShadowStartAlpha * opacity;
        const endAlpha = this.app.getSettings().flippingShadowEndAlpha * opacity;

        if (shadow.direction === 0) {                       // BACK
            this.ctx.translate(-width, -100);
            const g = this.ctx.createRadialGradient(width, rect.height, 0, width, rect.height, width);
            g.addColorStop(0, "rgba(0, 0, 0, " + startAlpha + ")");
            g.addColorStop(1, "rgba(0, 0, 0, " + endAlpha + ")");
            this.ctx.fillStyle = g;
        } else {                                              // FORWARD
            this.ctx.translate(0, -100);
            const g = this.ctx.createRadialGradient(0, rect.height, 0, 0, rect.height, width);
            g.addColorStop(0, "rgba(0, 0, 0, " + startAlpha + ")");
            g.addColorStop(1, "rgba(0, 0, 0, " + endAlpha + ")");
            this.ctx.fillStyle = g;
        }
        
        this.ctx.fillRect(0, 0, width, 2 * rect.height);
        this.ctx.restore();
    }

    private drawBookShadow(): void {"""
        ),
    },
    {
        "desc": "Call drawFlippingShadow inside drawFrame",
        "replace": (
            "        this.drawBookShadow();",
            "        this.drawBookShadow();\n        if (this.shadow != null) this.drawFlippingShadow();"
        ),
    },
]

# ------------------------------------------------------------------
# Run
# ------------------------------------------------------------------
if __name__ == "__main__":
    patch_file("node_modules/page-flip/src/Settings.ts", "Settings.ts", settings_ops)
    patch_file("node_modules/page-flip/src/Render/HTMLRender.ts", "HTMLRender.ts", html_ops)
    patch_file("node_modules/page-flip/src/Render/CanvasRender.ts", "CanvasRender.ts", canvas_ops)