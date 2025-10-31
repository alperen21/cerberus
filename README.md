# Cerberus - AI-Powered Phishing Shield

A Chrome extension that uses multi-layered AI-powered detection to identify and protect users from phishing websites in real-time, with a focus on protecting login attempts before credentials are entered.

## Overview

Cerberus is an enterprise-grade phishing detection system that combines Chrome extension technology with a FastAPI backend and advanced AI/LLM integration for real-time threat detection. The system analyzes web pages using screenshot analysis, domain verification, and LLM-based brand identification to detect phishing attempts.

## Technology Stack

### Frontend
- **TypeScript** with Rollup bundler
- **Chrome Extension (Manifest V3)**
- Chrome APIs: tabs, scripting, storage, notifications

### Backend
- **Python 3.13** with FastAPI + Uvicorn
- **AI/LLM Integration:**
  - Gemini (Google Generative AI)
  - Ollama (local LLM)
  - LangChain, LangGraph, LangSmith
- **Database/APIs:**
  - Google Cloud BigQuery (CrUX data)
  - Google Cloud Vision/Generative AI APIs
- **Data Processing:** BeautifulSoup4, Pillow

## Key Features

### 5-Layer Defense System

1. **Layer 1: Global Whitelist Check** (<50ms)
   - Pre-approved trusted domains (Google, Amazon, Microsoft, etc.)
   - Dynamic whitelist from Google CrUX API (high-reputation domains)
   - User-added trusted domains

2. **Layer 2: Blacklist Check** (<50ms)
   - Known phishing domains from threat feeds (OpenPhish)

3. **Layer 3: User Cache Check** (<100ms)
   - Frequently visited sites (≥10 visits in 20 days)
   - Personalized trusted domains

4. **Layer 4: Client-Side AI Analysis** (500ms-1.5s)
   - Partial screenshot capture
   - HTML content analysis
   - Uses Chrome's Prompt API with Gemini Nano (when available)

5. **Layer 5: Server-Side AI Analysis** (2-5s)
   - Full page screenshot + complete HTML
   - Domain metadata (WHOIS, SSL cert, age)
   - External threat intelligence APIs
   - LLM-based brand identification and domain matching

### Real-Time Protection

- Automatic page analysis on load
- Login detection (password fields, username fields, login buttons, form submission)
- Verdict classifications: Safe, Suspicious, or Dangerous
- Confidence scoring (0-1)
- Detailed reasons and explanations
- Visual highlights of suspicious elements
- Suggested actions (leave, report, continue, block)

### Visual Feedback

- **Extension icon color indicators:**
  - Green: Trusted site
  - Yellow: Under review/suspicious
  - Red: Phishing detected
- **Overlay panel** with detailed analysis
- **Highlight boxes** on suspicious elements
- **Magnified views** of flagged content

## Project Structure

```
cerberus/
├── frontend/              # Chrome Extension (TypeScript + Rollup)
│   ├── src/
│   │   ├── background/    # Service worker for screenshot capture & API calls
│   │   ├── content/       # Content scripts for page monitoring
│   │   ├── popup/         # Extension popup UI
│   │   ├── options/       # Settings interface
│   │   └── common/        # Shared utilities and types
│   ├── manifest.json      # Extension manifest (MV3)
│   ├── package.json
│   └── dist/              # Built extension
│
├── backend/               # FastAPI Backend Server
│   ├── server.py          # Main FastAPI application
│   ├── agentic/           # CerberusAgent with detection logic
│   ├── filter/            # Whitelist, blacklist, and cache management
│   ├── requirements.txt   # Python dependencies
│   └── start_server.sh    # Startup script
│
├── whitelist/             # Alternative: Whitelist-Only Extension
│   ├── manifest.json
│   ├── background.js
│   └── src/               # Whitelist functionality with CrUX integration
│
├── docs/                  # Documentation
│   ├── QUICKSTART.md      # 5-step setup guide
│   ├── COMPLETE_SETUP.md  # Detailed installation
│   ├── GOOGLE_CLOUD_SETUP.md
│   ├── INTEGRATION.md     # Architecture & data flow
│   └── TESTING_GUIDE.md
│
└── test_optimization.py   # Optimization testing script
```

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js and npm
- Google Cloud account with BigQuery API enabled
- Ollama installed locally

