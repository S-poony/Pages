// worker.js
// This is what's in cloudflare. Putting it here for inspection by my big brother

const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // content.lojkine.art/THIS_PART

    // HANDLE CORS (Allows your frontend at lojkine.art to talk to this worker)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth-Key",
        },
      });
    }

    try {
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
        headers.set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data: blob:; img-src * data: blob:; object-src 'none'; base-uri 'none';");
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