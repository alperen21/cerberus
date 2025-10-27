# Cerberus Quick Start Guide

Get Cerberus running in 5 steps!

## 📋 What You Need

Before starting, you need these 3 things:

1. **Google Cloud credentials** (JSON file)
2. **Google API key** (string)
3. **Ollama** installed with models

## 🚀 5-Step Setup

### Step 1: Set Up Google Cloud Credentials

Follow **[docs/GOOGLE_CLOUD_SETUP.md](docs/GOOGLE_CLOUD_SETUP.md)** to:
- Create a Google Cloud project
- Enable BigQuery API
- Download credentials JSON file

Then set the environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
```

### Step 2: Get Google API Key

1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key

Then set the environment variable:
```bash
export GOOGLE_API_KEY=your-api-key-here
```

### Step 3: Install and Start Ollama

```bash
# Install Ollama (macOS)
brew install ollama

# Download required models
ollama pull gemma3:4b
ollama pull gemma3:270m

# Start Ollama (keep running in Terminal 1)
ollama serve
```

### Step 4: Start Backend Server

Open a new terminal (Terminal 2):

```bash
cd cerberus/backend

# Create virtual environment (first time only)
python3 -m venv venv
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start server
./start_server.sh
```

You should see:
```
🐺 Starting Cerberus Backend Server...
🚀 Starting server on http://0.0.0.0:8000
INFO: Cerberus agent initialized successfully
```

### Step 5: Load Chrome Extension

```bash
# Build extension (first time only)
cd frontend
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `frontend/dist/` folder

Done! 🎉

## ✅ Verify It's Working

1. Visit https://google.com
2. Check extension icon - should show green checkmark ✓
3. Check backend terminal - should show:
   ```
   INFO: Analyzing URL: https://google.com
   INFO: Analysis complete: safe (confidence: 0.95)
   ```

## 🐛 Troubleshooting

### Backend won't start?

Check environment variables are set:
```bash
echo $GOOGLE_APPLICATION_CREDENTIALS
echo $GOOGLE_API_KEY
```

If empty, export them again (see steps 1 & 2).

### Extension shows errors?

1. Check backend is running: `curl http://localhost:8000/health`
2. Rebuild extension: `cd frontend && npm run build`
3. Reload extension in Chrome

### Ollama errors?

Make sure it's running:
```bash
ollama list
# Should show: gemma3:4b and gemma3:270m
```

## 📚 Full Documentation

- **Complete Setup:** [docs/COMPLETE_SETUP.md](docs/COMPLETE_SETUP.md)
- **Integration Guide:** [INTEGRATION.md](INTEGRATION.md)
- **Google Cloud Setup:** [docs/GOOGLE_CLOUD_SETUP.md](docs/GOOGLE_CLOUD_SETUP.md)

## 🔑 Environment Variables Quick Reference

Add these to your `~/.zshrc` or `~/.bashrc` to make them permanent:

```bash
# Required for Cerberus
export GOOGLE_APPLICATION_CREDENTIALS=~/cerberus-credentials/gcp-credentials.json
export GOOGLE_API_KEY=your-actual-google-api-key-here
```

Then run: `source ~/.zshrc` (or `source ~/.bashrc`)
