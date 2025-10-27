// Wrapper script to inject overlay without ES6 modules
// This script is injected by the service worker and creates the overlay

(function() {
  'use strict';

  // Simple overlay creation without dependencies
  window.cerberusCreateOverlay = function(response) {
    console.log('Creating Cerberus overlay with response:', response);

    // Remove existing overlay if present
    const existingOverlay = document.getElementById('cerberus-overlay-root');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create overlay container
    const overlayContainer = document.createElement('div');
    overlayContainer.id = 'cerberus-overlay-root';
    overlayContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483647;
      pointer-events: none;
    `;

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      pointer-events: all;
    `;

    // Create warning panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      pointer-events: all;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Determine colors based on verdict
    let color, icon, title;
    if (response.verdict === 'dangerous') {
      color = '#ef4444';
      icon = '⚠️';
      title = 'Warning: Potential Phishing Site Detected';
    } else if (response.verdict === 'suspicious') {
      color = '#f59e0b';
      icon = '⚠️';
      title = 'Caution: Suspicious Activity Detected';
    } else {
      color = '#22c55e';
      icon = '✓';
      title = 'Site Appears Safe';
    }

    // Build panel content
    panel.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 64px; margin-bottom: 16px;">${icon}</div>
        <h1 style="font-size: 24px; font-weight: 700; color: ${color}; margin: 0 0 8px 0;">${title}</h1>
        <p style="font-size: 14px; color: #6b7280; margin: 0;">Confidence: ${Math.round((response.confidence || 0) * 100)}%</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Analysis:</h3>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0;">
          ${response.explanation || response.reasons || 'No additional details available.'}
        </p>
      </div>

      ${response.suggested_actions && response.suggested_actions.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Suggested Actions:</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151;">
            ${response.suggested_actions.map(action => `<li style="margin-bottom: 4px;">${action.description || action}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="cerberus-leave-btn" style="
          background: ${color};
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        ">Leave This Site</button>

        <button id="cerberus-continue-btn" style="
          background: transparent;
          color: #6b7280;
          border: 2px solid #e5e7eb;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">Continue Anyway</button>
      </div>
    `;

    // Add hover effects
    const leaveBtn = panel.querySelector('#cerberus-leave-btn');
    const continueBtn = panel.querySelector('#cerberus-continue-btn');

    leaveBtn.addEventListener('mouseenter', () => {
      leaveBtn.style.opacity = '0.9';
    });
    leaveBtn.addEventListener('mouseleave', () => {
      leaveBtn.style.opacity = '1';
    });

    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.borderColor = '#9ca3af';
      continueBtn.style.color = '#374151';
    });
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.borderColor = '#e5e7eb';
      continueBtn.style.color = '#6b7280';
    });

    // Add button handlers
    leaveBtn.addEventListener('click', () => {
      window.history.back();
      overlayContainer.remove();
    });

    continueBtn.addEventListener('click', () => {
      overlayContainer.remove();
    });

    // Assemble and append
    overlayContainer.appendChild(backdrop);
    overlayContainer.appendChild(panel);
    document.documentElement.appendChild(overlayContainer);
  };
})();
