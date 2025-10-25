// Popup component for Cerberus extension
import React, { useState, useEffect } from 'react';
export const Popup = () => {
    const [currentResult, setCurrentResult] = useState(null);
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
        }
        catch (error) {
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
                        const result = {
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
        }
        catch (error) {
            console.error('Error analyzing page:', error);
            setIsAnalyzing(false);
        }
    };
    const toggleAutoAnalyze = () => {
        const newValue = !autoAnalyze;
        setAutoAnalyze(newValue);
        chrome.storage.local.set({ autoAnalyze: newValue });
    };
    const getVerdictColor = (verdict) => {
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
    const getVerdictIcon = (verdict) => {
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
    return (React.createElement("div", { className: "popup-container" },
        React.createElement("header", { className: "popup-header" },
            React.createElement("h1", { className: "popup-title" }, "Cerberus"),
            React.createElement("p", { className: "popup-subtitle" }, "Phishing Protection")),
        React.createElement("div", { className: "popup-content" },
            currentResult ? (React.createElement("div", { className: "result-card" },
                React.createElement("div", { className: "verdict-badge", style: { backgroundColor: getVerdictColor(currentResult.verdict) } },
                    React.createElement("span", { className: "verdict-icon" }, getVerdictIcon(currentResult.verdict)),
                    React.createElement("span", { className: "verdict-text" }, currentResult.verdict.charAt(0).toUpperCase() + currentResult.verdict.slice(1))),
                React.createElement("div", { className: "confidence-bar" },
                    React.createElement("div", { className: "confidence-label" },
                        "Confidence: ",
                        Math.round(currentResult.confidence * 100),
                        "%"),
                    React.createElement("div", { className: "confidence-progress" },
                        React.createElement("div", { className: "confidence-fill", style: {
                                width: `${currentResult.confidence * 100}%`,
                                backgroundColor: getVerdictColor(currentResult.verdict)
                            } }))),
                React.createElement("div", { className: "timestamp" },
                    "Last analyzed: ",
                    new Date(currentResult.timestamp).toLocaleTimeString()))) : (React.createElement("div", { className: "no-result" },
                React.createElement("p", null, "No analysis results yet"))),
            React.createElement("button", { className: "analyze-button", onClick: analyzeCurrentPage, disabled: isAnalyzing }, isAnalyzing ? 'Analyzing...' : 'Analyze Current Page'),
            React.createElement("div", { className: "settings-section" },
                React.createElement("label", { className: "setting-item" },
                    React.createElement("input", { type: "checkbox", checked: autoAnalyze, onChange: toggleAutoAnalyze }),
                    React.createElement("span", null, "Auto-analyze pages on load"))),
            React.createElement("div", { className: "footer-links" },
                React.createElement("a", { href: "#", onClick: () => chrome.runtime.openOptionsPage() }, "Settings"),
                React.createElement("a", { href: "https://github.com/yourusername/cerberus", target: "_blank", rel: "noopener noreferrer" }, "About")))));
};
export default Popup;
//# sourceMappingURL=Popup.js.map