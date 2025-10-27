# Complete Cerberus Setup Guide

This guide covers ALL requirements to run Cerberus, including Google Cloud credentials, Ollama, and Google API key.

## 📋 Prerequisites Checklist

- [ ] Python 3.8+ installed
- [ ] Node.js and npm installed
- [ ] Google Cloud account
- [ ] Google API key (for Gemini)
- [ ] Ollama installed (for local LLM)
- [ ] Chrome browser

## 🔧 Step-by-Step Setup

### 1. Set Up Google Cloud Credentials (for Whitelist)

The global whitelist uses Google's Chrome User Experience Report (CrUX) data via BigQuery.

#### A. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., "cerberus-phishing")
4. Click **Create**

#### B. Enable BigQuery API

1. Go to **APIs & Services** → **Library**
2. Search for "BigQuery API"
3. Click **Enable**

#### C. Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name: `cerberus-bigquery`
4. Click **Create and Continue**
5. Grant role: **BigQuery User**
6. Click **Done**

#### D. Download Credentials

1. Click on the service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON**
5. Click **Create** (file downloads automatically)

#### E. Save and Configure

```bash
# Create secure directory
mkdir -p ~/cerberus-credentials

# Move the downloaded file (replace with your actual filename)
mv ~/Downloads/cerberus-*.json ~/cerberus-credentials/gcp-credentials.json

# Secure permissions
chmod 600 ~/cerberus-credentials/gcp-credentials.json

# Set environment variable (macOS with zsh)
echo 'export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json' >> ~/.zshrc
source ~/.zshrc

# For bash users:
echo 'export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json' >> ~/.bashrc
source ~/.bashrc

# Verify
echo $GOOGLE_APPLICATION_CREDENTIALS
```

### 2. Get Google API Key (for Gemini LLM)

The backend uses Google's Gemini model for brand identification.

#### A. Get API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Create API Key**
3. Select your Google Cloud project (or create new one)
4. Copy the API key

#### B. Set Environment Variable

```bash
# For zsh (default on macOS):
echo 'export GOOGLE_API_KEY=your-api-key-here' >> ~/.zshrc
source ~/.zshrc

# For bash:
echo 'export GOOGLE_API_KEY=your-api-key-here' >> ~/.bashrc
source ~/.bashrc

# Verify
echo $GOOGLE_API_KEY
```

⚠️ **Important:** Replace `your-api-key-here` with your actual API key!

### 3. Install Ollama (for Local LLM)

Ollama provides fast local LLM inference for the client-side analysis path.

#### A. Install Ollama

**macOS:**
```bash
# Download from website
open https://ollama.ai/download

# Or use Homebrew
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download from https://ollama.ai/download

#### B. Start Ollama Service

```bash
# Start Ollama (runs as background service)
ollama serve
```

Leave this running in a terminal, or start it as a system service.

#### C. Download Required Models

```bash
# Download Gemma 4B (for brand identification)
ollama pull gemma3:4b

# Download Gemma 270M (for domain matching)
ollama pull gemma3:270m

# Verify models are installed
ollama list
```

Expected output:
```
NAME              ID              SIZE
gemma3:4b         abc123          2.5 GB
gemma3:270m       def456          200 MB
```

### 4. Install Backend Dependencies

```bash
cd /Users/seemanteng/Desktop/cerberus/cerberus/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 5. Install Frontend Dependencies

```bash
cd /Users/seemanteng/Desktop/cerberus/frontend

# Install Node.js dependencies
npm install

# Build the extension
npm run build
```

### 6. Verify All Environment Variables

```bash
# Run this script to check all environment variables
cat << 'EOF' > ~/check_cerberus_env.sh
#!/bin/bash
echo "🔍 Checking Cerberus Environment Variables..."
echo ""

if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "❌ GOOGLE_APPLICATION_CREDENTIALS not set"
else
    echo "✅ GOOGLE_APPLICATION_CREDENTIALS: $GOOGLE_APPLICATION_CREDENTIALS"
    if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo "   ✅ File exists"
    else
        echo "   ❌ File does not exist!"
    fi
fi

if [ -z "$GOOGLE_API_KEY" ]; then
    echo "❌ GOOGLE_API_KEY not set"
else
    echo "✅ GOOGLE_API_KEY: ${GOOGLE_API_KEY:0:10}..." # Show only first 10 chars
fi

echo ""
echo "🔍 Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama installed"
    if ollama list &> /dev/null; then
        echo "✅ Ollama service running"
        echo ""
        echo "📦 Installed models:"
        ollama list
    else
        echo "❌ Ollama service not running. Run: ollama serve"
    fi
else
    echo "❌ Ollama not installed"
fi

echo ""
echo "🔍 Checking Python packages..."
if python3 -c "import fastapi" 2>/dev/null; then
    echo "✅ FastAPI installed"
else
    echo "❌ FastAPI not installed. Run: pip install -r requirements.txt"
fi

if python3 -c "import google.cloud.bigquery" 2>/dev/null; then
    echo "✅ Google Cloud BigQuery installed"
else
    echo "❌ Google Cloud BigQuery not installed"
fi

if python3 -c "import langchain_google_genai" 2>/dev/null; then
    echo "✅ LangChain Google GenAI installed"
else
    echo "❌ LangChain Google GenAI not installed"
fi

if python3 -c "import langchain_ollama" 2>/dev/null; then
    echo "✅ LangChain Ollama installed"
else
    echo "❌ LangChain Ollama not installed"
fi
EOF

chmod +x ~/check_cerberus_env.sh
~/check_cerberus_env.sh
```

