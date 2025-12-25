/**
 * Core Processing UI Wrapper
 */
import { generateFlipbookHtml } from '../../../generator.js';

export async function processPdfLoop(pageCount, renderPageVariants, renderPage, showProgress) {
    const pageImages = [];
    const slowThreshold = 2000;

    for (let i = 1; i <= pageCount; i++) {
        const progress = 10 + (i / pageCount * 80);
        showProgress(progress, `Rendering page ${i} of ${pageCount}…`);

        const start = performance.now();
        if (renderPageVariants) {
            pageImages.push(await renderPageVariants(i));
        } else {
            pageImages.push(await renderPage(i));
        }

        const dur = performance.now() - start;
        if (dur > slowThreshold) {
            console.warn(`Slow render: page ${i} took ${Math.round(dur)}ms`);
        }
    }
    return pageImages;
}

export async function generateAllVersions(pageImages, options, assets, enrichmentHtmlList, pdfPageLinks) {
    const htmlSingle = await generateFlipbookHtml(pageImages, {
        ...options, mode: 'single'
    }, assets, enrichmentHtmlList, pdfPageLinks);

    const folderData = await generateFlipbookHtml(pageImages, {
        ...options, mode: 'folder'
    }, assets, enrichmentHtmlList, pdfPageLinks);

    return { htmlSingle, folderData };
}
