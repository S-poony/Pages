import { describe, it } from 'node:test';
import assert from 'node:assert';
import { paginateContent, createEnrichedPages } from '../src/epub-processor.js';

// Mock DOM environment for Node.js
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;
global.document.fonts = { ready: Promise.resolve() };

describe('EPUB Link Resolution', () => {

    describe('paginateContent', () => {
        it('should track anchors and return correct page indices', async () => {
            const html = `
                <div id="p1">Page 1 Content</div>
                <div id="p2" style="height: 2000px">Page 2 Content (forced split)</div>
                <div id="p3">Page 3 Content</div>
            `;

            // Mock measure container
            const measureContainer = document.createElement('div');
            document.body.appendChild(measureContainer);

            // Mock offsetHeight to force splits
            // We need to override offsetHeight on the created elements inside paginateContent
            // Since we can't easily do that without proxying document.createElement,
            // we'll rely on the logic that splits based on height.
            // But wait, paginateContent uses measureContainer.offsetHeight.
            // In JSDOM, offsetHeight is always 0 unless we do layout.
            // We can mock Object.defineProperty(HTMLElement.prototype, 'offsetHeight', ...)

            let currentHeight = 0;
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                get: function () {
                    // Simple mock: assume each div adds 100px, except the big one
                    if (this.innerHTML.includes('Page 2 Content')) return 2000;
                    if (this.childNodes.length > 0) return currentHeight;
                    return 0;
                }
            });

            // We need to control the height accumulation manually or use a simpler test
            // where we just check if IDs are captured, regardless of pagination.
            // If we set pageHeight huge, everything fits on page 1.

            const pageHeight = 5000;
            const { pages, anchors } = await paginateContent(html, measureContainer, pageHeight);

            assert.strictEqual(pages.length, 1);
            assert.strictEqual(anchors['p1'], 0);
            assert.strictEqual(anchors['p2'], 0);
            assert.strictEqual(anchors['p3'], 0);

            document.body.removeChild(measureContainer);
        });
    });

    describe('createEnrichedPages', () => {
        it('should build linkMap and rewrite internal links', async () => {
            // Mock Book Object
            const mockBook = {
                spine: {
                    spineItems: [
                        {
                            href: 'Text/chapter1.xhtml',
                            load: async () => {
                                const doc = document.implementation.createHTMLDocument();
                                doc.body.innerHTML = `
                                    <div id="intro">Intro</div>
                                    <a href="chapter2.xhtml#section1">Go to Section 1</a>
                                    <a href="#intro">Back to Intro</a>
                                    <a href="http://google.com">External</a>
                                `;
                                return doc;
                            }
                        },
                        {
                            href: 'Text/chapter2.xhtml',
                            load: async () => {
                                const doc = document.implementation.createHTMLDocument();
                                doc.body.innerHTML = `
                                    <div id="section1">Section 1</div>
                                `;
                                return doc;
                            }
                        }
                    ]
                },
                packageUrl: 'OEBPS/content.opf',
                load: async () => '' // Mock CSS load
            };

            // Mock Zip Object
            const mockZip = {
                files: {},
                file: () => null
            };

            const options = {
                pageWidth: 800,
                pageHeight: 1200,
                backgroundColor: '#fff'
            };

            // We need to mock paginateContent to return predictable anchors
            // But we are importing the real one.
            // Since we can't easily mock the imported function in ES modules without a loader,
            // we will rely on the real paginateContent working with our JSDOM setup.
            // We ensure pageHeight is large enough to avoid splitting for simplicity.

            const { pages, linkMap } = await createEnrichedPages(mockBook, mockZip, options);

            // Check Link Map
            // Chapter 1 is page 1 (index 0 + 1)
            assert.strictEqual(linkMap['Text/chapter1.xhtml'], 1);
            // Anchor in Chapter 1
            assert.strictEqual(linkMap['Text/chapter1.xhtml#intro'], 1);

            // Chapter 2 is page 2 (index 1 + 1)
            assert.strictEqual(linkMap['Text/chapter2.xhtml'], 2);
            // Anchor in Chapter 2
            assert.strictEqual(linkMap['Text/chapter2.xhtml#section1'], 2);

            // Check Link Rewriting in Page 1
            const page1Html = pages[0].enrichmentHtml;

            // Link to chapter2.xhtml#section1
            // Base: Text/chapter1.xhtml -> Text/
            // Target: Text/chapter2.xhtml#section1
            // Key: Text/chapter2.xhtml#section1
            assert(page1Html.includes('data-epub-href="Text/chapter2.xhtml#section1"'));

            // Link to #intro (same page)
            // Base: Text/chapter1.xhtml
            // Target: Text/chapter1.xhtml#intro
            assert(page1Html.includes('data-epub-href="Text/chapter1.xhtml#intro"'));

            // External link should be untouched (except target=_blank)
            assert(page1Html.includes('href="http://google.com"'));
            assert(page1Html.includes('target="_blank"'));
        });
    });
});
