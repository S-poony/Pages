// worker.js

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // content.lojkine.art/THIS_PART

    // HANDLE CORS (Allows your frontend at lojkine.art to talk to this worker)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // Change to "https://lojkine.art" for tighter security later
          "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Custom-Auth-Key",
        },
      });
    }

    // 1. SERVE THE SITE (GET request)
    // Example: User visits content.lojkine.art/abc-123
    if (request.method === "GET") {
      if (!key) return new Response("Welcome to Page Maker Hosting", { status: 200 });

      // specific file handling
      const object = await env.FLIPBOOK_BUCKET.get(`${key}/index.html`);

      if (object === null) {
        return new Response("Site not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Content-Type", "text/html");
      // SECURITY HEADERS
      headers.set("X-Content-Type-Options", "nosniff");

      return new Response(object.body, { headers });
    }

    // 2. UPLOAD / PUBLISH (PUT request)
    // Sent by your frontend when user clicks "Publish"
    if (request.method === "PUT") {
      const authKey = request.headers.get("X-Custom-Auth-Key");
      let siteId;
      let secretToken;

      // Scenario A: UPDATING an existing site
      if (authKey) {
        // In this simple version, the authKey IS the siteId for simplicity.
        // A more complex version would store a metadata mapping.
        // For now: The user keeps "abc-123-secret" as their key.
        // We extract the ID from it or verify it matches the folder.
        // LET'S KEEP IT SIMPLE: The key is the folder name.
        siteId = authKey; 
        secretToken = authKey;
      } 
      // Scenario B: NEW site
      else {
        siteId = crypto.randomUUID();
        secretToken = siteId; // Ideally, encrypt or hash this, but for a free MVP, this ID acts as the key.
      }

      // Save the file to R2
      await env.FLIPBOOK_BUCKET.put(`${siteId}/index.html`, request.body);

      return new Response(JSON.stringify({
        success: true,
        siteId: siteId,
        url: `https://${url.hostname}/${siteId}`,
        adminToken: secretToken // User must save this to update later!
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