## 🚀 Running Cerberus

Once all prerequisites are installed:

### Terminal 1: Start Ollama (if not already running as service)

```bash
ollama serve
```

### Terminal 2: Start Backend Server

```bash
cd /Users/seemanteng/Desktop/cerberus/cerberus/backend
source venv/bin/activate
./start_server.sh
```

Expected output:
```
🐺 Starting Cerberus Backend Server...
=======================================
📦 Checking dependencies...
✅ FastAPI found
🚀 Starting server on http://0.0.0.0:8000
   API documentation: http://localhost:8000/docs
   Health check: http://localhost:8000/health

Press Ctrl+C to stop the server

INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Initializing Cerberus agent...
INFO:     [INFO] Building CrUX allowlist for 2025_10
INFO:     Cerberus agent initialized successfully
INFO:     Application startup complete.
```

### Terminal 3: Test Backend

```bash
# Test health endpoint
curl http://localhost:8000/health

# Should return:
# {
#   "status": "healthy",
#   "agent_initialized": true,
#   "timestamp": "2025-10-24T..."
# }
```

### Load Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Navigate to `/Users/seemanteng/Desktop/cerberus/frontend/dist`
5. Click **Select**

You should see the Cerberus extension loaded!

## 🧪 Testing

### Test 1: Visit a Major Website

1. Visit https://google.com
2. Check the extension icon - should show green checkmark
3. Click extension to see "Safe" verdict

### Test 2: Check Backend Logs

In the backend terminal, you should see:
```
INFO: Analyzing URL: https://google.com from client: ...
INFO: [INFO] Using cached data for 2025_10
INFO: Analysis complete: safe (confidence: 0.95) in 45.23ms
```

### Test 3: Check Unknown Domain

1. Visit a lesser-known site
2. Extension should trigger LLM analysis
3. Takes 1-3 seconds for first analysis

## 🐛 Troubleshooting

### "GOOGLE_APPLICATION_CREDENTIALS not set"

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
```

### "GOOGLE_API_KEY not set"

```bash
export GOOGLE_API_KEY=your-actual-key-here
```

Make sure to add these to your `~/.zshrc` or `~/.bashrc` to make them permanent!

### "Ollama service not running"

```bash
# Start Ollama
ollama serve

# Or install as system service (macOS):
brew services start ollama
```

### "Model not found: gemma3:4b"

```bash
ollama pull gemma3:4b
ollama pull gemma3:270m
```

### Backend crashes on startup

Check that all environment variables are set:
```bash
echo $GOOGLE_APPLICATION_CREDENTIALS
echo $GOOGLE_API_KEY
```

And verify the credentials file exists:
```bash
ls -la $GOOGLE_APPLICATION_CREDENTIALS
```

### Extension not working

1. Check backend is running: `curl http://localhost:8000/health`
2. Rebuild extension: `cd frontend && npm run build`
3. Reload extension in Chrome
4. Check browser console (F12) for errors

## 📊 Cost Estimates

### Google Cloud BigQuery (Whitelist)
- **Free Tier:** 1 TB queries/month
- **Cerberus Usage:** <100 MB/month (with 30-day cache)
- **Cost:** $0/month (stays in free tier)

### Google Gemini API
- **Free Tier:** 15 requests/minute, 1 million tokens/day
- **Cerberus Usage:** 1-2 requests per new domain
- **Cost:** $0/month for personal use

### Ollama
- **Cost:** Free (runs locally)
- **Hardware:** Uses your computer's resources

## 🔒 Security Notes

- Never commit credentials to git
- Keep API keys secret
- `.gitignore` already configured to exclude:
  - `*-credentials.json`
  - `.env` files
  - Cache directories

## 📝 Quick Reference

```bash
# Environment variables needed:
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
export GOOGLE_API_KEY=your-api-key-here

# Start services:
ollama serve                                    # Terminal 1
cd backend && ./start_server.sh                 # Terminal 2

# Test:
curl http://localhost:8000/health              # Should return {"status":"healthy"}
```

## 🎯 Summary

You need:
1. ✅ Google Cloud credentials (for whitelist/BigQuery)
2. ✅ Google API key (for Gemini LLM)
3. ✅ Ollama installed with gemma3:4b and gemma3:270m models

Follow this guide step-by-step and you'll have Cerberus running!
