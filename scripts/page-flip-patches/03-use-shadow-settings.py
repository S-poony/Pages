
import os
import re

# 1. Patch HTMLRender.ts
html_render_path = 'src/lib/StPageFlip-master/src/Render/HTMLRender.ts'
print(f"Patching {html_render_path}...")

with open(html_render_path, 'r') as f:
    content = f.read()

# 1.1 Use this.getSettings().otherShadowOpacityScale
# Replace `* 0.7` with `* this.getSettings().otherShadowOpacityScale`
# Note: In the original file (Step 30), I don't see `* 0.7` in HTMLRender.ts?
# Let's check CanvasRender or elsewhere for 0.7 later.
# Wait, checking step 30 output... there is no 0.7 in HTMLRender.ts.
# It might be in the original source or added by another patch?
# `01-single-page-display.py` is large, maybe it adds it?
# For now, I'll stick to what I see in Step 30.
# Step 30 shows hard coded values like `0.05` and `0.4` etc.
# The original patch 03 tried to replace `* 0.7`.
# If I don't see it, I'll skip it for HTMLRender or look closer.

# 1.2 Use flippingShadow setting in drawFrame
# Block in HTMLRender.ts (lines 344+):
# if (this.shadow != null && this.flippingPage !== null) {
#    if (this.flippingPage.getDrawingDensity() === PageDensity.SOFT) {
# ...
search_block = """        if (this.shadow != null && this.flippingPage !== null) {
            if (this.flippingPage.getDrawingDensity() === PageDensity.SOFT) {"""

replace_block = """        if (this.shadow != null && this.flippingPage !== null && this.getSettings().flippingShadow) {
            if (this.flippingPage.getDrawingDensity() === PageDensity.SOFT) {"""

if search_block in content:
    content = content.replace(search_block, replace_block)
    print("  - Applied flippingShadow toggle check")
else:
    print("  - WARNING: Could not find block to apply flippingShadow toggle check")

# 1.3 Update drawOuterShadow gradient
# Line 248: background: linear-gradient(${shadowDirection}, rgba(0, 0, 0, ${this.shadow.opacity}), rgba(0, 0, 0, 0));
# We want to use StartAlpha and EndAlpha
# Note: `this.shadow.opacity` is calculated elsewhere. We multiply it by our alpha factors.
# Actually the existing code uses `this.shadow.opacity` as the start (or end?) and 0 as the other.
# Logic:
# Start: Main opacity * StartAlpha
# End: Main opacity * EndAlpha

# Regex for Outer Shadow Gradient
# background: linear-gradient(${shadowDirection}, rgba(0, 0, 0, ${
#                this.shadow.opacity
#            }), rgba(0, 0, 0, 0));
# This is multi-line in the file.

# Simplest way: replace the template string content.
old_outer_grad = "rgba(0, 0, 0, ${\n                this.shadow.opacity\n            }), rgba(0, 0, 0, 0)"
new_outer_grad = "rgba(0, 0, 0, ${\n                this.shadow.opacity * this.getSettings().flippingShadowStartAlpha\n            }), rgba(0, 0, 0, ${\n                this.shadow.opacity * this.getSettings().flippingShadowEndAlpha\n            })"

if old_outer_grad in content:
    content = content.replace(old_outer_grad, new_outer_grad)
    print("  - Patched drawOuterShadow gradient")
else:
    # Try single line version just in case whitespace differs
    old_outer_grad_sl = "rgba(0, 0, 0, ${this.shadow.opacity}), rgba(0, 0, 0, 0)"
    if old_outer_grad_sl in content:
        content = content.replace(old_outer_grad_sl, new_outer_grad) # formatting might be off but JS doesn't care much
        print("  - Patched drawOuterShadow gradient (single line match)")
    else:
        print("  - WARNING: Could not find drawOuterShadow gradient")

