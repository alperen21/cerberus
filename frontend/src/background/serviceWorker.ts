// Background service worker for Cerberus extension
// Handles screenshot capture and communication with backend

import { analyzeScreenshot, dataURLToBase64 } from '../common/api';
import { AnalysisRequest, BackendResponse, ExtensionMessage } from '../common/types';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'ANALYZE_PAGE') {
    handleAnalyzePage(sender.tab?.id).then(sendResponse).catch(error => {
      console.error('Error in handleAnalyzePage:', error);
      sendResponse({ error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'USER_ACTION') {
    handleUserAction(message.payload);
  }

  return false;
});

/**
 * Handle page analysis request
 */
async function handleAnalyzePage(tabId: number | undefined): Promise<{ success: boolean; data?: BackendResponse; error?: string }> {
  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  try {
    // Step 1: Capture visible tab screenshot
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab({
      format: 'png'
    });

    // Get tab info
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';
    const domain = new URL(url).hostname;

    // Step 2: Convert to base64 (remove data URL prefix)
    const screenshot_base64 = dataURLToBase64(screenshotDataUrl as string);

    // Get viewport size by injecting a script
    const viewportSizeResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ width: window.innerWidth, height: window.innerHeight })
    });

    const viewport_size = viewportSizeResult[0]?.result || { width: 1920, height: 1080 };

    // Step 3: Prepare request payload
    const request: AnalysisRequest = {
      url,
      domain,
      screenshot_base64,
      viewport_size
    };

    // Step 4: Send to backend
    const backendResponse = await analyzeScreenshot(request);

    // Step 5: Inject overlay if dangerous or suspicious
    if (backendResponse.verdict === 'dangerous' || backendResponse.verdict === 'suspicious') {
      try {
        // Inject the overlay script (non-module version)
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/inject-overlay.js']
        });

        // Call the overlay creation function
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (response) => {
            if (typeof (window as any).cerberusCreateOverlay === 'function') {
              (window as any).cerberusCreateOverlay(response);
            }
          },
          args: [backendResponse]
        });
      } catch (error) {
        console.error('Error injecting overlay:', error);
      }
    }

    // Update badge based on verdict
    updateBadge(tabId, backendResponse.verdict);

    console.log('Analysis complete:', backendResponse);

    return { success: true, data: backendResponse };
  } catch (error: any) {
    console.error('Error analyzing page:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle user actions (leave, report, etc.)
 */
function handleUserAction(payload: any): void {
  const { action, tabId } = payload;

  switch (action) {
    case 'leave':
      // Close the tab
      if (tabId) {
        chrome.tabs.remove(tabId);
      }
      break;

    case 'report':
      // Send telemetry (implement as needed)
      console.log('User reported suspicious page:', payload);
      chrome.storage.local.get('reports', (result) => {
        const reports = result.reports || [];
        reports.push({
          timestamp: Date.now(),
          url: payload.url,
          verdict: payload.verdict
        });
        chrome.storage.local.set({ reports });
      });
      break;

    case 'continue':
      // User chose to continue despite warning
      console.log('User continued to suspicious page:', payload);
      break;

    default:
      console.warn('Unknown action:', action);
  }
}

/**
 * Update extension badge based on verdict
 */
function updateBadge(tabId: number, verdict: string): void {
  let color: chrome.action.BadgeBackgroundColorDetails['color'];
  let text: string;

  switch (verdict) {
    case 'safe':
      color = '#22c55e'; // Green
      text = '✓';
      break;
    case 'suspicious':
      color = '#f59e0b'; // Amber
      text = '!';
      break;
    case 'dangerous':
      color = '#ef4444'; // Red
      text = '✕';
      break;
    default:
      color = '#6b7280'; // Gray
      text = '?';
  }

  chrome.action.setBadgeBackgroundColor({ color, tabId });
  chrome.action.setBadgeText({ text, tabId });
}

// Listen for extension icon clicks to trigger analysis
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    handleAnalyzePage(tab.id);
  }
});

// Auto-analyze pages on load (disabled by default - requires user interaction first)
// Uncomment this code if you want auto-analysis after implementing declarativeContent API
/*
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if auto-analysis is enabled
    chrome.storage.local.get('autoAnalyze', (result) => {
      if (result.autoAnalyze !== false) { // Default to true
        // Wait a bit for page to fully render
        setTimeout(() => {
          handleAnalyzePage(tabId);
        }, 1000);
      }
    });
  }
});
*/

console.log('Cerberus background service worker initialized');
