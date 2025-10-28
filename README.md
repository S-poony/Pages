Run the script:
source venv/bin/activate
python -m src.main


# Static Flipbook Generator README 📖

This project is a modular Python script designed to convert source documents (specifically PDF or simulated EPUB) into a lightweight, static HTML/CSS/JavaScript web application featuring a realistic, **3D page-turning effect**.

It is built with **zero external JavaScript dependencies**, relying entirely on custom CSS 3D transforms and vanilla JavaScript for performance and control.

-----

## 🏗️ Project Structure

The project is organized into a `src` directory containing the core Python logic for configuration, source file handling, and static file generation.

```
.
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── main.py (Entry point - assumed)
│   ├── processing/
│   │   ├── __init__.py
│   │   └── source_handler.py
│   └── generation/
│       ├── __init__.py
│       └── static_generator.py
└── [OUTPUT_DIR]/ (e.g., my_static_book/)
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── flipbook_core.js
    │   └── interactivity.js
    └── images/
        ├── page_1.jpeg
        └── page_2.jpeg
        └── ...
```

-----

## 🗃️ Component Breakdown

### 1\. Configuration (`src/config.py`)

This file holds all mutable constants for the project.

| Variable/Constant | Purpose |
| :--- | :--- |
| `SOURCE_FILE` | Path to the PDF, EPUB, or other document to be processed. |
| `BOOK_TITLE` | The title used in the output HTML `<title>` tag. |
| `OUTPUT_DIR` | The name of the folder where all static files are generated. |
| `FLIPBOOK_JS_FILENAME`, etc. | Defines the output names for the generated static files. |

### 2\. Source Processing (`src/processing/source_handler.py`)

This module is responsible for reading the input document and preparing its content for the web.

| Function | Purpose |
| :--- | :--- |
| `process_pdf(pdf_path, output_dir)` | Uses **PyMuPDF (`fitz`)** to open the PDF, iterate through every page, render it, and save the result as an optimized **`.jpeg`** image file in the `images/` directory. Returns the total page count. |
| `process_epub(epub_path, output_dir)` | (Placeholder logic) Designed to unzip EPUBs, aggregate content, and use **`lxml`** to clean and potentially split the HTML content into structured pages. |

### 3\. Static Generation (`src/generation/static_generator.py`)

This is the primary generation module that creates all necessary static files.

| Function | Purpose |
| :--- | :--- |
| `create_structure(output_dir)` | Creates the necessary `css/`, `js/`, and `images/` subdirectories. |
| `generate_css(...)` | Creates **`style.css`**. Defines the 3D viewing perspective (`perspective`), the core page styles, and the critical **`.turned`** classes for the `-180deg` (forward) rotation and `180deg` (backward) rotation. |
| `generate_js_flipbook(...)` | Creates **`flipbook_core.js`**. Contains the core **`Flipbook` class**. This class manages: 1. The book's current page state (`currentPage`). 2. Setting the correct **`transform-origin`** (`right center` or `left center`) for pages based on their position in the spread to ensure the spine is in the middle. 3. Handling the 3D rotation transition for `turnNext()` and `turnPrev()` via arrow keys or clicks. |
| `generate_html(...)` | Creates **`index.html`**. Inserts meta tags, links the CSS/JS files, and dynamically generates the `<div class="page">` containers, including **lazy-loading image tags** that reference the generated `.jpeg` files. |
| `open_output_in_browser(...)` | Uses the Python **`webbrowser`** module to automatically open the resulting `index.html` file after the generation process is complete. |

-----

## ▶️ Running the Generator

1.  **Configure:** Ensure your desired input and output names are set in `src/config.py`.
2.  **Run:** Execute the main script (e.g., from the project root):
    ```bash
    python -m src.main
    ```
3.  **View:** The resulting static site will be automatically generated into the folder defined by `OUTPUT_DIR` and launched in your default web browser. Use the **Left/Right arrow keys** or **click the pages** to turn them.