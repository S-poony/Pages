
import os

file_path = 'node_modules/page-flip/src/Settings.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Add to FlipSetting interface
interface_additions = """    /** if this value is true, flipping by clicking on the whole book will be locked. Only on corners */
    disableFlipByClick: boolean;

    /** Enable/disable the shadow below the flipping page */
    flippingShadow: boolean;
    /** Opacity at the start of the flipping shadow gradient (0-1) */
    flippingShadowStartAlpha: number;
    /** Opacity at the end of the flipping shadow gradient (0-1) */
    flippingShadowEndAlpha: number;
    /** Scale factor for other shadows (0-1) */
    otherShadowOpacityScale: number;
}"""

content = content.replace(
    "    /** if this value is true, flipping by clicking on the whole book will be locked. Only on corners */\n    disableFlipByClick: boolean;\n}",
    interface_additions
)

# Add to _default object
default_additions = """        disableFlipByClick: false,
        flippingShadow: true,
        flippingShadowStartAlpha: 0.0,
        flippingShadowEndAlpha: 1.0,
        otherShadowOpacityScale: 0.7,
    };"""

content = content.replace(
    "        disableFlipByClick: false,\n    };",
    default_additions
)

with open(file_path, 'w') as f:
    f.write(content)

print("Settings.ts updated successfully")
