// --- GUARD CLAUSE (Prevents crashes on re-injection) ---
if (window.caScriptLoaded) {
    // If script is already loaded, we just listen for messages. 
    // The existing listener handles it. We stop here to prevent variable re-declaration errors.
    throw new Error("ContextAware script already loaded"); 
}
window.caScriptLoaded = true;

// --- STATE VARIABLES ---
let originalBody = null;
let articleText = ""; 
let bionicProcessed = false; 

// Feature Specific Globals
let rulerElement = null;
let focusOverlay = null; 
let focusUpdateFrame = null; 

// TTS Globals
let ttsUtterance = null;
let ttsWordMap = []; 
let isTTSActive = false;

// --- 1. MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "update_state") {
        applyState(request.state);
    } 
    else if (request.action === "generate_summary") {
        const sourceText = articleText || document.body.innerText;
        const cleanSource = sourceText.split('\n').filter(line => line.trim().length > 40).join(' ');

        if (window.Summarizer) {
            const result = window.Summarizer.generate(cleanSource, request.length);
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

// --- 2. MAIN STATE APPLICATOR ---
function applyState(state) {
    // A. Simplify Mode
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
                    if(isTTSActive) stopTTS(); 
                    toggleFocusMode(false); 
                }
            } catch(e) { console.error(e); }
        }
    } else {
        if (originalBody) {
            document.body.innerHTML = originalBody;
            document.body.classList.remove("ca-simplified-body");
            originalBody = null;
            articleText = "";
            bionicProcessed = false;
            if(isTTSActive) stopTTS();
            toggleFocusMode(false);
        }
    }

    // B. Dyslexia Font
    if (state.dyslexia) document.body.classList.add("ca-dyslexia-mode");
    else document.body.classList.remove("ca-dyslexia-mode");

    // C. Bionic Reading
    toggleBionic(state.bionic);

    // D. Reading Ruler
    toggleRuler(state.ruler);
    
    // E. Focus Mode
    toggleFocusMode(state.focusMode);

    // F. TTS
    if (state.tts) {
        isTTSActive = true; 
    } else {
        stopTTS();
        isTTSActive = false;
    }
}

// ==========================================
// FOCUS MODE (SVG "Swiss Cheese" Method)
// ==========================================
function toggleFocusMode(enable) {
    if (focusOverlay) {
        focusOverlay.remove();
        focusOverlay = null;
        window.removeEventListener('scroll', requestFocusUpdate);
        window.removeEventListener('resize', requestFocusUpdate);
    }

    if (enable) {
        focusOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        focusOverlay.id = "ca-focus-svg";
        focusOverlay.style.position = "fixed";
        focusOverlay.style.top = "0";
        focusOverlay.style.left = "0";
        focusOverlay.style.width = "100%";
        focusOverlay.style.height = "100%";
        focusOverlay.style.zIndex = "2147483640"; 
        focusOverlay.style.pointerEvents = "none"; 
        
        const maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        maskPath.setAttribute("fill", "rgba(0, 0, 0, 0.75)"); 
        maskPath.setAttribute("fill-rule", "evenodd"); 
        focusOverlay.appendChild(maskPath);

        const borderGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        borderGroup.setAttribute("stroke", "#FFD700"); 
        borderGroup.setAttribute("stroke-width", "2");
        borderGroup.setAttribute("fill", "none");
        focusOverlay.appendChild(borderGroup);

        document.body.appendChild(focusOverlay);
        window.addEventListener('scroll', requestFocusUpdate, { passive: true });
        window.addEventListener('resize', requestFocusUpdate, { passive: true });
        
        updateFocusOverlay();
    }
}

function requestFocusUpdate() {
    if (!focusUpdateFrame) {
        focusUpdateFrame = requestAnimationFrame(() => {
            updateFocusOverlay();
            focusUpdateFrame = null;
        });
    }
}

function updateFocusOverlay() {
    if (!focusOverlay) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maskPath = focusOverlay.querySelector("path");
    const borderGroup = focusOverlay.querySelector("g");

    while (borderGroup.firstChild) {
        borderGroup.removeChild(borderGroup.firstChild);
    }

    const selectors = `a[href], button, input, textarea, select, [role="button"], [role="link"], .btn`;
    const elements = document.querySelectorAll(selectors);

    let d = `M0 0 H${width} V${height} H0 Z`;

    elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > height) return;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

        d += ` M${rect.x} ${rect.y} h${rect.width} v${rect.height} h-${rect.width} z`;

        const borderRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        borderRect.setAttribute("x", rect.x - 2); 
        borderRect.setAttribute("y", rect.y - 2);
        borderRect.setAttribute("width", rect.width + 4);
        borderRect.setAttribute("height", rect.height + 4);
        borderRect.setAttribute("rx", "2");
        borderGroup.appendChild(borderRect);
    });

    maskPath.setAttribute("d", d);
}


// ==========================================
// READING RULER
// ==========================================
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

// ==========================================
// BIONIC READING
// ==========================================
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
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (node.parentNode.classList.contains('ca-bionic-target')) return NodeFilter.FILTER_REJECT;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
            if (document.querySelector('.ca-tts-word') && !node.parentNode.classList.contains('ca-tts-word')) return NodeFilter.FILTER_SKIP;
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);

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

// ==========================================
// TEXT TO SPEECH
// ==========================================
function stripBionic() {
    const bionics = document.querySelectorAll('.ca-bionic-target');
    bionics.forEach(b => {
        const textNode = document.createTextNode(b.textContent);
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

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
            if (node.parentNode.classList.contains('ca-tts-word')) return NodeFilter.FILTER_REJECT;
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);

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
    if (command === 'stop') {
        stopTTS();
        return;
    }
    if (command === 'play') {
        stopTTS(); 
        prepareTTS();

        setTimeout(() => {
            const spans = Array.from(document.querySelectorAll('.ca-tts-word'));
            if (spans.length === 0) {
                alert("ContextAware: No text found.");
                return;
            }
            let fullText = "";
            ttsWordMap = [];
            spans.forEach(span => {
                ttsWordMap.push({ 
                    start: fullText.length, 
                    end: fullText.length + span.textContent.length,
                    element: span 
                });
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
            ttsUtterance.onend = () => document.querySelectorAll('.ca-tts-active').forEach(el => el.classList.remove('ca-tts-active'));
            window.speechSynthesis.speak(ttsUtterance);
        }, 50);
    }
}

function stopTTS() {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.ca-tts-active').forEach(el => el.classList.remove('ca-tts-active'));
}