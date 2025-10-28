// TypeScript types for the Cerberus Chrome Extension

export type Verdict = 'safe' | 'suspicious' | 'dangerous';

export interface Reason {
  code: string;
  label: string;
  detail: string;
}

export interface Highlight {
  id: string;
  type: string;
  selector?: string;
  coords?: { x: number; y: number; width: number; height: number };
  crop_base64?: string;
}

export interface BackendResponse {
  verdict: Verdict;
  confidence: number;
  reasons: Reason[];
  highlights: Highlight[];
  explanation: string;
  explanation_html?: string;
  suggested_actions: SuggestedAction[];
  processing_time_ms?: number;
  timestamp?: string;
}

export interface SuggestedAction {
  action: 'leave' | 'report' | 'continue' | 'block';
  label: string;
  description?: string;
}

export interface AnalysisRequest {
  url: string;
  domain: string;
  screenshot_base64: string;
  css_selector?: string;
  viewport_size?: { width: number; height: number };
  user_event?: string;
}

export interface CheckUrlRequest {
  url: string;
  domain: string;
}

export interface CheckUrlResponse {
  status: 'safe' | 'dangerous' | 'needs_analysis';
  reason?: string;
  in_whitelist: boolean;
  in_blacklist: boolean;
}

export interface ExtensionMessage {
  type: 'ANALYZE_PAGE' | 'ANALYSIS_RESULT' | 'SHOW_OVERLAY' | 'HIDE_OVERLAY' | 'USER_ACTION';
  payload?: any;
}

export interface OverlayConfig {
  verdict: Verdict;
  confidence: number;
  reasons: Reason[];
  highlights: Highlight[];
  explanation: string;
  explanation_html?: string;
  suggested_actions: SuggestedAction[];
}

export interface ClientInfo {
  clientId: string;
  extensionVersion: string;
}
