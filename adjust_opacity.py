
import os

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Reduce opacity for other shadows by 30%
# We can replace `this.shadow.opacity` with `(this.shadow.opacity * 0.7)` in specific methods.
# But `this.shadow.opacity` is used in drawFlippingShadow too, so we must be careful.
# I will target the specific lines in the 4 methods.

# drawHardInnerShadow
# background: linear-gradient(to right, rgba(0, 0, 0, ${(this.shadow.opacity * progress) / 100}) 5%,
content = content.replace(
    "rgba(0, 0, 0, ${(this.shadow.opacity * progress) / 100})",
    "rgba(0, 0, 0, ${(this.shadow.opacity * 0.7 * progress) / 100})"
)

# drawHardOuterShadow
# background: linear-gradient(to left, rgba(0, 0, 0, ${this.shadow.opacity}) 5%, rgba(0, 0, 0, 0) 100%);
content = content.replace(
    "rgba(0, 0, 0, ${this.shadow.opacity})",
    "rgba(0, 0, 0, ${this.shadow.opacity * 0.7})"
)
# Note: The above replacement might match multiple places.
# In drawHardOuterShadow: `rgba(0, 0, 0, ${this.shadow.opacity})`
# In drawInnerShadow: `rgba(0, 0, 0, ${this.shadow.opacity})` (twice)
# In drawOuterShadow: `rgba(0, 0, 0, ${this.shadow.opacity})`
# In drawFlippingShadow: `rgba(0, 0, 0, ${shadow.opacity})` (uses local var `shadow`)

# Let's handle drawInnerShadow and drawOuterShadow carefully.
# They use `this.shadow.opacity`.
# The replacement `rgba(0, 0, 0, ${this.shadow.opacity})` -> `rgba(0, 0, 0, ${this.shadow.opacity * 0.7})`
# should cover drawHardOuterShadow, drawInnerShadow, and drawOuterShadow.
# drawHardInnerShadow was handled separately above.

# 2. Add fade-in to drawFlippingShadow
# It uses `const shadow = this.shadow;` and then `shadow.opacity`.
# We want to modify the opacity used in the gradient.
# Current line (after my previous edit):
# background: linear-gradient(${cssAngle}deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${shadow.opacity}) 100%);

# I will calculate a new opacity with fade-in.
# Insert calculation before `const newStyle`.
# `const fadeIn = Math.min(1, shadow.progress / 10);`
# `const flippingOpacity = shadow.opacity * fadeIn;`

# Find the place to insert
target_str = "const cssAngle = angleDeg;"
insert_str = """
        const cssAngle = angleDeg;
        const fadeIn = Math.min(1, shadow.progress / 10);
        const flippingOpacity = shadow.opacity * fadeIn;"""

content = content.replace(target_str, insert_str)

# Update the gradient line to use flippingOpacity
# background: linear-gradient(${cssAngle}deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${shadow.opacity}) 100%);
content = content.replace(
    "rgba(0, 0, 0, ${shadow.opacity})",
    "rgba(0, 0, 0, ${flippingOpacity})"
)

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts opacity adjusted successfully")
