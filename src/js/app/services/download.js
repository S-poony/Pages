/**
 * Download and ZIP Service
 */
import JSZip from 'jszip';

export function downloadHtml(html, filename) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

export async function downloadZip(folderData, filename) {
    const zip = new JSZip();
    const { html, assets } = folderData;

    zip.file("index.html", html);
    assets.forEach(asset => {
        if (asset.data.includes(';base64,')) {
            zip.file(asset.filename, asset.data.split(',')[1], { base64: true });
        } else {
            zip.file(asset.filename, decodeURIComponent(asset.data.split(',')[1]));
        }
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    Object.assign(a, { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}
