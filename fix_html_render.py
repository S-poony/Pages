
import os

file_path = 'node_modules/page-flip/src/Render/HTMLRender.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Replace the messed up drawFrame with the correct one
# I'll target the range from `protected drawFrame(): void {` to `private clear(): void {`
# But since the file is messed up, I need to be careful.

# The messed up part looks like:
#     protected drawFrame(): void {
#         this.clear();
# 
#         this.drawLeftPage();
# 
#         this.drawRightPage();
# 
#         if (this.shadow != null) {
#             this.drawFlippingShadow();
#         }
# 
#         if (this.flippingPage != null) {
# 
#         if (this.flippingPage != null) {
#             (this.flippingPage as HTMLPage).getElement().style.zIndex = (
#                 this.getSettings().startZIndex + 5
#             ).toString(10);
# 
#             this.flippingPage.draw();
#         }
# 
#         if (this.shadow != null && this.flippingPage !== null) {
#             if (this.flippingPage.getDrawingDensity() === PageDensity.SOFT) {
#                 this.drawOuterShadow();
#                 this.drawInnerShadow();
#             } else {
#                 this.drawHardOuterShadow();
#                 this.drawHardInnerShadow();
#             }
#         }
#     }

# Correct version:
correct_draw_frame = """    protected drawFrame(): void {
        this.clear();

        this.drawLeftPage();

        this.drawRightPage();

        this.drawBottomPage();

        if (this.shadow != null) {
            this.drawFlippingShadow();
        }

        if (this.flippingPage != null) {
            (this.flippingPage as HTMLPage).getElement().style.zIndex = (
                this.getSettings().startZIndex + 5
            ).toString(10);

            this.flippingPage.draw();
        }

        if (this.shadow != null && this.flippingPage !== null) {
            if (this.flippingPage.getDrawingDensity() === PageDensity.SOFT) {
                this.drawOuterShadow();
                this.drawInnerShadow();
            } else {
                this.drawHardOuterShadow();
                this.drawHardInnerShadow();
            }
        }
    }"""

# I will use a regex or just find the start and end indices to replace.
# Start: "protected drawFrame(): void {"
# End: "private clear(): void {"

start_marker = "protected drawFrame(): void {"
end_marker = "private clear(): void {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    # Check if there is extra content between the end of drawFrame and start of clear
    # In the messed up file, there might be extra braces.
    # The replacement should cover everything between start_marker and end_marker.
    
    new_content = content[:start_idx] + correct_draw_frame + "\n\n    " + content[end_idx:]
    
    with open(file_path, 'w') as f:
        f.write(new_content)
    print("HTMLRender.ts fixed successfully")
else:
    print("Could not find markers")
