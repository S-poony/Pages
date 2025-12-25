// Global state
let zoom = 1;
window.currentZoom = 1;
let isPanning = false;
let startX = 0, startY = 0;
let panX = 0, panY = 0;
const ZOOM_RESET_TOLERANCE = 0.01;
let BOOK_WIDTH_AT_1X = 0;
let BOOK_HEIGHT_AT_1X = 0;
let pageFlip = null;
let isUpdatingFromHash = false; // Prevent infinite loops between hash and flip events
