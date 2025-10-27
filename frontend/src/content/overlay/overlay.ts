// Main overlay component for displaying analysis results

import { BackendResponse, Highlight, SuggestedAction } from '../../common/types';
import { safeSetInnerHTML } from '../../common/dom-sanitize';
import { createHighlightBox, getHighlightCoords } from '../dom-mappers';
import {
  getVerdictColors,
  getVerdictLabel,
  getVerdictIcon,
  formatConfidence,
  createProgressBar,
  createBackdrop,
  debounce
} from './overlay-utils';

let overlayContainer: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

/**
 * Create and show the overlay
 */
export function createOverlay(response: BackendResponse): void {
  // Remove existing overlay if present
  removeOverlay();

  // Create shadow DOM container for CSS isolation
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'cerberus-overlay-root';
  shadowRoot = overlayContainer.attachShadow({ mode: 'open' });

  // Add styles
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('src/content/overlay/overlay.css');
  shadowRoot.appendChild(styleLink);

  // Create overlay content
  const overlayContent = createOverlayContent(response);
  shadowRoot.appendChild(overlayContent);

  // Append to document
  document.documentElement.appendChild(overlayContainer);

  // Add highlight boxes if there are highlights
  if (response.highlights && response.highlights.length > 0) {
    createHighlightBoxes(response.highlights);
  }

  // Handle window resize
  window.addEventListener('resize', handleResize);
}

/**
 * Remove the overlay
 */
export function removeOverlay(): void {
  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
    shadowRoot = null;
  }

  // Remove highlight boxes
  removeHighlightBoxes();

  // Remove event listeners
  window.removeEventListener('resize', handleResize);
}

/**
 * Create overlay content structure
 */
function createOverlayContent(response: BackendResponse): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'cerberus-overlay-container';

  const colors = getVerdictColors(response.verdict);
  const isBlocking = response.verdict === 'dangerous' && response.confidence >= 0.85;

  // Add backdrop for blocking overlays
  if (isBlocking) {
    const backdrop = createBackdrop(0.7);
    container.appendChild(backdrop);
  }

  // Create main panel
  const panel = document.createElement('div');
  panel.className = `cerberus-panel ${isBlocking ? 'cerberus-panel-blocking' : 'cerberus-panel-warning'}`;
  panel.style.borderColor = colors.border;

  // Header
  const header = createHeader(response, colors);
  panel.appendChild(header);

  // Confidence bar
  const confidenceSection = createConfidenceSection(response.confidence, colors);
  panel.appendChild(confidenceSection);

  // Reasons
  if (response.reasons && response.reasons.length > 0) {
    const reasonsSection = createReasonsSection(response.reasons);
    panel.appendChild(reasonsSection);
  }

  // Explanation
  if (response.explanation || response.explanation_html) {
    const explanationSection = createExplanationSection(response);
    panel.appendChild(explanationSection);
  }

  // Suggested actions
  if (response.suggested_actions && response.suggested_actions.length > 0) {
    const actionsSection = createActionsSection(response.suggested_actions, colors);
    panel.appendChild(actionsSection);
  }

  // Close button (for non-blocking overlays)
  if (!isBlocking) {
    const closeButton = createCloseButton();
    panel.appendChild(closeButton);
  }

  container.appendChild(panel);

  // Top badge (small indicator)
  const badge = createTopBadge(response, colors);
  container.appendChild(badge);

  return container;
}

/**
 * Create header section
 */
function createHeader(response: BackendResponse, colors: any): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'cerberus-header';
  header.style.backgroundColor = colors.background;
  header.style.borderColor = colors.border;

  const icon = document.createElement('span');
  icon.className = 'cerberus-verdict-icon';
  icon.textContent = getVerdictIcon(response.verdict);
  icon.style.color = colors.primary;

  const title = document.createElement('h2');
  title.className = 'cerberus-title';
  title.textContent = `${getVerdictLabel(response.verdict)} Website`;
  title.style.color = colors.text;

  header.appendChild(icon);
  header.appendChild(title);

  return header;
}

/**
 * Create confidence section
 */
function createConfidenceSection(confidence: number, colors: any): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'cerberus-confidence-section';

  const label = document.createElement('div');
  label.className = 'cerberus-label';
  label.textContent = `Confidence: ${formatConfidence(confidence)}`;

  const progressBar = createProgressBar(confidence, colors.primary);

  section.appendChild(label);
  section.appendChild(progressBar);

  return section;
}

/**
 * Create reasons section
 */
