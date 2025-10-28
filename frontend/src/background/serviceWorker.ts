// Background service worker for Cerberus extension
// Handles screenshot capture and communication with backend

import { analyzeScreenshot, dataURLToBase64, checkUrl } from '../common/api.js';
import { AnalysisRequest, BackendResponse, ExtensionMessage } from '../common/types.js';

// Screenshot configuration
const SCREENSHOT_CONFIG = {
  TARGET_WIDTH: 1280,
  TARGET_HEIGHT: 800,
  JPEG_QUALITY: 80,
  FORMAT: 'jpeg' as const
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'ANALYZE_PAGE') {
    handleAnalyzePage(sender.tab?.id).then(sendResponse).catch(error => {
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
 * Resize and convert screenshot to JPEG
 * Note: Uses createImageBitmap which works in service workers
 */
async function resizeAndConvertScreenshot(dataUrl: string): Promise<string> {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create ImageBitmap (works in service workers)
    const imageBitmap = await createImageBitmap(blob);

    // Create canvas with target dimensions
    const canvas = new OffscreenCanvas(
      SCREENSHOT_CONFIG.TARGET_WIDTH,
      SCREENSHOT_CONFIG.TARGET_HEIGHT
    );
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Calculate scaling to fit target dimensions while maintaining aspect ratio
    const scale = Math.min(
      SCREENSHOT_CONFIG.TARGET_WIDTH / imageBitmap.width,
      SCREENSHOT_CONFIG.TARGET_HEIGHT / imageBitmap.height
    );

    const scaledWidth = imageBitmap.width * scale;
    const scaledHeight = imageBitmap.height * scale;

    // Center the image on canvas
    const x = (SCREENSHOT_CONFIG.TARGET_WIDTH - scaledWidth) / 2;
    const y = (SCREENSHOT_CONFIG.TARGET_HEIGHT - scaledHeight) / 2;

    // Fill background (black letterboxing)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, SCREENSHOT_CONFIG.TARGET_WIDTH, SCREENSHOT_CONFIG.TARGET_HEIGHT);

    // Draw resized image
    ctx.drawImage(imageBitmap, x, y, scaledWidth, scaledHeight);

    // Convert to JPEG blob
    const jpegBlob = await canvas.convertToBlob({
      type: `image/${SCREENSHOT_CONFIG.FORMAT}`,
      quality: SCREENSHOT_CONFIG.JPEG_QUALITY / 100
    });

    // Convert blob to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(jpegBlob);
    });
  } catch (error) {
    console.error('[Cerberus] Failed to resize screenshot:', error);
    throw error;
  }
}

/**
 * Check if a URL can be analyzed
 */
