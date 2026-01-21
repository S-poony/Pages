/**
 * Cloudflare Publishing Service
 */
import { WORKER_URL } from '../config.js';

export async function publishFlipbook(folderData, getUrlSlug, updateBtn) {
    if (!folderData) return;

    const { html, assets } = folderData;
    const originalHtml = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Preparing assets...`;

    try {
        const assetUrls = new Map();
        const totalAssets = assets.length;

        for (let i = 0; i < totalAssets; i++) {
            const asset = assets[i];
            updateBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Uploading asset ${i + 1}/${totalAssets}...`;

            const ext = asset.filename.split('.').pop().toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
            else if (ext === 'png') contentType = 'image/png';
            else if (ext === 'svg') contentType = 'image/svg+xml';
            else if (ext === 'webp') contentType = 'image/webp';

            let blob;
            if (asset.data.includes(';base64,')) {
                const byteCharacters = atob(asset.data.split(',')[1]);
                const byteNumbers = new Array(byteCharacters.length);
                for (let j = 0; j < byteCharacters.length; j++) byteNumbers[j] = byteCharacters.charCodeAt(j);
                blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
            } else {
                blob = new Blob([decodeURIComponent(asset.data.split(',')[1])], { type: contentType });
            }

            const sanitizedFilename = asset.filename.replace(/\//g, '_');
            const response = await fetch(`${WORKER_URL}/upload/${sanitizedFilename}`, {
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                body: blob
            });

            if (!response.ok) throw new Error(`Failed to upload asset ${asset.filename}`);
            const data = await response.json();
            assetUrls.set(asset.filename, data.url);
        }

        let finalHtml = html;
        for (const [filename, url] of assetUrls.entries()) {
            finalHtml = finalHtml.split(filename).join(url);
        }

        updateBtn.innerHTML = `<svg class="animate-spin btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Publishing HTML...`;

        const slug = getUrlSlug();
        const response = await fetch(`${WORKER_URL}/upload/${slug}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/html' },
            body: new Blob([finalHtml], { type: 'text/html' })
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return await response.json();

    } catch (err) {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalHtml;
        throw err;
    }
}
