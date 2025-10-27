# Cerberus Frontend - Chrome Extension

AI-powered phishing detection and protection Chrome extension.

## Features

- **Automated Page Analysis**: Automatically analyzes web pages for phishing indicators
- **Real-time Warnings**: Displays overlay warnings for suspicious or dangerous sites
- **Visual Highlights**: Highlights suspicious elements on the page with detailed explanations
- **Confidence Scoring**: Shows confidence levels for each detection
- **Customizable Settings**: Configure auto-analysis, confidence thresholds, and more
- **Action Suggestions**: Provides recommended actions (leave, report, continue)

## Architecture

The extension follows the Manifest V3 architecture with:

- **Background Service Worker** (`src/background/serviceWorker.ts`): Handles screenshot capture and backend communication
- **Content Script** (`src/content/contentScript.ts`): Injects overlays and handles DOM interactions
- **Popup** (`src/popup/`): Extension popup UI for quick analysis and status
- **Options Page** (`src/options/`): Settings and configuration interface

## File Structure

```
frontend/
├── manifest.json                # Extension manifest (MV3)
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript configuration
├── src/
│   ├── background/
│   │   └── serviceWorker.ts    # Background service worker
│   ├── content/
│   │   ├── contentScript.ts    # Main content script
│   │   ├── dom-mappers.ts      # DOM manipulation utilities
│   │   └── overlay/
│   │       ├── overlay.ts      # Overlay component logic
│   │       ├── overlay.css     # Overlay styles
│   │       └── overlay-utils.ts # Overlay utilities
│   ├── popup/
│   │   ├── Popup.tsx          # Popup React component
│   │   ├── popup.css          # Popup styles
│   │   ├── index.tsx          # Popup entry point
│   │   └── index.html         # Popup HTML
│   ├── options/
│   │   ├── Options.tsx        # Options React component
│   │   └── Options.html       # Options HTML
│   └── common/
│       ├── types.ts           # TypeScript types
│       ├── api.ts             # API utilities
│       ├── coord-map.ts       # Coordinate mapping
│       └── dom-sanitize.ts    # HTML sanitization
├── public/
│   └── icon-*.png             # Extension icons
└── scripts/
    └── build-and-pack.sh      # Build and packaging script
```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm
- Chrome browser

### Installation

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Build the extension**:
   ```bash
   npm run build
   ```

   Or use the build script:
   ```bash
   ./scripts/build-and-pack.sh
   ```

3. **Load in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

### Development

For development with auto-recompilation:

```bash
npm run watch
```

This will watch for TypeScript changes and recompile automatically.

## Backend Configuration

The extension communicates with a backend analysis server. By default, it expects the backend at:

```
http://localhost:8000
```

You can change this in the extension's Options page or by modifying the `BACKEND_URL` in `src/common/api.ts`.

## How It Works

### 1. Page Analysis Workflow

1. **Trigger**: Page loads or user clicks "Analyze" button
2. **Screenshot**: Background worker captures visible viewport using `chrome.tabs.captureVisibleTab`
3. **API Request**: Screenshot + metadata sent to backend via POST request
4. **Response Processing**: Backend returns verdict, confidence, reasons, and highlights
5. **Overlay Display**: Content script renders overlay with results
6. **Highlight Rendering**: Suspicious elements are highlighted on the page

### 2. Communication Flow

```
Content Script → Background Worker → Backend API
                       ↓
                  Response
                       ↓
Background Worker → Content Script → Overlay Display
```

### 3. Overlay Components

- **Top Badge**: Small icon showing safe/unsafe status
- **Main Panel**: Detailed information with reasons and explanations
- **Highlight Boxes**: Visual indicators on suspicious page elements
- **Magnifier**: Zoomed view of flagged elements
- **Action Buttons**: Suggested actions (leave, report, continue)

## API Request Format

```typescript
{
  url: string;              // Page URL
  domain: string;           // Domain name
  screenshot_base64: string; // Base64 encoded screenshot
  viewport_size?: {         // Optional viewport dimensions
    width: number;
    height: number;
  };
  css_selector?: string;    // Optional specific element selector
  user_event?: string;      // Optional user action context
}
```

## API Response Format

```typescript
{
  verdict: 'safe' | 'suspicious' | 'dangerous';
  confidence: number;       // 0-1 confidence score
  reasons: Array<{
    code: string;          // Reason code
    label: string;         // Human-readable label
    detail: string;        // Detailed explanation
  }>;
  highlights: Array<{
    id: string;
    type: string;
    selector?: string;     // CSS selector for element
    coords?: {            // Fallback coordinates
      x: number;
      y: number;
      width: number;
      height: number;
    };
    crop_base64?: string; // Cropped image of element
  }>;
  explanation: string;
  explanation_html?: string; // Optional HTML explanation
  suggested_actions: Array<{
    action: 'leave' | 'report' | 'continue' | 'block';
    label: string;
    description?: string;
  }>;
}
```

## Configuration Options

Access via Options page:

- **Auto-analyze pages**: Automatically analyze pages on load
- **Confidence threshold**: Minimum confidence to show warnings (50-100%)
- **Show notifications**: Enable browser notifications
- **Backend URL**: Custom backend server URL

## Security Features

- **Shadow DOM Isolation**: Overlay CSS isolated from page styles
- **HTML Sanitization**: All backend HTML sanitized to prevent XSS
- **Minimal Permissions**: Only requests necessary permissions
- **Client ID**: Unique client ID for rate limiting (no personal data)

## Permissions Required

- `scripting`: Inject content scripts
- `activeTab`: Access active tab
- `tabs`: Tab management and screenshot capture
- `storage`: Store settings and analysis history
- `notifications`: Show alerts
- `host_permissions`: Access backend API and analyze pages

## Troubleshooting

### Extension not loading
- Ensure all dependencies are installed (`npm install`)
- Check that build completed successfully
- Verify manifest.json is in the dist folder

### Analysis not working
- Check backend is running and accessible
- Verify backend URL in Options page
- Check browser console for errors (F12)
- Ensure required permissions are granted

### Overlay not showing
- Check confidence threshold in settings
- Verify page is not on an internal Chrome page (extensions can't run on chrome://)
- Check console for errors in content script

## Building for Production

To create a production build:

```bash
npm run build
npm run pack
```

This creates a `cerberus-extension.zip` file ready for Chrome Web Store submission.

## Browser Compatibility

- Chrome 88+ (Manifest V3 support)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers with MV3 support

## License

See main project LICENSE file.

## Support

For issues or questions, please open an issue in the main repository.
