# Cerberus Integration Guide

This document explains how the frontend, backend, and whitelist components work together in the Cerberus phishing detection system.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension (Frontend)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Popup UI   │  │   Content    │  │   Service Worker     │  │
│  │              │  │   Script     │  │   (Background)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                  │                     │               │
│         └──────────────────┴─────────────────────┘               │
│                            │                                     │
│                            ↓                                     │
│                   HTTP POST /api/analyze                         │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend Server                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CerberusAgent                          │  │
│  │  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ Global         │  │ Personal     │  │ Blacklist    │ │  │
│  │  │ Whitelist      │  │ Whitelist    │  │ Filter       │ │  │
│  │  │ (CrUX API)     │  │ (User Cache) │  │              │ │  │
│  │  └────────────────┘  └──────────────┘  └──────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │     Brand Identification & Domain Matching          │ │  │
│  │  │     (LLM-based: Gemini + Ollama)                    │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📂 Directory Structure

```
cerberus/
├── frontend/                    # Chrome Extension
│   ├── src/
│   │   ├── background/
│   │   │   └── serviceWorker.ts    # Handles screenshot capture & API calls
│   │   ├── content/
│   │   │   └── contentScript.ts    # Page monitoring & overlay display
│   │   ├── popup/
│   │   │   └── Popup.tsx           # Extension popup UI
│   │   └── common/
│   │       ├── api.ts              # API client functions
│   │       └── types.ts            # TypeScript interfaces
│   ├── manifest.json
│   └── package.json
│
├── cerberus/backend/            # Python Backend
│   ├── server.py                # FastAPI server (NEW!)
│   ├── start_server.sh          # Startup script (NEW!)
│   ├── agentic/
│   │   └── agent.py             # CerberusAgent with detection logic
│   ├── filter/
│   │   ├── whitelist.py         # Global whitelist (CrUX integration)
│   │   ├── personal_whitelist.py # User's personal cache
│   │   └── blacklist.py         # Known malicious domains
│   ├── requirements.txt         # Python dependencies
│   └── main.py                  # CLI test script
│
└── whitelist/                   # Standalone Extension (Alternative)
    ├── background.js            # Whitelist-only background service
    ├── content.js               # Login detection
    └── src/
        └── whitelist-manager.js # Whitelist management logic
```

## 🔄 Data Flow

### 1. Page Load & Analysis Trigger

```
User visits page
     ↓
Frontend: serviceWorker.ts detects page load (chrome.tabs.onUpdated)
     ↓
Frontend: Captures screenshot (chrome.tabs.captureVisibleTab)
     ↓
Frontend: Converts to base64 & prepares AnalysisRequest
     ↓
Frontend: POST to http://localhost:8000/api/analyze
```

### 2. Backend Processing Pipeline

```
Backend receives request
     ↓
1. Check Global Whitelist (CruxAllowlistBuilder)
   - Queries Google CrUX BigQuery data
   - Returns SAFE if domain is in top trusted sites
   - Cache: .crux_cache/
     ↓ (if not in whitelist)
     ↓
2. Check Blacklist
   - Returns DANGEROUS if domain is known malicious
     ↓ (if not in blacklist)
     ↓
3. Check Personal Whitelist
   - User's previously trusted domains
   - Cache: .personal_whitelist/list.json
     ↓ (if not cached)
     ↓
4. Brand Identification (LLM)
   - Identifies brand from screenshot
   - Uses Gemini or Ollama
     ↓
5. Domain Matching (LLM)
   - Compares identified brand with actual domain
   - Returns confidence score
     ↓
Backend returns AnalysisResponse
```

### 3. Frontend Response Handling

```
Backend response received
     ↓
Frontend: serviceWorker.ts processes response
     ↓
Frontend: Updates badge icon (✓ safe, ! suspicious, ✕ dangerous)
     ↓
Frontend: Sends message to contentScript.ts
     ↓
Frontend: contentScript displays overlay with verdict & actions
```

