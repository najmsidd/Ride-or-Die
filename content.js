if (window.__caContentInjected) {
    // Already injected, skip
} else {
    window.__caContentInjected = true;

    // State Variables
    let originalBody = null;
    let articleText = ""; 
    let bionicProcessed = false; 

    // Summary View State
    let summaryMode = false;
    let summaryOriginalBody = null;
    let lastState = { simplify: false, ruler: false, dyslexia: false, bionic: false, tts: false, tint: "off", contrast: "off" };

    // Global references
    let rulerElement = null;
    let tintElement = null;

    // TTS Variables
    let ttsUtterance = null;
    let ttsWordMap = []; 
    let isTTSActive = false;

    // 1. LISTEN FOR MESSAGES
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "update_state") {
            applyState(request.state);
        } 
        else if (request.action === "generate_summary") {
            let sourceText;
            
            if (summaryMode) {
                restoreSummaryView();
            }
            
            const contentContainer = document.querySelector('.ca-content');
            if (contentContainer) {
                sourceText = contentContainer.innerText;
            } else if (articleText) {
                sourceText = articleText;
            } else {
                sourceText = document.body.innerText;
            }
            
            const cleanSource = sourceText.split('\n').filter(line => line.trim().length > 40).join(' ');

            if (window.Summarizer) {
                const result = window.Summarizer.generate(cleanSource, request.length);
                showSummaryOnPage(result);
                sendResponse({ summary: result });
            } else {
                sendResponse({ summary: "Error: Summarizer library not loaded." });
            }
        }
        else if (request.action === "tts_control") {
            handleTTSControl(request.command, request.settings);
        }
        else if (request.action === "tts_update_settings") {
             if(isTTSActive) {
                 document.body.classList.remove('ca-tts-anim-snappy', 'ca-tts-anim-smooth');
                 document.body.classList.add(`ca-tts-anim-${request.settings.anim}`);
             }
        }
    });

    // 2. APPLY STATE
    function applyState(state) {
        lastState = state || lastState;

        if (summaryMode && state.simplify) {
            restoreSummaryView();
        }

        // Feature 1: Simplify Mode
        if (state.simplify) {
            if (!originalBody) originalBody = document.body.innerHTML;

            if (!articleText) {
                const docClone = document.cloneNode(true);
                
                let rescuedForm = null;
                const form = docClone.querySelector('form');
                if (form && form.querySelectorAll('input, select, textarea').length > 0) {
                    rescuedForm = form.outerHTML;
                }

                try {
                    const article = new Readability(docClone).parse();
                    if (article && article.content.length > 200) {
                        articleText = article.textContent;
                        
                        document.body.classList.add("ca-simplified-body");
                        let htmlPayload = `
                            <div class="ca-container">
                                <h1 class="ca-title">${article.title}</h1>
                                <div class="ca-content">${article.content}</div>
                        `;

                        if (rescuedForm && !article.content.includes("<form")) {
                            htmlPayload += `
                                <div class="ca-rescued-form">
                                    <h3>Interactive Form Detected</h3>
                                    ${rescuedForm}
                                </div>
                            `;
                        }
                        
                        htmlPayload += `</div>`; 
                        
                        document.body.innerHTML = htmlPayload;
                        
                        bionicProcessed = false; 
                        tintElement = null;
                        if(isTTSActive) stopTTS(); 
                    }
                } catch(e) { console.error(e); }
            }
        } else {
            if (originalBody && !summaryMode) {
                document.body.innerHTML = originalBody;
                document.body.classList.remove("ca-simplified-body");
                originalBody = null;
                articleText = "";
                bionicProcessed = false;
                tintElement = null;
                if(isTTSActive) stopTTS();
            }
        }

        // Feature 2: Dyslexia Font
        if (state.dyslexia) document.body.classList.add("ca-dyslexia-mode");
        else document.body.classList.remove("ca-dyslexia-mode");

        // Feature 3: Bionic Reading
        toggleBionic(state.bionic);

        // Feature 4: Reading Ruler
        toggleRuler(state.ruler);
        
        // Feature 5: Sensory Tint
        toggleTint(state.tint);

        // Feature 6: Contrast Mode
        toggleContrast(state.contrast);

        // Feature 7: TTS
        if (state.tts) {
            isTTSActive = true; 
        } else {
            stopTTS();
            isTTSActive = false;
        }
    }

    // --- CONTRAST LOGIC ---
    function toggleContrast(mode) {
        document.documentElement.classList.remove(
            'ca-contrast-dark-high', 
            'ca-contrast-light-high'
        );

        if (mode && mode !== 'off') {
            document.documentElement.classList.add(`ca-contrast-${mode}`);
        }
    }

    // --- TINT LOGIC ---
    function toggleTint(colorName) {
        let existingTint = document.getElementById("ca-tint-overlay");
        if (!existingTint) {
            tintElement = document.createElement("div");
            tintElement.id = "ca-tint-overlay";
            document.body.appendChild(tintElement);
        } else {
            tintElement = existingTint;
        }

        const colors = {
            "off": "transparent",
            "blue": "rgba(173, 216, 230, 0.25)",  
            "green": "rgba(144, 238, 144, 0.25)", 
            "rose": "rgba(255, 182, 193, 0.25)",  
            "peach": "rgba(255, 218, 185, 0.25)", 
            "gray": "rgba(128, 128, 128, 0.25)"   
        };

        if (colorName && colorName !== "off") {
            tintElement.style.display = "block";
            tintElement.style.backgroundColor = colors[colorName] || "transparent";
        } else {
            tintElement.style.display = "none";
        }
    }

    // --- RULER LOGIC ---
    function toggleRuler(enable) {
        let existingRuler = document.getElementById('ca-ruler');
        if (enable) {
            if (!existingRuler) {
                rulerElement = document.createElement("div");
                rulerElement.id = "ca-ruler";
                document.body.appendChild(rulerElement);
                document.removeEventListener("mousemove", moveRuler);
                document.addEventListener("mousemove", moveRuler);
            } else {
                rulerElement = existingRuler;
                rulerElement.style.display = "block";
                document.addEventListener("mousemove", moveRuler);
            }
        } else {
            if (existingRuler) existingRuler.style.display = "none";
            document.removeEventListener("mousemove", moveRuler);
        }
    }

    function moveRuler(e) {
        const r = document.getElementById('ca-ruler');
        if (r) r.style.top = (e.clientY - 30) + "px";
    }

    // --- BIONIC LOGIC ---
    function toggleBionic(enable) {
        if (enable) {
            if (!bionicProcessed) {
                processBionicText();
                bionicProcessed = true;
            }
            document.body.classList.add("ca-bionic-mode");
        } else {
            document.body.classList.remove("ca-bionic-mode");
        }
    }

    function processBionicText() {
        const root = document.querySelector('.ca-content') || document.body;
        const walker = document.createTreeWalker(
            root, NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentNode.classList.contains('ca-bionic-target')) return NodeFilter.FILTER_REJECT;
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
                    if (document.querySelector('.ca-tts-word') && !node.parentNode.classList.contains('ca-tts-word')) {
                         return NodeFilter.FILTER_SKIP;
                    }
                    if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }, false
        );

        const nodes = [];
        let node;
        while (node = walker.nextNode()) nodes.push(node);

        nodes.forEach(textNode => {
            const text = textNode.nodeValue;
            const words = text.split(/(\s+)/); 
            const fragment = document.createDocumentFragment();
            words.forEach(word => {
                if (word.trim().length > 0) {
                    const len = word.length;
                    let boldLen = 1;
                    if (len > 3) boldLen = len <= 5 ? 2 : 3;
                    
                    const span = document.createElement('span');
                    span.className = 'ca-bionic-target';
                    span.textContent = word.substring(0, boldLen);
                    const normal = document.createTextNode(word.substring(boldLen));
                    fragment.appendChild(span);
                    fragment.appendChild(normal);
                } else {
                    fragment.appendChild(document.createTextNode(word));
                }
            });
            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }

    // --- TTS LOGIC ---
    function stripBionic() {
        const bionics = document.querySelectorAll('.ca-bionic-target');
        bionics.forEach(b => {
            const text = b.textContent;
            const textNode = document.createTextNode(text);
            b.parentNode.replaceChild(textNode, b);
        });
        bionicProcessed = false;
        document.body.classList.remove('ca-bionic-mode');
        document.body.normalize(); 
    }

    function prepareTTS() {
        const root = document.querySelector('.ca-content') || document.body;
        if (document.querySelector('.ca-bionic-target')) stripBionic();
        if (root.querySelector('.ca-tts-word')) return;

        const walker = document.createTreeWalker(
            root, NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
                    if (node.parentNode.classList.contains('ca-tts-word')) return NodeFilter.FILTER_REJECT;
                    if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }, false
        );

        const nodes = [];
        let node;
        while (node = walker.nextNode()) nodes.push(node);

        nodes.forEach(textNode => {
            const text = textNode.nodeValue;
            const words = text.split(/(\s+)/); 
            const fragment = document.createDocumentFragment();
            words.forEach(word => {
                if (word.trim().length > 0) {
                    const span = document.createElement('span');
                    span.className = 'ca-tts-word';
                    span.textContent = word;
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(word));
                }
            });
            textNode.parentNode.replaceChild(fragment, textNode);
        });

        chrome.storage.local.get(['caSettings'], (result) => {
            if(result.caSettings && result.caSettings.bionic) {
                processBionicText(); 
                bionicProcessed = true;
                document.body.classList.add('ca-bionic-mode');
            }
        });
    }

    function handleTTSControl(command, settings) {
        if (command === 'stop') { stopTTS(); return; }
        if (command === 'play') {
            stopTTS(); 
            prepareTTS();
            setTimeout(() => {
                const spans = Array.from(document.querySelectorAll('.ca-tts-word'));
                if (spans.length === 0) { alert("ContextAware: No text found."); return; }
                
                let fullText = "";
                ttsWordMap = [];
                spans.forEach(span => {
                    ttsWordMap.push({ start: fullText.length, end: fullText.length + span.textContent.length, element: span });
                    fullText += span.textContent + " "; 
                });

                ttsUtterance = new SpeechSynthesisUtterance(fullText);
                ttsUtterance.rate = settings.rate || 1;
                ttsUtterance.pitch = settings.pitch || 1;
                
                document.body.classList.remove('ca-tts-anim-snappy', 'ca-tts-anim-smooth');
                document.body.classList.add(`ca-tts-anim-${settings.anim}`);

                ttsUtterance.onboundary = (event) => {
                    if (event.name === 'word') {
                        const charIndex = event.charIndex;
                        const match = ttsWordMap.find(w => charIndex >= w.start && charIndex < w.end);
                        if (match) {
                            const old = document.querySelector('.ca-tts-active');
                            if (old) old.classList.remove('ca-tts-active');
                            match.element.classList.add('ca-tts-active');
                            match.element.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                    }
                };
                ttsUtterance.onend = () => { document.querySelectorAll('.ca-tts-active').forEach(el => el.classList.remove('ca-tts-active')); };
                window.speechSynthesis.speak(ttsUtterance);
            }, 50);
        }
    }

    function stopTTS() {
        window.speechSynthesis.cancel();
        document.querySelectorAll('.ca-tts-active').forEach(el => el.classList.remove('ca-tts-active'));
    }

    // --- SUMMARY VIEW ---
    function showSummaryOnPage(summaryText) {
        if (!summaryMode) {
            summaryOriginalBody = document.body.innerHTML;
        } else {
            document.body.innerHTML = summaryOriginalBody;
            summaryOriginalBody = document.body.innerHTML;
        }
        
        summaryMode = true;

        if (isTTSActive) stopTTS();

        document.body.classList.add("ca-summary-mode");
        document.body.innerHTML = `
            <div class="ca-summary-container">
                <div class="ca-summary-header">
                    <h1 class="ca-summary-title">📝 Article Summary</h1>
                    <button class="ca-summary-close-btn" id="ca-close-summary">
                        <span>✕</span>
                        <span>Close Summary</span>
                    </button>
                </div>
                <div class="ca-summary-content">
                    <pre class="ca-summary-text"></pre>
                </div>
                <div class="ca-summary-meta">
                    Generated by ContextAware • AI-powered text summarization
                </div>
            </div>
        `;

        const summaryNode = document.querySelector('.ca-summary-text');
        if (summaryNode) summaryNode.textContent = summaryText;

        const closeBtn = document.getElementById('ca-close-summary');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                restoreSummaryView();
                chrome.storage.local.get(['caSettings'], (result) => {
                    if (result.caSettings) {
                        applyState(result.caSettings);
                    }
                });
            });
        }

        bionicProcessed = false;
        if (lastState?.dyslexia) document.body.classList.add("ca-dyslexia-mode");
        else document.body.classList.remove("ca-dyslexia-mode");

        toggleBionic(!!lastState?.bionic);
        toggleRuler(!!lastState?.ruler);
    }

    function restoreSummaryView() {
        if (summaryOriginalBody) {
            document.body.innerHTML = summaryOriginalBody;
        }
        document.body.classList.remove("ca-summary-mode");
        summaryMode = false;
        summaryOriginalBody = null;
        bionicProcessed = false;
    }
}