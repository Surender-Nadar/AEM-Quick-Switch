// This script runs in the popup and handles UI interactions.

// Event listener to run when the popup's HTML content is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    // Detect environment on load by querying the active tab.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;
        const statusElement = document.getElementById('env-status');
        const messageElement = document.getElementById('message');

        const ENVIRONMENT_CONFIG = {
            'qa': { 'patterns': ['author-astellas-qa-65.adobecqms.net', 'author1apnortheast1-b80.qa.astellas.adobecqms.net', '18.180.111.160'] },
            'prod': { 'patterns': ['author-astellas-prod-65.adobecqms.net', 'author1useast1-b80.prod-65.astellas.adobecqms.net', '54.243.158.24'] }
        };

        let currentEnv = null;
        for (const env in ENVIRONMENT_CONFIG) {
            if (ENVIRONMENT_CONFIG[env].patterns.some(pattern => url.includes(pattern))) {
                currentEnv = env;
                statusElement.innerHTML = `Current: <span class="env-highlight">${currentEnv.toUpperCase()}</span>`;
                break;
            }
        }

        if (!currentEnv) {
            statusElement.textContent = 'AEM not detected';
            messageElement.textContent = 'Please navigate to an AEM page.';
            document.querySelectorAll('.button').forEach(btn => btn.disabled = true);
        } else {
            document.querySelectorAll('.button').forEach(btn => btn.disabled = false);
        }
    });

    // Add event listeners for all navigation buttons.
    document.getElementById('xf-btn').addEventListener('click', () => sendMessageToBackground('go-to-xf'));
    document.getElementById('dam-btn').addEventListener('click', () => sendMessageToBackground('go-to-dam'));
    document.getElementById('sites-btn').addEventListener('click', () => sendMessageToBackground('go-to-sites'));
    document.getElementById('props-btn').addEventListener('click', () => sendMessageToBackground('go-to-page-properties'));
    document.getElementById('published-btn').addEventListener('click', () => sendMessageToBackground('view-as-published'));
    document.getElementById('classic-btn').addEventListener('click', () => sendMessageToBackground('go-to-classic-ui'));
    document.getElementById('editor-btn').addEventListener('click', () => sendMessageToBackground('go-to-editor'));
    document.getElementById('switch-env-btn').addEventListener('click', () => sendMessageToBackground('switch-environment'));

    // Add event listener for the "Edit Shortcuts" button.
    document.getElementById('shortcuts-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
});

function sendMessageToBackground(command) {
    chrome.runtime.sendMessage({ command: command }, (response) => {
        if (response && response.error) {
            const messageElement = document.getElementById('message');
            messageElement.textContent = response.error;
        }
    });
}