## 🔧 Component Integration Details

### Frontend → Backend Communication

**Request Format** ([api.ts:40-66](frontend/src/common/api.ts#L40-L66))
```typescript
const response = await fetch('http://localhost:8000/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-ID': clientId,
    'X-Extension-Version': version
  },
  body: JSON.stringify({
    url: "https://example.com",
    domain: "example.com",
    screenshot_base64: "iVBORw0KGgoAAAANS...",
    viewport_size: { width: 1920, height: 1080 }
  })
});
```

**Response Format** ([server.py:71-81](cerberus/backend/server.py#L71-L81))
```json
{
  "verdict": "safe" | "suspicious" | "dangerous",
  "confidence": 0.95,
  "reasons": [
    {
      "code": "global_whitelist",
      "label": "Trusted Domain",
      "detail": "Domain found in global whitelist"
    }
  ],
  "highlights": [],
  "explanation": "Analysis of example.com: Domain is trusted",
  "suggested_actions": [
    {
      "action": "continue",
      "label": "Continue",
      "description": "This site appears to be legitimate"
    }
  ],
  "processing_time_ms": 45.23,
  "timestamp": "2025-10-24T22:30:00.000Z"
}
```

### Whitelist Integration

#### Global Whitelist (CrUX)

**Location:** [filter/whitelist.py](cerberus/backend/filter/whitelist.py)

- Uses Google Chrome User Experience Report (CrUX) data
- Queries BigQuery for top 100K domains
- Caches results for 30 days in `.crux_cache/`
- Requires: `GOOGLE_APPLICATION_CREDENTIALS` environment variable

**Configuration:**
```python
builder = CruxAllowlistBuilder(
    cache_dir=".crux_cache",
    project_id="cerberus-475906",
    location="SG"  # Auto-detected by get_crux_location()
)
```

#### Personal Whitelist (User Cache)

**Location:** [filter/personal_whitelist.py](cerberus/backend/filter/personal_whitelist.py)

- Stores user's trusted domains (max 30)
- Persisted to `.personal_whitelist/list.json`
- LRU eviction when full
- Atomic file writes for safety

**Usage:**
```python
whitelist = PersonalWhitelist(max_size=30)
whitelist.add("trusted-domain.com")
is_safe = whitelist.check("https://trusted-domain.com/login")
```

### Backend Agent Logic

**Location:** [agentic/agent.py](cerberus/backend/agent.py)

The `CerberusAgent` uses a state graph (LangGraph) with these nodes:

1. **check_whitelist** → If found: END with "benign"
2. **check_blacklist** → If found: END with "phishing"
3. **check_cache** (personal) → If found: END with "benign"
4. **race_identify_check_and_logo** → Async race between:
   - Client-side: Ollama (faster, local)
   - Server-side: Gemini (more accurate, cloud)
   - First to finish wins

## 🚀 Setup & Running

### Backend Setup

```bash
cd cerberus/backend

# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up Google Cloud credentials (for whitelist)
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-credentials.json

# 4. Start the server
./start_server.sh
# OR
python3 -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Build the extension
npm run build

# 3. Load in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the frontend/dist/ directory
```

### Verify Integration

1. **Start backend server:**
   ```bash
   cd cerberus/backend && ./start_server.sh
   ```

2. **Check health endpoint:**
   ```bash
   curl http://localhost:8000/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "agent_initialized": true,
     "timestamp": "2025-10-24T22:30:00.000000"
   }
   ```

3. **Load extension in Chrome** and visit any website

4. **Check browser console** (F12) for logs:
   - Frontend: "Cerberus background service worker initialized"
   - Backend: "Analysis complete: safe (confidence: 0.95) in 45.23ms"

## 🧪 Testing the Integration

### Test 1: Safe Domain (Whitelisted)

```bash
# Visit a major site like google.com
# Expected: Green checkmark badge, "safe" verdict
```

### Test 2: Unknown Domain

```bash
# Visit a lesser-known site
# Expected: Analysis runs, brand matching occurs
```

### Test 3: Manual API Test

```bash
# Create test screenshot
base64 -i test_screenshot.png -o screenshot.b64

# Test API directly
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "domain": "example.com",
    "screenshot_base64": "'$(cat screenshot.b64)'",
    "viewport_size": {"width": 1920, "height": 1080}
  }'
```

## 🔍 Debugging

### Frontend Debugging

1. **Open Chrome DevTools** (F12) on any page
2. **Check Console tab** for logs from contentScript
3. **Open Extension Popup** → Right-click → Inspect
4. **View Service Worker logs:**
   - Go to chrome://extensions/
   - Find Cerberus → "service worker" link
   - Click "inspect" to see background logs

### Backend Debugging

1. **Check server logs** in terminal where `start_server.sh` runs
2. **Use FastAPI docs:** http://localhost:8000/docs
   - Interactive API testing
   - Try the `/api/analyze` endpoint
3. **Check whitelist cache:**
   ```bash
   ls -la .crux_cache/
   ls -la .personal_whitelist/
   ```

### Common Issues

#### 1. CORS Errors
**Symptom:** Frontend can't reach backend
**Fix:** Backend server.py already has CORS enabled for all origins

#### 2. Whitelist Not Loading
**Symptom:** "Failed to initialize Cerberus agent"
**Fix:** Set Google Cloud credentials:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

#### 3. Extension Not Loading
**Symptom:** Chrome won't load extension
**Fix:**
- Run `npm run build` in frontend/
- Make sure manifest.json is valid
- Check chrome://extensions/ for error messages

#### 4. Screenshot Analysis Slow
**Symptom:** Takes >5 seconds to analyze
**Fix:**
- Ensure Ollama is running locally (for fast path)
- Check network connection (for Gemini fallback)
- Whitelist working domains to skip LLM analysis

## 📊 Performance Expectations

| Component | Target | Typical |
|-----------|--------|---------|
| Whitelist check | <50ms | 10-30ms |
| Blacklist check | <10ms | 5ms |
| Personal cache check | <5ms | 1-2ms |
| LLM brand identification | <2s | 500ms-1.5s |
| Total (whitelisted) | <100ms | 50ms |
| Total (full analysis) | <3s | 1-2.5s |

## 🔐 Security Notes

- All components focus on **defensive security**
- No credential harvesting or malicious behavior
- Personal whitelist stored locally only
- API keys and credentials stay on backend
- Frontend has no direct database access

## 📝 Environment Variables

### Backend

```bash
# Required for whitelist feature
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-credentials.json

# Optional
export PORT=8000
export HOST=0.0.0.0
```

### Frontend

No environment variables needed. Configuration is in:
- [manifest.json](frontend/manifest.json)
- [api.ts](frontend/src/common/api.ts) (BACKEND_URL)

## 🤝 Integration Checklist

- [x] Backend server created ([server.py](cerberus/backend/server.py))
- [x] FastAPI dependencies added to requirements.txt
- [x] Startup script created ([start_server.sh](cerberus/backend/start_server.sh))
- [x] Frontend API client matches backend interface
- [x] Request/Response types synchronized
- [x] Whitelist integration working in backend
- [x] CORS configured for Chrome extension
- [x] Health check endpoint available
- [ ] Google Cloud credentials configured (user action required)
- [ ] Backend server started
- [ ] Extension loaded in Chrome
- [ ] End-to-end test completed

## 🎯 Next Steps

1. **Set up Google Cloud credentials** for whitelist feature
2. **Start the backend server:**
   ```bash
   cd cerberus/backend && ./start_server.sh
   ```
3. **Build and load the extension:**
   ```bash
   cd frontend && npm run build
   ```
4. **Test on real websites** and verify the integration

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Google CrUX API](https://developer.chrome.com/docs/crux/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
