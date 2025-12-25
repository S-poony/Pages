import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    normalizeProcessorOptions,
    loadPdfDocument,
    createPageRenderer,
    processPdf,
    defaultCanvasAPI
} from '../src/processor/pdf/processor.js';
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
                        save: () => { },
                        restore: () => { },
                        translate: () => { },
                        scale: () => { },
                        transform: () => { },
                        setTransform: () => { },
                        clearRect: () => { },
                        fillRect: () => { },
                        strokeRect: () => { },
                        beginPath: () => { },
                        closePath: () => { },
                        moveTo: () => { },
                        lineTo: () => { },
                        bezierCurveTo: () => { },
                        quadraticCurveTo: () => { },
                        arc: () => { },
                        rect: () => { },
                        fill: () => { },
                        stroke: () => { },
                        clip: () => { },
                        drawImage: () => { },
                        createImageData: () => ({ width: 100, height: 100, data: new Uint8ClampedArray(40000) }),
                        getImageData: () => ({ width: 100, height: 100, data: new Uint8ClampedArray(40000) }),
                        putImageData: () => { },
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
                scales: null,
                format: 'image/jpeg',
                quality: 0.92,
                doubleSpread: false
            });
        });

        it('should handle scales parameter for multi-scale rendering', () => {
            const result = normalizeProcessorOptions({ scales: [1, 2, 3] });
            assert.deepStrictEqual(result, {
                scale: 2,
                scales: [1, 2, 3],
                format: 'image/jpeg',
                quality: 0.92,
                doubleSpread: false
            });
        });

        it('should validate scale parameter', () => {
            assert.deepStrictEqual(normalizeProcessorOptions({ scale: 1 }), {
                scale: 1,
                scales: null,
                format: 'image/jpeg',
                quality: 0.92,
                doubleSpread: false
            });

            assert.throws(() => normalizeProcessorOptions({ scale: 0 }), {
                message: 'scale must be a positive number'
            });
        });
    });

    describe('loadPdfDocument', () => {
        it('should load a valid PDF document', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const pdf = await loadPdfDocument(arrayBuffer);
            assert(pdf, 'PDF document should be loaded');
            assert.strictEqual(typeof pdf.numPages, 'number');
        });
    });

    describe('processPdf', () => {
        it('should process PDF from ArrayBuffer', async () => {
            const arrayBuffer = getTestPdfArrayBuffer();
            const result = await processPdf(arrayBuffer, {}, mockCanvasAPI);
            assert.strictEqual(typeof result.pageCount, 'number');
            assert.strictEqual(typeof result.renderPage, 'function');
        });
    });
});
