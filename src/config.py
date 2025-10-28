# src/config.py

from pathlib import Path

# --- Source File Configuration ---
# ACTION: Place your single source file (PDF or EPUB) inside this folder.
# The script will automatically find the file and its extension.
SOURCE_FOLDER = "SOURCE_FILE" 

# --- Project Configuration ---
BOOK_TITLE = "My Incredible Decentralized Comic"
OUTPUT_DIR = Path("my_static_book") # The resulting static site folder

# --- File Names ---
FLIPBOOK_JS_FILENAME = "flipbook_core.js"
INTERACTIVE_JS_FILENAME = "interactivity.js"
CSS_FILENAME = "style.css"
INDEX_HTML_FILENAME = "index.html"