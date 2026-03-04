import { describe, it } from 'node:test';
import assert from 'node:assert';
import { processPdf } from '../src/processor/pdf/processor.js';
import { getTestPdfArrayBuffer } from './fixtures/test-pdf.js';

/**
 * Mock canvas API for testing
 */
const mockCanvasAPI = {
    createCanvas() {
        return {
            width: 800,
            height: 1000,
            getContext: () => ({
                save: () => { },
                restore: () => { },
                translate: () => { },
                scale: () => { },
                fillRect: () => { },
                render: () => ({ promise: Promise.resolve() }),
                drawImage: () => { }
            })
        };
    },
    canvasToDataURL: () => 'data:image/jpeg;base64,mock'
};

describe('PDF Text Extraction', () => {
    it('should extract and normalize text when preserveText is true', async () => {
        // We mock the PDF document directly in the test to avoid pdf.js/env issues
        const mockPage = {
            getViewport: () => ({
                width: 800,
                height: 1000,
                convertToViewportPoint: (x, y) => [x, 1000 - y] // Simplified bottom-up to top-down
            }),
            getTextContent: async () => ({
                items: [
                    {
                        str: 'Hello World',
                        transform: [12, 0, 0, 12, 72, 720],
                        width: 100,
                        height: 12,
                        fontName: 'F1'
                    }
                ],
                styles: {
                    'F1': { fontFamily: 'Helvetica' }
                }
            }),
            render: () => ({ promise: Promise.resolve() }),
            getAnnotations: async () => []
        };
        const mockPdf = {
            numPages: 1,
            getPage: async () => mockPage,
            getMetadata: async () => ({ info: { Title: 'Test' } }),
            getPageIndex: async () => 0
        };

        const result = await processPdf(mockPdf, { preserveText: true }, mockCanvasAPI);

        assert.ok(result.pageText, 'pageText should be present');
        assert.strictEqual(result.pageText.length, 1, 'Should have 1 page of text');
        assert.strictEqual(result.pageText[0].items.length, 1, 'Should have 1 extracted text item');

        const item = result.pageText[0].items[0];
        assert.strictEqual(item.str, 'Hello World');
        // pixelY = 1000 - 720 = 280
        // top = (280 - 12) / 1000 * 100 = 26.8%
        // left = 72 / 800 * 100 = 9%
        assert.strictEqual(item.top, '26.8000%');
        assert.strictEqual(item.left, '9.0000%');
        assert.strictEqual(item.fontFamily, 'Helvetica');
    });

    it('should NOT extract text when preserveText is false', async () => {
        const mockPage = {
            getViewport: () => ({ width: 800, height: 1000 }),
            getTextContent: async () => ({ items: [{ str: 'fail' }] }),
            getAnnotations: async () => []
        };
        const mockPdf = {
            numPages: 1,
            getPage: async () => mockPage,
            getMetadata: async () => ({ info: {} })
        };

        const result = await processPdf(mockPdf, { preserveText: false }, mockCanvasAPI);
        assert.strictEqual(result.pageText[0].items.length, 0, 'Should have 0 text items');
    });
});
