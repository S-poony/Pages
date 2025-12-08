/**
 * HTML Sanitization Module
 * Uses DOMPurify to sanitize HTML content from EPUB files
 * Prevents XSS attacks by removing scripts and unsafe attributes
 */

import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content from EPUB files
 * Removes JavaScript, unsafe attributes, and event handlers
 * @param {string} html - Raw HTML content to sanitize
 * @returns {string} Sanitized HTML safe for rendering
 */
// Handle DOMPurify in both Browser and Node.js (JSDOM) environments
function getSanitizer() {
    let sanitizer = DOMPurify;

    if (typeof DOMPurify === 'function') {
        // In Node.js/JSDOM, DOMPurify is a factory function
        // Check global.window first (JSDOM in tests)
        if (typeof global !== 'undefined' && global.window) {
            sanitizer = DOMPurify(global.window);
        } else if (typeof window !== 'undefined') {
            sanitizer = DOMPurify(window);
        }
    }

    return sanitizer;
}

export function sanitizeEpubHtml(html) {
    if (typeof html !== 'string') {
        return '';
    }

    const sanitizer = getSanitizer();

    return sanitizer.sanitize(html, {
        // Allow common HTML tags for text formatting and structure
        ALLOWED_TAGS: [
            'p', 'div', 'span', 'a', 'img', 'br', 'hr',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd',
            'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption',
            'strong', 'em', 'b', 'i', 'u', 's', 'mark',
            'sup', 'sub', 'small', 'del', 'ins',
            'blockquote', 'pre', 'code', 'cite', 'q',
            'abbr', 'time', 'address',
            'figure', 'figcaption',
            'section', 'article', 'aside', 'nav', 'header', 'footer', 'main'
        ],

        // Allow specific attributes needed for styling and linking
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'class', 'id', 'style',
            'width', 'height', 'align', 'colspan', 'rowspan',
            'datetime', 'cite', 'data-epub-href', 'target', 'rel',
            'epub:type', 'role'
        ],

        // Allow only safe URI schemes
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,

        // Explicitly forbid dangerous tags
        FORBID_TAGS: [
            'script', 'object', 'embed', 'iframe', 'frame', 'frameset',
            'form', 'input', 'button', 'textarea', 'select', 'option',
            'applet', 'base', 'link', 'meta', 'noscript'
        ],

        // Forbid event handlers and other dangerous attributes
        FORBID_ATTR: [
            'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout',
            'onmouseenter', 'onmouseleave', 'onmousemove', 'onmousedown', 'onmouseup',
            'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
            'onkeydown', 'onkeyup', 'onkeypress',
            'ontouchstart', 'ontouchend', 'ontouchmove',
            'onscroll', 'onwheel', 'ondrag', 'ondrop',
            'onanimationstart', 'onanimationend', 'onanimationiteration',
            'ontransitionend'
        ],

        // Keep text content when removing forbidden tags
        KEEP_CONTENT: true,

        // Return as string, not DOM
        RETURN_DOM: false,

        // Return as HTML string
        RETURN_DOM_FRAGMENT: false,

        // Allow data URIs for images (used for embedded images in EPUBs)
        ALLOW_DATA_ATTR: false
    });
}

/**
 * Sanitizes CSS styles
 * Removes potentially dangerous CSS properties
 * @param {string} css - Raw CSS content to sanitize
 * @returns {string} Sanitized CSS
 */
export function sanitizeEpubCss(css) {
    if (typeof css !== 'string') {
        return '';
    }

    // Remove @import rules that could load external resources
    css = css.replace(/@import\s+[^;]+;/gi, '');

    // Remove javascript: URLs in CSS
    css = css.replace(/javascript:[^;\}]*/gi, '');

    // Remove expression() which can execute code in old IE
    css = css.replace(/expression\s*\([^)]*\)/gi, '');

    // Remove behavior property (IE-specific) that can execute code
    css = css.replace(/behavior\s*:[^;}]*/gi, '');

    return css;
}

/**
 * Sanitizes a title string for use in filenames
 * Removes filesystem-unsafe characters and normalizes whitespace
 * @param {string} title - Raw title input
 * @returns {string} Sanitized title safe for filenames
 */
export function sanitizeTitle(title) {
    if (typeof title !== 'string' || !title.trim()) {
        return '';
    }

    return title
        .trim()
        .replace(/[<>:"/\\|?*]/g, '')     // Remove filesystem-unsafe chars
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .slice(0, 100);                    // Limit length
}

/**
 * Creates a URL-friendly slug from a title
 * @param {string} title - Title to slugify
 * @returns {string} URL-safe slug
 */
export function slugifyTitle(title) {
    if (typeof title !== 'string' || !title.trim()) {
        return '';
    }

    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')          // Remove non-word chars
        .replace(/\s+/g, '-')              // Spaces to hyphens
        .replace(/-+/g, '-')               // Collapse hyphens
        .slice(0, 50);                     // URL-friendly length
}
