/**
 * Cerberus Whitelist Manager
 * Implements Layer 1 defense: Global Whitelist Check (<50ms)
 * Manages three types of trusted domains:
 * 1. Global trusted domains (hardcoded)
 * 2. User-added trusted domains
 * 3. Dynamic whitelist from CrUX API (high-reputation domains)
 */

class WhitelistManager {
  constructor() {
    this.globalTrustedDomains = new Set([
      // Major Tech Companies
      'google.com', 'gmail.com', 'youtube.com', 'blogger.com', 'google.co.uk',
      'microsoft.com', 'outlook.com', 'live.com', 'hotmail.com', 'office.com',
      'apple.com', 'icloud.com',
      'amazon.com', 'aws.amazon.com', 'amazon.co.uk', 'amazon.de',
      'meta.com', 'facebook.com', 'instagram.com', 'whatsapp.com',

      // Financial Institutions (Major Banks)
      'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com',
      'usbank.com', 'capitalone.com', 'discover.com', 'americanexpress.com',
      'paypal.com', 'stripe.com', 'square.com',

      // Major E-commerce & Services
      'ebay.com', 'etsy.com', 'shopify.com', 'walmart.com', 'target.com',
      'bestbuy.com', 'costco.com', 'homedepot.com',

      // Social & Communication
      'twitter.com', 'x.com', 'linkedin.com', 'reddit.com', 'discord.com',
      'slack.com', 'zoom.us', 'teams.microsoft.com',

      // Cloud & Development
      'github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com',
      'docker.com', 'dropbox.com', 'onedrive.com',

      // Media & Entertainment
      'netflix.com', 'spotify.com', 'twitch.tv', 'hulu.com', 'disney.com',

      // Government & Education
      'irs.gov', 'usa.gov', 'medicare.gov', 'socialsecurity.gov',
      'edu', // All .edu domains

      // Major News & Information
      'wikipedia.org', 'cnn.com', 'bbc.com', 'nytimes.com', 'reuters.com'
    ]);

    this.cruxApiKey = null;
    this.dynamicWhitelist = new Set();
    this.lastDynamicUpdate = 0;
    this.DYNAMIC_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    this.init();
  }

  async init() {
    await this.loadUserDomains();
    await this.loadDynamicWhitelist();
    await this.loadCruxApiKey();
  }

  /**
   * Layer 1 Check: Fast whitelist verification (<50ms)
   * Returns true if domain is trusted, false otherwise
   */
  async isWhitelisted(url) {
    const startTime = performance.now();

    try {
      const domain = this.extractDomain(url);
      if (!domain) return false;

      // Check global trusted domains first (fastest)
      if (this.isGlobalTrusted(domain)) {
        this.logPerformance('global', startTime);
        return true;
      }

      // Check user-added domains
      const userDomains = await this.getUserDomains();
      if (userDomains.has(domain)) {
        this.logPerformance('user', startTime);
        return true;
      }

      // Check dynamic whitelist (CrUX-based)
      if (this.dynamicWhitelist.has(domain)) {
        this.logPerformance('dynamic', startTime);
        return true;
      }

      this.logPerformance('not_found', startTime);
      return false;
    } catch (error) {
      console.error('Whitelist check error:', error);
      return false;
    }
  }

  /**
   * Extract domain from URL, handling subdomains intelligently
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname.toLowerCase();

      // Handle www prefix
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }

      // For subdomains, check if parent domain is trusted
      const parts = hostname.split('.');
      if (parts.length > 2) {
        // Check full subdomain first, then parent domain
        return hostname;
      }

      return hostname;
    } catch (error) {
      console.error('Invalid URL:', url, error);
      return null;
    }
  }

  /**
   * Check if domain is in global trusted list
   * Handles both exact matches and parent domain matches
   */
  isGlobalTrusted(domain) {
    // Direct match
    if (this.globalTrustedDomains.has(domain)) {
      return true;
    }

    // Check parent domains for subdomains
    const parts = domain.split('.');
    if (parts.length > 2) {
      const parentDomain = parts.slice(-2).join('.');
      if (this.globalTrustedDomains.has(parentDomain)) {
        return true;
      }
    }

    // Special handling for .edu domains
    if (domain.endsWith('.edu')) {
      return true;
    }

    return false;
  }

  /**
   * Add domain to user whitelist
   */
  async addUserDomain(domain) {
    const userDomains = await this.getUserDomains();
    userDomains.add(domain.toLowerCase());

    await chrome.storage.local.set({
      userWhitelistedDomains: Array.from(userDomains)
    });

    console.log(`Added ${domain} to user whitelist`);
  }

  /**
   * Remove domain from user whitelist
   */
  async removeUserDomain(domain) {
    const userDomains = await this.getUserDomains();
    userDomains.delete(domain.toLowerCase());

    await chrome.storage.local.set({
      userWhitelistedDomains: Array.from(userDomains)
    });

    console.log(`Removed ${domain} from user whitelist`);
  }

  /**
   * Get user-added domains from storage
   */
  async getUserDomains() {
    const result = await chrome.storage.local.get(['userWhitelistedDomains']);
    return new Set(result.userWhitelistedDomains || []);
  }

  /**
   * Load user domains at startup
   */
  async loadUserDomains() {
    // This is handled by getUserDomains() when needed
  }

  /**
   * Load and initialize CrUX API key
   */
  async loadCruxApiKey() {
    const result = await chrome.storage.local.get(['cruxApiKey']);
    this.cruxApiKey = result.cruxApiKey;
  }

