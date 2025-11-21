
import os
import re

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Use otherShadowOpacityScale
# Replace `* 0.7` with `* this.getSettings().otherShadowOpacityScale`
# Regex: `\* 0\.7`
content = re.sub(r'\* 0\.7', r'* this.getSettings().otherShadowOpacityScale', content)

# 2. Use flippingShadow setting in drawFrame
# Replace `if (this.shadow != null) {` with `if (this.shadow != null && this.getSettings().flippingShadow) {`
# Only for the call to drawFlippingShadow.
# The block is:
#         if (this.shadow != null) {
#             this.drawFlippingShadow();
#         }
content = content.replace(
    "if (this.shadow != null) {\n            this.drawFlippingShadow();\n        }",
    "if (this.shadow != null && this.getSettings().flippingShadow) {\n            this.drawFlippingShadow();\n        }"
)

# 3. Update drawFlippingShadow to use Start/End Alpha
# Current gradient: `rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${flippingOpacity}) 100%`
# New: `rgba(0, 0, 0, ${this.getSettings().flippingShadowStartAlpha * flippingOpacity}) 0%, rgba(0, 0, 0, ${this.getSettings().flippingShadowEndAlpha * flippingOpacity}) 100%`

# Wait, `flippingOpacity` includes `shadow.opacity * fadeIn`.
# If StartAlpha is 0, then `0 * flippingOpacity` is 0. Correct.
# If EndAlpha is 1, then `1 * flippingOpacity` is `flippingOpacity`. Correct.

# I need to find the gradient string again.
# It was: `background: linear-gradient(${cssAngle}deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${flippingOpacity}) 100%);`

# I will replace it with a template string that uses the settings.
# Note: `this` context is available.

old_gradient_line = "background: linear-gradient(${cssAngle}deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${flippingOpacity}) 100%);"
new_gradient_line = "background: linear-gradient(${cssAngle}deg, rgba(0, 0, 0, ${flippingOpacity * this.getSettings().flippingShadowStartAlpha}) 0%, rgba(0, 0, 0, ${flippingOpacity * this.getSettings().flippingShadowEndAlpha}) 100%);"

content = content.replace(old_gradient_line, new_gradient_line)

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts updated to use settings")
