/**
 * EPUB Loader Module
 * responsible for initializing the epub.js library and loading the binary data
 * from the source file into a traversable book object.
 */

import ePub from 'epubjs';

/**
 * Loads an EPUB document from array buffer
 * @param {ArrayBuffer} arrayBuffer - EPUB data as array buffer
 * @returns {Promise<Object>} EPUB book object
 */
export async function loadEpubDocument(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error('arrayBuffer must be an ArrayBuffer');
    }

    try {
        const book = ePub(arrayBuffer);
        await book.ready;
        return book;
    } catch (e) {
        console.error('Failed to load EPUB:', e);
        throw new Error('Failed to parse EPUB file');
    }
}
