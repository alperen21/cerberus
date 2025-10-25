// Content script for Cerberus extension
// Runs on every page and handles overlay rendering
import { createOverlay, removeOverlay } from './overlay/overlay';
// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYSIS_RESULT') {
        handleAnalysisResult(message.payload);
        sendResponse({ success: true });
        return false;
    }
    if (message.type === 'SHOW_OVERLAY') {
        createOverlay(message.payload);
        sendResponse({ success: true });
        return false;
    }
    if (message.type === 'HIDE_OVERLAY') {
        removeOverlay();
        sendResponse({ success: true });
        return false;
    }
    return false;
});
/**
 * Handle analysis result from backend
 */
function handleAnalysisResult(response) {
    console.log('Received analysis result:', response);
    // Determine if we should show overlay based on verdict and confidence
    const shouldShowOverlay = shouldDisplayOverlay(response);
    if (shouldShowOverlay) {
        createOverlay(response);
    }
    else {
        // Just show a passive indicator (handled by background badge)
        console.log('Page is safe, no overlay needed');
    }
}
/**
 * Determine if overlay should be displayed
 */
function shouldDisplayOverlay(response) {
    const { verdict, confidence } = response;
    // Show blocking overlay for dangerous sites with high confidence
    if (verdict === 'dangerous' && confidence >= 0.85) {
        return true;
    }
    // Show warning overlay for suspicious sites
    if (verdict === 'suspicious' && confidence >= 0.7) {
        return true;
    }
    // Don't show overlay for safe sites
    return false;
}
/**
 * Trigger analysis manually (can be called from popup or keyboard shortcut)
 */
export function triggerAnalysis() {
    chrome.runtime.sendMessage({ type: 'ANALYZE_PAGE' }, (response) => {
        if (response?.error) {
            console.error('Analysis error:', response.error);
        }
    });
}
// Auto-trigger analysis on page load (if enabled)
window.addEventListener('load', () => {
    chrome.storage.local.get('autoAnalyze', (result) => {
        if (result.autoAnalyze !== false) {
            // Trigger analysis after a short delay
            setTimeout(() => {
                triggerAnalysis();
            }, 500);
        }
    });
});
console.log('Cerberus content script initialized');
//# sourceMappingURL=contentScript.js.map