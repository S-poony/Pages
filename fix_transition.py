
import os
import re

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Fix 1: Change clearShadow to use opacity instead of display: none for flippingShadow
old_clear = "        this.flippingShadow.style.cssText = 'display: none';"
new_clear = "        this.flippingShadow.style.cssText = 'opacity: 0; pointer-events: none;';"
content = content.replace(old_clear, new_clear)

# Fix 2: In drawFlippingShadow, keep display: block always, and set opacity as a separate property
# The current approach sets everything in one cssText assignment.
# I need to ensure the element always has the transition property set.

# Find the newStyle assignment in drawFlippingShadow
# Current pattern has: display: block; ...bunch of properties... pointer-events: none;
# I need to add transition to the style string

# First, let's ensure the transition is in the base style
old_style_section = r"(pointer-events: none;)\n(\s+)(transition: opacity 500ms ease-out;)"
# Actually, let me check if the transition was already added by my previous script

# Let me just find and replace the entire newStyle construction
# The issue is that cssText replaces ALL styles, so the transition needs to be re-set every frame.

# Actually, better approach: Set transition once on element creation, then only modify opacity.
# But since we're using cssText which replaces everything, we need transition in every assignment.

# The transition should already be there from my previous script.
# The problem is the fadeIn is set to 1, and we're using display: none in clearShadow.

# New approach:
# 1. Keep the element always displayed (remove display from style)
# 2. Control visibility purely with opacity
# 3. Keep transition in the style

# Replace the newStyle to not have display: block, and to have proper opacity
old_style_start = "const newStyle = `\n            display: block;"
new_style_start = "const newStyle = `"

content = content.replace(old_style_start, new_style_start)

# Also need to ensure opacity is the property being transitioned
# The current gradient has opacity baked into rgba, but we need a top-level opacity for transition

# Actually, simpler fix:
# Add an initial opacity: 0 setting, then on next frame, set proper opacity
# But that requires async code...

# Even simpler: Use visibility: hidden instead of display: none for hiding
# No wait, that also doesn't trigger transitions.

# The CORRECT approach:
# 1. Always keep the element rendered (position: absolute, always present)
# 2. Use opacity: 0 when hidden (in clearShadow)
# 3. Use opacity: 1 (or calculated value) when showing (in drawFlippingShadow)  
# 4. Have transition: opacity always set

# But the opacity is already in the rgba values of the gradient...
# We need a separate opacity property.

# Let me revise the entire approach:
# - In clearShadow: set opacity: 0
# - In drawFlippingShadow: calculate an opacity value and set it as a top-level property
# - Keep the background gradient always at full intensity
# - Control fade with top-level opacity

# Let's search for where we calculate flippingOpacity
fadein_line = "const fadeIn = 1; // Transition handled by CSS"
# Replace to calculate actual opacity
new_fadein = "// Opacity controlled by CSS transition"

content = content.replace(fadein_line, new_fadein)

# Now modify the gradient to not multiply by fadeIn
old_gradient = "rgba(0, 0, 0, ${flippingOpacity * this.getSettings().flippingShadowStartAlpha}) 0%, rgba(0, 0, 0, ${flippingOpacity * this.getSettings().flippingShadowEndAlpha}) 100%)"
new_gradient = "rgba(0, 0, 0, ${shadow.opacity * this.getSettings().flippingShadowStartAlpha}) 0%, rgba(0, 0, 0, ${shadow.opacity * this.getSettings().flippingShadowEndAlpha}) 100%)"
content = content.replace(old_gradient, new_gradient)

# Add opacity: 1 to the style
# Find the line with transition and add opacity after pointer-events
old_transition_line = "transition: opacity 500ms ease-out;"
new_transition_line = "transition: opacity 500ms ease-out;\n            opacity: 1;"
content = content.replace(old_transition_line, new_transition_line)

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts fixed to properly support opacity transition")
