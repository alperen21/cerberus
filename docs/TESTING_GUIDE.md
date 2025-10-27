# Cerberus Testing Guide

## ✅ How to Tell if the Extension is Working

### Step 1: Verify Extension is Loaded

1. **Open Chrome** and go to `chrome://extensions/`
2. **Check for Cerberus** in the extensions list
3. You should see:
   - ✅ Name: "Cerberus - Phishing Protection"
   - ✅ Blue icon with "C"
   - ✅ Toggle is **ON** (enabled)
   - ✅ No errors shown

### Step 2: Check Backend Server

The backend must be running for the extension to work.

**Check if server is running:**
```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "agent_initialized": true,
  "timestamp": "2025-10-24T..."
}
```

If this fails, restart the server:
```bash
cd /Users/seemanteng/Desktop/cerberus/cerberus/backend
source venv/bin/activate
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
export GOOGLE_API_KEY=AIzaSyA2g2hj_zKXB6MRqXNle0zRQNmXBgJv_a0
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3: Test on a Known Safe Website

1. **Visit https://google.com**
2. **Wait 2-3 seconds** for analysis
3. **Check the extension icon** in Chrome toolbar:
   - Should change color or show a badge
   - Click icon to see analysis result

**What to expect:**
- ✅ Icon shows green checkmark or safe indicator
- ✅ Popup shows "Safe" or "Benign" verdict
- ✅ Confidence score around 0.9-1.0

### Step 4: Check Browser Console for Logs

1. **Press F12** to open Chrome DevTools
2. Go to **Console** tab
3. Look for Cerberus messages:

**Expected logs:**
```
Cerberus background service worker initialized
Analyzing URL: https://google.com
Analysis complete: safe (confidence: 0.95)
```

### Step 5: Check Backend Logs

In the terminal where your backend is running, you should see:

```
INFO: Analyzing URL: https://google.com from client: ...
INFO: [INFO] Using cached data for 2025_09
INFO: Analysis complete: safe (confidence: 0.95) in 45.23ms
```

### Step 6: View the Extension Service Worker

1. Go to `chrome://extensions/`
2. Find **Cerberus** extension
3. Click **"service worker"** link (appears after "Inspect views")
4. This opens a console showing background script logs

**Expected in service worker console:**
```
Cerberus background service worker initialized
[Info about page analysis]
```

## 🧪 Detailed Testing Steps

### Test 1: Known Safe Site (Whitelisted)

**Site:** https://google.com

**Expected Result:**
- ⚡ **Fast response** (<100ms) - hits global whitelist
- ✅ **Verdict:** "safe" or "benign"
- 📊 **Confidence:** 0.9-1.0
- 📝 **Reason:** "Domain found in global whitelist"

**How to verify:**
1. Visit https://google.com
2. Click extension icon
3. Should show green/safe indicator
4. Backend logs show: `"is_in_global_whitelist": true`

### Test 2: Unknown Domain (LLM Analysis)

**Site:** https://example.com (or any lesser-known site)

**Expected Result:**
- ⏱️ **Slower response** (1-3 seconds) - runs LLM analysis
- ⚠️ **Verdict:** Could be "safe", "suspicious", or "dangerous"
- 📊 **Confidence:** 0.5-0.9
- 📝 **Reason:** Brand identification result

**How to verify:**
1. Visit a non-whitelisted site
2. Wait for analysis (takes longer)
3. Extension shows verdict based on LLM analysis
4. Backend logs show: `"race_identify_check_and_logo"` execution

### Test 3: Known Phishing Site (DO NOT VISIT REAL ONES!)

**Note:** Your backend has 300 known phishing URLs loaded from OpenPhish

**Expected Result:**
- ⚡ **Fast response** (<50ms) - hits blacklist
- ❌ **Verdict:** "dangerous" or "phishing"
- 📊 **Confidence:** 0.9-1.0
- 📝 **Reason:** "Domain found in blacklist"

**Check blacklist is loaded:**
```bash
cat /Users/seemanteng/Desktop/cerberus/cerberus/backend/.openphish_cache/blacklist.json | head -20
```

### Test 4: Personal Whitelist

**How to test:**
1. Visit a site that's NOT in global whitelist (e.g., your personal blog)
2. Mark it as safe (if extension has this feature)
3. Visit it again
4. Should be faster and marked safe

**Check personal whitelist:**
```bash
cat /Users/seemanteng/Desktop/cerberus/cerberus/backend/.personal_whitelist/list.json
```

## 📊 Understanding the Output

### Extension Icon States

| Icon | Meaning | Verdict |
|------|---------|---------|
| ✓ Green | Safe site | benign |
| ! Yellow | Suspicious | suspicious |
| ✕ Red | Dangerous | phishing/dangerous |
| ? Gray | Unknown/Error | - |

