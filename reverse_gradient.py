
import os

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Swap the gradient colors
# Current: rgba(0, 0, 0, ${shadow.opacity}) 0%, rgba(0, 0, 0, 0) 100%
# New: rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${shadow.opacity}) 100%

old_gradient = "rgba(0, 0, 0, ${shadow.opacity}) 0%, rgba(0, 0, 0, 0) 100%"
new_gradient = "rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, ${shadow.opacity}) 100%"

if old_gradient in content:
    content = content.replace(old_gradient, new_gradient)
    with open(file_path, 'w') as f:
        f.write(content)
    print("HTMLRender.ts gradient reversed successfully")
else:
    print("Could not find gradient string to replace")
