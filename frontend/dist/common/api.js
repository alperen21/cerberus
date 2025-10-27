// API utilities for communicating with the backend
const BACKEND_URL = 'http://localhost:8000';
const API_ENDPOINT = `${BACKEND_URL}/api/analyze`;
/**
 * Generate or retrieve client ID for rate limiting and telemetry
 */
export async function getClientInfo() {
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
export async function analyzeScreenshot(request) {
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
export function dataURLToBase64(dataURL) {
    const parts = dataURL.split(',');
    return parts.length > 1 ? parts[1] : dataURL;
}
//# sourceMappingURL=api.js.map