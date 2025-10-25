#!/bin/bash

# Build and Pack Script for Cerberus Extension

set -e

echo "🔨 Building Cerberus Extension..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist
mkdir -p dist

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Compile TypeScript
echo "⚙️  Compiling TypeScript..."
npx tsc

# Copy static assets
echo "📋 Copying static assets..."
cp manifest.json dist/
cp -r public dist/

# Create necessary directories
mkdir -p dist/src/popup
mkdir -p dist/src/options

# Copy HTML files
cp src/popup/index.html dist/src/popup/
cp src/options/Options.html dist/src/options/

# Copy CSS files (they're not TypeScript)
cp src/popup/popup.css dist/src/popup/
cp src/content/overlay/overlay.css dist/src/content/overlay/

echo "✅ Build complete!"

# Pack extension
if command -v zip &> /dev/null; then
  echo "📦 Packing extension..."
  cd dist
  zip -r ../cerberus-extension.zip .
  cd ..
  echo "✅ Extension packed to cerberus-extension.zip"
else
  echo "⚠️  zip command not found. Skipping packing."
  echo "   Please install zip or manually zip the dist folder."
fi

echo ""
echo "🎉 Done! Load the extension from the 'dist' folder in Chrome:"
echo "   1. Open chrome://extensions/"
echo "   2. Enable 'Developer mode'"
echo "   3. Click 'Load unpacked'"
echo "   4. Select the 'dist' folder"
