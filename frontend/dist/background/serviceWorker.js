(function () {
    'use strict';

    // API utilities for communicating with the backend
    const BACKEND_URL = 'http://localhost:8000';
    const API_ENDPOINT = `${BACKEND_URL}/api/analyze`;
    /**
     * Generate or retrieve client ID for rate limiting and telemetry
     */
    async function getClientInfo() {
        const manifest = chrome.runtime.getManifest();
        // Try to get existing client ID from storage
        const result = await chrome.storage.local.get('clientId');
        let clientId = result.clientId;
        // Generate new client ID if it doesn't exist
        if (!clientId) {
            clientId = generateClientId();
            await chrome.storage.local.set({ clientId });
        }
        return {
            clientId,
            extensionVersion: manifest.version
        };
    }
    /**
     * Generate a unique client ID
     */
    function generateClientId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Send analysis request to backend
     */
    async function analyzeScreenshot(request) {
        const clientInfo = await getClientInfo();
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-ID': clientInfo.clientId,
                    'X-Extension-Version': clientInfo.extensionVersion
                },
                body: JSON.stringify(request)
            });
            if (!response.ok) {
                throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            console.error('Error analyzing screenshot:', error);
            throw error;
        }
    }
    /**
     * Convert dataURL to base64 string (remove data:image/png;base64, prefix)
     */
    function dataURLToBase64(dataURL) {
        const parts = dataURL.split(',');
        return parts.length > 1 ? parts[1] : dataURL;
    }

    // Background service worker for Cerberus extension
    // Handles screenshot capture and communication with backend
    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
     * Check if a URL can be analyzed
     */
    function isAnalyzableUrl(url) {
        if (!url)
            return false;
        // Blocked URL patterns
        const blockedPrefixes = [
            'chrome://',
            'chrome-extension://',
            'edge://',
            'about:',
            'file://',
            'view-source:',
            'devtools://',
            'brave://'
        ];
        return !blockedPrefixes.some(prefix => url.startsWith(prefix));
    }
    /**
     * Handle page analysis request
     */
    async function handleAnalyzePage(tabId) {
        if (!tabId) {
            return { success: false, error: 'No tab ID provided' };
        }
        try {
            // Get tab info first to check URL
            const tab = await chrome.tabs.get(tabId);
            const url = tab.url || '';
            // Check if URL can be analyzed
            if (!isAnalyzableUrl(url)) {
                console.log('Skipping analysis for restricted URL:', url);
                return { success: false, error: 'Cannot analyze this URL type' };
            }
            // Step 1: Capture visible tab screenshot
            const screenshotDataUrl = await chrome.tabs.captureVisibleTab({
                format: 'png'
            });
            const domain = new URL(url).hostname;
            // Step 2: Convert to base64 (remove data URL prefix)
            const screenshot_base64 = dataURLToBase64(screenshotDataUrl);
            // Get viewport size by injecting a script
            const viewportSizeResult = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => ({ width: window.innerWidth, height: window.innerHeight })
            });
            const viewport_size = viewportSizeResult[0]?.result || { width: 1920, height: 1080 };
            // Step 3: Prepare request payload
            const request = {
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
                            if (typeof window.cerberusCreateOverlay === 'function') {
                                window.cerberusCreateOverlay(response);
                            }
                        },
                        args: [backendResponse]
                    });
                }
                catch (error) {
                    console.error('Error injecting overlay:', error);
                }
            }
            // Update badge based on verdict
            updateBadge(tabId, backendResponse.verdict);
            console.log('Analysis complete:', backendResponse);
            return { success: true, data: backendResponse };
        }
        catch (error) {
            console.error('Error analyzing page:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Handle user actions (leave, report, etc.)
     */
    function handleUserAction(payload) {
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
    function updateBadge(tabId, verdict) {
        let color;
        let text;
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

})();
//# sourceMappingURL=serviceWorker.js.map
