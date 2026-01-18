
import { test } from 'node:test';
import assert from 'node:assert';
import { processPdf } from '../src/processor/pdf/processor.js';
import { normalizeProcessorOptions } from '../src/processor/pdf/options.js';

// Mock Canvas API that captures drawing commands
const createMockCanvasAPI = () => {
    const drawings = [];
    return {
        drawings,
        createCanvas() {
            let width = 0;
            let height = 0;
            return {
                set width(w) { width = w; },
                get width() { return width; },
                set height(h) { height = h; },
                get height() { return height; },
                getContext(type) {
                    if (type === '2d') {
                        return {
                            save: () => { },
                            restore: () => { },
                            translate: (x, y) => {
                                drawings.push({ type: 'translate', x, y });
                            },
                            fillRect: (x, y, w, h) => {
                                drawings.push({ type: 'fillRect', x, y, w, h });
                            },
                            drawImage: () => { },
                            // Mock other context methods as needed
                        };
                    }
                    return null;
                },
                toDataURL: () => 'data:image/png;base64,mock'
            };
        },
        canvasToDataURL: () => 'data:image/png;base64,mock',
        releaseCanvas: () => { }
    };
};

test('Double Spread Aspect Ratio Normalization', async (t) => {
    // 1. Setup Mock PDF with mixed aspect ratios
    // Page 1: Standard Landscape Spread (1000x500) -> Ratio 2.0
    // Page 2: Deviant Portrait Page (500x500) -> Ratio 1.0 (Square for simplicity, Half of spread)
    // We expect Page 2 to be normalized to 1000x500 (White Box), then split.

    const mockPdf = {
        numPages: 2,
        getPage: async (pageNumber) => {
            if (pageNumber === 1) {
                // Standard Spread
                return {
                    view: [0, 0, 1000, 500],
                    getViewport: ({ scale }) => ({ width: 1000 * scale, height: 500 * scale, scale }),
                    render: () => ({ promise: Promise.resolve() }),
                    getOperatorList: async () => ({ argsArray: [], fnArray: [] }), // Minimal mock
                };
            } else {
                // Deviant Page
                return {
                    view: [0, 0, 500, 500],
                    getViewport: ({ scale }) => ({ width: 500 * scale, height: 500 * scale, scale }),
                    render: () => ({ promise: Promise.resolve() }),
                    getOperatorList: async () => ({ argsArray: [], fnArray: [] }),
                };
            }
        },
        getMetadata: async () => ({ info: { Title: 'Test PDF' } }),
    };

    const canvasAPI = createMockCanvasAPI();
    const options = {
        doubleSpread: true,
        scale: 1,
        // Ensure normalization is triggered by passing target if dynamic detection needs more pages, 
        // but our dynamic detection should work with 2 pages (1 common vs 1 deviant? No, 2 pages: 1 ratio A, 1 ratio B. 
        // If counts are equal, it might pick either. 
        // Let's force targetAspectRatio to be 2.0 to simulate a mostly-spread PDF.
        targetAspectRatio: 2.0
    };

    // Run processor
    const result = await processPdf(mockPdf, options, canvasAPI);

    // Result has `renderPageVariants`.
    // It mocks `halfPageCount` = numPages * 2 = 4.
    // Page 3 (2L) -> PDF Page 2 Left (Should be White Space)
    // Page 4 (2R) -> PDF Page 2 Right (Should be Content)

    // Render Page 3 (2L)
    await result.renderPageVariants(3);

    // Verify drawings for Page 3 (2L)
    const drawings = canvasAPI.drawings;

    // Check for translate(500, 0)
    // Page 2 is 500 wide. Target is 1000 wide. 
    // Normalized: [White 500][Content 500] (Right Aligned)
    // xOffset = 500.
    // Side Left: splitOffset = 0.
    // translate(500, 0).
    // Canvas view: 0 to 500. Content drawn at 500. Empty.

    const translate500 = drawings.find(d => d.type === 'translate' && d.x === 500 && d.y === 0);
    assert.ok(translate500, 'Should translate content by 500px (pushing it to right half)');

    // Clear drawings
    drawings.length = 0;

    // Render Page 4 (2R)
    await result.renderPageVariants(4);

    // Side Right: splitOffset = -500.
    // xOffset = 500.
    // translate(0, 0).
    const translate0 = drawings.find(d => d.type === 'translate' && d.x === 0 && d.y === 0);
    assert.ok(translate0, 'Should translate content by 0px (visible in right half)');
});