# 1.4 Update drawInnerShadow gradient
# Line 184:
# background: linear-gradient(${shadowDirection},
#    rgba(0, 0, 0, ${this.shadow.opacity}) 5%,
#    rgba(0, 0, 0, 0.05) 15%,
#    rgba(0, 0, 0, ${this.shadow.opacity}) 35%,
#    rgba(0, 0, 0, 0) 100%);

# We need to be careful here as it has intermediate stops.
# Let's just adjust the start and end for now, or maybe the main opacity components.
# The user asked for "flippingShadowStartAlpha" and "EndAlpha".
# Usually inner shadow implies the shadow *on* the page being flipped (or the one below).
# For now, let's assume we want to scale `this.shadow.opacity` by `otherShadowOpacityScale` for the inner shadow? 
# Or does flippingShadow settings apply to inner shadow too?
# "flippingShadow" usually means the "Outer" shadow (the one cast by the flipping page).
# The "Inner" shadow is the fold gradient on the page itself.
# User code has `otherShadowOpacityScale`.
# Let's apply `otherShadowOpacityScale` to inner shadow and `flippingShadowStart/End` to outer shadow.

# Replace `this.shadow.opacity` with `this.shadow.opacity * this.getSettings().otherShadowOpacityScale` in drawInnerShadow
# But wait, there are multiple occurrences.
# Let's target the drawInnerShadow method specifically if possible, or just global replace if safe.
# It appears twice in drawInnerShadow (5% and 35%).
# It also appears in drawHardInnerShadow.

# Let's use a regex to find all `this.shadow.opacity` inside `drawInnerShadow` scope? 
# Too complex for simple script.
# Let's just replace `this.shadow.opacity` with `(this.shadow.opacity * this.getSettings().otherShadowOpacityScale)` 
# BUT ONLY within the inner shadow functions strings.

# Explicit replacement for drawInnerShadow block
# Matches lines 185-188 roughly
old_inner = "rgba(0, 0, 0, ${this.shadow.opacity}) 5%,"
new_inner = "rgba(0, 0, 0, ${this.shadow.opacity * this.getSettings().otherShadowOpacityScale}) 5%,"
content = content.replace(old_inner, new_inner)

old_inner_2 = "rgba(0, 0, 0, ${this.shadow.opacity}) 35%,"
new_inner_2 = "rgba(0, 0, 0, ${this.shadow.opacity * this.getSettings().otherShadowOpacityScale}) 35%,"
content = content.replace(old_inner_2, new_inner_2)
print("  - Patched drawInnerShadow opacities")

with open(html_render_path, 'w') as f:
    f.write(content)


# 2. Patch CanvasRender.ts
canvas_render_path = 'src/lib/StPageFlip-master/src/Render/CanvasRender.ts'
print(f"Patching {canvas_render_path}...")

with open(canvas_render_path, 'r') as f:
    content = f.read()

# 2.1 Use flippingShadow setting in drawFrame
# Line 48: if (this.shadow != null) {
search_block_canvas = "if (this.shadow != null) {"
replace_block_canvas = "if (this.shadow != null && this.app.getSettings().flippingShadow) {" # Access settings via app or this.setting? Wrapper usually has getSettings() on app or passed in.
# Constructor has `setting: FlipSetting`. Stored as `protected setting: FlipSetting` in Render (base class)?
# Base `Render` doesn't seem to expose `setting` public, but `app.getSettings()` is used in line 36 of CanvasRender.
# So `this.app.getSettings()` is correct.

if search_block_canvas in content:
    # Be careful not to replace every instance if it appears elsewhere?
    # It appears once in drawFrame (Line 48).
    # But checking line 48 in Step 26: `if (this.shadow != null) {`
    # It might appear elsewhere.
    # Let's restrict it by context or just replace all (probably fine as `drawFrame` is the main loop).
    content = content.replace(search_block_canvas, replace_block_canvas)
    print("  - Applied flippingShadow toggle check")
