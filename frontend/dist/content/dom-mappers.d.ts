import { Highlight } from '../common/types';
import { ViewportCoords } from '../common/coord-map';
/**
 * Find element using CSS selector
 */
export declare function findElementBySelector(selector: string): Element | null;
/**
 * Get coordinates for a highlight
 * Returns either selector-based or coordinate-based position
 */
export declare function getHighlightCoords(highlight: Highlight): ViewportCoords | null;
/**
 * Create a highlight box element for an element or coordinates
 */
export declare function createHighlightBox(highlight: Highlight, coords: ViewportCoords, onClick?: (highlight: Highlight) => void): HTMLDivElement;
/**
 * Create a numbered badge for a highlight
 */
export declare function createHighlightBadge(number: number): HTMLDivElement;
/**
 * Attach outline to an element (alternative to highlight box)
 */
export declare function attachOutlineToElement(element: Element, color?: string): void;
/**
 * Remove outline from an element
 */
export declare function removeOutlineFromElement(element: Element): void;
/**
 * Scroll element into view smoothly
 */
export declare function scrollToElement(element: Element): void;
/**
 * Scroll to coordinates
 */
export declare function scrollToCoords(coords: ViewportCoords): void;
//# sourceMappingURL=dom-mappers.d.ts.map