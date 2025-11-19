// worker.js
// This is what's in cloudflare. Putting it here for inspection by my big brother

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

    // 1. SERVE THE SITE (GET request)
    if (request.method === "GET") {
      if (!key) return new Response("Welcome to Page Maker Hosting", { status: 200 });

      // Retrieve from R2
      const object = await env.FLIPBOOK_BUCKET.get(`${key}/index.html`);

      if (object === null) {
        return new Response("Site not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Content-Type", "text/html");

      // --- SECURITY HEADERS (The "Checks") ---

      // 1. CSP: The most important one.
      // - default-src 'self' 'unsafe-inline' data: blob: -> Allows the flipbook's own scripts and base64 images to run.
      // - object-src 'none' -> Blocks plugins like Flash or Java.
      // - base-uri 'none' -> Prevents base-hijacking attacks.
      // - img-src * data: blob: -> Allows images from anywhere (since users might link images).
      headers.set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' data: blob:; img-src * data: blob:; object-src 'none'; base-uri 'none';");

      // 2. Prevent MIME-sniffing (stops browser from guessing a text file is actually a script)
      headers.set("X-Content-Type-Options", "nosniff");

      // 3. Referrer Policy (Privacy)
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

      return new Response(object.body, { headers });
    }

    // 2. UPLOAD / PUBLISH (PUT request)
    if (request.method === "PUT") {
      // ALWAYS CREATE new
      const siteId = crypto.randomUUID();

      // Save to R2
      await env.FLIPBOOK_BUCKET.put(`${siteId}/index.html`, request.body);

      return new Response(JSON.stringify({
        success: true,
        siteId: siteId,
        url: `https://${url.hostname}/${siteId}`
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return new Response("Method not allowed", { status: 405 });
  },
};