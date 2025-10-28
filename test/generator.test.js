import { describe, it } from 'node:test';
import assert from 'node:assert';
import { wrapFlipbookJs, generatePagesHtml, generateFlipbookHtml } from '../src/generator.js';

/**
 * Mock asset loader for testing
 */
const mockAssetLoader = {
    loadCss: async () => '.test-css { color: red; }',
    loadJs: async () => 'console.log("test js");'
};

describe('Flipbook HTML Generator', () => {
    describe('wrapFlipbookJs', () => {
        it('should wrap JavaScript content and replace initialization code', () => {
            const inputJs = `
const totalPages = parseInt(document.getElementById('book-container').dataset.pageCount);
const pageImages = JSON.parse(document.getElementById('book-container').dataset.pageImages);
function init() { /* ... */ }
`;

            const expected = `
const totalPages = window.__PAGE_COUNT__;
const pageImages = window.__PAGE_IMAGES__;
function init() { /* ... */ }
`;

            const result = wrapFlipbookJs(inputJs);
            assert.strictEqual(result, expected);
        });

        it('should handle empty string input', () => {
            const result = wrapFlipbookJs('');
            assert.strictEqual(result, '');
        });

        it('should throw error for non-string input', () => {
            assert.throws(() => wrapFlipbookJs(null), {
                message: 'jsContent must be a string'
            });
            assert.throws(() => wrapFlipbookJs(123), {
                message: 'jsContent must be a string'
            });
            assert.throws(() => wrapFlipbookJs({}), {
                message: 'jsContent must be a string'
            });
        });

        it('should handle JavaScript without the target patterns', () => {
            const inputJs = 'console.log("no patterns here");';
            const result = wrapFlipbookJs(inputJs);
            assert.strictEqual(result, inputJs);
        });
    });

    describe('generatePagesHtml', () => {
        it('should generate correct HTML for single page', () => {
            const result = generatePagesHtml(1);
            const expected = `            <div class="page" id="page-1">
                <div class="page-face page-face-front"></div>
                <div class="page-face page-face-back" id="page-1-back"></div>
            </div>`;
            assert.strictEqual(result, expected);
        });

        it('should generate correct HTML for multiple pages', () => {
            const result = generatePagesHtml(3);
            assert(result.includes('id="page-1"'));
            assert(result.includes('id="page-2"'));
            assert(result.includes('id="page-3"'));
            assert(result.includes('id="page-1-back"'));
            assert(result.includes('id="page-2-back"'));
            assert(result.includes('id="page-3-back"'));
        });

        it('should throw error for invalid pageCount', () => {
            assert.throws(() => generatePagesHtml(0), {
                message: 'pageCount must be a positive integer'
            });
            assert.throws(() => generatePagesHtml(-1), {
                message: 'pageCount must be a positive integer'
            });
            assert.throws(() => generatePagesHtml(1.5), {
                message: 'pageCount must be a positive integer'
            });
            assert.throws(() => generatePagesHtml('2'), {
                message: 'pageCount must be a positive integer'
            });
        });
    });

    describe('generateFlipbookHtml', () => {
        it('should generate complete HTML with default options', async () => {
            const pageImages = ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2'];
            const result = await generateFlipbookHtml(2, pageImages, {}, mockAssetLoader);

            // Check basic structure
            assert(result.includes('<!DOCTYPE html>'));
            assert(result.includes('<html lang="en">'));
            assert(result.includes('<title>Flipbook</title>'));
            assert(result.includes('.test-css { color: red; }'));
            assert(result.includes('console.log("test js");'));
            assert(result.includes('window.__PAGE_COUNT__ = 2'));
            assert(result.includes('window.__PAGE_IMAGES__ = ["data:image/jpeg;base64,test1","data:image/jpeg;base64,test2"]'));
            assert(result.includes('id="page-1"'));
            assert(result.includes('id="page-2"'));
        });

        it('should generate HTML with custom title', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(1, pageImages, { title: 'My Book' }, mockAssetLoader);

            assert(result.includes('<title>My Book</title>'));
        });

        it('should validate input parameters', async () => {
            await assert.rejects(
                async () => generateFlipbookHtml(0, [], {}, mockAssetLoader),
                { message: 'pageCount must be a positive integer' }
            );

            await assert.rejects(
                async () => generateFlipbookHtml(1, 'not an array', {}, mockAssetLoader),
                { message: 'pageImages must be an array' }
            );

            await assert.rejects(
                async () => generateFlipbookHtml(2, ['image1'], {}, mockAssetLoader),
                { message: 'pageImages length must match pageCount' }
            );
        });

        it('should handle asset loader failures gracefully', async () => {
            const failingLoader = {
                loadCss: async () => { throw new Error('CSS load failed'); },
                loadJs: async () => { throw new Error('JS load failed'); }
            };

            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(1, pageImages, {}, failingLoader);

            assert(result.includes('<style></style>'));
            assert(result.includes('<script></script>'));
        });

        it('should generate valid HTML structure', async () => {
            const pageImages = ['data:image/jpeg;base64,test'];
            const result = await generateFlipbookHtml(1, pageImages, {}, mockAssetLoader);

            // Check that all required elements are present
            assert(result.includes('<meta charset="UTF-8">'));
            assert(result.includes('<meta name="viewport"'));
            assert(result.includes('<div id="flipbook-wrapper">'));
            assert(result.includes('<div id="book-container">'));
            assert(result.includes('<div class="page" id="page-1">'));
            assert(result.includes('<div class="page-face page-face-front"></div>'));
            assert(result.includes('<div class="page-face page-face-back" id="page-1-back"></div>'));
        });

        it('should escape special characters in JSON', async () => {
            const pageImages = ['data:image/jpeg;base64,test"with"quotes'];
            const result = await generateFlipbookHtml(1, pageImages, {}, mockAssetLoader);

            // JSON.stringify should escape quotes properly
            assert(result.includes('"data:image/jpeg;base64,test\\"with\\"quotes"'));
        });
    });
});