function isAnalyzableUrl(url: string): boolean {
  if (!url) return false;

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
async function handleAnalyzePage(tabId: number | undefined): Promise<{ success: boolean; data?: BackendResponse; error?: string }> {
  if (!tabId) {
    return { success: false, error: 'No tab ID provided' };
  }

  const startTime = Date.now();

  try {
    // Get tab info first to check URL
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';
    const domain = new URL(url).hostname;

    console.log(`[Cerberus] 🔍 Starting analysis for: ${url}`);
    console.log(`[Cerberus] 📍 Domain: ${domain}`);

    // Check if URL can be analyzed
    if (!isAnalyzableUrl(url)) {
      console.warn(`[Cerberus] ⚠️ URL type not supported: ${url}`);
      return { success: false, error: 'Cannot analyze this URL type' };
    }

    // Step 1: Fast URL check (whitelist/blacklist) - BEFORE capturing screenshot
    console.log(`[Cerberus] ⚡ Checking URL against whitelist/blacklist...`);
    const urlCheckStart = Date.now();
    const urlCheckResult = await checkUrl(url, domain);
    const urlCheckTime = Date.now() - urlCheckStart;
    console.log(`[Cerberus] ✓ URL check completed in ${urlCheckTime}ms - Status: ${urlCheckResult.status}`);

    // If URL is already determined safe or dangerous, skip screenshot capture
    if (urlCheckResult.status === 'safe' || urlCheckResult.status === 'dangerous') {
      const totalTime = Date.now() - startTime;
      console.log(`[Cerberus] 🚀 FAST PATH - No screenshot needed!`);
      console.log(`[Cerberus] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[Cerberus] 🎯 VERDICT: ${urlCheckResult.status.toUpperCase()}`);
      console.log(`[Cerberus] 💡 REASON: ${urlCheckResult.reason}`);
      console.log(`[Cerberus] ⚡ Total time: ${totalTime}ms (screenshot capture skipped!)`);
      console.log(`[Cerberus] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Create a minimal response for safe/dangerous sites found in lists
      const fastPathResponse: BackendResponse = {
        verdict: urlCheckResult.status === 'safe' ? 'safe' : 'dangerous',
        confidence: 1.0, // High confidence for whitelist/blacklist matches
        reasons: [{
          code: urlCheckResult.in_whitelist ? 'whitelist' : 'blacklist',
          label: urlCheckResult.in_whitelist ? 'Trusted Domain' : 'Known Threat',
          detail: urlCheckResult.reason || 'Domain found in list'
        }],
        highlights: [],
        explanation: urlCheckResult.reason || 'Domain found in list',
        suggested_actions: urlCheckResult.status === 'safe' ? [
          { action: 'continue', label: 'Continue', description: 'This site appears to be legitimate' }
        ] : [
          { action: 'leave', label: 'Leave Site', description: 'Close this page immediately to protect your information' },
          { action: 'report', label: 'Report Phishing', description: 'Help others by reporting this suspicious site' }
        ],
        processing_time_ms: totalTime,
        timestamp: new Date().toISOString()
      };

      // Show overlay for dangerous sites
      if (urlCheckResult.status === 'dangerous') {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/inject-overlay.js']
          });

          await chrome.scripting.executeScript({
            target: { tabId },
            func: (response) => {
              if (typeof (window as any).cerberusCreateOverlay === 'function') {
                (window as any).cerberusCreateOverlay(response);
              }
            },
            args: [fastPathResponse]
          });
        } catch (error) {
          // Silently fail overlay injection
        }
      }

      // Update badge
      updateBadge(tabId, fastPathResponse.verdict);

      return { success: true, data: fastPathResponse };
    }

    // URL needs full analysis - proceed with screenshot capture
    console.log(`[Cerberus] 🔬 URL needs full analysis - capturing screenshot...`);

    // Step 2: Capture visible tab screenshot (PNG first)
    console.log(`[Cerberus] 📸 Capturing screenshot...`);
    const captureStart = Date.now();
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab({
      format: 'png'
    });
    console.log(`[Cerberus] ✓ Screenshot captured in ${Date.now() - captureStart}ms`);

    // Step 3: Resize and convert to JPEG
    console.log(`[Cerberus] 🖼️  Resizing to ${SCREENSHOT_CONFIG.TARGET_WIDTH}x${SCREENSHOT_CONFIG.TARGET_HEIGHT} and converting to JPEG (quality: ${SCREENSHOT_CONFIG.JPEG_QUALITY}%)...`);
    const resizeStart = Date.now();
    const resizedScreenshotDataUrl = await resizeAndConvertScreenshot(screenshotDataUrl as string);
    const resizeTime = Date.now() - resizeStart;

    // Calculate size reduction
    const originalSize = (screenshotDataUrl.length * 0.75 / 1024).toFixed(2); // rough base64 to KB
    const resizedSize = (resizedScreenshotDataUrl.length * 0.75 / 1024).toFixed(2);
    console.log(`[Cerberus] ✓ Image processed in ${resizeTime}ms (${originalSize}KB → ${resizedSize}KB, ${((1 - parseFloat(resizedSize) / parseFloat(originalSize)) * 100).toFixed(1)}% reduction)`);

    // Step 4: Convert to base64 (remove data URL prefix)
    const screenshot_base64 = dataURLToBase64(resizedScreenshotDataUrl);

    // Get viewport size by injecting a script
    const viewportSizeResult = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ width: window.innerWidth, height: window.innerHeight })
    });

    const viewport_size = viewportSizeResult[0]?.result || { width: 1920, height: 1080 };
    console.log(`[Cerberus] 📐 Viewport size: ${viewport_size.width}x${viewport_size.height}`);

    // Step 5: Prepare request payload
    const request: AnalysisRequest = {
      url,
      domain,
      screenshot_base64,
      viewport_size
    };

    // Step 6: Send to backend for LLM analysis
    console.log(`[Cerberus] 🤖 Sending to LLM for analysis...`);
    const llmStart = Date.now();
    const backendResponse = await analyzeScreenshot(request);
    const llmTime = Date.now() - llmStart;

    console.log(`[Cerberus] ✓ LLM analysis completed in ${llmTime}ms`);
    console.log(`[Cerberus] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[Cerberus] 🎯 VERDICT: ${backendResponse.verdict.toUpperCase()}`);
    console.log(`[Cerberus] 📊 CONFIDENCE: ${(backendResponse.confidence * 100).toFixed(1)}%`);
    console.log(`[Cerberus] 💡 EXPLANATION: ${backendResponse.explanation}`);

    if (backendResponse.reasons && backendResponse.reasons.length > 0) {
      console.log(`[Cerberus] 📋 REASONS:`);
      backendResponse.reasons.forEach((reason, index) => {
        console.log(`[Cerberus]    ${index + 1}. [${reason.code}] ${reason.label}: ${reason.detail}`);
      });
    }

    if (backendResponse.processing_time_ms) {
      console.log(`[Cerberus] ⏱️  Backend processing time: ${backendResponse.processing_time_ms}ms`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Cerberus] ⚡ Total analysis time: ${totalTime}ms`);
    console.log(`[Cerberus] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Step 7: Inject overlay if dangerous or suspicious
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
        // Silently fail overlay injection
      }
    }

    // Update badge based on verdict
    updateBadge(tabId, backendResponse.verdict);

    return { success: true, data: backendResponse };
  } catch (error: any) {
    const errorTime = Date.now() - startTime;
    console.error(`[Cerberus] ❌ Analysis failed after ${errorTime}ms`);
    console.error(`[Cerberus] Error: ${error.message}`);
    if (error.stack) {
      console.error(`[Cerberus] Stack trace:`, error.stack);
    }
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
      if (tabId) {
        chrome.tabs.remove(tabId);
      }
      break;

    case 'report':
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
      // User chose to continue
      break;

    default:
      break;
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

// Listen for extension icon clicks to trigger manual analysis
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    console.log('[Cerberus] Manual analysis triggered via icon click');
    handleAnalyzePage(tab.id);
  }
});

// Auto-analyze pages on load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if URL is analyzable
    if (isAnalyzableUrl(tab.url)) {
      console.log(`[Cerberus] 🔄 Auto-analysis triggered for: ${tab.url}`);
      // Wait a bit for page to fully render before capturing screenshot
      setTimeout(() => {
        handleAnalyzePage(tabId);
      }, 1500); // 1.5 second delay for page to render
    } else {
      console.log(`[Cerberus] ⏭️  Skipping auto-analysis for: ${tab.url}`);
    }
  }
});

console.log('[Cerberus] Background service worker initialized with auto-analysis enabled');
