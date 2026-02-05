document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const toggleSimplify = document.getElementById('toggle-simplify');
    const toggleRuler = document.getElementById('toggle-ruler');
    const toggleFont = document.getElementById('toggle-font');
    const toggleBionic = document.getElementById('toggle-bionic'); 
    const toggleTTS = document.getElementById('toggle-tts');

    // TTS
    const ttsSettingsDiv = document.getElementById('tts-settings');
    const ttsRate = document.getElementById('tts-rate');
    const ttsPitch = document.getElementById('tts-pitch');
    const ttsAnim = document.getElementById('tts-anim');
    const btnPlay = document.getElementById('btn-tts-play');
    const btnStop = document.getElementById('btn-tts-stop');
    const rateVal = document.getElementById('rate-value');
    const pitchVal = document.getElementById('pitch-value');

    // Summary
    const btnSummarize = document.getElementById('btn-summarize');
    const slider = document.getElementById('summary-slider');
    const summaryText = document.getElementById('summary-text');
    const summaryBox = document.getElementById('summary-result');

    // --- Init ---
    // Force unchecked visually on load to prevent flashes
    [toggleSimplify, toggleRuler, toggleFont, toggleBionic, toggleTTS].forEach(el => {
        if(el) el.checked = false;
    });

    // 1. LOAD SETTINGS
    chrome.storage.local.get(['caSettings', 'ttsConfig'], (result) => {
        let state = result.caSettings;
        if (!state) {
            state = { simplify: false, ruler: false, dyslexia: false, bionic: false, tts: false };
            chrome.storage.local.set({ caSettings: state });
        }
        const config = result.ttsConfig || { rate: 1, pitch: 1, anim: 'snappy' };
        
        // Apply UI
        if(toggleSimplify) toggleSimplify.checked = state.simplify;
        if(toggleRuler) toggleRuler.checked = state.ruler;
        if(toggleFont) toggleFont.checked = state.dyslexia;
        if(toggleBionic) toggleBionic.checked = state.bionic;
        
        if(toggleTTS) {
            toggleTTS.checked = state.tts;
            if(state.tts) ttsSettingsDiv.classList.remove('hidden');
            else ttsSettingsDiv.classList.add('hidden');
        }
        
        if(ttsRate) { ttsRate.value = config.rate; rateVal.textContent = config.rate + 'x'; }
        if(ttsPitch) { ttsPitch.value = config.pitch; pitchVal.textContent = config.pitch; }
        if(ttsAnim) { ttsAnim.value = config.anim; }

        syncTab(state);
    });

    // 2. SETTINGS HELPERS
    function updateSetting(key, value) {
        chrome.storage.local.get(['caSettings'], (result) => {
            const state = result.caSettings || { simplify: false, ruler: false, dyslexia: false, bionic: false, tts: false };
            state[key] = value;
            chrome.storage.local.set({ caSettings: state });
            syncTab(state);
        });
    }

    if(toggleSimplify) toggleSimplify.addEventListener('change', (e) => updateSetting('simplify', e.target.checked));
    if(toggleRuler) toggleRuler.addEventListener('change', (e) => updateSetting('ruler', e.target.checked));
    if(toggleFont) toggleFont.addEventListener('change', (e) => updateSetting('dyslexia', e.target.checked));
    if(toggleBionic) toggleBionic.addEventListener('change', (e) => updateSetting('bionic', e.target.checked));
    
    if(toggleTTS) toggleTTS.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if(isChecked) ttsSettingsDiv.classList.remove('hidden');
        else ttsSettingsDiv.classList.add('hidden');
        updateSetting('tts', isChecked);
    });

    // TTS Logic
    function saveTTSConfig() {
        const config = { rate: parseFloat(ttsRate.value), pitch: parseFloat(ttsPitch.value), anim: ttsAnim.value };
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
        const config = { rate: parseFloat(ttsRate.value), pitch: parseFloat(ttsPitch.value), anim: ttsAnim.value };
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "tts_control", command: cmd, settings: config });
        });
    }

    // 4. SUMMARY
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
                        length: verbosity 
                    }, (response) => {
                        if (response && response.summary) {
                            summaryText.value = response.summary;
                        } else {
                            summaryText.value = "Could not generate summary.";
                        }
                    });
                });
            });
        });
    }

    // Sync Helper
    function syncTab(state) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0].url.startsWith('chrome://')) return;
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['readability.js', 'summarizer.js', 'content.js']
            }, () => {
                chrome.scripting.insertCSS({ target: { tabId: tabs[0].id }, files: ['content.css'] });
                chrome.tabs.sendMessage(tabs[0].id, { action: "update_state", state: state });
            });
        });
    }
});