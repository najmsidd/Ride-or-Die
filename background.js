chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-reader") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            const tabId = tabs[0].id;

            // Ensure scripts are injected before sending message
            // This prevents errors if the user hits the shortcut on a fresh page before opening popup
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['readability.js', 'summarizer.js', 'content.js']
            }, () => {
                // Check for errors (e.g., restricted browser pages)
                if (chrome.runtime.lastError) return;

                // Inject CSS
                chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['content.css']
                });

                // Retrieve current settings, toggle simplify, and re-apply
                chrome.storage.local.get(['caSettings'], (result) => {
                    // Default to all false if no settings exist
                    let settings = result.caSettings || { 
                        simplify: false, 
                        ruler: false, 
                        dyslexia: false, 
                        bionic: false, 
                        tts: false 
                    };

                    // Toggle the Simplify Mode
                    settings.simplify = !settings.simplify;

                    // 1. Save new state so Popup UI stays in sync
                    chrome.storage.local.set({ caSettings: settings });

                    // 2. Send message to content.js to apply visual changes
                    chrome.tabs.sendMessage(tabId, { 
                        action: "update_state", 
                        state: settings 
                    });
                });
            });
        });
    }
});