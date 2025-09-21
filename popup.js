// This script runs in the popup and handles all UI interactions.

document.addEventListener("DOMContentLoaded", () => {
  const enableToggle = document.getElementById("enable-toggle");

  // Load saved state for the toggle
  chrome.storage.local.get(["extensionEnabled"], (result) => {
    enableToggle.checked = result.extensionEnabled !== false; // default to true
  });

  // Save toggle state on change
  enableToggle.addEventListener("change", () => {
    chrome.storage.local.set({ extensionEnabled: enableToggle.checked });
  });

  // Add event listeners for all command buttons
  const commandButtons = {
    "xf-btn": "go-to-xf",
    "dam-btn": "go-to-dam",
    "sites-btn": "go-to-sites",
    "forms-btn": "go-to-forms",
    "props-btn": "go-to-page-properties",
    "published-btn": "view-as-published",
    "editor-btn": "go-to-editor",
    "switch-env-btn": "switch-environment",
    "toggle-ui-btn": "toggle-ui",
  };

  for (const [id, command] of Object.entries(commandButtons)) {
    document.getElementById(id).addEventListener("click", () => {
      if (enableToggle.checked) {
        // Note: The new background script expects a different message format for commands
        // This will be updated in the next step to align with the new background.js
        chrome.runtime.sendMessage({
          command: "triggerCommand",
          commandName: command,
        });
      }
    });
  }

  // Environment buttons
  document.querySelectorAll(".env-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (enableToggle.checked) {
        chrome.runtime.sendMessage({
          command: "openUrl",
          url: button.dataset.url,
        });
      }
    });
  });

  // Shortcuts button
  document.getElementById("shortcuts-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
});
