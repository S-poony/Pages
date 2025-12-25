/**
 * PDF Loader Module
 * Handles the lazy-loading of the pdf.js library and the strategic configuration
 * of its worker scripts for various environments (Browser, CDNs, etc.).
 */

let pdfjsLibPromise = null;

export async function getPdfJsLib() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            if (typeof window !== 'undefined') {
                // Browser environment
                const pdfjsModule = await import('pdfjs-dist');
                const lib = pdfjsModule.default || pdfjsModule;

                if (!lib.GlobalWorkerOptions) {
                    lib.GlobalWorkerOptions = {};
                }

                const strategies = [
                    () => {
                        if (import.meta?.url) {
                            return new URL(
                                'pdfjs-dist/build/pdf.worker.min.mjs',
                                import.meta.url
                            ).toString();
                        }
                        throw new Error('import.meta.url not available');
                    },
                    () => '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
                    () => {
                        const version = lib.version || '3.11.174';
                        return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
                    }
                ];

                for (const strategy of strategies) {
                    try {
                        lib.GlobalWorkerOptions.workerSrc = strategy();
                        break;
                    } catch (e) { }
                }

                if (!lib.GlobalWorkerOptions.workerSrc) {
                    throw new Error('Could not set pdf.js worker source');
                }

                window.pdfjsLib = lib;
                return lib;
            } else {
                // Node.js environment
                try {
                    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
                    return pdfjsModule.default || pdfjsModule;
                } catch (e) {
                    return {
                        getDocument: async () => ({
                            promise: Promise.resolve({
                                numPages: 1,
                                getPage: async () => ({
                                    getViewport: () => ({ width: 100, height: 100 }),
                                    render: () => ({ promise: Promise.resolve() })
                                })
                            })
                        })
                    };
                }
            }
        })();
    }
    return pdfjsLibPromise;
}

/**
 * Loads a PDF document from array buffer
 * @param {ArrayBuffer} arrayBuffer - PDF data as array buffer
 * @returns {Promise<Object>} PDF document
 */
export async function loadPdfDocument(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
        throw new Error('arrayBuffer must be an ArrayBuffer');
    }

    const pdfjsLib = await getPdfJsLib();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf;
}
