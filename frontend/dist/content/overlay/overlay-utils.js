// Utility functions for overlay rendering
/**
 * Get color scheme based on verdict
 */
export function getVerdictColors(verdict) {
    switch (verdict) {
        case 'safe':
            return {
                primary: '#22c55e',
                background: '#f0fdf4',
                text: '#166534',
                border: '#86efac'
            };
        case 'suspicious':
            return {
                primary: '#f59e0b',
                background: '#fffbeb',
                text: '#92400e',
                border: '#fcd34d'
            };
        case 'dangerous':
            return {
                primary: '#ef4444',
                background: '#fef2f2',
                text: '#991b1b',
                border: '#fca5a5'
            };
        default:
            return {
                primary: '#6b7280',
                background: '#f9fafb',
                text: '#374151',
                border: '#d1d5db'
            };
    }
}
/**
 * Get verdict label
 */
export function getVerdictLabel(verdict) {
    switch (verdict) {
        case 'safe':
            return 'Safe';
        case 'suspicious':
            return 'Suspicious';
        case 'dangerous':
            return 'Dangerous';
        default:
            return 'Unknown';
    }
}
/**
 * Get verdict icon
 */
export function getVerdictIcon(verdict) {
    switch (verdict) {
        case 'safe':
            return '✓';
        case 'suspicious':
            return '⚠';
        case 'dangerous':
            return '✕';
        default:
            return '?';
    }
}
/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence) {
    return `${Math.round(confidence * 100)}%`;
}
/**
 * Create a progress bar element
 */
export function createProgressBar(confidence, color) {
    const container = document.createElement('div');
    container.className = 'cerberus-progress-container';
    const bar = document.createElement('div');
    bar.className = 'cerberus-progress-bar';
    bar.style.width = `${confidence * 100}%`;
    bar.style.backgroundColor = color;
    container.appendChild(bar);
    return container;
}
/**
 * Create icon element
 */
export function createIcon(iconName) {
    const icon = document.createElement('span');
    icon.className = 'cerberus-icon';
    icon.textContent = iconName;
    return icon;
}
/**
 * Debounce function for resize events
 */
export function debounce(func, wait) {
    let timeout = null;
    return function (...args) {
        if (timeout)
            clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
/**
 * Check if element is visible in viewport
 */
export function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth);
}
/**
 * Create a backdrop overlay
 */
export function createBackdrop(opacity = 0.5) {
    const backdrop = document.createElement('div');
    backdrop.className = 'cerberus-backdrop';
    backdrop.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
    return backdrop;
}
//# sourceMappingURL=overlay-utils.js.map