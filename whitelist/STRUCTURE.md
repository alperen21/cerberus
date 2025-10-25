# Cerberus Whitelist System - Folder Structure

This folder contains the complete implementation of the Cerberus whitelist system using Google CrUX API integration.

## 📁 Folder Structure

```
whitelist/
├── manifest.json                 # Chrome extension manifest
├── background.js                 # Service worker for Layer 1 checking
├── content.js                    # Content script for login detection
├── popup.html                    # Extension popup interface
├── README.md                     # Complete documentation
├── scripts/
│   └── popup.js                  # Popup UI controller
├── src/
│   ├── whitelist-manager.js      # Core whitelist functionality
│   └── crux-integration.js       # Google CrUX API integration
├── styles/
│   └── popup.css                 # Popup styling
└── icons/                        # Extension icons (placeholder)
```

## 🔧 Core Components

### **whitelist-manager.js**
- Three-tier whitelist system (Global, User, Dynamic)
- Fast <50ms Layer 1 checking
- Storage management for user domains
- Performance tracking and optimization

### **crux-integration.js**
- Google CrUX API integration
- Reputation scoring based on performance metrics
- Rate limiting and batch processing
- Domain analysis algorithms

### **background.js**
- Service worker coordination
- Tab monitoring and icon updates
- Statistics tracking
- Daily maintenance tasks

### **content.js**
- Login attempt detection
- Real-time whitelist checking
- Visual status indicators
- User interaction handling

### **popup.html + popup.js**
- User interface for whitelist management
- CrUX API configuration
- Statistics dashboard
- Export/import functionality

## 🚀 Installation

1. Load the `whitelist` folder as an unpacked Chrome extension
2. Configure your Google CrUX API key in Settings
3. The extension will automatically protect against phishing attempts

## 📊 Features

✅ **Layer 1 Defense**: <50ms whitelist checking
✅ **Global Whitelist**: 70+ pre-trusted domains
✅ **User Management**: Add/remove trusted domains
✅ **Dynamic Updates**: CrUX API-based reputation scoring
✅ **Performance Optimized**: Minimal memory and CPU usage
✅ **Privacy-First**: Local processing with optional cloud features

## 🔗 API Integration

The system integrates with Google's Chrome User Experience Report API to identify high-reputation domains based on:

- **Largest Contentful Paint (LCP)**
- **First Contentful Paint (FCP)**
- **Interaction to Next Paint (INP)**
- **Cumulative Layout Shift (CLS)**

Domains scoring ≥70% are automatically trusted.

## 🛡️ Security

This implementation focuses on **defensive security** only:
- Phishing detection and prevention
- User education about threats
- Trusted domain management
- Performance-based reputation scoring

The code does not contain any malicious functionality and is designed solely for protecting users from phishing attacks.