import { describe, it } from 'node:test';
import assert from 'node:assert';
import { paginateContent, createEnrichedPages } from '../src/processor/epub/processor.js';

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

            let currentHeight = 0;
            Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                get: function () {
                    if (this.innerHTML.includes('Page 2 Content')) return 2000;
                    if (this.childNodes.length > 0) return currentHeight;
                    return 0;
                },
                configurable: true
            });

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
                load: async () => ''
            };

            const mockZip = {
                files: {},
                file: () => null
            };

            const options = {
                pageWidth: 800,
                pageHeight: 1200,
                backgroundColor: '#fff'
            };

            const { pages, linkMap } = await createEnrichedPages(mockBook, mockZip, options);

            assert.strictEqual(linkMap['Text/chapter1.xhtml'], 1);
            assert.strictEqual(linkMap['Text/chapter1.xhtml#intro'], 1);
            assert.strictEqual(linkMap['Text/chapter2.xhtml'], 2);
            assert.strictEqual(linkMap['Text/chapter2.xhtml#section1'], 2);

            const page1Html = pages[0].enrichmentHtml;
            assert(page1Html.includes('data-epub-href="Text/chapter2.xhtml#section1"'));
            assert(page1Html.includes('data-epub-href="Text/chapter1.xhtml#intro"'));
            assert(page1Html.includes('href="http://google.com"'));
            assert(page1Html.includes('target="_blank"'));
        });
    });
});
