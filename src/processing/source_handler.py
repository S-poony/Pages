# src/processing/source_handler.py

import shutil
from pathlib import Path
from zipfile import ZipFile

# --- Real Libraries for Document Parsing ---
from lxml import etree 
import fitz # PyMuPDF library

# Note: PAGES_COUNT constant is no longer imported from config

def process_epub(epub_path: Path, output_dir: Path) -> tuple[str, int] or tuple[None, None]:
    """
    Handles EPUB source. Extracts content, cleans HTML, and prepares assets.
    
    Returns: A tuple (aggregated_html_content, page_count).
    """
    print(f"\n--- Processing EPUB file: {epub_path.name} ---")
    
    temp_extract_dir = output_dir / "epub_temp"
    
    try:
        # 1. Extraction (EPUB is a ZIP archive)
        with ZipFile(epub_path, 'r') as zip_ref:
            zip_ref.extractall(temp_extract_dir)
        
        # --- Real EPUB Page Counting/Splitting Logic Placeholder ---
        dynamic_page_count = 5 
        
        content_file = next(temp_extract_dir.glob('**/*.html'), None) or next(temp_extract_dir.glob('**/*.xhtml'), None)
        if not content_file:
            print("Error: Could not find any HTML/XHTML content file inside the EPUB.")
            return None, None
        
        with open(content_file, 'r', encoding='utf-8') as f:
            raw_html_content = f.read()
            
        print(f"EPUB content aggregated and **simulated** page count: {dynamic_page_count}. Implementation of lxml splitting needed.")
        return raw_html_content, dynamic_page_count
        
    except Exception as e:
        print(f"An unexpected error occurred during EPUB processing: {e}")
        return None, None
    finally:
        if temp_extract_dir.exists():
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