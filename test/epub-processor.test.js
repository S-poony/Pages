import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    normalizeEpubProcessorOptions,
    loadEpubDocument,
    processEpub
} from '../src/epub-processor.js';

describe('EPUB Processor', () => {
    describe('normalizeEpubProcessorOptions', () => {
        it('should return default options when none provided', () => {
            const result = normalizeEpubProcessorOptions();
            assert.strictEqual(result.pageWidth, 450);
            assert.strictEqual(result.backgroundColor, '#ffffff');
            // Default height should be portrait 9:16 ratio (450x800)
            assert.strictEqual(result.pageHeight, 800);
        });

        it('should accept custom pageWidth', () => {
            const result = normalizeEpubProcessorOptions({ pageWidth: 1000 });
            assert.strictEqual(result.pageWidth, 1000);
            assert.strictEqual(result.pageHeight, 800); // Uses default pageHeight
        });

        it('should accept custom pageHeight', () => {
            const result = normalizeEpubProcessorOptions({ pageWidth: 800, pageHeight: 600 });
            assert.strictEqual(result.pageWidth, 800);
            assert.strictEqual(result.pageHeight, 600);
        });

        it('should accept custom backgroundColor', () => {
            const result = normalizeEpubProcessorOptions({ backgroundColor: '#f0f0f0' });
            assert.strictEqual(result.backgroundColor, '#f0f0f0');
        });

        it('should validate pageWidth', () => {
            assert.throws(() => normalizeEpubProcessorOptions({ pageWidth: 0 }), /pageWidth must be a positive number/);
            assert.throws(() => normalizeEpubProcessorOptions({ pageWidth: -100 }), /pageWidth must be a positive number/);
            assert.throws(() => normalizeEpubProcessorOptions({ pageWidth: 'invalid' }), /pageWidth must be a positive number/);
        });
    });

    describe('loadEpubDocument', () => {
        it('should reject invalid input', async () => {
            await assert.rejects(
                async () => loadEpubDocument('not an array buffer'),
                { message: 'arrayBuffer must be an ArrayBuffer' }
            );
        });
    });

    describe('processEpub', () => {
        it('should validate input', async () => {
            await assert.rejects(
                async () => processEpub('invalid'),
                { message: 'input must be a File or ArrayBuffer' }
            );
        });
    });
});