  /**
   * Set CrUX API key for dynamic whitelist updates
   */
  async setCruxApiKey(apiKey) {
    this.cruxApiKey = apiKey;
    await chrome.storage.local.set({ cruxApiKey: apiKey });
  }

  /**
   * Load dynamic whitelist from storage
   */
  async loadDynamicWhitelist() {
    const result = await chrome.storage.local.get(['dynamicWhitelist', 'lastDynamicUpdate']);
    this.dynamicWhitelist = new Set(result.dynamicWhitelist || []);
    this.lastDynamicUpdate = result.lastDynamicUpdate || 0;

    // Check if update is needed
    if (Date.now() - this.lastDynamicUpdate > this.DYNAMIC_UPDATE_INTERVAL) {
      this.updateDynamicWhitelist();
    }
  }

  /**
   * Update dynamic whitelist using CrUX API
   * Identifies high-reputation domains based on performance metrics
   */
  async updateDynamicWhitelist() {
    if (!this.cruxApiKey) {
      console.log('CrUX API key not configured, skipping dynamic whitelist update');
      return;
    }

    try {
      const highReputationDomains = await this.fetchHighReputationDomains();
      this.dynamicWhitelist = new Set([...this.dynamicWhitelist, ...highReputationDomains]);
      this.lastDynamicUpdate = Date.now();

      await chrome.storage.local.set({
        dynamicWhitelist: Array.from(this.dynamicWhitelist),
        lastDynamicUpdate: this.lastDynamicUpdate
      });

      console.log(`Updated dynamic whitelist with ${highReputationDomains.length} domains`);
    } catch (error) {
      console.error('Failed to update dynamic whitelist:', error);
    }
  }

  /**
   * Fetch high-reputation domains using CrUX API
   * Analyzes popular domains for good performance metrics
   */
  async fetchHighReputationDomains() {
    const popularDomains = [
      'reddit.com', 'stackoverflow.com', 'medium.com', 'github.com',
      'wikipedia.org', 'npmjs.com', 'docker.com', 'atlassian.com',
      'salesforce.com', 'adobe.com', 'nvidia.com', 'intel.com',
      'mongodb.com', 'postgresql.org', 'mysql.com', 'cloudflare.com'
    ];

    const highReputationDomains = [];

    for (const domain of popularDomains) {
      try {
        const metrics = await this.getCruxMetrics(domain);
        if (this.isHighReputation(metrics)) {
          highReputationDomains.push(domain);
        }

        // Rate limiting: 150 queries per minute
        await this.sleep(500); // 500ms between requests
      } catch (error) {
        console.warn(`Failed to get metrics for ${domain}:`, error);
      }
    }

    return highReputationDomains;
  }

  /**
   * Get CrUX metrics for a domain
   */
  async getCruxMetrics(domain) {
    const url = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

    const requestBody = {
      origin: `https://${domain}`,
      formFactor: 'DESKTOP',
      metrics: [
        'largest_contentful_paint',
        'first_contentful_paint',
        'interaction_to_next_paint',
        'cumulative_layout_shift'
      ]
    };

    const response = await fetch(`${url}?key=${this.cruxApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`CrUX API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Determine if metrics indicate high reputation
   * Good performance metrics suggest legitimate, well-maintained sites
   */
  isHighReputation(metrics) {
    if (!metrics.record || !metrics.record.metrics) {
      return false;
    }

    const { metrics: metricData } = metrics.record;

    // Check Largest Contentful Paint (LCP) - should be good (under 2.5s for 75th percentile)
    const lcp = metricData.largest_contentful_paint;
    if (lcp && lcp.percentiles && lcp.percentiles.p75 > 2500) {
      return false; // Poor LCP indicates potential issues
    }

    // Check Cumulative Layout Shift (CLS) - should be good (under 0.1 for 75th percentile)
    const cls = metricData.cumulative_layout_shift;
    if (cls && cls.percentiles && cls.percentiles.p75 > 0.1) {
      return false; // Poor CLS indicates potential issues
    }

    // Check Interaction to Next Paint (INP) - should be good (under 200ms for 75th percentile)
    const inp = metricData.interaction_to_next_paint;
    if (inp && inp.percentiles && inp.percentiles.p75 > 200) {
      return false; // Poor INP indicates potential issues
    }

    return true; // Passed all performance checks
  }

  /**
   * Utility function for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log performance metrics for Layer 1 optimization
   */
  logPerformance(type, startTime) {
    const duration = performance.now() - startTime;
    if (duration > 50) { // Log if exceeding 50ms target
      console.warn(`Whitelist check (${type}) took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get whitelist statistics for admin/debugging
   */
  async getStats() {
    const userDomains = await this.getUserDomains();

    return {
      globalTrustedCount: this.globalTrustedDomains.size,
      userDomainsCount: userDomains.size,
      dynamicWhitelistCount: this.dynamicWhitelist.size,
      lastDynamicUpdate: new Date(this.lastDynamicUpdate).toISOString(),
      cruxApiConfigured: !!this.cruxApiKey
    };
  }

  /**
   * Export whitelist data for backup/analysis
   */
  async exportWhitelist() {
    const userDomains = await this.getUserDomains();

    return {
      globalTrustedDomains: Array.from(this.globalTrustedDomains),
      userDomains: Array.from(userDomains),
      dynamicWhitelist: Array.from(this.dynamicWhitelist),
      exportDate: new Date().toISOString()
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WhitelistManager;
} else if (typeof window !== 'undefined') {
  window.WhitelistManager = WhitelistManager;
}