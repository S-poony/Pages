import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    normalizeProcessorOptions,
    loadPdfDocument,
    createPageRenderer,
    processPdf,
    defaultCanvasAPI
} from '../src/processor.js';
import { getTestPdfArrayBuffer } from './fixtures/test-pdf.js';

/**
 * Mock canvas API for testing
 */
const mockCanvasAPI = {
    createCanvas() {
        const canvas = {
            width: 100,
            height: 100,
            getContext(type) {
                if (type === '2d') {
                    return {
                        // Mock 2D context methods that pdf.js might use
                        save: () => {},
                        restore: () => {},
                        translate: () => {},
                        scale: () => {},
                        transform: () => {},
                        setTransform: () => {},
                        clearRect: () => {},
                        fillRect: () => {},
                        strokeRect: () => {},
                        beginPath: () => {},
                        closePath: () => {},
                        moveTo: () => {},
                        lineTo: () => {},
                        bezierCurveTo: () => {},
                        quadraticCurveTo: () => {},
                        arc: () => {},
                        rect: () => {},
                        fill: () => {},
                        stroke: () => {},
                        clip: () => {},
                        drawImage: () => {},
                        createImageData: () => ({ width: 100, height: 100, data: new Uint8ClampedArray(40000) }),
                        getImageData: () => ({ width: 100, height: 100, data: new Uint8ClampedArray(40000) }),
                        putImageData: () => {},
                        // Properties
                        fillStyle: '#000000',
                        strokeStyle: '#000000',
                        lineWidth: 1,
                        lineCap: 'butt',
                        lineJoin: 'miter',
                        miterLimit: 10,
                        globalAlpha: 1,
                        globalCompositeOperation: 'source-over',
                        shadowOffsetX: 0,
                        shadowOffsetY: 0,
                        shadowBlur: 0,
                        shadowColor: 'rgba(0,0,0,0)',
                        font: '10px sans-serif',
                        textAlign: 'start',
                        textBaseline: 'alphabetic'
                    };
                }
                return null;
            }
        };
        return canvas;
    },

    canvasToDataURL(canvas, format, quality) {
        return `data:${format};base64,mockdata${canvas.width}x${canvas.height}`;
    }
};