function createReasonsSection(reasons: any[]): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'cerberus-reasons-section';

  const title = document.createElement('h3');
  title.className = 'cerberus-section-title';
  title.textContent = 'Why this was flagged:';

  const list = document.createElement('ul');
  list.className = 'cerberus-reasons-list';

  reasons.forEach((reason) => {
    const item = document.createElement('li');
    item.className = 'cerberus-reason-item';

    const labelSpan = document.createElement('strong');
    labelSpan.textContent = reason.label;

    const detailSpan = document.createElement('span');
    detailSpan.textContent = ` - ${reason.detail}`;

    item.appendChild(labelSpan);
    item.appendChild(detailSpan);
    list.appendChild(item);
  });

  section.appendChild(title);
  section.appendChild(list);

  return section;
}

/**
 * Create explanation section
 */
function createExplanationSection(response: BackendResponse): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'cerberus-explanation-section';

  const title = document.createElement('h3');
  title.className = 'cerberus-section-title';
  title.textContent = 'Details:';

  const content = document.createElement('div');
  content.className = 'cerberus-explanation-content';

  if (response.explanation_html) {
    safeSetInnerHTML(content, response.explanation_html);
  } else {
    content.textContent = response.explanation;
  }

  section.appendChild(title);
  section.appendChild(content);

  return section;
}

/**
 * Create actions section
 */
function createActionsSection(actions: SuggestedAction[], colors: any): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'cerberus-actions-section';

  actions.forEach((action) => {
    const button = document.createElement('button');
    button.className = 'cerberus-action-button';
    button.textContent = action.label;

    // Style based on action type
    if (action.action === 'leave') {
      button.style.backgroundColor = colors.primary;
      button.style.color = '#ffffff';
    }

    button.addEventListener('click', () => handleAction(action.action));

    section.appendChild(button);
  });

  return section;
}

/**
 * Create close button
 */
function createCloseButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'cerberus-close-button';
  button.textContent = '×';
  button.addEventListener('click', removeOverlay);
  return button;
}

/**
 * Create top badge
 */
function createTopBadge(response: BackendResponse, colors: any): HTMLDivElement {
  const badge = document.createElement('div');
  badge.className = 'cerberus-top-badge';
  badge.style.backgroundColor = colors.primary;
  badge.textContent = getVerdictIcon(response.verdict);
  return badge;
}

/**
 * Create highlight boxes on the page
 */
function createHighlightBoxes(highlights: Highlight[]): void {
  highlights.forEach((highlight, index) => {
    const coords = getHighlightCoords(highlight);
    if (coords) {
      const box = createHighlightBox(highlight, coords, (h) => {
        // Show magnifier if crop is available
        if (h.crop_base64) {
          showMagnifier(h.crop_base64, coords);
        }
      });

      // Add number badge
      const badge = document.createElement('div');
      badge.className = 'cerberus-highlight-badge';
      badge.textContent = (index + 1).toString();
      box.appendChild(badge);

      document.body.appendChild(box);
    }
  });
}

/**
 * Remove highlight boxes
 */
function removeHighlightBoxes(): void {
  const boxes = document.querySelectorAll('.cerberus-highlight-box');
  boxes.forEach((box) => box.remove());
}

/**
 * Show magnifier with cropped image
 */
function showMagnifier(cropBase64: string, coords: any): void {
  const magnifier = document.createElement('div');
  magnifier.className = 'cerberus-magnifier';

  const img = document.createElement('img');
  img.src = `data:image/png;base64,${cropBase64}`;

  magnifier.appendChild(img);
  document.body.appendChild(magnifier);

  // Position near the highlight
  magnifier.style.left = `${coords.x + coords.width + 10}px`;
  magnifier.style.top = `${coords.y}px`;

  // Remove on click outside
  setTimeout(() => {
    const removeHandler = () => {
      magnifier.remove();
      document.removeEventListener('click', removeHandler);
    };
    document.addEventListener('click', removeHandler);
  }, 100);
}

/**
 * Handle user action
 */
function handleAction(action: string): void {
  chrome.runtime.sendMessage({
    type: 'USER_ACTION',
    payload: {
      action,
      url: window.location.href,
      tabId: chrome.devtools?.inspectedWindow?.tabId
    }
  });

  if (action === 'continue') {
    removeOverlay();
  }
}

/**
 * Handle window resize
 */
const handleResize = debounce(() => {
  // Reposition highlights if needed
  const boxes = document.querySelectorAll('.cerberus-highlight-box');
  boxes.forEach((box) => box.remove());
}, 300);
