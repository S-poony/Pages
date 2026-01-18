// worker.js - Combined single-file version for Cloudflare Dashboard
// This file includes both the worker and the generator code

const MAX_SIZE_BYTES = 300 * 1024 * 1024; // 300MB

// ============================================================================
// GENERATOR CODE (from generator.js)
// ============================================================================

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapeMap[char]);
}

function escapeAttr(str) {
    if (typeof str !== 'string') return '';
    const attrEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '\n': '&#10;',
        '\r': '&#13;',
        '\t': '&#9;'
    };
    return str.replace(/[&<>"'\n\r\t]/g, char => attrEscapeMap[char]);
}

function renderLinks(links) {
    if (!links || links.length === 0) return '';

    return links.map(link => {
        const top = typeof link.rect.y === 'number' ? `${link.rect.y}%` : link.rect.y;
        const left = typeof link.rect.x === 'number' ? `${link.rect.x}%` : link.rect.x;
        const width = typeof link.rect.width === 'number' ? `${link.rect.width}%` : link.rect.width;
        const height = typeof link.rect.height === 'number' ? `${link.rect.height}%` : link.rect.height;

        const style = `top: ${top}; left: ${left}; width: ${width}; height: ${height}; position: absolute;`;

        let attr = '';
        if (link.type === 'external' && link.url) {
            attr = `href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer"`;
        } else if (link.type === 'internal' && link.targetPage) {
            attr = `href="javascript:void(0)" data-target-page="${link.targetPage}"`;
        }

        const title = link.title || (link.type === 'external' ? link.url : `Go to page ${link.targetPage}`);

        return `<a class="pdf-link" style="${style}" ${attr} title="${escapeAttr(title)}" data-source-top="${top}" data-source-left="${left}" data-source-width="${width}" data-source-height="${height}"></a>`;
    }).join('');
}

function generatePagesHtml(pages, doubleSpread = false) {
    return pages.map((page, i) => {
        const pageNum = i + 1;
        const imageUrl = page.imageUrl || page.imageData;
        const links = page.links || [];

        const objectPosition = doubleSpread ? (pageNum % 2 === 0 ? 'left' : 'right') : 'center';
        const imgStyle = doubleSpread ? `style="object-position: ${objectPosition} center;"` : '';

        return `
<div class="page-container" data-density="soft">
  <img class="page-image" src="${escapeAttr(imageUrl)}" alt="" loading="eager" ${imgStyle} />
  <div class="enrichment-layer">
    ${renderLinks(links)}
  </div>
</div>`;
    }).join('');
}

const FLIPBOOK_CSS = `:root{--color-cream:#FDFBF8;--color-warm-gray:#E8E4D9;--color-charcoal:#2A2A2A;--color-terracotta:#C9785B;--font-sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}body{margin:0;padding:0;overflow:hidden;background-color:var(--color-cream);font-family:var(--font-sans);color:var(--color-charcoal)}#flipbook-wrapper{width:100vw;height:100vh;height:100dvh;display:flex;justify-content:center;align-items:center;perspective:2000px;cursor:default}#flipbook-container{position:relative;transition:transform .15s ease-out;transform-origin:center center;flex-shrink:0;min-width:100px;min-height:100px}#flipbook{position:relative;width:100%;height:100%}.page-image{width:100%;height:100%;object-fit:contain;display:block;-webkit-user-drag:none;user-select:none;pointer-events:none}.page-container{position:relative;width:100%;height:100%;z-index:1500;background-color:white;box-shadow:0 0 10px rgba(0,0,0,.05)}.enrichment-layer{position:absolute;inset:0;pointer-events:auto;z-index:1510;overflow:hidden}.pdf-link{display:block;cursor:pointer;z-index:1520;pointer-events:auto}.pdf-link:hover{background-color:rgba(255,255,0,.2)}#controls-panel{position:fixed;bottom:max(24px,env(safe-area-inset-bottom,0px) + 12px);left:50%;transform:translateX(-50%);background:white;padding:12px 24px;border-radius:30px;box-shadow:0 4px 20px rgba(0,0,0,.08);border:1px solid rgba(0,0,0,.05);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;justify-items:center;gap:16px;z-index:2000;opacity:.3;transition:opacity .3s ease,transform .3s ease;max-width:calc(100vw - 32px);min-width:180px}#toc-btn{grid-column:1;justify-self:start}.page-input-container{grid-column:2}#page-links-btn{grid-column:3;justify-self:end}#controls-panel:hover,#controls-panel.active{opacity:1;transform:translateX(-50%) translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.12)}input[type="range"]{-webkit-appearance:none;appearance:none;width:120px;height:4px;background:var(--color-warm-gray);border-radius:2px;outline:none}input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:var(--color-terracotta);cursor:pointer;transition:.2s}#page-input{width:40px;text-align:center;border:1px solid var(--color-warm-gray);border-radius:4px;padding:4px;font-family:var(--font-sans);color:var(--color-charcoal);font-size:14px;-moz-appearance:textfield;appearance:textfield}#page-input::-webkit-outer-spin-button,#page-input::-webkit-inner-spin-button{-webkit-appearance:none;appearance:none;margin:0}.page-input-container{display:flex;align-items:center;gap:4px}.page-nav-btn{background:none;border:none;padding:4px;cursor:pointer;color:var(--color-charcoal);border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background-color .2s}.page-nav-btn:hover{background-color:rgba(0,0,0,.05);color:var(--color-terracotta)}#top-controls-panel{position:fixed;top:max(24px,env(safe-area-inset-top,0px) + 12px);left:50%;transform:translateX(-50%);background:white;padding:8px 16px;border-radius:30px;box-shadow:0 4px 20px rgba(0,0,0,.08);border:1px solid rgba(0,0,0,.05);display:flex;align-items:center;gap:16px;z-index:2000;opacity:.3;transition:opacity .3s ease,transform .3s ease}#top-controls-panel:hover,#top-controls-panel.active{opacity:1;transform:translateX(-50%) translateY(2px);box-shadow:0 8px 30px rgba(0,0,0,.12)}.zoom-controls{display:flex;align-items:center;gap:12px}.icon-btn,#fullscreen-btn{background:none;border:none;color:var(--color-charcoal);cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;transition:color .2s;border-radius:4px}.icon-btn:hover,#fullscreen-btn:hover{color:var(--color-terracotta);background-color:rgba(0,0,0,.05)}.toc-modal{position:fixed;inset:0;z-index:2000;display:flex;justify-content:center;align-items:center}.toc-modal.hidden{display:none}.toc-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5)}.toc-content{position:relative;background:white;width:90vw;max-width:400px;max-height:85dvh;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden}.toc-header{padding:16px 20px;border-bottom:1px solid var(--color-warm-gray);display:flex;justify-content:space-between;align-items:center;background:var(--color-cream)}.toc-header h2{margin:0;font-size:18px;font-weight:600;color:var(--color-charcoal)}#toc-close-btn,#links-close-btn{background:none;border:none;cursor:pointer;color:var(--color-charcoal);padding:4px;border-radius:4px}.toc-list{padding:10px 0;overflow-y:auto;flex:1}#links-modal .toc-content{max-width:550px}.toc-item{padding:10px 20px;cursor:pointer;transition:background-color .2s;font-size:15px;color:var(--color-charcoal);display:flex;justify-content:space-between;align-items:center;text-decoration:none}.toc-item:hover{color:var(--color-terracotta)}#zoom-level,.page-count{font-size:14px;font-weight:500;color:var(--color-charcoal);min-width:3em;text-align:center}#loading-screen{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;background-color:var(--color-cream);z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;transition:opacity .5s ease-out}#loading-screen.hidden{opacity:0;pointer-events:none}.spinner{width:40px;height:40px;border:4px solid var(--color-warm-gray);border-top:4px solid var(--color-terracotta);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px}.loading-text{color:var(--color-terracotta);font-size:14px;font-weight:500;letter-spacing:.5px}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.toc-item-text{flex:1;display:flex;flex-direction:column;min-width:0;gap:2px}.toc-item-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}.toc-item-page{font-size:11px;color:#888}`;

function generateFlipbookHtml(options) {
    const {
        title = 'Flipbook',
        doubleSpread = false,
        pages = [],
        bookmarks = [],
        jsUrl = ''
    } = options;

    if (!Array.isArray(pages) || pages.length < 1) {
        throw new Error('pages must be an array with at least one page');
    }

    const pagesHtml = generatePagesHtml(pages, doubleSpread);
    const actualPageCount = pages.length;

    const needsBlankPage = actualPageCount % 2 !== 0;
    const blankPageHtml = needsBlankPage
        ? '<div class="page-container" data-density="soft" style="background-color: white;"></div>'
        : '';

    let aspectRatio = 0.707;
    if (pages[0].width && pages[0].height) {
        aspectRatio = pages[0].width / pages[0].height;
    }

    const tocData = bookmarks.map(b => ({ title: b.title, page: b.page }));
    const pageLinks = pages.map((p, i) => ({
        pageNum: i + 1,
        links: (p.links || []).map(link => ({
            type: link.type,
            title: link.title || (link.type === 'external' ? link.url : `Page ${link.targetPage}`),
            url: link.url,
            targetPage: link.targetPage,
            rect: link.rect
        }))
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>${FLIPBOOK_CSS}</style>
</head>
<body>
    <div id="loading-screen">
        <div class="spinner"></div>
        <div class="loading-text">Loading Pages...</div>
    </div>
    <div id="flipbook-wrapper">
        <div id="flipbook-container">
            <div id="flipbook" data-double-spread="${doubleSpread}">${pagesHtml}${blankPageHtml}</div>
        </div>
        <div id="top-controls-panel">
            <div class="zoom-controls">
                <input type="range" id="zoom-slider" min="1" max="3" step="0.05" value="1" aria-label="Zoom">
                <div id="zoom-level">1x</div>
            </div>
            <button id="fullscreen-btn" aria-label="Toggle Fullscreen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
            </button>
        </div>
        <div id="controls-panel">
            <button id="toc-btn" class="icon-btn" aria-label="Table of Contents" style="${tocData.length > 0 ? '' : 'display: none;'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M3 12h18M3 18h18"/>
                </svg>
            </button>
            <div class="page-input-container">
                <button id="prev-page-btn" class="page-nav-btn" aria-label="Previous Page">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <input type="number" id="page-input" min="2" max="${actualPageCount}" value="2">
                <button id="next-page-btn" class="page-nav-btn" aria-label="Next Page">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </button>
            </div>
            <button id="page-links-btn" class="icon-btn" aria-label="Page Links" style="display: none;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
            </button>
        </div>
        <div id="toc-modal" class="toc-modal hidden">
            <div class="toc-overlay"></div>
            <div class="toc-content">
                <div class="toc-header">
                    <h2>Table of Contents</h2>
                    <button id="toc-close-btn" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="toc-list" class="toc-list"></div>
            </div>
        </div>
        <div id="links-modal" class="toc-modal hidden">
            <div class="toc-overlay"></div>
            <div class="toc-content">
                <div class="toc-header">
                    <h2>Page Links</h2>
                    <button id="links-close-btn" aria-label="Close">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div id="links-list" class="toc-list"></div>
            </div>
        </div>
    </div>
    <script>
        window.FLIPBOOK_CONFIG = {
            pageCount: ${actualPageCount},
            doubleSpread: ${doubleSpread},
            pageAspectRatio: ${aspectRatio},
            linkMap: {},
            tableOfContents: ${JSON.stringify(tocData)},
            pageLinks: ${JSON.stringify(pageLinks)}
        };
    </script>
    <script src="${escapeAttr(jsUrl)}"></script>
</body>
</html>`;
}

// ============================================================================
// WORKER CODE
// ============================================================================

function validateApiKey(request, env) {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) return false;
    const allowedKeys = (env.API_KEYS || '').split(',').map(k => k.trim()).filter(k => k);
    return allowedKeys.includes(apiKey);
}

async function handleFlipbookAPI(request, env, url) {
    if (!validateApiKey(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or missing API key' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

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

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'pages array is required and must not be empty' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    const slug = (title || 'flipbook').slice(0, 50).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const shortId = crypto.randomUUID().slice(0, 8);
    const siteId = `${slug}-${shortId}`;

    const pageUrls = [];
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (!page.imageData) {
            return new Response(JSON.stringify({ success: false, error: `Page ${i + 1} is missing imageData` }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const imageData = page.imageData;
        let blob;
        let ext = 'jpg';
        let contentType = 'image/jpeg';

        if (imageData.startsWith('data:')) {
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

    const jsUrl = env.FLIPBOOK_JS_URL || 'https://content.lojkine.art/flipbook.bundle.js';

    const html = generateFlipbookHtml({
        title: title || 'Flipbook',
        doubleSpread,
        pages: pageUrls,
        bookmarks,
        jsUrl
    });

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
        const key = url.pathname.slice(1);

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
            // API ENDPOINT
            if (request.method === "POST" && url.pathname === '/api/flipbook') {
                return await handleFlipbookAPI(request, env, url);
            }

            // SERVE FILES
            if (request.method === "GET") {
                if (!key) return new Response("Welcome to Page Maker Hosting", { status: 200 });

                let object = await env.FLIPBOOK_BUCKET.get(key);

                if (object === null && !key.includes('.')) {
                    object = await env.FLIPBOOK_BUCKET.get(`${key}/index.html`);
                }

                if (object === null) {
                    return new Response("File not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
                }

                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set("etag", object.httpEtag);

                if (object.httpMetadata && object.httpMetadata.contentType) {
                    headers.set("Content-Type", object.httpMetadata.contentType);
                }

                headers.set("Content-Security-Policy", "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://*.stripe.com https://*.stripe.network; img-src * data: blob: https://*.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://js.stripe.com; font-src 'self' https://fonts.gstatic.com; frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://*.stripe.com https://*.stripe.network blob: https://content.lojkine.art; worker-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://*.stripe.network blob:; object-src 'none'; base-uri 'none';");
                headers.set("X-Content-Type-Options", "nosniff");
                headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
                headers.set("Access-Control-Allow-Origin", "*");

                return new Response(object.body, { headers });
            }

            // UPLOAD
            if (request.method === "PUT" && url.pathname.startsWith('/upload')) {
                const contentLength = request.headers.get("Content-Length");
                if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
                    return new Response("Payload Too Large", {
                        status: 413,
                        headers: { "Access-Control-Allow-Origin": "*" }
                    });
                }

                const pathParts = url.pathname.split('/').filter(p => p);
                const contentType = request.headers.get("Content-Type") || 'application/octet-stream';
                const isHtml = contentType.includes('text/html');

                let siteId;
                let savePath;

                if (pathParts.length === 1) {
                    siteId = crypto.randomUUID();
                    savePath = `${siteId}/index.html`;
                } else if (pathParts.length === 2 && isHtml) {
                    const slug = pathParts[1].slice(0, 50).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
                    const shortId = crypto.randomUUID().slice(0, 8);
                    siteId = slug ? `${slug}-${shortId}` : shortId;
                    savePath = `${siteId}/index.html`;
                } else if (pathParts.length === 2) {
                    siteId = crypto.randomUUID();
                    savePath = `${siteId}/${pathParts[1]}`;
                } else {
                    siteId = pathParts[1];
                    savePath = pathParts.slice(1).join('/');
                }

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
