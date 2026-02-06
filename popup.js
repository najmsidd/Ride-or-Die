document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const toggleSimplify = document.getElementById('toggle-simplify');
    const toggleFocus = document.getElementById('toggle-focus');
    const toggleRuler = document.getElementById('toggle-ruler');
    const toggleFont = document.getElementById('toggle-font');
    const toggleBionic = document.getElementById('toggle-bionic');
    const toggleNewContent = document.getElementById('toggle-newcontent');
    const toggleTTS = document.getElementById('toggle-tts');
    const selectTint = document.getElementById('select-tint');
    const selectContrast = document.getElementById('select-contrast');

    // TTS Controls
    const ttsSettingsDiv = document.getElementById('tts-settings');
    const ttsRate = document.getElementById('tts-rate');
    const ttsPitch = document.getElementById('tts-pitch');
    const ttsAnim = document.getElementById('tts-anim');
    const btnPlay = document.getElementById('btn-tts-play');
    const btnStop = document.getElementById('btn-tts-stop');
    const rateVal = document.getElementById('rate-value');
    const pitchVal = document.getElementById('pitch-value');

    const btnSummarize = document.getElementById('btn-summarize');
    const slider = document.getElementById('summary-slider');
    const summaryText = document.getElementById('summary-text');
    const summaryBox = document.getElementById('summary-result');

    // Force UI to unchecked initially to prevent visual flash
    [toggleSimplify, toggleFocus, toggleRuler, toggleFont, toggleBionic, toggleNewContent, toggleTTS].forEach(el => {
        if(el) el.checked = false;
    });
    if(selectTint) selectTint.value = "off";
    if(selectContrast) selectContrast.value = "off";

    // 1. LOAD SAVED STATE
    function loadState() {
        chrome.storage.local.get(['caSettings', 'ttsConfig'], (result) => {
            let state = result.caSettings;

            if (!state) {
                state = { 
                    simplify: false, 
                    focusMode: false,
                    ruler: false, 
                    dyslexia: false, 
                    bionic: false, 
                    newContent: false,
                    tts: false,
                    tint: "off",
                    contrast: "off"
                };
                chrome.storage.local.set({ caSettings: state });
            }

            const config = result.ttsConfig || { rate: 1, pitch: 1, anim: 'snappy' };
            
            // Apply to UI
            if(toggleSimplify) toggleSimplify.checked = state.simplify;
            if(toggleFocus) toggleFocus.checked = state.focusMode;
            if(toggleRuler) toggleRuler.checked = state.ruler;
            if(toggleFont) toggleFont.checked = state.dyslexia;
            if(toggleBionic) toggleBionic.checked = state.bionic;
            if(toggleNewContent) toggleNewContent.checked = state.newContent || false;
            if(selectTint) selectTint.value = state.tint || "off"; 
            if(selectContrast) selectContrast.value = state.contrast || "off"; 
            
            if(toggleTTS) {
                toggleTTS.checked = state.tts;
                if(state.tts) ttsSettingsDiv.classList.remove('hidden');
                else ttsSettingsDiv.classList.add('hidden');
            }
            
            if(ttsRate) { ttsRate.value = config.rate; rateVal.textContent = config.rate + 'x'; }
            if(ttsPitch) { ttsPitch.value = config.pitch; pitchVal.textContent = config.pitch; }
            if(ttsAnim) { ttsAnim.value = config.anim; }

            // Sync Tab
            syncTab(state);
        });
    }

    // Initial Load
    loadState();

    // 2. LISTEN FOR CHANGES (Live Update UI if Shortcut is used)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.caSettings) {
            const newState = changes.caSettings.newValue;
            if(toggleFocus) toggleFocus.checked = newState.focusMode;
            if(toggleSimplify) toggleSimplify.checked = newState.simplify;
        }
    });

    // 3. SAVE STATE HELPER
    function updateSetting(key, value) {
        chrome.storage.local.get(['caSettings'], (result) => {
            const state = result.caSettings || { 
                simplify: false, 
                focusMode: false,
                ruler: false, 
                dyslexia: false, 
                bionic: false, 
                newContent: false,
                tts: false,
                tint: "off",
                contrast: "off"
            };
            state[key] = value;
            chrome.storage.local.set({ caSettings: state });
            // State change will automatically sync to all tabs via storage listener
        });
    }

    // Toggles
    if(toggleSimplify) toggleSimplify.addEventListener('change', (e) => updateSetting('simplify', e.target.checked));
    if(toggleFocus) toggleFocus.addEventListener('change', (e) => updateSetting('focusMode', e.target.checked));
    if(toggleRuler) toggleRuler.addEventListener('change', (e) => updateSetting('ruler', e.target.checked));
    if(toggleFont) toggleFont.addEventListener('change', (e) => updateSetting('dyslexia', e.target.checked));
    if(toggleBionic) toggleBionic.addEventListener('change', (e) => updateSetting('bionic', e.target.checked));
    if(toggleNewContent) toggleNewContent.addEventListener('change', (e) => updateSetting('newContent', e.target.checked));
    if(selectTint) selectTint.addEventListener('change', (e) => updateSetting('tint', e.target.value)); 
    if(selectContrast) selectContrast.addEventListener('change', (e) => updateSetting('contrast', e.target.value)); 
    
    if(toggleTTS) toggleTTS.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if(isChecked) ttsSettingsDiv.classList.remove('hidden');
        else ttsSettingsDiv.classList.add('hidden');
        updateSetting('tts', isChecked);
    });

    // TTS Settings
    function saveTTSConfig() {
        const config = {
            rate: parseFloat(ttsRate.value),
            pitch: parseFloat(ttsPitch.value),
            anim: ttsAnim.value
        };
        chrome.storage.local.set({ ttsConfig: config });
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "tts_update_settings", settings: config });
        });
    }

    if(ttsRate) ttsRate.addEventListener('input', (e) => { rateVal.textContent = e.target.value + 'x'; saveTTSConfig(); });
    if(ttsPitch) ttsPitch.addEventListener('input', (e) => { pitchVal.textContent = e.target.value; saveTTSConfig(); });
    if(ttsAnim) ttsAnim.addEventListener('change', saveTTSConfig);

    if(btnPlay) btnPlay.addEventListener('click', () => sendTTSCommand('play'));
    if(btnStop) btnStop.addEventListener('click', () => sendTTSCommand('stop'));

    function sendTTSCommand(cmd) {
        const config = {
            rate: parseFloat(ttsRate.value),
            pitch: parseFloat(ttsPitch.value),
            anim: ttsAnim.value
        };
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "tts_control", command: cmd, settings: config });
        });
    }

    // Summarize
    if(btnSummarize) {
        btnSummarize.addEventListener('click', () => {
            summaryBox.classList.remove('hidden');
            summaryText.value = "Analyzing...";
            const verbosity = parseInt(slider.value, 10);

            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['readability.js', 'summarizer.js', 'content.js']
                }, () => {
                    chrome.scripting.insertCSS({ target: { tabId: tabs[0].id }, files: ['content.css'] });
                    
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        action: "generate_summary", 
                        method: 'algorithmic',
                        length: verbosity 
                    }, (response) => {
                        if (response && response.summary) {
                            summaryText.value = response.summary;
                        } else {
                            summaryText.value = "Could not generate summary. Please try again.";
                        }
                    });
                });
            });
        });
    }

    // Sync Helper - Ensures content script is loaded on the active tab
    function syncTab(state) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs[0] || tabs[0].url.startsWith('chrome://')) return;
            
            // First, try to send a message to see if content script is already loaded
            chrome.tabs.sendMessage(tabs[0].id, { action: "update_state", state: state }, (response) => {
                // If there's an error, content script isn't loaded yet, so inject it
                if (chrome.runtime.lastError) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['readability.js', 'summarizer.js', 'content.js']
                    }, () => {
                        chrome.scripting.insertCSS({ target: { tabId: tabs[0].id }, files: ['content.css'] });
                        // State will be applied via restorePersistedState when content.js loads
                    });
                }
                // If no error, content script is already loaded and received the message
            });
        });
    }
});
