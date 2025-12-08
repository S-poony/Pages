
import os
import re

# Paths
settings_path = 'node_modules/page-flip/src/Settings.ts'
html_render_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'
canvas_render_path = 'node_modules/page-flip/src/Render/CanvasRender.ts'

def patch_file(path, name, operations):
    print(f"Patching {name} ({path})...")
    if not os.path.exists(path):
        print(f"  ERROR: File not found: {path}")
        return

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = False
    for op in operations:
        description = op['desc']
        # simple 'replace' or 'regex'
        if 'replace' in op:
            old = op['replace'][0]
            new = op['replace'][1]
            if old in content:
                content = content.replace(old, new)
                print(f"  - {description}: Success")
                modified = True
            else:
                # Check if already applied
                if new in content:
                    print(f"  - {description}: Already applied (Skipping)")
                else:
                    print(f"  - {description}: FAILED - Pattern not found")
        elif 'regex' in op:
            pattern = op['regex'][0]
            repl = op['regex'][1]
            if re.search(pattern, content):
                content = re.sub(pattern, repl, content)
                print(f"  - {description}: Success")
                modified = True
            else:
                # Basic check if already seemingly applied isn't easy with regex substitution
                 print(f"  - {description}: FAILED/SKIPPED - Pattern not found")
    
    if modified:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Saved {name}.")
    else:
        print(f"  No changes made to {name}.")


# ==================================================================================
# 1. Patch Settings.ts
# ==================================================================================
settings_ops = [
    {
        'desc': 'Add new settings to interface',
        'replace': (
            "    /** Scale factor for other shadows (0-1) */\n    otherShadowOpacityScale: number;",
            "    /** Scale factor for other shadows (0-1) */\n    otherShadowOpacityScale: number;\n\n    /** Base width of flattening shadow in pixels */\n    flippingShadowWidthOffset: number;\n    /** Scale factor of flattening shadow width */\n    flippingShadowWidthScale: number;"
        )
    },
    {
        'desc': 'Add default values',
        'replace': (
            "        otherShadowOpacityScale: 0.7,",
            "        otherShadowOpacityScale: 0.7,\n        flippingShadowWidthOffset: 50,\n        flippingShadowWidthScale: 2,"
        )
    }
]

# ==================================================================================
# 2. Patch HTMLRender.ts
# ==================================================================================
html_ops = [
    {
        'desc': 'Add private flippingShadow property',
        'replace': (
            "    private hardInnerShadow: HTMLElement = null;",
            "    private hardInnerShadow: HTMLElement = null;\n    private flippingShadow: HTMLElement = null;"
        )
    },
    {
        'desc': 'Inject shadow HTML in createShadows',
        'replace': (
            '             <div class="stf__hardInnerShadow"></div>`',
            '             <div class="stf__hardInnerShadow"></div>\n             <div class="stf__flippingShadow"></div>`'
        )
    },
    {
        'desc': 'Select flippingShadow element',
        'replace': (
            "        this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');",
            "        this.hardInnerShadow = this.element.querySelector('.stf__hardInnerShadow');\n        this.flippingShadow = this.element.querySelector('.stf__flippingShadow');"
        )
    },
    {
        'desc': 'Clear/Hide flippingShadow',
        'replace': (
            "        this.hardInnerShadow.style.cssText = 'display: none';",
            "        this.hardInnerShadow.style.cssText = 'display: none';\n        this.flippingShadow.style.cssText = 'display: none';"
        )
    },
    {
        'desc': 'Inject drawFlippingShadow method',
        'replace': (
            "    protected drawFrame(): void {",
            """    private drawFlippingShadow(): void {
        const rect = this.getRect();
        const shadow = this.shadow;

        if (!this.getSettings().flippingShadow) {
            this.flippingShadow.style.display = 'none';
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

        let direction = 'to left';
        let translateX = 0;
        
        if (shadow.direction === FlipDirection.BACK) { // 0 in JS logic
             direction = 'to left';
             translateX = width;
        } else {
             direction = 'to right';
             translateX = 0;
        }

        const newStyle = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 4).toString(10)};
            width: ${width}px;
            height: ${rect.height * 4}px;
            background: linear-gradient(${direction}, rgba(0, 0, 0, ${startAlpha}), rgba(0, 0, 0, ${endAlpha}));
            left: ${rect.left}px;
            top: ${rect.top}px;
            position: absolute;
            transform-origin: ${translateX}px ${rect.height}px;
            transform: translate3d(${shadowPos.x - translateX - rect.left}px, ${shadowPos.y - rect.height - rect.top}px, 0) rotate(${angle}rad);
            pointer-events: none;
        `;
        
        this.flippingShadow.style.cssText = newStyle;
    }

    protected drawFrame(): void {"""
        )
    },
    {
        'desc': 'Call drawFlippingShadow in drawFrame',
        'replace': (
            "        if (this.shadow != null && this.flippingPage !== null && this.getSettings().flippingShadow) {",
            "        if (this.shadow != null && this.getSettings().flippingShadow) this.drawFlippingShadow();\n\n        if (this.shadow != null && this.flippingPage !== null && this.getSettings().flippingShadow) {"
        )
    }
]

