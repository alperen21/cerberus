# Cerberus - AI-Powered Phishing Shield

A Chrome extension that uses AI-powered multi-layered detection to identify phishing websites in real-time, leveraging Chrome's Built-in AI APIs (Gemini Nano) to protect users during login attempts.

## Features

### 🛡️ 5-Layer Defense System

1. **Layer 1: Global Whitelist Check** (<50ms)
   - Pre-approved trusted domains (Google, Amazon, etc.)
   - User-added trusted domains
   - Dynamic whitelist from CrUX API (high-reputation domains)

2. **Layer 2: Blacklist Check** (<50ms)
   - Known phishing domains from threat feeds

3. **Layer 3: User Cache Check** (<100ms)
   - Frequently visited sites (≥10 visits in 20 days)
   - Personalized trusted domains

4. **Layer 4: Client-Side AI Analysis** (500ms-1.5s)
   - Partial screenshot capture (incremental, stops at logo)
   - HTML content analysis (parallel)
   - Navigation history review
   - Uses Prompt API (multimodal) with Gemini Nano

5. **Layer 5: Server-Side AI Analysis** (2-5s)
   - Full page screenshot + complete HTML
   - Domain metadata (WHOIS, SSL cert, age)
   - External threat intelligence APIs

## Whitelist System

### Three-Tier Whitelist Architecture

#### 1. Global Trusted Domains
Pre-configured list of major trusted websites including:
- **Tech Companies**: Google, Microsoft, Apple, Amazon, Meta
- **Financial Institutions**: Major banks, PayPal, Stripe
- **E-commerce**: eBay, Shopify, Walmart, Target
- **Social Platforms**: Twitter, LinkedIn, Reddit, Discord
- **Development**: GitHub, Stack Overflow, npm
- **Government/Education**: .gov and .edu domains

#### 2. User-Added Trusted Domains
- Users can manually add domains they trust
- Persistent storage across browser sessions
- Easy management through popup interface
- Export/import functionality for backup

#### 3. Dynamic Whitelist (CrUX API Integration)
- Automatically identifies high-reputation domains
- Based on Chrome User Experience Report data
- Analyzes performance metrics:
  - Largest Contentful Paint (LCP)
  - First Contentual Paint (FCP)
  - Interaction to Next Paint (INP)
  - Cumulative Layout Shift (CLS)
- Updates daily with configurable thresholds

### Google CrUX API Integration

The extension uses Google's Chrome User Experience Report API to identify high-reputation domains based on real user performance data.

#### Setup Instructions

1. **Get a Google Cloud API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable the Chrome UX Report API
   - Create credentials (API Key)
   - Restrict the key to Chrome UX Report API

2. **Configure in Extension**:
   - Click the Cerberus extension icon
   - Go to Settings
   - Enter your API key in "Google CrUX API Configuration"
   - Click "Test" to verify the key works
   - Click "Save"

#### How CrUX Reputation Scoring Works

The extension analyzes domains using multiple performance metrics:

- **LCP Score**: Sites with LCP ≤ 2.5s get full points
- **INP Score**: Sites with INP ≤ 200ms get full points
- **CLS Score**: Sites with CLS ≤ 0.1 get full points
- **Overall Score**: Weighted average (0-100 scale)

Domains scoring ≥70 are considered high-reputation and added to the dynamic whitelist.

## Installation

### Development Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `cerberus` directory

### Production Installation

1. Download the latest release from the Chrome Web Store
2. Click "Add to Chrome"
3. Grant necessary permissions

## Usage

### Basic Operation

1. **Automatic Protection**: Cerberus automatically monitors pages for login attempts
2. **Visual Indicators**: Extension icon changes color based on site status:
   - 🟢 Green: Trusted site
   - 🟡 Yellow: Under review/suspicious
   - 🔴 Red: Phishing detected

3. **Login Detection**: Triggers when users:
   - Focus on password fields
   - Focus on username/email fields
   - Click login buttons
   - Submit login forms

### Managing Whitelist

1. **View Current Site Status**:
   - Click the Cerberus extension icon
   - See if current site is trusted
   - Add/remove from trusted list

2. **Manage Trusted Domains**:
   - Click "Manage Whitelist"
   - Add new domains manually
   - Remove domains you no longer trust
   - View dynamic whitelist from CrUX

3. **Export/Import Settings**:
   - Go to Settings
   - Export whitelist for backup
   - Import previously saved whitelist

### Statistics

View protection statistics including:
- Total domains checked
- Whitelist hit rate
- Average response time
- Last CrUX update

## API Configuration

### Required Permissions

- `activeTab`: Monitor current tab for login attempts
- `storage`: Save whitelist and user preferences
- `tabs`: Track navigation for user cache
- `scripting`: Inject content scripts for detection
- `background`: Run background service worker

### CrUX API Rate Limits

- 150 queries per minute per project
- Extension automatically handles rate limiting
- Updates run once per day to stay within limits

## Privacy

- **Local Processing**: Layer 1-3 run entirely locally
- **No Personal Data**: Only domain names are analyzed
- **Optional Cloud**: CrUX API is optional, disable anytime
- **No Tracking**: Extension doesn't track user behavior

## Performance

### Layer 1 Benchmarks

- **Target**: <50ms per check
- **Typical**: 5-15ms for whitelist hits
- **Memory**: ~2MB for whitelist data
- **Storage**: <1MB for user data

### Optimization Features

- **Parallel Processing**: Multiple checks run simultaneously
- **Intelligent Caching**: Frequent sites cached locally
- **Progressive Capture**: Only capture necessary screenshots
- **Smart Escalation**: Only 10-20% of cases need server analysis

## Development

### Project Structure

```
cerberus/
├── manifest.json              # Extension manifest
├── background.js              # Service worker
├── content.js                 # Content script
├── popup.html                 # Extension popup
├── scripts/
│   └── popup.js              # Popup interface logic
├── src/
│   └── whitelist/
│       ├── whitelist-manager.js    # Core whitelist logic
│       └── crux-integration.js     # CrUX API integration
├── styles/
│   └── popup.css             # Popup styling
└── icons/                    # Extension icons
```

### Key Classes

- **WhitelistManager**: Core whitelist functionality
- **CruxIntegration**: Google CrUX API integration
- **PopupController**: UI management
- **CerberusBackground**: Background service coordination
- **CerberusContentScript**: Login detection

### Testing

1. **Unit Tests**: Test whitelist logic
2. **Integration Tests**: Test CrUX API integration
3. **E2E Tests**: Test full login detection flow
4. **Performance Tests**: Verify <50ms Layer 1 response

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-repo/cerberus/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/your-repo/cerberus/discussions)
- **Security**: Report security issues privately to security@cerberus.ai

## Roadmap

### Current Release (v1.0)
- ✅ Layer 1: Whitelist checking
- ✅ CrUX API integration
- ✅ User whitelist management
- ✅ Performance optimization

### Next Release (v1.1)
- 🔄 Layer 2: Blacklist checking
- 🔄 Layer 3: User cache
- 🔄 Enhanced UI/UX

### Future Releases
- 📅 Layer 4: Client-side AI analysis
- 📅 Layer 5: Server-side AI analysis
- 📅 Educational chatbot sidebar
- 📅 Advanced threat intelligence

## Chrome Built-in AI Integration

This extension is designed to leverage Chrome's Built-in AI APIs including:

- **Prompt API**: For multimodal analysis (screenshots + text)
- **Summarizer API**: To condense page content
- **Translator API**: To detect obfuscation tactics

*Note: Built-in AI APIs are currently in development. The extension is designed to integrate these APIs when they become available.*