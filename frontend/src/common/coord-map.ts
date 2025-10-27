// Coordinate mapping utilities for device pixel ratio and scroll offsets

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
export function mapCoordsToViewport(
  coords: ViewportCoords,
  scrollX: number = window.scrollX,
  scrollY: number = window.scrollY
): ViewportCoords {
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
export function getElementViewportRect(element: Element): ViewportCoords {
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
export function isInViewport(coords: ViewportCoords): boolean {
  return (
    coords.x >= window.scrollX &&
    coords.y >= window.scrollY &&
    coords.x + coords.width <= window.scrollX + window.innerWidth &&
    coords.y + coords.height <= window.scrollY + window.innerHeight
  );
}

/**
 * Get current viewport size
 */
export function getViewportSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}
