
import os
import re

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Find the newStyle in drawFlippingShadow and add transition property
# Current style includes: display, z-index, width, height, background, left, top, position, pointer-events
# Add: transition: opacity 500ms ease-out;

# I'll search for the newStyle assignment and add the transition line
old_style_pattern = r"(const newStyle = `[^`]*position: absolute;[^`]*pointer-events: none;)"
new_style_replacement = r"\1\n            transition: opacity 500ms ease-out;"

content = re.sub(old_style_pattern, new_style_replacement, content)

# Also, I should remove or comment out the fadeIn calculation since it's not needed anymore
# Actually, let's keep fadeIn but set it to always 1, so the opacity is always full (controlled by transition instead)
content = content.replace(
    'const fadeIn = Math.min(1, shadow.progress / 60);',
    'const fadeIn = 1; // Transition handled by CSS'
)

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts updated with CSS transition")
