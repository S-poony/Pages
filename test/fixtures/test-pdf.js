/**
 * Minimal test PDF data
 * A simple 1-page PDF containing "Hello World"
 */

// This is a minimal PDF with one page containing "Hello World"
// Generated as a base64 string for easy testing
export const TEST_PDF_BASE64 = `JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovQ29udGVudHMgNCAwIFIKL1Jlc291cmNlcyA8PAovRm9udCA8PAovRjEgNSAwIFIKPj4KPj4KPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA0NAo+c3RyZWFtCkJUCi9GMSAxMiBUZgo3MiA3MjAgVGQKKFRlc3QgUGRGIFBhZ2UpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYwIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjc0IDAwMDAwIG4gCjAwMDAwMDAzNzMgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0NTkKJUVPRgo=`;

/**
 * Get the test PDF as a Uint8Array
 * @returns {Uint8Array} PDF data as bytes
 */
export function getTestPdfBytes() {
    return Uint8Array.from(atob(TEST_PDF_BASE64), c => c.charCodeAt(0));
}

/**
 * Get the test PDF as an ArrayBuffer
 * @returns {ArrayBuffer} PDF data as ArrayBuffer
 */
export function getTestPdfArrayBuffer() {
    const bytes = getTestPdfBytes();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
