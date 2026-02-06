chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-focus") {
        toggleFocusModeShortcut();
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
                tts: false 
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