### Setup (5 Steps)

1. **Google Cloud Setup**
   - Create a GCP project and download credentials JSON
   - Enable BigQuery API
   - Place credentials at `~/cerberus-credentials/gcp-credentials.json`

2. **Get Google API Key**
   - Visit [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Generate an API key

3. **Configure Environment**
   ```bash
   cd cerberus/backend
   cp .env.example .env
   # Edit .env with your credentials:
   # GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
   # GOOGLE_API_KEY=your-api-key-here
   ```

4. **Install Ollama Models**
   ```bash
   ollama pull gemma3
   ```

5. **Start Backend Server**
   ```bash
   cd backend
   ./start_server.sh
   ```

6. **Build and Load Extension**
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `frontend/dist` directory

For detailed setup instructions, see [docs/QUICKSTART.md](docs/QUICKSTART.md) or [docs/COMPLETE_SETUP.md](docs/COMPLETE_SETUP.md).

## Usage

1. **Browse normally** - Cerberus runs automatically in the background
2. **Visual indicators** - Check the extension icon color:
   - Green: Site is trusted
   - Yellow: Analysis in progress or suspicious
   - Red: Phishing detected
3. **View details** - Click the extension icon to see:
   - Verdict and confidence score
   - Detailed reasons
   - Suggested actions
4. **Manage whitelist** - Add trusted sites in the extension options

## Architecture

```
┌─────────────────────────────────────┐
│   Chrome Extension (Frontend)       │
│  - Popup UI                         │
│  - Content Script                   │
│  - Service Worker                   │
└─────────────┬───────────────────────┘
              │ HTTP POST /api/analyze
              │ (screenshot + metadata)
              ↓
┌─────────────────────────────────────┐
│    FastAPI Backend Server           │
│  ┌────────────────────────────────┐│
│  │  CerberusAgent                 ││
│  │  - State Graph (LangGraph)     ││
│  │  - Multi-layer filtering       ││
│  │  - LLM brand identification    ││
│  ├────────────────────────────────┤│
│  │  Filters:                      ││
│  │  - Global Whitelist (CrUX)     ││
│  │  - Blacklist (OpenPhish)       ││
│  │  - Personal Whitelist          ││
│  │  - AI Analysis (Gemini/Ollama) ││
│  └────────────────────────────────┘│
└─────────────┬───────────────────────┘
              │ JSON Response
              │ (verdict, confidence, reasons)
              ↓
┌─────────────────────────────────────┐
│  Browser Display                    │
│  - Badge indicator                  │
│  - Overlay panel                    │
│  - Element highlights               │
└─────────────────────────────────────┘
```

For complete architecture details, see [docs/INTEGRATION.md](docs/INTEGRATION.md).

## Performance

- **Layer 1 (Whitelist):** <50ms per check (typical 5-15ms)
- **Layer 3 (User Cache):** <100ms
- **Layer 4 (Client AI):** 500ms-1.5s
- **Layer 5 (Server AI):** 2-5s
- **Memory:** ~2MB for whitelist data
- **Storage:** <1MB for user data

## Security Features

- Shadow DOM isolation for overlay CSS
- HTML sanitization to prevent XSS attacks
- Minimal permissions required
- Client ID for rate limiting (no personal data collected)
- Local-first processing for Layers 1-3
- Optional cloud processing with privacy controls
- No user behavior tracking

## Testing

Run the optimization test:

```bash
python test_optimization.py
```

For comprehensive testing procedures, see [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md).

## Documentation

- [QUICKSTART.md](docs/QUICKSTART.md) - 5-step quick setup guide
- [COMPLETE_SETUP.md](docs/COMPLETE_SETUP.md) - Detailed installation and configuration
- [GOOGLE_CLOUD_SETUP.md](docs/GOOGLE_CLOUD_SETUP.md) - GCP credentials setup instructions
- [INTEGRATION.md](docs/INTEGRATION.md) - Complete architecture and data flow
- [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) - Testing procedures and verification


## Acknowledgments

- Google CrUX API for domain reputation data
- OpenPhish for threat intelligence feeds
- LangChain and LangGraph for AI orchestration
- Google Gemini for AI/LLM capabilities
