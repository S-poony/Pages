// worker.js
// This is what's in cloudflare. Putting it here for inspection by my big brother

import { generateFlipbookHtml } from './generator.js';

const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300MB

// API Key validation - set this in your Cloudflare Worker environment variables
// In Cloudflare Dashboard: Workers > your worker > Settings > Variables > Add variable
// Name: API_KEYS, Value: comma-separated list of valid keys

function validateApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return false;

  // Get allowed keys from environment variable (comma-separated)
  const allowedKeys = (env.API_KEYS || '').split(',').map(k => k.trim()).filter(k => k);
  return allowedKeys.includes(apiKey);
}

/**
 * Handle API flipbook creation
 * POST /api/flipbook
 */
async function handleFlipbookAPI(request, env, url) {
  // Validate API key
  if (!validateApiKey(request, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or missing API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const { title, doubleSpread = false, pages, bookmarks = [] } = body;

  // Validate required fields
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'pages array is required and must not be empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Generate site ID from title
  const slug = (title || 'flipbook').slice(0, 50).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const shortId = crypto.randomUUID().slice(0, 8);
  const siteId = `${slug}-${shortId}`;

  // Upload page images to R2 and collect URLs
  const pageUrls = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page.imageData) {
      return new Response(JSON.stringify({ success: false, error: `Page ${i + 1} is missing imageData` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Decode base64 image
    const imageData = page.imageData;
    let blob;
    let ext = 'jpg';
    let contentType = 'image/jpeg';

    if (imageData.startsWith('data:')) {
      // Data URL format
      const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return new Response(JSON.stringify({ success: false, error: `Page ${i + 1} has invalid imageData format` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      contentType = `image/${matches[1]}`;
      const base64Data = matches[2];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }
      blob = bytes;
    } else {
      return new Response(JSON.stringify({ success: false, error: `Page ${i + 1} imageData must be a data URL` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Upload to R2
    const imagePath = `${siteId}/images/page-${i + 1}.${ext}`;
    await env.FLIPBOOK_BUCKET.put(imagePath, blob, {
      httpMetadata: { contentType }
    });

    pageUrls.push({
      imageUrl: `https://${url.hostname}/${imagePath}`,
      links: page.links || [],
      width: page.width,
      height: page.height
    });
  }

  // URL to the flipbook JavaScript bundle (hosted on your main site or CDN)
  // This should be set as an environment variable, defaulting to a relative path
  const jsUrl = env.FLIPBOOK_JS_URL || 'https://lojkine.art/pages/flipbook.bundle.js';

  // Generate HTML
  const html = generateFlipbookHtml({
    title: title || 'Flipbook',
    doubleSpread,
    pages: pageUrls,
    bookmarks,
    jsUrl
  });

  // Upload HTML to R2
  const htmlPath = `${siteId}/index.html`;
  await env.FLIPBOOK_BUCKET.put(htmlPath, html, {
    httpMetadata: { contentType: 'text/html' }
  });

  const publishedUrl = `https://${url.hostname}/${siteId}`;

  return new Response(JSON.stringify({
    success: true,
    url: publishedUrl,
    slug: siteId,
    pageCount: pages.length
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // content.lojkine.art/THIS_PART

    // HANDLE CORS (Allows your frontend at lojkine.art to talk to this worker)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth-Key, X-API-Key",
        },
      });
    }


    try {
      // 0. API ENDPOINT (POST /api/flipbook)
      if (request.method === "POST" && url.pathname === '/api/flipbook') {
        return await handleFlipbookAPI(request, env, url);
      }

      // 1. SERVE THE SITE (GET request)
      if (request.method === "GET") {
        if (!key) return new Response("Welcome to Page Maker Hosting", { status: 200 });

        // Retrieve from R2
        // Try exact match first (for assets)
        let object = await env.FLIPBOOK_BUCKET.get(key);

        // If not found, try adding index.html (for site root)
        if (object === null && !key.includes('.')) {
          object = await env.FLIPBOOK_BUCKET.get(`${key}/index.html`);
        }

        if (object === null) {
          return new Response("File not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        // Ensure Content-Type is passed through
        if (object.httpMetadata && object.httpMetadata.contentType) {
          headers.set("Content-Type", object.httpMetadata.contentType);
        }

        // --- SECURITY HEADERS ---
        headers.set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://*.stripe.com https://*.stripe.network; img-src * data: blob: https://*.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://js.stripe.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://*.stripe.com https://*.stripe.network blob: https://content.lojkine.art; worker-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.stripe.network blob:; object-src 'none'; base-uri 'none';");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        headers.set("Access-Control-Allow-Origin", "*"); // Allow CORS for assets

        return new Response(object.body, { headers });
      }

      // 2. UPLOAD / PUBLISH (PUT request)
      // Supports:
      //   PUT /upload              -> UUID/index.html (legacy)
      //   PUT /upload/slug         -> slug-shortid/index.html (for HTML with beautiful URLs)
      //   PUT /upload/siteId/file  -> siteId/file (for assets, siteId passed by frontend)
      if (request.method === "PUT" && url.pathname.startsWith('/upload')) {
        // Check size limit
        const contentLength = request.headers.get("Content-Length");
        if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
          return new Response("Payload Too Large", {
            status: 413,
            headers: { "Access-Control-Allow-Origin": "*" }
          });
        }

        const pathParts = url.pathname.split('/').filter(p => p);
        // pathParts[0] = 'upload', pathParts[1] = slug/siteId/filename, etc.

        const contentType = request.headers.get("Content-Type") || 'application/octet-stream';
        const isHtml = contentType.includes('text/html');

        let siteId;
        let savePath;

        if (pathParts.length === 1) {
          // PUT /upload -> legacy UUID-based path
          siteId = crypto.randomUUID();
          savePath = `${siteId}/index.html`;
        } else if (pathParts.length === 2 && isHtml) {
          // PUT /upload/my-slug -> slug-based path for HTML
          const slug = pathParts[1].slice(0, 50).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
          const shortId = crypto.randomUUID().slice(0, 8);
          siteId = slug ? `${slug}-${shortId}` : shortId;
          savePath = `${siteId}/index.html`;
        } else if (pathParts.length === 2) {
          // PUT /upload/filename.ext -> asset with new UUID siteId
          siteId = crypto.randomUUID();
          savePath = `${siteId}/${pathParts[1]}`;
        } else {
          // PUT /upload/siteId/path/to/file -> use provided siteId
          siteId = pathParts[1];
          savePath = pathParts.slice(1).join('/');
        }

        // Save to R2 with Content-Type
        await env.FLIPBOOK_BUCKET.put(savePath, request.body, {
          httpMetadata: { contentType }
        });

        return new Response(JSON.stringify({
          success: true,
          siteId: siteId,
          url: `https://${url.hostname}/${savePath}`
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }

      return new Response("Method not allowed", { status: 405, headers: { "Access-Control-Allow-Origin": "*" } });

    } catch (err) {
      // GLOBAL ERROR HANDLER - Critical for CORS
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  },
};