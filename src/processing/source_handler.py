# src/processing/source_handler.py

import shutil
from pathlib import Path
from zipfile import ZipFile
import re # For regex cleaning

# --- Real Libraries for Document Parsing ---
from lxml import etree, html
import fitz # PyMuPDF library

# Note: PAGES_COUNT constant is no longer imported from config

# --- HELPER FUNCTION: EPUB Asset Management ---
def _copy_epub_assets(temp_extract_dir: Path, output_dir: Path):
    """
    Identifies and copies common EPUB assets (images, fonts, CSS) 
    from the temporary extraction directory to the final output/images/ folder.
    """
    asset_dir = output_dir / "images"
    print("Copying EPUB assets...")
    
    # Common file extensions to copy
    asset_extensions = ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.svg', 
                        '*.css', '*.woff', '*.woff2', '*.ttf', '*.otf']
    
    for ext in asset_extensions:
        for asset_path in temp_extract_dir.glob(f'**/{ext}'):
            # Preserve folder structure relative to the EPUB root
            relative_path = asset_path.relative_to(temp_extract_dir)
            destination_path = asset_dir / relative_path
            
            # Ensure the destination subdirectory exists
            destination_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy the file
            shutil.copy2(asset_path, destination_path)

    print(f"Assets copied to {asset_dir.name}.")


def process_epub(epub_path: Path, output_dir: Path) -> tuple[str, int] or tuple[None, None]:
    """
    Handles EPUB source. Extracts content, cleans HTML using lxml, and prepares assets.
    
    Returns: A tuple (list_of_page_html_snippets, page_count).
    """
    print(f"\n--- Processing EPUB file: {epub_path.name} ---")
    
    # Create a temporary directory for extraction
    temp_extract_dir = output_dir / "epub_temp"
    
    try:
        # 1. Extraction (EPUB is a ZIP archive)
        with ZipFile(epub_path, 'r') as zip_ref:
            zip_ref.extractall(temp_extract_dir)
        
        # 2. Asset Copying
        _copy_epub_assets(temp_extract_dir, output_dir)
        
        # 3. Locate and Aggregate Content Documents
        # Note: A full implementation would parse content.opf for the manifest/spine.
        # This version aggregates all found HTML/XHTML content.
        
        aggregated_content = []
        page_html_files = list(temp_extract_dir.glob('**/*.html')) + list(temp_extract_dir.glob('**/*.xhtml'))
        
        if not page_html_files:
            print("Error: Could not find any HTML/XHTML content file inside the EPUB.")
            return [], 0
            
        print(f"Found {len(page_html_files)} content files. Aggregating and cleaning...")

        for content_file in page_html_files:
            try:
                # Parse the HTML content using lxml
                parser = etree.HTMLParser()
                tree = etree.parse(str(content_file), parser)
                
                # Use XPath to find the main body content (or just the body tag)
                body_element = tree.xpath('//body')
                if body_element:
                    # Clean the body content (remove script, style, epub-specific noise)
                    etree.strip_elements(body_element[0], 'script', 'style', 'head', 'title', 'meta', 'link', 'nav', 'footer', 'header', 'epub:type', 'section')
                    
                    # Get the cleaned HTML fragment (excluding the <body> tags themselves)
                    # We use html.tostring to ensure standard HTML encoding
                    content_fragment = b"".join(etree.tostring(child, encoding='utf-8', pretty_print=True) for child in body_element[0].iterchildren())
                    
                    # Decode to string and append
                    aggregated_content.append(content_fragment.decode('utf-8'))
                    
            except Exception as e:
                print(f"Warning: Failed to process {content_file.name}. Error: {e}")

        # 4. Simulated Page Splitting (Simple Chapter/File Split)
        # In a full reflowable engine, this would be complex. For a flipbook, 
        # we treat each aggregated content file as a single "page" for now.
        
        page_content_snippets = aggregated_content
        dynamic_page_count = len(page_content_snippets)
        
        if dynamic_page_count == 0:
             print("Error: Aggregated content resulted in zero pages.")
             return [], 0
             
        # The return is now a list of strings (HTML snippets), not one large string.
        print(f"EPUB content aggregated and cleaned. Simulated page count: {dynamic_page_count}.")
        return page_content_snippets, dynamic_page_count
        
    except Exception as e:
        print(f"An unexpected error occurred during EPUB processing: {e}")
        return [], 0
    finally:
        # 5. Cleanup
        if temp_extract_dir.exists():
            print("Cleaning up temporary extraction directory.")
            shutil.rmtree(temp_extract_dir)

def process_pdf(pdf_path: Path, output_dir: Path) -> int:
    """
    Handles PDF or image sources by converting pages to JPEG images.
    Returns: The total number of pages found/processed.
    """
    print(f"\n--- Processing PDF/Image source: {pdf_path.name} ---")
    
    try:
        # 1. Open the PDF file using PyMuPDF (fitz)
        doc = fitz.open(pdf_path)
        dynamic_page_count = doc.page_count
        
        image_dir = output_dir / "images"
        
        # 2. Iterate through pages, render, and save as JPEG
        for i in range(dynamic_page_count):
            page = doc.load_page(i)
            
            # Create a matrix for scaling (2x resolution for better output quality)
            matrix = fitz.Matrix(2, 2) 
            pix = page.get_pixmap(matrix=matrix)
            
            # Save the actual JPEG image file
            pix.save(image_dir / f"page_{i + 1}.jpeg") 

        doc.close()

        print(f"PDF processed. Extracted and saved {dynamic_page_count} JPEG image files in the '{image_dir.name}' directory.")
        return dynamic_page_count
    
    except fitz.FileNotFoundError:
        print(f"Error: PDF file not found at {pdf_path}. Cannot count pages.")
        return 0
    except Exception as e:
        # Catch any exception during the opening or processing phases
        print(f"\n--- CRITICAL ERROR ---")
        print(f"Failed to process PDF: {pdf_path.name}")
        print(f"PyMuPDF Exception Detail: {e}")
        print("This often means the PDF file is corrupted, encrypted, or invalid.")
        print("-----------------------")
        return 0