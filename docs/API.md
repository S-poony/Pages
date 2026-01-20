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
    'Content-Type': 'application/json'
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

## Rate Limiting

The API is limited to **5 flipbooks per hour per IP address**. No API key is required. 

If you exceed this limit, the API will return a `429 Too Many Requests` status.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Flipbook title (used in URL slug) |
| `doubleSpread` | boolean | No | Each image spans two pages (default: false) |
| `pages` | array | **Yes** | Array of page objects |
| `bookmarks` | array | No | Table of contents entries |
| `linkMap` | object | No | Mapping for <a> links |

### Page Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imageData` | string | **Yes** | Base64 data URL of page image |
| `width` | number | No | Image width in pixels |
| `height` | number | No | Image height in pixels |
| `links` | array | No | Array of link objects |
| `enrichmentHtml` | string | No | Custom HTML to overlay on the page |

### Link Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"internal"` or `"external"` |
| `targetPage` | number | Target page (for internal links) |
| `url` | string | URL (for external links) |
| `title` | string | Link tooltip text |
| `rect` | object | Position: `{ x, y, width, height }` as numbers representing percentages (0-100) |


> [!NOTE]
> Links are rendered as `<a>` tags with the class `.pdf-link`. They are placed in an "enrichment layer" above the page image.

### Bookmark Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Chapter/section title |
| `page` | number | Page number |

---

## Custom HTML (enrichmentHtml)

The `enrichmentHtml` field allows you to inject arbitrary HTML into a layer that sits on top of the page image. This is useful for:
- Adding custom interactive elements.
- Using `<a>` tags with custom behavior or attributes.
- Overlaying SVG or other graphics.

Example:
```javascript
{
  imageData: "...",
  enrichmentHtml: `<a href="https://example.com" class="custom-link" style="position:absolute; top:10%; left:10%; width:50px; height:50px;">Click Me</a>`
}
```

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
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ title: 'My Document', pages })
});
```

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 429 | Rate limit exceeded | Max 5 flipbooks per hour |
| 400 | pages array is required | Include at least one page |
| 400 | Page N is missing imageData | Each page needs imageData (data URL) |
| 400 | Invalid JSON body | Check request body format |

---

## Setup (for deployment)

1. Deploy `worker/worker.js` to Cloudflare Workers.
2. Bind an R2 bucket named `FLIPBOOK_BUCKET`.
3. (Optional) Bind a KV namespace named `RATE_LIMIT_KV` for rate limiting.
4. (Optional) Set `FLIPBOOK_JS_URL` and `FLIPBOOK_CSS_URL` to your custom bundles.
