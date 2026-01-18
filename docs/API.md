# Pages API Documentation

Create flipbooks programmatically from your application.

## Quick Start

```javascript
const pages = [
  {
    imageData: 'data:image/jpeg;base64,...',  // Your rendered page
    links: [
      { type: 'internal', targetPage: 5, rect: { x: 10, y: 20, width: 30, height: 5 } }
    ]
  }
];

const response = await fetch('https://content.lojkine.art/api/flipbook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    title: 'My Book',
    pages: pages,
    bookmarks: [{ title: 'Chapter 1', page: 1 }]
  })
});

const { url } = await response.json();
console.log('Published at:', url);
```

---

## Endpoint

```
POST https://content.lojkine.art/api/flipbook
```

## Authentication

Include your API key in the `X-API-Key` header.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Flipbook title (used in URL slug) |
| `doubleSpread` | boolean | No | Each image spans two pages (default: false) |
| `pages` | array | **Yes** | Array of page objects |
| `bookmarks` | array | No | Table of contents entries |

### Page Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imageData` | string | **Yes** | Base64 data URL of page image |
| `width` | number | No | Image width in pixels |
| `height` | number | No | Image height in pixels |
| `links` | array | No | Array of link objects |

### Link Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"internal"` or `"external"` |
| `targetPage` | number | Target page (for internal links) |
| `url` | string | URL (for external links) |
| `title` | string | Link tooltip text |
| `rect` | object | Position: `{ x, y, width, height }` as percentages |

### Bookmark Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Chapter/section title |
| `page` | number | Page number |

---

## Response

**Success (200):**
```json
{
  "success": true,
  "url": "https://content.lojkine.art/my-book-abc12345",
  "slug": "my-book-abc12345",
  "pageCount": 42
}
```

**Error (4xx):**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Integration with html2canvas

```javascript
import html2canvas from 'html2canvas';

async function renderPageToImage(element) {
  const canvas = await html2canvas(element, {
    scale: 2,  // Higher quality
    useCORS: true
  });
  return canvas.toDataURL('image/jpeg', 0.9);
}

// Render all pages
const pages = [];
for (const pageElement of document.querySelectorAll('.page')) {
  const imageData = await renderPageToImage(pageElement);
  pages.push({
    imageData,
    width: pageElement.offsetWidth,
    height: pageElement.offsetHeight,
    links: extractLinksFromPage(pageElement)  // Your link extraction logic
  });
}

// Create flipbook
const response = await fetch('https://content.lojkine.art/api/flipbook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({ title: 'My Document', pages })
});
```

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Invalid or missing API key | Check X-API-Key header |
| 400 | pages array is required | Include at least one page |
| 400 | Page N is missing imageData | Each page needs imageData |
| 400 | Invalid JSON body | Check request body format |

---

## Setup (for deployment)

1. Deploy the updated `worker.js` and `generator.js` to Cloudflare
2. Add environment variable `API_KEYS` with comma-separated valid keys
3. Optionally set `FLIPBOOK_JS_URL` to your flipbook JS bundle URL
