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
        it('should generate page elements with side classes', () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = generatePagesHtml(pageImages);
            assert(result.includes('class="page left"'));
            assert(result.includes('id="page-1"'));
            assert(result.includes('src="data:image/jpeg;base64,test"'));
            assert(result.includes('loading="lazy"'));
        });

        it('should generate correct HTML for multiple pages', () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2', 'data:image/jpeg;base64,test3'];
            const result = generatePagesHtml(pageImages);
            assert(result.includes('id="page-1"'));
            assert(result.includes('id="page-2"'));
            assert(result.includes('id="page-3"'));
            assert(result.includes('class="page left"'));
            assert(result.includes('class="page right"'));
            assert(result.includes('src="data:image/jpeg;base64,test1"'));
            assert(result.includes('src="data:image/jpeg;base64,test2"'));
            assert(result.includes('src="data:image/jpeg;base64,test3"'));
        });

        it('should throw error for invalid input', () => {
            assert.throws(() => generatePagesHtml('not an array'), {
                message: 'pageImages must be an array'
            });
        });
    });

    describe('generateFlipbookHtml', () => {
        it('should generate complete HTML with default options', async () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            // Check basic structure
            assert(result.includes('<!DOCTYPE html>'));
            assert(result.includes('<html lang="en">'));
            assert(result.includes('<title>Flipbook</title>'));
            assert(result.includes('.test-css { color: red; }'));
            assert(result.includes('console.log("test js");'));
            assert(result.includes('window.FLIPBOOK_CONFIG'));
            assert(result.includes('pageCount: 2'));
            assert(result.includes('id="page-1"'));
            assert(result.includes('id="page-2"'));
            assert(result.includes('<img src="data:image/jpeg;base64,test1"'));
            assert(result.includes('<img src="data:image/jpeg;base64,test2"'));
        });

        it('should generate HTML with custom title', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, { title: 'My Book' }, mockAssetLoader);

            assert(result.includes('<title>My Book</title>'));
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
                loadJs: async () => { throw new Error('JS load failed'); }
            };

            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {}, failingLoader);

            assert(result.includes('<style></style>'));
            assert(result.includes('<script></script>'));
        });

        it('should generate valid HTML structure', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            assert(result.includes('<meta charset="UTF-8">'));
            assert(result.includes('<meta name="viewport"'));
            assert(result.includes('<div id="flipbook-wrapper">'));
            assert(result.includes('id="book-container"'));
            assert(result.includes('class="page left"'));
            assert(result.includes('id="page-1"'));
            assert(result.includes('<img src="data:image/jpeg;base64,test"'));
            assert(result.includes('loading="lazy"'));
        });

        it('should escape special characters in HTML attributes', async () => {
            const pageImages = ['data:image/jpeg;base64,test"with"quotes'];
            const result = await generateFlipbookHtml(pageImages, {}, mockAssetLoader);

            // HTML attribute escaping should convert quotes to &quot;
            assert(result.includes('data:image/jpeg;base64,test&quot;with&quot;quotes'));
        });
    });
});
