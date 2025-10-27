/**
 * Cerberus Popup Interface Controller
 * Handles the Chrome extension popup UI interactions and whitelist management
 */

class PopupController {
  constructor() {
    this.whitelistManager = new WhitelistManager();
    this.cruxIntegration = null;
    this.currentTab = null;
    this.currentDomain = null;

    this.init();
  }

  async init() {
    await this.whitelistManager.init();
    await this.loadCurrentTabInfo();
    await this.setupEventListeners();
    await this.updateUI();
    await this.initializeCruxIntegration();
  }

  /**
   * Load information about the current active tab
   */
  async loadCurrentTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;

      if (tab && tab.url) {
        this.currentDomain = this.whitelistManager.extractDomain(tab.url);
        this.updateCurrentSiteDisplay();
      }
    } catch (error) {
      console.error('Failed to load current tab info:', error);
    }
  }

  /**
   * Set up all event listeners for the popup interface
   */
  async setupEventListeners() {
    // Panel toggles
    document.getElementById('whitelistManagementBtn').addEventListener('click', () => {
      this.showPanel('whitelistPanel');
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.showPanel('settingsPanel');
    });

    document.getElementById('statsBtn').addEventListener('click', () => {
      this.showPanel('statsPanel');
      this.loadStatistics();
    });

    // Panel close buttons
    document.getElementById('closeWhitelistPanel').addEventListener('click', () => {
      this.hidePanel('whitelistPanel');
    });

    document.getElementById('closeSettingsPanel').addEventListener('click', () => {
      this.hidePanel('settingsPanel');
    });

    document.getElementById('closeStatsPanel').addEventListener('click', () => {
      this.hidePanel('statsPanel');
    });

    // Whitelist management
    document.getElementById('addToWhitelistBtn').addEventListener('click', () => {
      this.addCurrentSiteToWhitelist();
    });

    document.getElementById('removeFromWhitelistBtn').addEventListener('click', () => {
      this.removeCurrentSiteFromWhitelist();
    });

    document.getElementById('addDomainBtn').addEventListener('click', () => {
      this.addDomainFromInput();
    });

    document.getElementById('newDomainInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addDomainFromInput();
      }
    });

    // Settings
    document.getElementById('saveCruxApiBtn').addEventListener('click', () => {
      this.saveCruxApiKey();
    });

    document.getElementById('testCruxApiBtn').addEventListener('click', () => {
      this.testCruxApiKey();
    });

    // Export/Import
    document.getElementById('exportWhitelistBtn').addEventListener('click', () => {
      this.exportWhitelist();
    });

    document.getElementById('importWhitelistBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
      this.importWhitelist(e.target.files[0]);
    });

    // Dynamic whitelist refresh
    document.getElementById('refreshDynamicBtn').addEventListener('click', () => {
      this.refreshDynamicWhitelist();
    });
  }

  /**
   * Initialize CrUX integration if API key is available
   */
  async initializeCruxIntegration() {
    const result = await chrome.storage.local.get(['cruxApiKey']);
    if (result.cruxApiKey) {
      this.cruxIntegration = new CruxIntegration(result.cruxApiKey);
      document.getElementById('cruxApiKeyInput').value = '••••••••';
    }
  }

  /**
   * Update the current site display in the popup
   */
  updateCurrentSiteDisplay() {
    const domainElement = document.getElementById('siteDomain');
    const statusElement = document.getElementById('siteStatus');
    const statusBadge = document.getElementById('siteStatusBadge');
    const actionsElement = document.getElementById('siteActions');

    if (this.currentDomain) {
      domainElement.textContent = this.currentDomain;
      actionsElement.style.display = 'block';

      // Check if domain is whitelisted
      this.whitelistManager.isWhitelisted(this.currentTab.url).then(isWhitelisted => {
        if (isWhitelisted) {
          statusBadge.textContent = 'Trusted';
          statusBadge.className = 'status-badge trusted';
          document.getElementById('addToWhitelistBtn').style.display = 'none';
          document.getElementById('removeFromWhitelistBtn').style.display = 'inline-block';
        } else {
          statusBadge.textContent = 'Not Trusted';
          statusBadge.className = 'status-badge untrusted';
          document.getElementById('addToWhitelistBtn').style.display = 'inline-block';
          document.getElementById('removeFromWhitelistBtn').style.display = 'none';
        }
      });
    } else {
      domainElement.textContent = 'Invalid or local page';
      statusBadge.textContent = 'N/A';
      statusBadge.className = 'status-badge neutral';
      actionsElement.style.display = 'none';
    }
  }

  /**
   * Update the overall UI state
   */
  async updateUI() {
    await this.updateWhitelistDisplay();
    await this.updateSettings();
  }

  /**
   * Update whitelist displays in the management panel
   */
  async updateWhitelistDisplay() {
    // Update user domains list
    const userDomains = await this.whitelistManager.getUserDomains();
    const userDomainsCount = document.getElementById('userDomainsCount');
    const userDomainsList = document.getElementById('userDomainsList');

    userDomainsCount.textContent = userDomains.size;

    if (userDomains.size === 0) {
      userDomainsList.innerHTML = '<div class="empty-state">No trusted domains added yet</div>';
    } else {
      userDomainsList.innerHTML = Array.from(userDomains)
        .map(domain => `
          <div class="domain-item">
            <span class="domain-name">${domain}</span>
            <button class="btn-remove" onclick="popupController.removeUserDomain('${domain}')">×</button>
          </div>
        `).join('');
    }

    // Update dynamic domains count
    const dynamicDomainsCount = document.getElementById('dynamicDomainsCount');
    dynamicDomainsCount.textContent = this.whitelistManager.dynamicWhitelist.size;
  }

  /**
   * Update settings panel
   */
  async updateSettings() {
    const result = await chrome.storage.local.get(['enableDynamicWhitelist', 'enableSubdomainMatching']);

    document.getElementById('enableDynamicWhitelist').checked =
      result.enableDynamicWhitelist !== false; // Default to true

    document.getElementById('enableSubdomainMatching').checked =
      result.enableSubdomainMatching !== false; // Default to true
  }

  /**
   * Show a specific panel and hide others
   */
  showPanel(panelId) {
    // Hide all panels
    const panels = ['whitelistPanel', 'settingsPanel', 'statsPanel'];
    panels.forEach(id => {
      document.getElementById(id).style.display = 'none';
    });

    // Show selected panel
    document.getElementById(panelId).style.display = 'block';
  }

  /**
   * Hide a specific panel
   */
  hidePanel(panelId) {
    document.getElementById(panelId).style.display = 'none';
  }

  /**
   * Add current site to user whitelist
   */
  async addCurrentSiteToWhitelist() {
    if (!this.currentDomain) return;

    try {
      await this.whitelistManager.addUserDomain(this.currentDomain);
      this.showToast(`Added ${this.currentDomain} to trusted domains`, 'success');
      this.updateCurrentSiteDisplay();
      this.updateWhitelistDisplay();
    } catch (error) {
      this.showToast('Failed to add domain to whitelist', 'error');
      console.error('Error adding domain:', error);
    }
  }

  /**
   * Remove current site from user whitelist
   */
  async removeCurrentSiteFromWhitelist() {
    if (!this.currentDomain) return;

    try {
      await this.whitelistManager.removeUserDomain(this.currentDomain);
      this.showToast(`Removed ${this.currentDomain} from trusted domains`, 'success');
      this.updateCurrentSiteDisplay();
      this.updateWhitelistDisplay();
    } catch (error) {
      this.showToast('Failed to remove domain from whitelist', 'error');
      console.error('Error removing domain:', error);
    }
  }

  /**
   * Add domain from input field
   */
  async addDomainFromInput() {
    const input = document.getElementById('newDomainInput');
    const domain = input.value.trim().toLowerCase();

    if (!domain) {
      this.showToast('Please enter a domain', 'warning');
      return;
    }

    // Basic domain validation
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
      this.showToast('Please enter a valid domain (e.g., example.com)', 'error');
      return;
    }

    try {
      await this.whitelistManager.addUserDomain(domain);
      this.showToast(`Added ${domain} to trusted domains`, 'success');
      input.value = '';
      this.updateWhitelistDisplay();
    } catch (error) {
      this.showToast('Failed to add domain', 'error');
      console.error('Error adding domain:', error);
    }
  }

  /**
   * Remove a user domain from the whitelist
   */
  async removeUserDomain(domain) {
    try {
      await this.whitelistManager.removeUserDomain(domain);
      this.showToast(`Removed ${domain} from trusted domains`, 'success');
      this.updateWhitelistDisplay();
      if (this.currentDomain === domain) {
        this.updateCurrentSiteDisplay();
      }
    } catch (error) {
      this.showToast('Failed to remove domain', 'error');
      console.error('Error removing domain:', error);
    }
  }

  /**
   * Save CrUX API key
   */
  async saveCruxApiKey() {
    const apiKey = document.getElementById('cruxApiKeyInput').value.trim();

    if (!apiKey || apiKey === '••••••••') {
      this.showToast('Please enter a valid API key', 'warning');
      return;
    }

    try {
      await this.whitelistManager.setCruxApiKey(apiKey);
      this.cruxIntegration = new CruxIntegration(apiKey);
      document.getElementById('cruxApiKeyInput').value = '••••••••';
      this.showToast('CrUX API key saved successfully', 'success');

      // Test the API key
      const validation = await this.cruxIntegration.validateApiKey();
      if (validation.valid) {
        document.getElementById('cruxApiStatus').innerHTML =
          '<div class="status-success">✅ API key is valid and working</div>';
      } else {
        document.getElementById('cruxApiStatus').innerHTML =
          `<div class="status-error">❌ ${validation.message}</div>`;
      }
    } catch (error) {
      this.showToast('Failed to save API key', 'error');
      console.error('Error saving API key:', error);
    }
  }

  /**
   * Test CrUX API key
   */
  async testCruxApiKey() {
    if (!this.cruxIntegration) {
      this.showToast('Please save an API key first', 'warning');
      return;
    }

    this.showToast('Testing API key...', 'info');

    try {
      const validation = await this.cruxIntegration.validateApiKey();
      if (validation.valid) {
        document.getElementById('cruxApiStatus').innerHTML =
          '<div class="status-success">✅ API key is valid and working</div>';
        this.showToast('API key test successful', 'success');
      } else {
        document.getElementById('cruxApiStatus').innerHTML =
          `<div class="status-error">❌ ${validation.message}</div>`;
        this.showToast('API key test failed', 'error');
      }
    } catch (error) {
      this.showToast('API key test failed', 'error');
      console.error('API key test error:', error);
    }
  }

  /**
   * Refresh dynamic whitelist
   */
  async refreshDynamicWhitelist() {
    if (!this.cruxIntegration) {
      this.showToast('CrUX API key required for dynamic whitelist', 'warning');
      return;
    }

    this.showToast('Updating dynamic whitelist...', 'info');

    try {
      await this.whitelistManager.updateDynamicWhitelist();
      this.updateWhitelistDisplay();
      this.showToast('Dynamic whitelist updated successfully', 'success');
    } catch (error) {
      this.showToast('Failed to update dynamic whitelist', 'error');
      console.error('Dynamic whitelist update error:', error);
    }
  }

  /**
   * Export whitelist data
   */
  async exportWhitelist() {
    try {
      const data = await this.whitelistManager.exportWhitelist();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `cerberus-whitelist-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      this.showToast('Whitelist exported successfully', 'success');
    } catch (error) {
      this.showToast('Failed to export whitelist', 'error');
      console.error('Export error:', error);
    }
  }

  /**
   * Import whitelist data
   */
  async importWhitelist(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate import data
      if (!data.userDomains || !Array.isArray(data.userDomains)) {
        throw new Error('Invalid whitelist file format');
      }

      // Import user domains
      for (const domain of data.userDomains) {
        await this.whitelistManager.addUserDomain(domain);
      }

      this.updateWhitelistDisplay();
      this.showToast(`Imported ${data.userDomains.length} domains`, 'success');
    } catch (error) {
      this.showToast('Failed to import whitelist', 'error');
      console.error('Import error:', error);
    }
  }

  /**
   * Load and display statistics
   */
  async loadStatistics() {
    try {
      const stats = await this.whitelistManager.getStats();

      document.getElementById('whitelistedDomains').textContent =
        stats.globalTrustedCount + stats.userDomainsCount + stats.dynamicWhitelistCount;

      document.getElementById('globalTrustedCount').textContent = stats.globalTrustedCount;
      document.getElementById('userAddedCount').textContent = stats.userDomainsCount;
      document.getElementById('dynamicCount').textContent = stats.dynamicWhitelistCount;

      if (stats.lastDynamicUpdate && stats.lastDynamicUpdate !== '1970-01-01T00:00:00.000Z') {
        document.getElementById('lastUpdate').textContent =
          new Date(stats.lastDynamicUpdate).toLocaleDateString();
      } else {
        document.getElementById('lastUpdate').textContent = 'Never';
      }

      // Load additional stats from storage
      const storageStats = await chrome.storage.local.get([
        'totalDomainsChecked',
        'averageResponseTime'
      ]);

      document.getElementById('totalDomainsChecked').textContent =
        storageStats.totalDomainsChecked || '0';

      document.getElementById('avgResponseTime').textContent =
        storageStats.averageResponseTime ? `${storageStats.averageResponseTime}ms` : 'N/A';

    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
  }
}

// Initialize popup controller when DOM is loaded
let popupController;
document.addEventListener('DOMContentLoaded', () => {
  popupController = new PopupController();
});