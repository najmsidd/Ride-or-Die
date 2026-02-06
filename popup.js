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
    const aiHelpLink = document.getElementById('ai-help-link');
    const checkAiBtn = document.getElementById('check-ai-btn');
    const aiStatus = document.getElementById('ai-status');
    const aiRadio = document.getElementById('ai-radio');

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

    // Check Browser AI availability
    if (checkAiBtn) {
        checkAiBtn.addEventListener('click', () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: async () => {
                        try {
                            const result = {
                                windowAi: typeof window.ai !== 'undefined',
                                aiKeys: window.ai ? Object.keys(window.ai) : [],
                                hasSummarizer: typeof window.ai?.summarizer !== 'undefined',
                                hasLanguageModel: typeof window.ai?.languageModel !== 'undefined',
                                available: false,
                                reason: 'unknown',
                                details: ''
                            };

                            if (!window.ai) {
                                result.reason = 'no-window-ai';
                                result.details = 'window.ai is undefined. Enable Prompt API flag and restart Chrome.';
                                return result;
                            }

                            // Check for languageModel (Prompt API) - this is what you actually have
                            if (window.ai.languageModel) {
                                try {
                                    const caps = await window.ai.languageModel.capabilities();
                                    result.reason = caps.available;
                                    result.available = caps.available === 'readily';
                                    result.details = `Prompt API (languageModel) available. Status: ${caps.available}`;
                                    return result;
                                } catch (error) {
                                    result.reason = 'error';
                                    result.details = `languageModel exists but error: ${error.message}`;
                                    return result;
                                }
                            }

                            // Summarizer API check (probably not available)
                            if (!window.ai.summarizer) {
                                result.reason = 'no-summarizer';
                                result.details = `Summarizer API not available. Found APIs: ${result.aiKeys.join(', ')}. Using Prompt API instead.`;
                                result.available = result.hasLanguageModel; // Mark as available if we have languageModel
                                return result;
                            }

                            const caps = await window.ai.summarizer.capabilities();
                            result.reason = caps.available;
                            result.available = caps.available === 'readily';
                            result.details = JSON.stringify(caps);
                            
                            return result;
                        } catch (error) {
                            return { 
                                available: false, 
                                reason: 'error', 
                                details: error.message,
                                windowAi: typeof window.ai !== 'undefined',
                                aiKeys: window.ai ? Object.keys(window.ai) : [],
                                hasLanguageModel: typeof window.ai?.languageModel !== 'undefined'
                            };
                        }
                    }
                }, (results) => {
                    if (results && results[0] && results[0].result) {
                        const result = results[0].result;
                        aiStatus.style.display = 'block';
                        
                        console.log('Browser AI Check Result:', result);
                        
                        if (result.available || result.hasLanguageModel) {
                            aiStatus.style.background = '#d4edda';
                            aiStatus.style.color = '#155724';
                            aiStatus.textContent = result.hasLanguageModel ? 
                                '✅ Browser AI (Prompt API) is available!' : 
                                '✅ Browser AI is available!';
                            aiRadio.disabled = false;
                        } else {
                            aiStatus.style.background = '#fff3cd';
                            aiStatus.style.color = '#856404';
                            
                            let message = '❌ Not Available: ';
                            
                            switch(result.reason) {
                                case 'no-window-ai':
                                    message += 'Enable Prompt API flag in chrome://flags/ and restart.';
                                    break;
                                case 'no-summarizer':
                                    if (result.hasLanguageModel) {
                                        message = '✅ Using Prompt API (languageModel). Summarizer API not needed.';
                                        aiStatus.style.background = '#d4edda';
                                        aiStatus.style.color = '#155724';
                                        aiRadio.disabled = false;
                                    } else {
                                        message += `No AI APIs found: ${result.aiKeys.join(', ') || 'none'}`;
                                    }
                                    break;
                                case 'after-download':
                                    message += 'Model downloading. Check chrome://components/';
                                    break;
                                case 'no':
                                    message += 'Not supported. Use Algorithmic method.';
                                    break;
                                default:
                                    message += `${result.details}`;
                            }
                            
                            aiStatus.textContent = message;
                            if (!result.hasLanguageModel) {
                                aiRadio.disabled = true;
                            }
                        }
                    }
                });
            });
        });
    }

    // Show/hide AI setup help link based on selected method
    document.querySelectorAll('input[name="summary-method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'browser-ai') {
                aiHelpLink.style.display = 'inline';
            } else {
                aiHelpLink.style.display = 'none';
            }
        });
    });

    if (aiHelpLink) {
        aiHelpLink.addEventListener('click', (e) => {
            e.preventDefault();
            const helpText = `Browser AI Setup - COMPLETE GUIDE:

⚠️ CRITICAL: Browser AI is VERY experimental and may not work!

STEP 1: Use Chrome Canary/Dev
Download from: google.com/chrome/canary/

STEP 2: Enable ALL Required Flags in chrome://flags/
Copy and paste each flag exactly:

#optimization-guide-on-device-model
Set to: Enabled BypassPerfRequirement

#prompt-api-for-gemini-nano  
Set to: Enabled

#ai-rewriter-api
Set to: Enabled (optional but helps)

STEP 3: RESTART Chrome Completely
Close ALL windows, not just the tab!

STEP 4: Wait for Model Download
1. Open chrome://components/
2. Find "Optimization Guide On Device Model"
3. Click "Check for update"
4. Wait 15-30 minutes for ~1.7GB download
5. You should see version number appear

STEP 5: Enable Developer Mode (IMPORTANT!)
1. Go to chrome://extensions/
2. Turn ON "Developer mode" (top right)
3. This is REQUIRED for window.ai to work

STEP 6: Test in Regular Tab
Don't test in extension pages - use a real website

STEP 7: Verify
Click "🔍 Check" button

REALITY CHECK:
• This API is experimental and unstable
• It may be disabled/removed anytime
• Only works in US/UK regions (VPN may not help)
• Requires ~2GB disk space
• May not work at all in your setup

RECOMMENDATION:
Use the "🔧 Algorithmic" method instead - it's fast,
reliable, and works everywhere without any setup!`;
            
            alert(helpText);
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