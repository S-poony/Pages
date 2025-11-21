
import os

file_path = 'node_modules/page-flip/src/Flip/Flip.ts'

with open(file_path, 'r') as f:
    content = f.read()

old_call = """            this.render.setShadowData(
                this.calc.getShadowStartPoint(),
                this.calc.getShadowAngle(),
                progress,
                this.calc.getDirection()
            );"""

new_call = """            this.render.setShadowData(
                this.calc.getShadowStartPoint(),
                this.calc.getShadowAngle(),
                progress,
                this.calc.getDirection(),
                this.calc.getCorner()
            );"""

content = content.replace(old_call, new_call)

with open(file_path, 'w') as f:
    f.write(content)

print("Flip.ts modified successfully")
