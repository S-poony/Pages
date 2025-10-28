# src/main.py

import sys
from pathlib import Path

# Import configuration and modules from the package structure
sys.path.append(str(Path(__file__).resolve().parent))

from config import SOURCE_FOLDER, OUTPUT_DIR, BOOK_TITLE
from generation.static_generator import create_structure, generate_css, generate_js_flipbook, generate_js_interactive, generate_html, open_output_in_browser # <-- ADDED FUNCTION
from processing.source_handler import process_pdf, process_epub

def find_source_file(source_folder: str) -> Path or None:
    """Scans the source folder for a single .pdf or .epub file."""
    
    source_dir = Path(source_folder)
    if not source_dir.is_dir():
        print(f"Error: Source folder '{source_folder}' not found. Please create it.")
        return None

    # Search for files with .pdf or .epub extensions
    allowed_extensions = ['*.pdf', '*.epub']
    
    # Use glob to find all matching files
    source_files = []
    for ext in allowed_extensions:
        source_files.extend(source_dir.glob(ext))
    
    if not source_files:
        print(f"Error: No .pdf or .epub file found in the '{source_folder}' directory.")
        return None
    
    if len(source_files) > 1:
        print(f"Error: Found multiple files ({len(source_files)}) in '{source_folder}'. Please keep only ONE source file (PDF or EPUB).")
        # List the conflicting files for the user
        print("Conflicting files found:")
        for f in source_files:
            print(f"- {f.name}")
        return None

    return source_files[0]


def main():
    """
    Main function to execute the static site generation workflow.
    """
    print(f"--- 🚀 Starting Book Generator: {BOOK_TITLE} ---")

    # 1. Configuration and Setup: AUTO-DETECT SOURCE FILE
    source_path = find_source_file(SOURCE_FOLDER)
    
    if source_path is None:
        sys.exit(1)
        
    source_type = source_path.suffix.lower().replace('.', '')
    page_content = None
    dynamic_page_count = 0 
    is_epub_source = (source_type == 'epub')
    
    print(f"Detected Source File: {source_path.name} (Type: {source_type.upper()})")

    # 2. Create Directory Structure
    if not create_structure(OUTPUT_DIR):
        sys.exit(1)

    # 3. Process Source File (Extraction and Cleanup)
    if is_epub_source:
        page_content, dynamic_page_count = process_epub(source_path, OUTPUT_DIR)
        if page_content is None:
            print("\n--- ❌ Project Generation Failed due to EPUB error ---")
            sys.exit(1)
    elif source_type in ['pdf', 'jpg', 'jpeg', 'png', 'webp']:
        dynamic_page_count = process_pdf(source_path, OUTPUT_DIR)
    else:
        print(f"Error: Unsupported source file type '{source_type}'. Only 'pdf' and 'epub' are supported.")
        sys.exit(1)

    # Validation
    if dynamic_page_count <= 0:
        print("\n--- ❌ Project Generation Failed: Could not determine page count ---")
        sys.exit(1)

    # 4. Generate Static Assets and HTML
    print(f"\n--- Generating Static Files for {dynamic_page_count} Pages ---")
    generate_css(OUTPUT_DIR, is_epub=is_epub_source)
    generate_js_flipbook(OUTPUT_DIR, dynamic_page_count) 
    generate_js_interactive(OUTPUT_DIR, is_epub=is_epub_source)
    generate_html(OUTPUT_DIR, BOOK_TITLE, dynamic_page_count, content_html=page_content, is_epub=is_epub_source) 

    # 5. Completion
    print("\n--- ✅ Project Generation Complete ---")
    print(f"The static site is ready in the directory: {OUTPUT_DIR.name}/")
    open_output_in_browser(OUTPUT_DIR)


if __name__ == "__main__":
    main()