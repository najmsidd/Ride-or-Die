chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-reader") {
        // Get the active tab
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs.length === 0) return;
            const tabId = tabs[0].id;

            // 1. Fetch current settings
            chrome.storage.local.get(['caSettings'], (result) => {
                // Default state if nothing is saved yet
                let state = result.caSettings || { 
                    simplify: false, 
                    ruler: false, 
                    dyslexia: false, 
                    bionic: false, 
                    tts: false,
                    tint: "off"
                };

                // 2. Toggle the simplify mode
                state.simplify = !state.simplify;

                // 3. Save the new state (so popup stays in sync)
                chrome.storage.local.set({ caSettings: state });

                // 4. Inject scripts if needed (Robustness check)
                // We execute script first to ensure content.js is loaded before messaging
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['readability.js', 'summarizer.js', 'content.js']
                }, () => {
                    chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['content.css'] });
                    
                    // 5. Send message to Apply State
                    chrome.tabs.sendMessage(tabId, { 
                        action: "update_state", 
                        state: state 
                    });
                });
            });
        });
    });
});