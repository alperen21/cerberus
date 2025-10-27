// DOM mapping utilities for finding elements and creating highlights

import { Highlight } from '../common/types';
import { getElementViewportRect, mapCoordsToViewport, ViewportCoords } from '../common/coord-map';

/**
 * Find element using CSS selector
 */
export function findElementBySelector(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.error('Invalid selector:', selector, error);
    return null;
  }
}

/**
 * Get coordinates for a highlight
 * Returns either selector-based or coordinate-based position
 */
export function getHighlightCoords(highlight: Highlight): ViewportCoords | null {
  // Prefer selector-based approach (more resilient to layout shifts)
  if (highlight.selector) {
    const element = findElementBySelector(highlight.selector);
    if (element) {
      return getElementViewportRect(element);
    }
  }

  // Fallback to coordinate-based approach
  if (highlight.coords) {
    return mapCoordsToViewport(highlight.coords);
  }

  return null;
}

/**
 * Create a highlight box element for an element or coordinates
 */
export function createHighlightBox(
  highlight: Highlight,
  coords: ViewportCoords,
  onClick?: (highlight: Highlight) => void
): HTMLDivElement {
  const box = document.createElement('div');
  box.className = 'cerberus-highlight-box';
  box.dataset.highlightId = highlight.id;
  box.dataset.highlightType = highlight.type;

  // Position the box
  box.style.position = 'absolute';
  box.style.left = `${coords.x}px`;
  box.style.top = `${coords.y}px`;
  box.style.width = `${coords.width}px`;
  box.style.height = `${coords.height}px`;

  // Add click handler
  if (onClick) {
    box.addEventListener('click', () => onClick(highlight));
  }

  // Add hover effect
  box.addEventListener('mouseenter', () => {
    box.classList.add('cerberus-highlight-hover');
  });

  box.addEventListener('mouseleave', () => {
    box.classList.remove('cerberus-highlight-hover');
  });

  return box;
}

/**
 * Create a numbered badge for a highlight
 */
export function createHighlightBadge(number: number): HTMLDivElement {
  const badge = document.createElement('div');
  badge.className = 'cerberus-highlight-badge';
  badge.textContent = number.toString();
  return badge;
}

/**
 * Attach outline to an element (alternative to highlight box)
 */
export function attachOutlineToElement(element: Element, color: string = '#ef4444'): void {
  (element as HTMLElement).style.outline = `2px solid ${color}`;
  (element as HTMLElement).style.outlineOffset = '2px';
  (element as HTMLElement).classList.add('cerberus-outlined-element');
}

/**
 * Remove outline from an element
 */
export function removeOutlineFromElement(element: Element): void {
  (element as HTMLElement).style.outline = '';
  (element as HTMLElement).style.outlineOffset = '';
  (element as HTMLElement).classList.remove('cerberus-outlined-element');
}

/**
 * Scroll element into view smoothly
 */
export function scrollToElement(element: Element): void {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}

/**
 * Scroll to coordinates
 */
export function scrollToCoords(coords: ViewportCoords): void {
  window.scrollTo({
    left: coords.x - window.innerWidth / 2,
    top: coords.y - window.innerHeight / 2,
    behavior: 'smooth'
  });
}
