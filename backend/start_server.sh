#!/bin/bash

# Cerberus Backend Server Startup Script
# This script starts the FastAPI backend server for the Cerberus phishing detection system

set -e

echo "🐺 Starting Cerberus Backend Server..."
echo "======================================="

# Check if we're in the correct directory
if [ ! -f "server.py" ]; then
    echo "❌ Error: server.py not found. Please run this script from the backend directory."
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d "../venv" ] && [ ! -d "../../venv" ]; then
    echo "⚠️  No virtual environment found. It's recommended to use a virtual environment."
    echo "   Create one with: python3 -m venv venv"
    echo "   Activate it with: source venv/bin/activate"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if required packages are installed
echo "📦 Checking dependencies..."
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "❌ FastAPI not found. Installing dependencies..."
    pip3 install -r requirements.txt
fi

# Check for Google Cloud credentials (needed for whitelist)
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "⚠️  Warning: GOOGLE_APPLICATION_CREDENTIALS not set."
    echo "   The whitelist feature may not work without Google Cloud credentials."
    echo "   Set it with: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json"
    echo ""
fi

# Set default port
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}

echo ""
echo "🚀 Starting server on http://${HOST}:${PORT}"
echo "   API documentation: http://localhost:${PORT}/docs"
echo "   Health check: http://localhost:${PORT}/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 -m uvicorn server:app --host "${HOST}" --port "${PORT}" --reload