# ==================================================================================
# 3. Patch CanvasRender.ts
# ==================================================================================
canvas_ops = [
    {
        'desc': 'Inject drawFlippingShadow method',
        'replace': (
            "    private drawBookShadow(): void {",  # Insert before drawBookShadow
            """    private drawFlippingShadow(): void {
        if (!this.app.getSettings().flippingShadow) return;
        if (!this.flippingPage) return;

        const rect = this.getRect();
        const shadow = this.shadow;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(rect.left, rect.top, rect.width, rect.height);

        const shadowPos = this.convertToGlobal({ x: shadow.pos.x, y: shadow.pos.y });
        this.ctx.translate(shadowPos.x, shadowPos.y);
        this.ctx.rotate(Math.PI + shadow.angle + Math.PI / 2);

        const progress = shadow.progress / 100;
        const width = this.app.getSettings().flippingShadowWidthOffset + 
                      shadow.width * this.app.getSettings().flippingShadowWidthScale * progress;
        
        const opacity = this.app.getSettings().flippingShadowOpacity;
        const startAlpha = this.app.getSettings().flippingShadowStartAlpha * opacity;
        const endAlpha = this.app.getSettings().flippingShadowEndAlpha * opacity;

        if (shadow.direction === FlipDirection.BACK) {
            this.ctx.translate(-width, -100);
            const gradient = this.ctx.createRadialGradient(width, rect.height, 0, width, rect.height, width);
            gradient.addColorStop(0, "rgba(0, 0, 0, " + startAlpha + ")");
            gradient.addColorStop(1, "rgba(0, 0, 0, " + endAlpha + ")");
            this.ctx.fillStyle = gradient;
        } else {
            this.ctx.translate(0, -100);
            const gradient = this.ctx.createRadialGradient(0, rect.height, 0, 0, rect.height, width);
            gradient.addColorStop(0, "rgba(0, 0, 0, " + startAlpha + ")");
            gradient.addColorStop(1, "rgba(0, 0, 0, " + endAlpha + ")");
            this.ctx.fillStyle = gradient;
        }

        this.ctx.clip();
        this.ctx.fillRect(0, 0, width, 2 * rect.height);
        this.ctx.restore();
    }

    private drawBookShadow(): void {"""
        )
    },
    {
        'desc': 'Call drawFlippingShadow in drawFrame',
        'replace': (
            "        this.drawBookShadow();",
            "        this.drawBookShadow();\n        if (this.shadow != null) this.drawFlippingShadow();"
        )
    }
]

# Run patches
patch_file(settings_path, "Settings.ts", settings_ops)
patch_file(html_render_path, "HTMLRender.ts", html_ops)
patch_file(canvas_render_path, "CanvasRender.ts", canvas_ops)
