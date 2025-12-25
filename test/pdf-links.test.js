import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractPageLinks, resolveLinkDestinations, normalizeLinkRects } from '../src/processor/pdf/annotations.js';

describe('PDF Link Extraction', () => {
    test('extractPageLinks should identify link annotations', async () => {
        const mockPage = {
            getAnnotations: async () => [
                { subtype: 'Link', rect: [100, 100, 200, 200], url: 'https://example.com' },
                { subtype: 'Text', rect: [0, 0, 10, 10] }, // Should be ignored
                { subtype: 'Link', rect: [300, 300, 400, 400], dest: 'page1' }
            ]
        };

        const links = await extractPageLinks(mockPage);
        assert.strictEqual(links.length, 2);
        assert.strictEqual(links[0].url, 'https://example.com');
        assert.strictEqual(links[1].dest, 'page1');
    });

    test('resolveLinkDestinations should resolve string destinations', async () => {
        const mockPdf = {
            getDestination: async (dest) => dest === 'target' ? [{ num: 5, gen: 0 }] : null,
            getPageIndex: async (ref) => ref.num === 5 ? 4 : -1
        };

        const links = [{ dest: 'target' }];
        const resolved = await resolveLinkDestinations(mockPdf, links);

        assert.strictEqual(resolved[0].pageNumber, 5);
    });

    test('normalizeLinkRects should convert PDF rects to percentages', () => {
        const links = [
            { rect: [0, 500, 100, 600] } // 100x100 box at top-left
        ];
        const pageWidth = 1000;
        const pageHeight = 1000;

        const normalized = normalizeLinkRects(links, pageWidth, pageHeight);

        // top = (1000 - 600) / 1000 = 40%
        // left = 0 / 1000 = 0%
        // width = 100 / 1000 = 10%
        // height = 100 / 1000 = 10%
        assert.strictEqual(normalized[0].top, '40.0000%');
        assert.strictEqual(normalized[0].left, '0.0000%');
        assert.strictEqual(normalized[0].width, '10.0000%');
        assert.strictEqual(normalized[0].height, '10.0000%');
    });
});
