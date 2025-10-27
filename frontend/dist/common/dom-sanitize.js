// DOM sanitization utilities to prevent XSS attacks
/**
 * Sanitize HTML string to prevent XSS attacks
 * Removes dangerous tags and attributes while preserving safe formatting
 */
export function sanitizeHTML(html) {
    // Create a temporary DOM element
    const temp = document.createElement('div');
    temp.textContent = html;
    // List of allowed tags
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div'];
    // Parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Remove script tags and event handlers
    removeDisallowedElements(doc.body, allowedTags);
    removeEventHandlers(doc.body);
    return doc.body.innerHTML;
}
/**
 * Remove elements that are not in the allowed list
 */
function removeDisallowedElements(element, allowedTags) {
    const children = Array.from(element.children);
    for (const child of children) {
        if (!allowedTags.includes(child.tagName.toLowerCase())) {
            // Replace disallowed element with its text content
            const textNode = document.createTextNode(child.textContent || '');
            child.replaceWith(textNode);
        }
        else {
            // Recursively check children
            removeDisallowedElements(child, allowedTags);
        }
    }
}
/**
 * Remove all event handler attributes from elements
 */
function removeEventHandlers(element) {
    // Remove inline event handlers
    const attributes = Array.from(element.attributes);
    for (const attr of attributes) {
        if (attr.name.startsWith('on')) {
            element.removeAttribute(attr.name);
        }
    }
    // Recursively check children
    for (const child of Array.from(element.children)) {
        removeEventHandlers(child);
    }
}
/**
 * Escape HTML special characters
 */
export function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
/**
 * Safely set innerHTML with sanitization
 */
export function safeSetInnerHTML(element, html) {
    element.innerHTML = sanitizeHTML(html);
}
//# sourceMappingURL=dom-sanitize.js.map