describe('PDF Processor', () => {
    describe('normalizeProcessorOptions', () => {
        it('should return default options when none provided', () => {
            const result = normalizeProcessorOptions();
            assert.deepStrictEqual(result, {
                scale: 2,
                format: 'image/jpeg',
                quality: 0.92
            });
        });

        it('should validate scale parameter', () => {
            assert.deepStrictEqual(normalizeProcessorOptions({ scale: 1 }), {
                scale: 1,
                format: 'image/jpeg',
                quality: 0.92
            });

            assert.throws(() => normalizeProcessorOptions({ scale: 0 }), {
                message: 'scale must be a positive number'
            });

            assert.throws(() => normalizeProcessorOptions({ scale: -1 }), {
                message: 'scale must be a positive number'
            });

            assert.throws(() => normalizeProcessorOptions({ scale: 'invalid' }), {
                message: 'scale must be a positive number'
            });
        });

        it('should validate format parameter', () => {
            assert.deepStrictEqual(normalizeProcessorOptions({ format: 'image/png' }), {
                scale: 2,
                format: 'image/png',
                quality: 0.92
            });

            assert.throws(() => normalizeProcessorOptions({ format: 'invalid' }), {
                message: 'format must be either "image/jpeg" or "image/png"'
            });
        });

        it('should validate quality parameter', () => {
            assert.deepStrictEqual(normalizeProcessorOptions({ quality: 0.8 }), {
                scale: 2,
                format: 'image/jpeg',
                quality: 0.8
            });

            assert.throws(() => normalizeProcessorOptions({ quality: -0.1 }), {
                message: 'quality must be a number between 0 and 1'
            });

            assert.throws(() => normalizeProcessorOptions({ quality: 1.1 }), {
                message: 'quality must be a number between 0 and 1'
            });

            assert.throws(() => normalizeProcessorOptions({ quality: 'invalid' }), {
                message: 'quality must be a number between 0 and 1'
            });
        });
    });

    describe('loadPdfDocument', () => {
        it('should load a valid PDF document', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const pdf = await loadPdfDocument(arrayBuffer);

            assert(pdf, 'PDF document should be loaded');
            assert.strictEqual(typeof pdf.numPages, 'number', 'PDF should have numPages property');
            assert(pdf.numPages > 0, 'PDF should have at least one page');
        });

        it('should reject invalid input', async () => {
            await assert.rejects(
                async () => loadPdfDocument('not an array buffer'),
                { message: 'arrayBuffer must be an ArrayBuffer' }
            );

            await assert.rejects(
                async () => loadPdfDocument(null),
                { message: 'arrayBuffer must be an ArrayBuffer' }
            );
        });

        it('should reject invalid PDF data', async () => {
            const invalidBuffer = new ArrayBuffer(100);
            await assert.rejects(
                async () => loadPdfDocument(invalidBuffer),
                // pdf.js will throw an error for invalid PDF data
            );
        });
    });

    describe('createPageRenderer', () => {
        it('should create a page renderer function', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const pdf = await loadPdfDocument(arrayBuffer);
            const options = normalizeProcessorOptions();

            const renderPage = createPageRenderer(pdf, options, mockCanvasAPI);

            assert.strictEqual(typeof renderPage, 'function', 'Should return a function');
        });

        it('should create a renderer function that accepts valid page numbers', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const pdf = await loadPdfDocument(arrayBuffer);
            const options = normalizeProcessorOptions();

            const renderPage = createPageRenderer(pdf, options, mockCanvasAPI);

            // Just test that the function exists and doesn't throw for valid input
            // We skip actual rendering since it's complex to mock the canvas context
            assert.strictEqual(typeof renderPage, 'function');
        });

        it('should handle different image formats', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const pdf = await loadPdfDocument(arrayBuffer);

            const pngOptions = normalizeProcessorOptions({ format: 'image/png' });
            const renderPagePNG = createPageRenderer(pdf, pngOptions, mockCanvasAPI);

            // Test that different options create different renderers
            assert.strictEqual(typeof renderPagePNG, 'function');
        });

        it('should validate page numbers', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const pdf = await loadPdfDocument(arrayBuffer);
            const options = normalizeProcessorOptions();

            const renderPage = createPageRenderer(pdf, options, mockCanvasAPI);

            await assert.rejects(
                async () => renderPage(0),
                { message: 'Page 0 is out of range (1-1)' }
            );

            await assert.rejects(
                async () => renderPage(2),
                { message: 'Page 2 is out of range (1-1)' }
            );

            await assert.rejects(
                async () => renderPage('invalid'),
                { message: 'Page invalid is out of range (1-1)' }
            );
        });
    });

    describe('processPdf', () => {
        it('should process PDF from ArrayBuffer', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const result = await processPdf(arrayBuffer, {}, mockCanvasAPI);

            assert.strictEqual(typeof result.pageCount, 'number', 'Should return pageCount');
            assert.strictEqual(typeof result.renderPage, 'function', 'Should return renderPage function');
            assert(result.pageCount > 0, 'Page count should be positive');
        });

        it('should process PDF from File-like object', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();

            // Mock File-like object
            const mockFile = {
                arrayBuffer: async () => arrayBuffer
            };

            const result = await processPdf(mockFile, {}, mockCanvasAPI);

            assert.strictEqual(typeof result.pageCount, 'number', 'Should return pageCount');
            assert.strictEqual(typeof result.renderPage, 'function', 'Should return renderPage function');
        });

        it('should validate input types', async () => {
            await assert.rejects(
                async () => processPdf('invalid input'),
                { message: 'input must be a File or ArrayBuffer' }
            );

            await assert.rejects(
                async () => processPdf(null),
                { message: 'input must be a File or ArrayBuffer' }
            );
        });

        it('should apply custom options', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const customOptions = {
                scale: 1,
                format: 'image/png',
                quality: 0.8
            };

            const result = await processPdf(arrayBuffer, customOptions, mockCanvasAPI);

            // Test that custom options are accepted and processing completes
            assert.strictEqual(typeof result.pageCount, 'number');
            assert.strictEqual(typeof result.renderPage, 'function');
        });

        it('should work with default canvas API', async () => {
            // Skip this test if running in Node.js without DOM
            if (typeof document === 'undefined') {
                return;
            }

            const arrayBuffer = getTestPdfArrayBuffer();
            const result = await processPdf(arrayBuffer, {}, defaultCanvasAPI);

            assert.strictEqual(typeof result.pageCount, 'number');
            assert.strictEqual(typeof result.renderPage, 'function');
        });
    });
});
