/**
 * PDF Canvas API Module
 * Provides a specialized interface for canvas operations, including an internal
 * pooling mechanism to drastically reduce memory churn during heavy rendering tasks.
 */

/**
 * Default canvas API implementation using DOM with pooling support
 */
export const defaultCanvasAPI = {
    _pool: [],

    createCanvas() {
        if (this._pool.length > 0) {
            const canvas = this._pool.pop();
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.width = 1;
                canvas.height = 1;
            }
            return canvas;
        }
        return document.createElement('canvas');
    },

    releaseCanvas(canvas) {
        if (canvas) {
            this._pool.push(canvas);
        }
    },

    canvasToDataURL(canvas, format, quality) {
        return canvas.toDataURL(format, quality);
    }
};
