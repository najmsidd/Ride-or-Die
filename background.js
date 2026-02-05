chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-mode") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['readability.js', 'content.js']
            }, () => {
                chrome.scripting.insertCSS({
                    target: { tabId: tabs[0].id },
                    files: ['content.css']
                });
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_simplify" });
            });
        });
    }
});