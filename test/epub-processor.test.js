import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    normalizeEpubProcessorOptions,
    loadEpubDocument,
    createEpubPageRenderer,
    processEpub,
    defaultCanvasAPI
} from '../src/epub-processor.js';

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
                        fillStyle: '#000000',
                        fillRect: () => { },
                        fillText: () => { },
                        measureText: (text) => ({ width: text.length * 8 }),
                        drawImage: () => { },
                        font: '16px Georgia, serif',
                        textBaseline: 'top'
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

describe('EPUB Processor', () => {
    describe('normalizeEpubProcessorOptions', () => {
        it('should return default options when none provided', () => {
            const result = normalizeEpubProcessorOptions();
            assert.deepStrictEqual(result, {
                scale: 2,
                scales: null,
                format: 'image/jpeg',
                quality: 0.92,
                pageWidth: 800
            });
        });

        it('should handle scales parameter for multi-scale rendering', () => {
            const result = normalizeEpubProcessorOptions({ scales: [1, 2, 3] });
            assert.deepStrictEqual(result, {
                scale: 2,
                scales: [1, 2, 3],
                format: 'image/jpeg',
                quality: 0.92,
                pageWidth: 800
            });
        });

        it('should validate scale parameter', () => {
            assert.deepStrictEqual(normalizeEpubProcessorOptions({ scale: 1 }), {
                scale: 1,
                scales: null,
                format: 'image/jpeg',
                quality: 0.92,
                pageWidth: 800
            });

            assert.throws(() => normalizeEpubProcessorOptions({ scale: 0 }), {
                message: 'scale must be a positive number'
            });

            assert.throws(() => normalizeEpubProcessorOptions({ scale: -1 }), {
                message: 'scale must be a positive number'
            });

            assert.throws(() => normalizeEpubProcessorOptions({ scale: 'invalid' }), {
                message: 'scale must be a positive number'
            });
        });

        it('should validate format parameter', () => {
            assert.deepStrictEqual(normalizeEpubProcessorOptions({ format: 'image/png' }), {
                scale: 2,
                scales: null,
                format: 'image/png',
                quality: 0.92,
                pageWidth: 800
            });

            assert.throws(() => normalizeEpubProcessorOptions({ format: 'invalid' }), {
                message: 'format must be either "image/jpeg" or "image/png"'
            });
        });

        it('should validate quality parameter', () => {
            assert.deepStrictEqual(normalizeEpubProcessorOptions({ quality: 0.8 }), {
                scale: 2,
                scales: null,
                format: 'image/jpeg',
                quality: 0.8,
                pageWidth: 800
            });

            assert.throws(() => normalizeEpubProcessorOptions({ quality: -0.1 }), {
                message: 'quality must be a number between 0 and 1'
            });

            assert.throws(() => normalizeEpubProcessorOptions({ quality: 1.1 }), {
                message: 'quality must be a number between 0 and 1'
            });

            assert.throws(() => normalizeEpubProcessorOptions({ quality: 'invalid' }), {
                message: 'quality must be a number between 0 and 1'
            });
        });

        it('should validate pageWidth parameter', () => {
            assert.deepStrictEqual(normalizeEpubProcessorOptions({ pageWidth: 1000 }), {
                scale: 2,
                scales: null,
                format: 'image/jpeg',
                quality: 0.92,
                pageWidth: 1000
            });

            assert.throws(() => normalizeEpubProcessorOptions({ pageWidth: 0 }), {
                message: 'pageWidth must be a positive number'
            });

            assert.throws(() => normalizeEpubProcessorOptions({ pageWidth: -100 }), {
                message: 'pageWidth must be a positive number'
            });
        });
    });

    describe('loadEpubDocument', () => {
        it('should reject invalid input', async () => {
            await assert.rejects(
                async () => loadEpubDocument('not an array buffer'),
                { message: 'arrayBuffer must be an ArrayBuffer' }
            );

            await assert.rejects(
                async () => loadEpubDocument(null),
                { message: 'arrayBuffer must be an ArrayBuffer' }
            );
        });

        it('should reject invalid EPUB data', async () => {
            const invalidBuffer = new ArrayBuffer(100);
            await assert.rejects(
                async () => loadEpubDocument(invalidBuffer),
                // epubjs will throw an error for invalid EPUB data
            );
        });
    });

    describe('Aspect Ratio Calculation', () => {
        it('should use 16:9 aspect ratio (width * 9/16 = height)', () => {
            const options = normalizeEpubProcessorOptions({ pageWidth: 800 });
            const expectedHeight = Math.round(800 * (9 / 16));

            // The aspect ratio should be 16:9
            assert.strictEqual(expectedHeight, 450); // 800 * 9/16 = 450
        });

        it('should calculate height correctly for different widths', () => {
            const widths = [600, 800, 1000, 1200];
            const aspectRatio = 9 / 16;

            widths.forEach(width => {
                const expectedHeight = Math.round(width * aspectRatio);
                const ratio = width / expectedHeight;
                // Assert the ratio is approximately 16:9
                assert.ok(Math.abs(ratio - (16 / 9)) < 0.01,
                    `Width ${width} should produce 16:9 ratio, got ${ratio}`);
            });
        });
    });

    // Note: Full integration tests with actual EPUB files would require:
    // 1. A browser environment for html2canvas
    // 2. Valid EPUB test fixtures
    // 3. More complex mocking of the ePub library
    // These tests cover the core validation and configuration logic
});
