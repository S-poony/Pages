
import os
import re

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Change fade-in calculation to be slower
# Current: const fadeIn = Math.min(1, shadow.progress / 10);
# New: const fadeIn = Math.min(1, shadow.progress / 60);
# This will fade in over the first 30% of the flip (60/200 = 0.3)

content = content.replace(
    'const fadeIn = Math.min(1, shadow.progress / 10);',
    'const fadeIn = Math.min(1, shadow.progress / 60);'
)

with open(file_path, 'w') as f:
    f.write(content)

print("HTMLRender.ts fade-in speed adjusted (now fades in over first 30% of flip)")