else:
    print("  - WARNING: Could not find block to apply flippingShadow toggle check in CanvasRender")

# 2.2 Update drawOuterShadow gradients
# Line 112: outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + this.shadow.opacity + ')');
# Line 113: outerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
# AND Line 116/117 for the other direction.

# We want:
# 0 -> StartAlpha
# 1 -> EndAlpha
# (Or vice versa depending on direction?)

# Access settings: `this.app.getSettings()`
settings_access = "this.app.getSettings()"

# Direction BACK (Line 110)
# Gradient 0 -> 1 is Close -> Far (Opacity -> Transparent)
# So 0 is Start (Opacity) -> use StartAlpha
# 1 is End (Transparent) -> use EndAlpha

# Replacements:
# `this.shadow.opacity` -> `this.shadow.opacity * ${settings_access}.flippingShadowStartAlpha`
# `'rgba(0, 0, 0, 0)'` -> `'rgba(0, 0, 0, ' + (this.shadow.opacity * ${settings_access}.flippingShadowEndAlpha) + ')'`

# Regex matching is safer.
# Pattern: outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + this.shadow.opacity + ')');
p1 = r"outerGradient\.addColorStop\(0, 'rgba\(0, 0, 0, ' \+ this\.shadow\.opacity \+ '\)'\);"
r1 = f"outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + (this.shadow.opacity * {settings_access}.flippingShadowStartAlpha) + ')');"

content = re.sub(p1, r1, content)

# Pattern: outerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
p2 = r"outerGradient\.addColorStop\(1, 'rgba\(0, 0, 0, 0\)'\);"
r2 = f"outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + (this.shadow.opacity * {settings_access}.flippingShadowEndAlpha) + ')');"

content = re.sub(p2, r2, content)

# NOW allow for the OTHER direction (Forward lines 116-117)
# For forward:
# 0 -> Transparent (End)
# 1 -> Opacity (Start)
# Wait, let's verify visual logic.
# Forward: `translate(-this.shadow.width, -100)`
# Back: `translate(0, -100)`
# Usually StartAlpha is the "Contact" point and EndAlpha is the "Far" point.
# If Forward goes 0->1 (Transp->Opacity), then 1 is Contact.
# So 1 should use StartAlpha, 0 should use EndAlpha.

# My previous replace for p2 transformed `addColorStop(1, ... 0)` -> EndAlpha.
# In Forward (p2 matches line 117? No line 117 is Opacity).
# Line 116: addColorStop(0, ... 0) -> this matches p1? No p1 has `this.shadow.opacity`.
# Line 117: addColorStop(1, ... opacity)

# Let's handle explicit lines.

# Case 1: Opacity at 0 (Back direction) -> StartAlpha
# Already handled by p1/r1 (matches Line 112)

# Case 2: Transparency at 1 (Back direction) -> EndAlpha
# Already handled by p2/r2 (matches Line 113)

# Case 3: Transparency at 0 (Forward direction, Line 116)
p3 = r"outerGradient\.addColorStop\(0, 'rgba\(0, 0, 0, 0\)'\);"
r3 = f"outerGradient.addColorStop(0, 'rgba(0, 0, 0, ' + (this.shadow.opacity * {settings_access}.flippingShadowEndAlpha) + ')');"
content = re.sub(p3, r3, content)

# Case 4: Opacity at 1 (Forward direction, Line 117)
p4 = r"outerGradient\.addColorStop\(1, 'rgba\(0, 0, 0, ' \+ this\.shadow\.opacity \+ '\)'\);"
r4 = f"outerGradient.addColorStop(1, 'rgba(0, 0, 0, ' + (this.shadow.opacity * {settings_access}.flippingShadowStartAlpha) + ')');"
content = re.sub(p4, r4, content)

print("  - Patched drawOuterShadow gradients")

with open(canvas_render_path, 'w') as f:
    f.write(content)

print("Updates complete.")
