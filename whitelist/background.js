/**
 * Cerberus Background Service Worker
 * Handles Layer 1 whitelist checking and coordinates the 5-layer defense system
 */

importScripts('src/whitelist-manager.js');

class CerberusBackground {
  constructor() {
    this.whitelistManager = new WhitelistManager();
    this.stats = {
      totalChecks: 0,
      whitelistHits: 0,
      averageResponseTimes: [],
      lastDayStats: []
    };

    this.init();
  }

  async init() {
    await this.whitelistManager.init();
    this.setupEventListeners();
    this.loadStats();
    console.log('Cerberus background service initialized');
  }

  setupEventListeners() {
    // Handle tab updates to check for login attempts
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // Handle content script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Update icon based on current tab
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      this.updateIcon(tab);
    });

    // Handle extension icon clicks
    chrome.action.onClicked.addListener((tab) => {
      // This will be handled by the popup
    });

    // Periodic stats cleanup and dynamic whitelist updates
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'cerberus-daily-tasks') {
        this.performDailyTasks();
      }
    });

    // Set up daily tasks alarm
    chrome.alarms.create('cerberus-daily-tasks', {
      delayInMinutes: 60, // First run in 1 hour
      periodInMinutes: 24 * 60 // Run daily
    });
  }

  /**
   * Handle tab updates - check if tab might need protection
   */
  async handleTabUpdate(tabId, tab) {
    try {
      const isWhitelisted = await this.checkWhitelist(tab.url);
      this.updateIcon(tab, isWhitelisted);

      // Store tab info for potential login detection
      await chrome.storage.session.set({
        [`tab_${tabId}`]: {
          url: tab.url,
          domain: this.whitelistManager.extractDomain(tab.url),
          isWhitelisted,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }

  /**
   * Handle messages from content scripts and popup
   */
  async handleMessage(message, sender, sendResponse) {
    const startTime = performance.now();

    try {
      switch (message.type) {
        case 'CHECK_WHITELIST':
          const result = await this.handleWhitelistCheck(message.url);
          this.recordResponseTime(performance.now() - startTime);
          sendResponse(result);
          break;

        case 'LOGIN_ATTEMPT_DETECTED':
          const protection = await this.handleLoginAttempt(message, sender.tab);
          sendResponse(protection);
          break;

        case 'REPORT_FALSE_POSITIVE':
          await this.handleFalsePositiveReport(message);
          sendResponse({ success: true });
          break;

        case 'GET_STATS':
          const stats = await this.getDetailedStats();
          sendResponse(stats);
          break;

        case 'UPDATE_DYNAMIC_WHITELIST':
          await this.whitelistManager.updateDynamicWhitelist();
          sendResponse({ success: true });
          break;

        default:
          console.warn('Unknown message type:', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Layer 1: Fast whitelist check (<50ms target)
   */
  async handleWhitelistCheck(url) {
    const startTime = performance.now();

    try {
      const isWhitelisted = await this.whitelistManager.isWhitelisted(url);
      const responseTime = performance.now() - startTime;

      // Update statistics
      this.stats.totalChecks++;
      if (isWhitelisted) {
        this.stats.whitelistHits++;
      }

      this.recordResponseTime(responseTime);

      // Log slow responses for optimization
      if (responseTime > 50) {
        console.warn(`Slow whitelist check: ${responseTime.toFixed(2)}ms for ${url}`);
      }

      return {
        isWhitelisted,
        responseTime,
        layer: 1,
        action: isWhitelisted ? 'ALLOW' : 'PROCEED_TO_LAYER_2'
      };
    } catch (error) {
      console.error('Whitelist check failed:', error);
      return {
        isWhitelisted: false,
        responseTime: performance.now() - startTime,
        layer: 1,
        action: 'PROCEED_TO_LAYER_2',
        error: error.message
      };
    }
  }

  /**
   * Handle detected login attempts - trigger the 5-layer defense
   */
  async handleLoginAttempt(message, tab) {
    console.log('Login attempt detected on:', tab.url);

    // Start with Layer 1 check
    const layer1Result = await this.handleWhitelistCheck(tab.url);

    if (layer1Result.isWhitelisted) {
      // Domain is whitelisted - allow and exit
      return {
        action: 'ALLOW',
        layer: 1,
        reason: 'Domain is whitelisted',
        confidence: 100
      };
    }

    // If not whitelisted, signal to proceed to Layer 2 (blacklist check)
    // This would be handled by the content script or another component
    return {
      action: 'PROCEED_TO_LAYER_2',
      layer: 1,
      reason: 'Domain not in whitelist, proceeding to blacklist check',
      confidence: 0
    };
  }

  /**
   * Handle false positive reports for learning
   */
  async handleFalsePositiveReport(message) {
    try {
      // Store false positive for analysis
      const reports = await chrome.storage.local.get(['falsePositiveReports']) || { falsePositiveReports: [] };
      reports.falsePositiveReports.push({
        url: message.url,
        domain: this.whitelistManager.extractDomain(message.url),
        timestamp: Date.now(),
        userComment: message.comment || '',
        detectionLayer: message.layer || 'unknown'
      });

      // Keep only last 100 reports
      if (reports.falsePositiveReports.length > 100) {
        reports.falsePositiveReports = reports.falsePositiveReports.slice(-100);
      }

      await chrome.storage.local.set(reports);

      // Optionally add to user whitelist if user confirms
      if (message.addToWhitelist) {
        const domain = this.whitelistManager.extractDomain(message.url);
        await this.whitelistManager.addUserDomain(domain);
        console.log(`Added ${domain} to user whitelist due to false positive report`);
      }

    } catch (error) {
      console.error('Error handling false positive report:', error);
      throw error;
    }
  }

  /**
   * Update extension icon based on site status
   */
  async updateIcon(tab, isWhitelisted = null) {
    if (!tab || !tab.url) return;

    try {
      if (isWhitelisted === null) {
        isWhitelisted = await this.whitelistManager.isWhitelisted(tab.url);
      }

      let iconPath, badgeText, badgeColor, title;

      if (isWhitelisted) {
        iconPath = 'icons/icon-green.png';
        badgeText = '✓';
        badgeColor = '#4ade80';
        title = 'Cerberus - Trusted Site';
      } else if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        iconPath = 'icons/icon-gray.png';
        badgeText = '';
        badgeColor = '#6b7280';
        title = 'Cerberus - Browser Page';
      } else {
        iconPath = 'icons/icon48.png';
        badgeText = '';
        badgeColor = '#3b82f6';
        title = 'Cerberus - Monitoring';
      }

      await chrome.action.setIcon({
        path: iconPath,
        tabId: tab.id
      });

      await chrome.action.setBadgeText({
        text: badgeText,
        tabId: tab.id
      });

      await chrome.action.setBadgeBackgroundColor({
        color: badgeColor,
        tabId: tab.id
      });

      await chrome.action.setTitle({
        title: title,
        tabId: tab.id
      });

    } catch (error) {
      console.error('Error updating icon:', error);
    }
  }

  /**
   * Check whitelist for a URL
   */
  async checkWhitelist(url) {
    try {
      return await this.whitelistManager.isWhitelisted(url);
    } catch (error) {
      console.error('Whitelist check error:', error);
      return false;
    }
  }

  /**
   * Record response time for performance tracking
   */
  recordResponseTime(time) {
    this.stats.averageResponseTimes.push(time);

    // Keep only last 1000 measurements
    if (this.stats.averageResponseTimes.length > 1000) {
      this.stats.averageResponseTimes = this.stats.averageResponseTimes.slice(-1000);
    }

    // Update stored stats periodically
    if (this.stats.averageResponseTimes.length % 10 === 0) {
      this.saveStats();
    }
  }

  /**
   * Get detailed statistics
   */
  async getDetailedStats() {
    const whitelistStats = await this.whitelistManager.getStats();
    const avgResponseTime = this.stats.averageResponseTimes.length > 0
      ? this.stats.averageResponseTimes.reduce((sum, time) => sum + time, 0) / this.stats.averageResponseTimes.length
      : 0;

    return {
      ...whitelistStats,
      totalChecks: this.stats.totalChecks,
      whitelistHits: this.stats.whitelistHits,
      whitelistHitRate: this.stats.totalChecks > 0 ? (this.stats.whitelistHits / this.stats.totalChecks * 100).toFixed(1) : 0,
      averageResponseTime: Math.round(avgResponseTime * 100) / 100,
      responseTimeP95: this.calculatePercentile(this.stats.averageResponseTimes, 95),
      responseTimeP99: this.calculatePercentile(this.stats.averageResponseTimes, 99)
    };
  }

  /**
   * Calculate percentile for response times
   */
  calculatePercentile(times, percentile) {
    if (times.length === 0) return 0;

    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[index] * 100) / 100;
  }

  /**
   * Save statistics to storage
   */
  async saveStats() {
    try {
      const avgResponseTime = this.stats.averageResponseTimes.length > 0
        ? Math.round((this.stats.averageResponseTimes.reduce((sum, time) => sum + time, 0) / this.stats.averageResponseTimes.length) * 100) / 100
        : 0;

      await chrome.storage.local.set({
        totalDomainsChecked: this.stats.totalChecks,
        whitelistHits: this.stats.whitelistHits,
        averageResponseTime: avgResponseTime,
        lastStatsUpdate: Date.now()
      });
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  /**
   * Load statistics from storage
   */
  async loadStats() {
    try {
      const stored = await chrome.storage.local.get([
        'totalDomainsChecked',
        'whitelistHits',
        'averageResponseTime',
        'lastStatsUpdate'
      ]);

      this.stats.totalChecks = stored.totalDomainsChecked || 0;
      this.stats.whitelistHits = stored.whitelistHits || 0;

      console.log('Loaded stats:', this.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  /**
   * Perform daily maintenance tasks
   */
  async performDailyTasks() {
    try {
      console.log('Performing daily maintenance tasks...');

      // Update dynamic whitelist
      await this.whitelistManager.updateDynamicWhitelist();

      // Clean old session data
      const storage = await chrome.storage.session.get();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      for (const [key, value] of Object.entries(storage)) {
        if (key.startsWith('tab_') && value.timestamp && (now - value.timestamp) > oneDay) {
          await chrome.storage.session.remove(key);
        }
      }

      // Reset daily stats
      this.stats.lastDayStats.push({
        date: new Date().toISOString().split('T')[0],
        totalChecks: this.stats.totalChecks,
        whitelistHits: this.stats.whitelistHits,
        avgResponseTime: this.stats.averageResponseTimes.length > 0
          ? this.stats.averageResponseTimes.reduce((sum, time) => sum + time, 0) / this.stats.averageResponseTimes.length
          : 0
      });

      // Keep only last 30 days
      if (this.stats.lastDayStats.length > 30) {
        this.stats.lastDayStats = this.stats.lastDayStats.slice(-30);
      }

      await this.saveStats();

      console.log('Daily maintenance tasks completed');
    } catch (error) {
      console.error('Error during daily tasks:', error);
    }
  }
}

// Initialize background service
const cerberusBackground = new CerberusBackground();