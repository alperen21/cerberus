/**
 * Cerberus Content Script
 * Detects login attempts and triggers the 5-layer defense system
 * Implements Layer 1 whitelist checking integration
 */

class CerberusContentScript {
  constructor() {
    this.loginDetected = false;
    this.passwordFields = [];
    this.usernameFields = [];
    this.isProcessing = false;
    this.lastCheck = 0;
    this.checkThrottle = 1000; // 1 second throttle

    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupDetection());
    } else {
      this.setupDetection();
    }

    // Listen for dynamic content changes
    this.setupMutationObserver();

    console.log('Cerberus content script initialized on:', window.location.hostname);
  }

  /**
   * Set up login detection mechanisms
   */
  setupDetection() {
    this.detectPasswordFields();
    this.setupEventListeners();
    this.performInitialCheck();
  }

  /**
   * Detect password and username fields on the page
   */
  detectPasswordFields() {
    // Find password fields
    this.passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));

    // Find potential username fields
    this.usernameFields = Array.from(document.querySelectorAll('input[type="email"], input[type="text"]'))
      .filter(input => {
        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        const autocomplete = input.autocomplete?.toLowerCase() || '';

        return (
          name.includes('user') || name.includes('email') || name.includes('login') ||
          id.includes('user') || id.includes('email') || id.includes('login') ||
          placeholder.includes('user') || placeholder.includes('email') || placeholder.includes('login') ||
          autocomplete.includes('username') || autocomplete.includes('email')
        );
      });

    console.log(`Detected ${this.passwordFields.length} password fields and ${this.usernameFields.length} username fields`);
  }

  /**
   * Set up event listeners for login detection
   */
  setupEventListeners() {
    // Listen for focus on password fields (most reliable trigger)
    this.passwordFields.forEach(field => {
      field.addEventListener('focus', () => this.onLoginAttemptDetected('password_focus'));
      field.addEventListener('input', () => this.onLoginAttemptDetected('password_input'));
    });

    // Listen for focus on username fields
    this.usernameFields.forEach(field => {
      field.addEventListener('focus', () => this.onLoginAttemptDetected('username_focus'));
    });

    // Listen for form submissions
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      // Check if form contains password fields
      const hasPasswordField = form.querySelector('input[type="password"]');
      if (hasPasswordField) {
        form.addEventListener('submit', (e) => this.onLoginSubmitDetected(e, form));
      }
    });

    // Listen for specific button clicks (Sign In, Log In, etc.)
    this.setupLoginButtonDetection();
  }

  /**
   * Set up detection for login buttons
   */
  setupLoginButtonDetection() {
    const loginKeywords = ['sign in', 'log in', 'login', 'submit', 'enter', 'continue'];
    const buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');

    buttons.forEach(button => {
      const text = (button.textContent || button.value || '').toLowerCase();
      const hasLoginKeyword = loginKeywords.some(keyword => text.includes(keyword));

      if (hasLoginKeyword) {
        button.addEventListener('click', () => this.onLoginAttemptDetected('login_button_click'));
      }
    });
  }

  /**
   * Set up mutation observer to detect dynamically added login forms
   */
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldRecheck = false;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if new password fields were added
            const newPasswordFields = node.querySelectorAll?.('input[type="password"]') || [];
            if (newPasswordFields.length > 0) {
              shouldRecheck = true;
            }
          }
        });
      });

      if (shouldRecheck) {
        setTimeout(() => this.setupDetection(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Handle detected login attempts
   */
  async onLoginAttemptDetected(trigger) {
    // Throttle checks to avoid spam
    const now = Date.now();
    if (now - this.lastCheck < this.checkThrottle || this.isProcessing) {
      return;
    }

    this.lastCheck = now;
    this.isProcessing = true;

    try {
      console.log(`Login attempt detected via: ${trigger} on ${window.location.hostname}`);

      // First, check if this is already a trusted domain (Layer 1)
      const whitelistResult = await this.checkWhitelist();

      if (whitelistResult.isWhitelisted) {
        console.log('Domain is whitelisted, allowing login attempt');
        this.showStatusIndicator('trusted');
        this.isProcessing = false;
        return;
      }

      console.log('Domain not whitelisted, would proceed to Layer 2 (blacklist check)');
      this.showStatusIndicator('checking');

      // In a full implementation, this would trigger the remaining layers
      // For now, we'll just show that Layer 1 completed
      this.handleNonWhitelistedSite(trigger);

    } catch (error) {
      console.error('Error during login attempt detection:', error);
      this.showStatusIndicator('error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle form submission detection
   */
  async onLoginSubmitDetected(event, form) {
    console.log('Login form submission detected');

    // Get form data for analysis (in a privacy-preserving way)
    const formData = this.analyzeForm(form);

    await this.onLoginAttemptDetected('form_submit');

    // In a full implementation, this might temporarily prevent submission
    // while layers 2-5 are processed
  }

  /**
   * Analyze form structure for login indicators
   */
  analyzeForm(form) {
    const passwordFields = form.querySelectorAll('input[type="password"]');
    const emailFields = form.querySelectorAll('input[type="email"]');
    const textFields = form.querySelectorAll('input[type="text"]');

    return {
      hasPasswordField: passwordFields.length > 0,
      hasEmailField: emailFields.length > 0,
      hasUsernameField: textFields.length > 0,
      fieldCount: passwordFields.length + emailFields.length + textFields.length,
      action: form.action || window.location.href,
      method: form.method || 'GET'
    };
  }

  /**
   * Check whitelist via background script (Layer 1)
   */
  async checkWhitelist() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CHECK_WHITELIST',
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: Date.now()
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Whitelist check failed:', chrome.runtime.lastError);
          resolve({ isWhitelisted: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Handle sites that are not whitelisted
   */
  async handleNonWhitelistedSite(trigger) {
    // Notify background script about login attempt on non-whitelisted site
    chrome.runtime.sendMessage({
      type: 'LOGIN_ATTEMPT_DETECTED',
      url: window.location.href,
      domain: window.location.hostname,
      trigger: trigger,
      timestamp: Date.now(),
      pageInfo: {
        title: document.title,
        hasHTTPS: window.location.protocol === 'https:',
        passwordFieldCount: this.passwordFields.length,
        usernameFieldCount: this.usernameFields.length
      }
    }, (response) => {
      if (response && response.action === 'PROCEED_TO_LAYER_2') {
        console.log('Proceeding to Layer 2: Blacklist check');
        // In full implementation, this would trigger Layer 2
      }
    });
  }

  /**
   * Perform initial check when page loads
   */
  async performInitialCheck() {
    // Only check if there are login fields present
    if (this.passwordFields.length > 0 || this.usernameFields.length > 0) {
      const whitelistResult = await this.checkWhitelist();

      if (whitelistResult.isWhitelisted) {
        this.showStatusIndicator('trusted');
      } else {
        this.showStatusIndicator('monitoring');
      }
    }
  }

  /**
   * Show visual status indicator
   */
  showStatusIndicator(status) {
    // Remove existing indicator
    const existingIndicator = document.getElementById('cerberus-status-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create new indicator
    const indicator = document.createElement('div');
    indicator.id = 'cerberus-status-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 999999;
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    let icon, text, color;

    switch (status) {
      case 'trusted':
        icon = '🛡️';
        text = 'Trusted Site';
        color = '#059669';
        break;
      case 'checking':
        icon = '⏳';
        text = 'Checking...';
        color = '#d97706';
        break;
      case 'monitoring':
        icon = '👁️';
        text = 'Monitoring';
        color = '#3b82f6';
        break;
      case 'error':
        icon = '⚠️';
        text = 'Error';
        color = '#dc2626';
        break;
      default:
        icon = '🛡️';
        text = 'Protected';
        color = '#6b7280';
    }

    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; color: ${color};">
        <span>${icon}</span>
        <span>Cerberus: ${text}</span>
      </div>
    `;

    indicator.style.borderColor = color;

    // Add click handler to show more info
    indicator.addEventListener('click', () => {
      this.showDetailedStatus();
    });

    document.body.appendChild(indicator);

    // Auto-hide after 3 seconds for non-critical statuses
    if (status === 'checking' || status === 'monitoring') {
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.style.opacity = '0.7';
          indicator.style.transform = 'scale(0.9)';
        }
      }, 3000);
    }
  }

  /**
   * Show detailed status popup
   */
  showDetailedStatus() {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      margin: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;

    modal.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="32" height="32" style="border-radius: 6px;">
        <h2 style="margin: 0; font-size: 18px; color: #1f2937;">Cerberus Protection Status</h2>
      </div>

      <div style="margin-bottom: 16px;">
        <strong style="color: #374151;">Current Site:</strong> ${window.location.hostname}<br>
        <strong style="color: #374151;">Password Fields:</strong> ${this.passwordFields.length}<br>
        <strong style="color: #374151;">Username Fields:</strong> ${this.usernameFields.length}
      </div>

      <div style="padding: 12px; background: #f9fafb; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #6b7280;">
        Cerberus is monitoring this page for phishing attempts. If you're on a legitimate login page, you can add it to your trusted sites.
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="cerberus-close" style="
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          color: #374151;
          cursor: pointer;
          font-size: 13px;
        ">Close</button>
        <button id="cerberus-trust" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #3b82f6;
          color: white;
          cursor: pointer;
          font-size: 13px;
        ">Add to Trusted</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event listeners
    modal.querySelector('#cerberus-close').addEventListener('click', () => {
      overlay.remove();
    });

    modal.querySelector('#cerberus-trust').addEventListener('click', () => {
      this.addToTrustedSites();
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * Add current site to trusted domains
   */
  addToTrustedSites() {
    chrome.runtime.sendMessage({
      type: 'ADD_TO_WHITELIST',
      domain: window.location.hostname,
      url: window.location.href
    }, (response) => {
      if (response && response.success) {
        this.showStatusIndicator('trusted');

        // Show success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 50px;
          right: 10px;
          z-index: 999999;
          background: #059669;
          color: white;
          padding: 12px 16px;
          border-radius: 6px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        `;
        notification.textContent = `Added ${window.location.hostname} to trusted sites`;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
      }
    });
  }
}

// Initialize content script
const cerberusContent = new CerberusContentScript();