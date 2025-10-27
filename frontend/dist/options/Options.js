// Options page for Cerberus extension
import React, { useState, useEffect } from 'react';
export const Options = () => {
    const [autoAnalyze, setAutoAnalyze] = useState(true);
    const [confidenceThreshold, setConfidenceThreshold] = useState(0.85);
    const [showNotifications, setShowNotifications] = useState(true);
    const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        // Load settings
        chrome.storage.local.get(['autoAnalyze', 'confidenceThreshold', 'showNotifications', 'backendUrl'], (result) => {
            if (result.autoAnalyze !== undefined)
                setAutoAnalyze(result.autoAnalyze);
            if (result.confidenceThreshold !== undefined)
                setConfidenceThreshold(result.confidenceThreshold);
            if (result.showNotifications !== undefined)
                setShowNotifications(result.showNotifications);
            if (result.backendUrl !== undefined)
                setBackendUrl(result.backendUrl);
        });
    }, []);
    const saveSettings = () => {
        chrome.storage.local.set({
            autoAnalyze,
            confidenceThreshold,
            showNotifications,
            backendUrl
        }, () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        });
    };
    const resetSettings = () => {
        setAutoAnalyze(true);
        setConfidenceThreshold(0.85);
        setShowNotifications(true);
        setBackendUrl('http://localhost:8000');
    };
    const clearHistory = () => {
        if (confirm('Are you sure you want to clear all analysis history?')) {
            chrome.storage.local.clear(() => {
                alert('History cleared successfully');
            });
        }
    };
    return (React.createElement("div", { style: styles.container },
        React.createElement("header", { style: styles.header },
            React.createElement("h1", { style: styles.title }, "Cerberus Settings"),
            React.createElement("p", { style: styles.subtitle }, "Configure your phishing protection preferences")),
        React.createElement("main", { style: styles.main },
            React.createElement("section", { style: styles.section },
                React.createElement("h2", { style: styles.sectionTitle }, "Analysis Settings"),
                React.createElement("div", { style: styles.setting },
                    React.createElement("label", { style: styles.label },
                        React.createElement("input", { type: "checkbox", checked: autoAnalyze, onChange: (e) => setAutoAnalyze(e.target.checked), style: styles.checkbox }),
                        React.createElement("div", null,
                            React.createElement("div", { style: styles.settingTitle }, "Auto-analyze pages"),
                            React.createElement("div", { style: styles.settingDesc }, "Automatically analyze pages when they load")))),
                React.createElement("div", { style: styles.setting },
                    React.createElement("label", { style: styles.label },
                        React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: styles.settingTitle }, "Confidence Threshold"),
                            React.createElement("div", { style: styles.settingDesc },
                                "Minimum confidence level to show warnings (",
                                Math.round(confidenceThreshold * 100),
                                "%)"),
                            React.createElement("input", { type: "range", min: "0.5", max: "1", step: "0.05", value: confidenceThreshold, onChange: (e) => setConfidenceThreshold(parseFloat(e.target.value)), style: styles.slider })))),
                React.createElement("div", { style: styles.setting },
                    React.createElement("label", { style: styles.label },
                        React.createElement("input", { type: "checkbox", checked: showNotifications, onChange: (e) => setShowNotifications(e.target.checked), style: styles.checkbox }),
                        React.createElement("div", null,
                            React.createElement("div", { style: styles.settingTitle }, "Show notifications"),
                            React.createElement("div", { style: styles.settingDesc }, "Display browser notifications for threats"))))),
            React.createElement("section", { style: styles.section },
                React.createElement("h2", { style: styles.sectionTitle }, "Backend Configuration"),
                React.createElement("div", { style: styles.setting },
                    React.createElement("label", { style: styles.label },
                        React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: styles.settingTitle }, "Backend URL"),
                            React.createElement("div", { style: styles.settingDesc }, "URL of the analysis backend server"),
                            React.createElement("input", { type: "text", value: backendUrl, onChange: (e) => setBackendUrl(e.target.value), style: styles.input, placeholder: "http://localhost:8000" }))))),
            React.createElement("section", { style: styles.section },
                React.createElement("h2", { style: styles.sectionTitle }, "Data Management"),
                React.createElement("div", { style: styles.setting },
                    React.createElement("button", { onClick: clearHistory, style: styles.dangerButton }, "Clear Analysis History"))),
            React.createElement("div", { style: styles.actions },
                React.createElement("button", { onClick: saveSettings, style: styles.saveButton }, saved ? 'Saved!' : 'Save Settings'),
                React.createElement("button", { onClick: resetSettings, style: styles.resetButton }, "Reset to Defaults")))));
};
const styles = {
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
        backgroundColor: '#f9fafb',
        minHeight: '100vh'
    },
    header: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '40px 20px',
        textAlign: 'center'
    },
    title: {
        margin: 0,
        fontSize: '32px',
        fontWeight: 700
    },
    subtitle: {
        margin: '8px 0 0 0',
        fontSize: '16px',
        opacity: 0.9
    },
    main: {
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px'
    },
    section: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    },
    sectionTitle: {
        margin: '0 0 20px 0',
        fontSize: '20px',
        fontWeight: 600,
        color: '#111827'
    },
    setting: {
        marginBottom: '20px'
    },
    label: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        cursor: 'pointer'
    },
    checkbox: {
        width: '20px',
        height: '20px',
        cursor: 'pointer',
        marginTop: '2px'
    },
    settingTitle: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '4px'
    },
    settingDesc: {
        fontSize: '14px',
        color: '#6b7280'
    },
    input: {
        width: '100%',
        padding: '10px 12px',
        fontSize: '14px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        marginTop: '8px',
        boxSizing: 'border-box'
    },
    slider: {
        width: '100%',
        marginTop: '12px'
    },
    actions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center'
    },
    saveButton: {
        padding: '12px 32px',
        fontSize: '16px',
        fontWeight: 600,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'transform 0.2s ease'
    },
    resetButton: {
        padding: '12px 32px',
        fontSize: '16px',
        fontWeight: 600,
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    },
    dangerButton: {
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 600,
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        border: '1px solid #fca5a5',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
    }
};
export default Options;
//# sourceMappingURL=Options.js.map