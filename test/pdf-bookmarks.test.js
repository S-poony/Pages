import { extractBookmarks } from '../src/pdf-bookmarks.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('PDF Bookmarks Extraction', () => {
    it('should return empty array if no outline', async () => {
        const pdf = {
            getOutline: async () => null
        };
        const bookmarks = await extractBookmarks(pdf);
        assert.deepStrictEqual(bookmarks, []);
    });

    it('should extract simple bookmarks with explicit destinations', async () => {
        const outline = [
            { title: 'Chapter 1', dest: [{ num: 1, gen: 0 }, { name: 'XYZ' }] },
            { title: 'Chapter 2', dest: [{ num: 5, gen: 0 }, { name: 'XYZ' }] }
        ];

        const pdf = {
            getOutline: async () => outline,
            getPageIndex: async (ref) => {
                if (ref.num === 1) return 0; // Page 1 (0-based)
                if (ref.num === 5) return 4; // Page 5 (0-based)
                return -1;
            }
        };

        const bookmarks = await extractBookmarks(pdf);
        assert.deepStrictEqual(bookmarks, [
            { title: 'Chapter 1', page: 1, level: 0 }, // 1-based
            { title: 'Chapter 2', page: 5, level: 0 }
        ]);
    });

    it('should resolve named destinations', async () => {
        const outline = [
            { title: 'Intro', dest: 'intro_dest' }
        ];

        const pdf = {
            getOutline: async () => outline,
            getDestination: async (name) => {
                if (name === 'intro_dest') return [{ num: 10, gen: 0 }];
                return null;
            },
            getPageIndex: async (ref) => {
                if (ref.num === 10) return 9;
                return -1;
            }
        };

        const bookmarks = await extractBookmarks(pdf);
        assert.deepStrictEqual(bookmarks, [
            { title: 'Intro', page: 10, level: 0 }
        ]);
    });

    it('should handle nested bookmarks', async () => {
        const outline = [
            {
                title: 'Section 1',
                dest: [{ num: 1, gen: 0 }],
                items: [
                    { title: 'Subsection 1.1', dest: [{ num: 2, gen: 0 }] }
                ]
            }
        ];

        const pdf = {
            getOutline: async () => outline,
            getPageIndex: async (ref) => {
                if (ref.num === 1) return 0;
                if (ref.num === 2) return 1;
                return -1;
            }
        };

        const bookmarks = await extractBookmarks(pdf);
        assert.deepStrictEqual(bookmarks, [
            {
                title: 'Section 1',
                page: 1,
                level: 0,
                children: [
                    { title: 'Subsection 1.1', page: 2, level: 1 }
                ]
            }
        ]);
    });
});
