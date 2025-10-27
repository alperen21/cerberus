// Coordinate mapping utilities for device pixel ratio and scroll offsets
/**
 * Map backend coordinates to viewport coordinates
 * Accounts for device pixel ratio and scroll offsets
 */
export function mapCoordsToViewport(coords, scrollX = window.scrollX, scrollY = window.scrollY) {
    return {
        x: coords.x + scrollX,
        y: coords.y + scrollY,
        width: coords.width,
        height: coords.height
    };
}
/**
 * Get element bounding rectangle relative to viewport
 */
export function getElementViewportRect(element) {
    const rect = element.getBoundingClientRect();
    return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
    };
}
/**
 * Check if coordinates are within viewport
 */
export function isInViewport(coords) {
    return (coords.x >= window.scrollX &&
        coords.y >= window.scrollY &&
        coords.x + coords.width <= window.scrollX + window.innerWidth &&
        coords.y + coords.height <= window.scrollY + window.innerHeight);
}
/**
 * Get current viewport size
 */
export function getViewportSize() {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}
//# sourceMappingURL=coord-map.js.map