
import os
import re

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Regex to match `rgba(0, 0, 0, ${...this.shadow.opacity...})` handling whitespace
# Pattern: rgba\(0, 0, 0, \$\{\s*this\.shadow\.opacity\s*\}\)
# We want to replace the inner part with `this.shadow.opacity * 0.7`

# However, some might be `(this.shadow.opacity * progress) / 100`.
# Let's look at the specific cases from my previous read (and assumptions).

# 1. drawHardInnerShadow: `rgba(0, 0, 0, ${(this.shadow.opacity * progress) / 100})`
# Regex: `rgba\(0, 0, 0, \$\{\(this\.shadow\.opacity \* progress\) / 100\}\)`
# Replace: `rgba(0, 0, 0, ${(this.shadow.opacity * 0.7 * progress) / 100})`

content = re.sub(
    r'rgba\(0, 0, 0, \$\{\(this\.shadow\.opacity \* progress\) / 100\}\)',
    r'rgba(0, 0, 0, ${(this.shadow.opacity * 0.7 * progress) / 100})',
    content
)

# 2. drawHardOuterShadow: `rgba(0, 0, 0, ${this.shadow.opacity})`
# This might be multi-line.
# Regex: `rgba\(0, 0, 0, \$\{\s*this\.shadow\.opacity\s*\}\)`
# Replace: `rgba(0, 0, 0, ${this.shadow.opacity * 0.7})`

content = re.sub(
    r'rgba\(0, 0, 0, \$\{\s*this\.shadow\.opacity\s*\}\)',
    r'rgba(0, 0, 0, ${this.shadow.opacity * 0.7})',
    content
)

# 3. drawInnerShadow: `rgba(0, 0, 0, ${this.shadow.opacity})`
# Same regex as #2 should catch this if it matches `this.shadow.opacity` exactly.
# But wait, drawInnerShadow has:
# `rgba(0, 0, 0, ${this.shadow.opacity}) 5%,`
# `rgba(0, 0, 0, ${this.shadow.opacity}) 35%,`
# The regex #2 handles `this.shadow.opacity` surrounded by whitespace in `${}`.
# So it should work for these too.

# 4. drawOuterShadow: `rgba(0, 0, 0, ${this.shadow.opacity})`
# Same regex #2.

# Let's verify if there are any other patterns.
# In drawHardInnerShadow, it was `(this.shadow.opacity * progress) / 100`.
# My regex #1 handles that specific calculation.

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts opacity fixed with regex")
