import { Verdict } from '../../common/types';
/**
 * Get color scheme based on verdict
 */
export declare function getVerdictColors(verdict: Verdict): {
    primary: string;
    background: string;
    text: string;
    border: string;
};
/**
 * Get verdict label
 */
export declare function getVerdictLabel(verdict: Verdict): string;
/**
 * Get verdict icon
 */
export declare function getVerdictIcon(verdict: Verdict): string;
/**
 * Format confidence as percentage
 */
export declare function formatConfidence(confidence: number): string;
/**
 * Create a progress bar element
 */
export declare function createProgressBar(confidence: number, color: string): HTMLDivElement;
/**
 * Create icon element
 */
export declare function createIcon(iconName: string): HTMLSpanElement;
/**
 * Debounce function for resize events
 */
export declare function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Check if element is visible in viewport
 */
export declare function isElementInViewport(element: HTMLElement): boolean;
/**
 * Create a backdrop overlay
 */
export declare function createBackdrop(opacity?: number): HTMLDivElement;
//# sourceMappingURL=overlay-utils.d.ts.map