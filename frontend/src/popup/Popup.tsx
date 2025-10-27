// Popup component for Cerberus extension

import React, { useState, useEffect } from 'react';

interface AnalysisResult {
  verdict: string;
  confidence: number;
  timestamp: number;
  url: string;
}

export const Popup: React.FC = () => {
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);

  useEffect(() => {
    // Load settings
    chrome.storage.local.get(['autoAnalyze'], (result) => {
      if (result.autoAnalyze !== undefined) {
        setAutoAnalyze(result.autoAnalyze);
      }
    });

    // Get current tab analysis result
    getCurrentTabResult();
  }, []);

  const getCurrentTabResult = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.storage.local.get([`analysis_${tab.id}`], (result) => {
          if (result[`analysis_${tab.id}`]) {
            setCurrentResult(result[`analysis_${tab.id}`]);
          }
        });
      }
    } catch (error) {
      console.error('Error getting tab result:', error);
    }
  };

  const analyzeCurrentPage = async () => {
    setIsAnalyzing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.runtime.sendMessage({ type: 'ANALYZE_PAGE' }, (response) => {
          if (response?.data) {
            const result: AnalysisResult = {
              verdict: response.data.verdict,
              confidence: response.data.confidence,
              timestamp: Date.now(),
              url: tab.url || ''
            };
            setCurrentResult(result);

            // Store result
            chrome.storage.local.set({ [`analysis_${tab.id}`]: result });
          }
          setIsAnalyzing(false);
        });
      }
    } catch (error) {
      console.error('Error analyzing page:', error);
      setIsAnalyzing(false);
    }
  };

  const toggleAutoAnalyze = () => {
    const newValue = !autoAnalyze;
    setAutoAnalyze(newValue);
    chrome.storage.local.set({ autoAnalyze: newValue });
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'safe':
        return '#22c55e';
      case 'suspicious':
        return '#f59e0b';
      case 'dangerous':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'safe':
        return '✓';
      case 'suspicious':
        return '⚠';
      case 'dangerous':
        return '✕';
      default:
        return '?';
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">Cerberus</h1>
        <p className="popup-subtitle">Phishing Protection</p>
      </header>

      <div className="popup-content">
        {currentResult ? (
          <div className="result-card">
            <div
              className="verdict-badge"
              style={{ backgroundColor: getVerdictColor(currentResult.verdict) }}
            >
              <span className="verdict-icon">{getVerdictIcon(currentResult.verdict)}</span>
              <span className="verdict-text">
                {currentResult.verdict.charAt(0).toUpperCase() + currentResult.verdict.slice(1)}
              </span>
            </div>
            <div className="confidence-bar">
              <div className="confidence-label">
                Confidence: {Math.round(currentResult.confidence * 100)}%
              </div>
              <div className="confidence-progress">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${currentResult.confidence * 100}%`,
                    backgroundColor: getVerdictColor(currentResult.verdict)
                  }}
                />
              </div>
            </div>
            <div className="timestamp">
              Last analyzed: {new Date(currentResult.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="no-result">
            <p>No analysis results yet</p>
          </div>
        )}

        <button
          className="analyze-button"
          onClick={analyzeCurrentPage}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Current Page'}
        </button>

        <div className="settings-section">
          <label className="setting-item">
            <input
              type="checkbox"
              checked={autoAnalyze}
              onChange={toggleAutoAnalyze}
            />
            <span>Auto-analyze pages on load</span>
          </label>
        </div>

        <div className="footer-links">
          <a href="#" onClick={() => chrome.runtime.openOptionsPage()}>
            Settings
          </a>
          <a href="https://github.com/yourusername/cerberus" target="_blank" rel="noopener noreferrer">
            About
          </a>
        </div>
      </div>
    </div>
  );
};

export default Popup;
