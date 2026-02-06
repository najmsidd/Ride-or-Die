chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-focus") {
        toggleFocusModeShortcut();
    } else if (command === "toggle-reader") {
        toggleReaderViewShortcut();
    }
});

function toggleFocusModeShortcut() {
    chrome.storage.local.get(['caSettings'], (result) => {
        let state = result.caSettings;
        
        // Initialize defaults if empty
        if (!state) {
            state = { 
                simplify: false, 
                focusMode: false,
                ruler: false, 
                dyslexia: false, 
                bionic: false, 
                tts: false,
                tint: "off",
                contrast: "off"
            };
        }

        // Toggle Focus Mode
        state.focusMode = !state.focusMode;

        // Save and Apply
        chrome.storage.local.set({ caSettings: state }, () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;

                const tabId = tabs[0].id;

                // 1. Try sending a message first (Fastest)
                chrome.tabs.sendMessage(tabId, { action: "update_state", state: state })
                    .catch(() => {
                        // 2. If message fails, it means script isn't injected. Inject now.
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            files: ['readability.js', 'summarizer.js', 'content.js']
                        }, () => {
                            chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content.css'] });
                            
                            // 3. Send message again after injection
                            setTimeout(() => {
                                chrome.tabs.sendMessage(tabId, { action: "update_state", state: state });
                            }, 50);
                        });
                    });
            });
        });
    });
}

function toggleReaderViewShortcut() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs.length === 0) return;
        const tabId = tabs[0].id;

        // 1. Fetch current settings
        chrome.storage.local.get(['caSettings'], (result) => {
            // Default state if nothing is saved yet
            let state = result.caSettings || { 
                simplify: false, 
                focusMode: false,
                ruler: false, 
                dyslexia: false, 
                bionic: false, 
                tts: false,
                tint: "off",
                contrast: "off"
            };

            // 2. Toggle the simplify mode
            state.simplify = !state.simplify;

            // 3. Save the new state (so popup stays in sync)
            chrome.storage.local.set({ caSettings: state });

            // 4. Try sending a message first (Fastest)
            chrome.tabs.sendMessage(tabId, { action: "update_state", state: state })
                .catch(() => {
                    // 5. If message fails, inject scripts
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['readability.js', 'summarizer.js', 'content.js']
                    }, () => {
                        chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content.css'] });
                        
                        // 6. Send message to Apply State
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tabId, { 
                                action: "update_state", 
                                state: state 
                            });
                        }, 50);
                    });
                });
        });
    });
}