### API Response Format

When you click the extension icon, it shows data from this response:

```json
{
  "verdict": "safe",
  "confidence": 0.95,
  "reasons": [
    {
      "code": "global_whitelist",
      "label": "Trusted Domain",
      "detail": "Domain found in global whitelist"
    }
  ],
  "highlights": [],
  "explanation": "Analysis of google.com: Domain is trusted",
  "suggested_actions": [
    {
      "action": "continue",
      "label": "Continue",
      "description": "This site appears to be legitimate"
    }
  ]
}
```

### Backend Processing Pipeline

Your backend checks in this order:

1. ✅ **Global Whitelist** (CrUX - 1000 top domains)
   - If found: Return "safe" immediately

2. ❌ **Blacklist** (OpenPhish - 300 known phishing URLs)
   - If found: Return "dangerous" immediately

3. 💾 **Personal Whitelist** (Your trusted sites - max 30)
   - If found: Return "safe" immediately

4. 🤖 **LLM Analysis** (Brand identification + domain matching)
   - Identifies brand from screenshot
   - Compares with actual domain
   - Returns verdict with confidence

## 🐛 Troubleshooting

### Extension Not Showing Up

**Check:**
```bash
# Verify dist folder has all files
ls -la /Users/seemanteng/Desktop/cerberus/frontend/dist/

# Should see:
# - manifest.json
# - background/ (with serviceWorker.js)
# - content/ (with contentScript.js)
# - public/ (with icons)
```

### No Analysis Happening

**Check extension console:**
1. Go to `chrome://extensions/`
2. Click "service worker" under Cerberus
3. Look for errors

**Common issues:**
- Backend not running → Start server
- CORS error → Backend should allow all origins
- Network error → Check backend URL in code

### Backend Not Responding

**Test backend directly:**
```bash
# Health check
curl http://localhost:8000/health

# Test analysis endpoint
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://google.com",
    "domain": "google.com",
    "screenshot_base64": "test",
    "viewport_size": {"width": 1920, "height": 1080}
  }'
```

### Slow Analysis

**Expected times:**
- Whitelisted: <100ms
- Blacklisted: <50ms
- Personal whitelist: <10ms
- LLM analysis: 1-3 seconds (first time), faster with Ollama

**If slower:**
- Check Ollama is running: `ollama list`
- Check network connection (for Gemini)
- Check backend logs for errors

## 📈 Performance Monitoring

### Check Whitelist Stats

The backend tracks:
- Total domains checked
- Whitelist hit rate
- Average response time
- Cache performance

**View stats:**
```bash
curl http://localhost:8000/api/stats
```

### Check Cache

**Global whitelist cache:**
```bash
ls -la /Users/seemanteng/Desktop/cerberus/cerberus/backend/.crux_cache/
# Should show cached BigQuery results
```

**Blacklist cache:**
```bash
ls -la /Users/seemanteng/Desktop/cerberus/cerberus/backend/.openphish_cache/
# Should show blacklist.json with 300 URLs
```

**Personal whitelist:**
```bash
cat /Users/seemanteng/Desktop/cerberus/cerberus/backend/.personal_whitelist/list.json
# Shows your trusted domains
```

## 🎯 Success Criteria

Your extension is working correctly if:

- ✅ Extension loads without errors
- ✅ Backend health check returns "healthy"
- ✅ Google.com is marked as safe in <100ms
- ✅ Extension icon changes based on verdict
- ✅ Backend logs show analysis happening
- ✅ Service worker console shows no errors

## 🔍 Advanced Testing

### Test with Real Screenshot

```bash
cd /Users/seemanteng/Desktop/cerberus/cerberus/backend

# Test with actual screenshot
python3 main.py
```

This will:
1. Load `exp.png` screenshot
2. Analyze it with the full pipeline
3. Print verdict and confidence
4. Show which whitelist/blacklist was hit

### Manual API Test

Create a test script:

```python
import requests
import base64

# Read a screenshot
with open("exp.png", "rb") as f:
    screenshot = base64.b64encode(f.read()).decode()

# Send request
response = requests.post("http://localhost:8000/api/analyze", json={
    "url": "https://example.com",
    "domain": "example.com",
    "screenshot_base64": screenshot,
    "viewport_size": {"width": 1920, "height": 1080}
})

print(response.json())
```

## 📝 What to Report

If something isn't working, check:

1. **Extension status** - Loaded? Enabled? Any errors?
2. **Backend status** - Running? Health check passing?
3. **Browser console** - Any errors or logs?
4. **Backend logs** - Any errors or analysis logs?
5. **Test results** - What happens on google.com?

With this information, we can debug any issues! 🚀
