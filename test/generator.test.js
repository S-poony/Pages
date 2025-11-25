import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generatePagesHtml, generateFlipbookHtml } from '../src/generator.js';

/**
 * Mock asset loader for testing
 */
const mockAssetLoader = {
    loadCss: async () => '.test-css { color: red; }',
    loadJs: async () => 'console.log("test js");',
    loadPageFlipJs: async () => 'console.log("page-flip");'
};

describe('Flipbook HTML Generator', () => {

    describe('generatePagesHtml', () => {
        it('should generate page-container elements with enrichment layers', () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = generatePagesHtml(pageImages);
            assert(result.includes('class="page-container"'));
            assert(result.includes('class="enrichment-layer"'));
            assert(result.includes('PAGE 1 - ENRICHMENT ZONE'));
            assert(result.includes('src="data:image/jpeg;base64,test"'));
            assert(result.includes('loading="eager"'));
        });

        it('should generate correct HTML for multiple pages', () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2', 'data:image/jpeg;base64,test3'];
            const result = generatePagesHtml(pageImages);
            assert(result.includes('PAGE 1 - ENRICHMENT ZONE'));
            assert(result.includes('PAGE 2 - ENRICHMENT ZONE'));
            assert(result.includes('PAGE 3 - ENRICHMENT ZONE'));
            assert(result.includes('src="data:image/jpeg;base64,test1"'));
            assert(result.includes('src="data:image/jpeg;base64,test2"'));
            assert(result.includes('src="data:image/jpeg;base64,test3"'));
        });

        it('should support responsive image variants with srcset', () => {
            const variants = [
                { scale: 1, width: 800, height: 600, dataUrl: 'data:image/jpeg;base64,variant1' },
                { scale: 2, width: 1600, height: 1200, dataUrl: 'data:image/jpeg;base64,variant2' }
            ];
            const pageImages = [variants];
            const result = generatePagesHtml(pageImages, false, 'single');

            assert(result.includes('srcset='));
            assert(result.includes('800w'));
            assert(result.includes('1600w'));
            assert(result.includes('sizes='));
        });

        it('should generate folder mode with external image paths', () => {
            const variants = [
                { scale: 1, width: 800, height: 600, dataUrl: 'data:image/jpeg;base64,variant1' }
            ];
            const pageImages = [variants];
            const result = generatePagesHtml(pageImages, false, 'folder');

            assert(result.includes('images/page-1-800w.jpg'));
            assert(!result.includes('data:image/jpeg'));
        });

        it('should handle double-spread mode with object-position', () => {
            // Use variants format to trigger object-position styling
            const variants1 = [
                { scale: 1, width: 800, height: 600, dataUrl: 'data:image/jpeg;base64,page1' }
            ];
            const variants2 = [
                { scale: 1, width: 800, height: 600, dataUrl: 'data:image/jpeg;base64,page2' }
            ];
            const pageImages = [variants1, variants2];
            const result = generatePagesHtml(pageImages, true, 'single');

            // Check for object-position styling
            assert(result.includes('object-position:'));
        });

        it('should throw error for invalid input', () => {
            assert.throws(() => generatePagesHtml('not an array'), {
                message: 'pageImages must be an array'
            });
        });
    });

    describe('generateFlipbookHtml', () => {
        it('should generate complete HTML in single mode (default)', async () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            // Result should be a string (not an object with html/assets)
            assert.strictEqual(typeof result, 'string');

            // Check basic structure
            assert(result.includes('<!DOCTYPE html>'));
            assert(result.includes('<html lang="en">'));
            assert(result.includes('<title>Flipbook</title>'));
            assert(result.includes('.test-css { color: red; }'));
            assert(result.includes('console.log("test js");'));
            assert(result.includes('console.log("page-flip");'));

            // Check new configuration format
            assert(result.includes('window.FLIPBOOK_CONFIG'));
            assert(result.includes('pageCount: 2'));
            assert(result.includes('doubleSpread: false'));
            assert(result.includes('pageAspectRatio:'));

            // Check page structure
            assert(result.includes('class="page-container"'));
            assert(result.includes('class="enrichment-layer"'));
            assert(result.includes('<img src="data:image/jpeg;base64,test1"'));
            assert(result.includes('<img src="data:image/jpeg;base64,test2"'));
        });

        it('should generate folder mode with assets object', async () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2'];
            const result = await generateFlipbookHtml(pageImages, { mode: 'folder' }, mockAssetLoader);

            // Result should be an object with html and assets
            assert.strictEqual(typeof result, 'object');
            assert(result.html);
            assert(Array.isArray(result.assets));
            assert.strictEqual(result.assets.length, 2);

            // Check HTML doesn't have embedded data URLs
            assert(result.html.includes('images/page-1.jpg'));
            assert(result.html.includes('images/page-2.jpg'));
        });

        it('should handle multi-scale variants in folder mode', async () => {
            const variants1 = [
                { scale: 1, width: 800, height: 600, dataUrl: 'data:image/jpeg;base64,v1-1x' },
                { scale: 2, width: 1600, height: 1200, dataUrl: 'data:image/jpeg;base64,v1-2x' }
            ];
            const variants2 = [
                { scale: 1, width: 800, height: 600, dataUrl: 'data:image/jpeg;base64,v2-1x' },
                { scale: 2, width: 1600, height: 1200, dataUrl: 'data:image/jpeg;base64,v2-2x' }
            ];
            const pageImages = [variants1, variants2];

            const result = await generateFlipbookHtml(pageImages, { mode: 'folder' }, mockAssetLoader);

            assert.strictEqual(result.assets.length, 4); // 2 pages × 2 variants each
            assert(result.assets.some(a => a.filename.includes('page-1-800w.jpg')));
            assert(result.assets.some(a => a.filename.includes('page-1-1600w.jpg')));
            assert(result.assets.some(a => a.filename.includes('page-2-800w.jpg')));
            assert(result.assets.some(a => a.filename.includes('page-2-1600w.jpg')));
        });

        it('should generate HTML with custom title and options', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {
                title: 'My Custom Book',
                doubleSpread: true,
                addBlankPage: true
            }, mockAssetLoader);

            assert(result.includes('<title>My Custom Book</title>'));
            assert(result.includes('doubleSpread: true'));
        });

        it('should add blank page when addBlankPage is true', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {
                addBlankPage: true
            }, mockAssetLoader);

            // Should have a blank page before content
            assert(result.includes('background-color: white'));
        });

        it('should add blank page at end for odd page count', async () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2', 'data:image/jpeg;base64,test3'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            // Should add a blank page at end to make it even (3 pages + 1 blank = 4)
            const blankPages = (result.match(/background-color: white/g) || []).length;
            assert(blankPages >= 1);
        });

        it('should calculate and inject aspect ratio', async () => {
            const variants = [
                { scale: 1, width: 1000, height: 1414, dataUrl: 'data:image/jpeg;base64,test' }
            ];
            const pageImages = [variants];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            // Should calculate aspect ratio (1000/1414 ≈ 0.707)
            assert(result.includes('pageAspectRatio:'));
            assert(result.includes('0.707'));
        });

        it('should validate input parameters', async () => {
            await assert.rejects(
                async () => generateFlipbookHtml([], {}, mockAssetLoader),
                { message: 'pageImages must contain at least one image' }
            );

            await assert.rejects(
                async () => generateFlipbookHtml('not an array', {}, mockAssetLoader),
                { message: 'pageImages must be an array' }
            );
        });

        it('should handle asset loader failures gracefully', async () => {
            const failingLoader = {
                loadCss: async () => { throw new Error('CSS load failed'); },
                loadJs: async () => { throw new Error('JS load failed'); },
                loadPageFlipJs: async () => { throw new Error('PageFlip load failed'); }
            };

            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {}, failingLoader);

            // Should still generate HTML with empty styles/scripts
            assert(result.includes('<!DOCTYPE html>'));
        });

        it('should generate valid HTML structure', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            assert(result.includes('<meta charset="UTF-8">'));
            assert(result.includes('<meta name="viewport"'));
            assert(result.includes('<div id="flipbook-wrapper">'));
            assert(result.includes('<div id="flipbook-container">'));
            assert(result.includes('<div id="flipbook"'));
            assert(result.includes('class="page-container"'));
            assert(result.includes('<img src="data:image/jpeg;base64,test"'));
            assert(result.includes('loading="eager"'));
        });

        it('should escape special characters in title', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {
                title: '<script>alert("xss")</script>'
            }, mockAssetLoader);

            // HTML escaping should convert special chars
            assert(result.includes('&lt;script&gt;'));
            assert(!result.includes('<script>alert("xss")</script>'));
        });

        it('should escape special characters in HTML attributes', async () => {
            const pageImages = ['data:image/jpeg;base64,test"with"quotes'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            // HTML attribute escaping should convert quotes to &quot;
            assert(result.includes('data:image/jpeg;base64,test&quot;with&quot;quotes'));
        });

        it('should include enrichment zone comments', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            assert(result.includes('ENRICHMENT ZONE'));
            assert(result.includes('PASTE YOUR CODE HERE'));
        });

        it('should include controls panel in HTML', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            assert(result.includes('id="controls-panel"'));
            assert(result.includes('id="page-input"'));
            assert(result.includes('id="zoom-slider"'));
            assert(result.includes('id="zoom-level"'));
        });
    });
});
