import { describe, it } from 'node:test';
import assert from 'node:assert';
import { processPdf, defaultCanvasAPI, normalizeProcessorOptions, createPageRenderer } from '../src/processor/pdf/processor.js';
import { getTestPdfArrayBuffer } from './fixtures/test-pdf.js';

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
        return `data:${format};base64,perf${canvas.width}x${canvas.height}`;
    }
};

describe('Performance', () => {
    it('renderPage should complete within 2000ms', async () => {
        const fakePdf = {
            numPages: 1,
            getPage: async () => ({
                getViewport: () => ({ width: 100, height: 100 }),
                render: () => ({ promise: Promise.resolve() })
            })
        };

        const options = normalizeProcessorOptions();
        const renderPage = createPageRenderer(fakePdf, options, mockCanvasAPI);

        const start = Date.now();
        const img = await renderPage(1);
        const duration = Date.now() - start;

        assert.strictEqual(typeof img, 'string');
        assert(duration < 2000, `renderPage took too long: ${duration}ms`);
    });
});
