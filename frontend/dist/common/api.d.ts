import { AnalysisRequest, BackendResponse, ClientInfo, CheckUrlResponse } from './types';
/**
 * Generate or retrieve client ID for rate limiting and telemetry
 */
export declare function getClientInfo(): Promise<ClientInfo>;
/**
 * Check URL against whitelist/blacklist before full analysis
 */
export declare function checkUrl(url: string, domain: string): Promise<CheckUrlResponse>;
/**
 * Send analysis request to backend
 */
export declare function analyzeScreenshot(request: AnalysisRequest): Promise<BackendResponse>;
/**
 * Convert dataURL to base64 string (remove data:image/png;base64, prefix)
 */
export declare function dataURLToBase64(dataURL: string): string;
//# sourceMappingURL=api.d.ts.map