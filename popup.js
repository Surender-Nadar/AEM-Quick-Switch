// AEM SWIFT NAV - Popup UI Script

document.addEventListener("DOMContentLoaded", () => {
  const enableToggle = document.getElementById("enable-toggle");

  // Load and set toggle state
  chrome.storage.local.get(["extensionEnabled"], (result) => {
    enableToggle.checked = result.extensionEnabled !== false;
  });

  enableToggle.addEventListener("change", () => {
    chrome.storage.local.set({ extensionEnabled: enableToggle.checked });
  });

  // Dynamically display shortcuts
  chrome.commands.getAll((commands) => {
    for (const command of commands) {
      const shortcutEl = document.getElementById(`${command.name}-sc`);
      if (shortcutEl && command.shortcut) {
        shortcutEl.textContent = command.shortcut;
      }
    }
  });

  // Add event listeners for all command buttons
  const commandButtons = [
    "go-to-sites",
    "go-to-dam",
    "go-to-xf",
    "go-to-forms",
    "go-to-page-properties",
    "view-as-published",
    "go-to-editor",
    "toggle-ui",
    "switch-environment",
  ];

  commandButtons.forEach((id) => {
    document.getElementById(id).addEventListener("click", () => {
      if (enableToggle.checked) {
        chrome.runtime.sendMessage({
          command: "triggerCommand",
          commandName: id,
        });
      }
    });
  });

  // Login environment buttons
  document.querySelectorAll("[data-url]").forEach((button) => {
    button.addEventListener("click", () => {
      if (enableToggle.checked) {
        chrome.runtime.sendMessage({
          command: "openUrl",
          url: button.dataset.url,
        });
      }
    });
  });

  // "Edit All" shortcuts button
  document.getElementById("shortcuts-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
});
