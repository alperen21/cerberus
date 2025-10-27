/**
 * Sanitize HTML string to prevent XSS attacks
 * Removes dangerous tags and attributes while preserving safe formatting
 */
export declare function sanitizeHTML(html: string): string;
/**
 * Escape HTML special characters
 */
export declare function escapeHTML(text: string): string;
/**
 * Safely set innerHTML with sanitization
 */
export declare function safeSetInnerHTML(element: HTMLElement, html: string): void;
//# sourceMappingURL=dom-sanitize.d.ts.map