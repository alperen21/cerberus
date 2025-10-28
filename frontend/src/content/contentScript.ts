// Content script for Cerberus extension
// Runs on every page and handles overlay rendering

import { ExtensionMessage, BackendResponse } from '../common/types';
import { createOverlay, removeOverlay } from './overlay/overlay';

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'ANALYSIS_RESULT') {
    handleAnalysisResult(message.payload as BackendResponse);
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
function handleAnalysisResult(response: BackendResponse): void {
  // Determine if we should show overlay based on verdict and confidence
  const shouldShowOverlay = shouldDisplayOverlay(response);

  if (shouldShowOverlay) {
    createOverlay(response);
  }
}

/**
 * Determine if overlay should be displayed
 */
function shouldDisplayOverlay(response: BackendResponse): boolean {
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
export function triggerAnalysis(): void {
  chrome.runtime.sendMessage({ type: 'ANALYZE_PAGE' });
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

console.log('[Cerberus] Content script initialized');
