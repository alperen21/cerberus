export interface ViewportCoords {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Map backend coordinates to viewport coordinates
 * Accounts for device pixel ratio and scroll offsets
 */
export declare function mapCoordsToViewport(coords: ViewportCoords, scrollX?: number, scrollY?: number): ViewportCoords;
/**
 * Get element bounding rectangle relative to viewport
 */
export declare function getElementViewportRect(element: Element): ViewportCoords;
/**
 * Check if coordinates are within viewport
 */
export declare function isInViewport(coords: ViewportCoords): boolean;
/**
 * Get current viewport size
 */
export declare function getViewportSize(): {
    width: number;
    height: number;
};
//# sourceMappingURL=coord-map.d.ts.map