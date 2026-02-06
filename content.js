// --- GUARD CLAUSE (Prevents crashes on re-injection) ---
if (!window.caScriptLoaded) {
window.caScriptLoaded = true;

// --- STATE VARIABLES ---
let originalBody = null;
let articleText = ""; 
let bionicProcessed = false; 

// Summary View State
let summaryMode = false;
let summaryOriginalBody = null;
let lastState = { simplify: false, focusMode: false, ruler: false, dyslexia: false, bionic: false, newContent: false, tts: false, tint: "off", contrast: "off" };

// Feature Specific Globals
let rulerElement = null;
let tintElement = null;
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

// --- 2. MAIN STATE APPLICATOR ---
function applyState(state) {
    lastState = state || lastState;

    if (summaryMode && state.simplify) {
        restoreSummaryView();
    }

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
                    tintElement = null;
                    if(isTTSActive) stopTTS(); 
                    toggleFocusMode(false); 
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

    // F. Sensory Tint
    toggleTint(state.tint);

    // G. Contrast Mode
    toggleContrast(state.contrast);

    // H. TTS
    if (state.tts) {
        isTTSActive = true; 
    } else {
        stopTTS();
        isTTSActive = false;
    }

    // I. New Content Indicators
    toggleNewContentObserver(state.newContent);
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
// CONTRAST LOGIC
// ==========================================
function toggleContrast(mode) {
    document.documentElement.classList.remove(
        'ca-contrast-dark-high', 
        'ca-contrast-light-high'
    );

    if (mode && mode !== 'off') {
        document.documentElement.classList.add(`ca-contrast-${mode}`);
    }
}

// ==========================================
// TINT LOGIC
// ==========================================
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

// ==========================================
// READING RULER
// ==========================================
function toggleRuler(enable) {
    let existingRuler = document.getElementById('ca-ruler');
    if (enable) {
        if (!existingRuler) {
            rulerElement = document.createElement("div");
            rulerElement.id = "ca-ruler";
            rulerElement.style.display = "block";
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

// ==========================================
// SUMMARY VIEW
// ==========================================
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

// ==========================================
// NEW CONTENT INDICATORS
// ==========================================

let contentObserver = null;
let markedElements = new WeakSet();
const NEW_CONTENT_DURATION = 5000; // Duration in ms before indicator fades

/**
 * Initialize the new content observer
 * Watches for DOM mutations and highlights changed/new elements
 */
function initNewContentObserver() {
    if (contentObserver) {
        contentObserver.disconnect();
    }

    contentObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Handle added nodes
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Skip if already marked or is a script/style element
                        if (markedElements.has(node) || 
                            node.tagName === 'SCRIPT' || 
                            node.tagName === 'STYLE' ||
                            node.id === 'ca-focus-svg' ||
                            node.id === 'ca-ruler' ||
                            node.id === 'ca-tint-overlay' ||
                            node.classList.contains('ca-container') ||
                            node.classList.contains('ca-summary-container')) {
                            return;
                        }
                        markAsNewContent(node);
                    }
                });
            }
            
            // Handle content changes in existing nodes
            if (mutation.type === 'characterData' || 
                (mutation.type === 'childList' && mutation.target.nodeType === Node.ELEMENT_NODE)) {
                const target = mutation.type === 'characterData' ? mutation.target.parentElement : mutation.target;
                
                if (target && 
                    !markedElements.has(target) &&
                    target.nodeType === Node.ELEMENT_NODE &&
                    target.tagName !== 'SCRIPT' && 
                    target.tagName !== 'STYLE' &&
                    !target.classList.contains('ca-new-content') &&
                    !target.classList.contains('ca-tts-word')) {
                    
                    // Only mark if it's a visible content element
                    const style = window.getComputedStyle(target);
                    if (style.display !== 'none' && style.visibility !== 'hidden') {
                        markAsNewContent(target, 'subtle');
                    }
                }
            }
        });
    });

    // Observe the document with specific configuration
    contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: false
    });
}

/**
 * Mark an element as new content with visual indicator
 * @param {HTMLElement} element - The element to mark
 * @param {string} variant - 'normal', 'glow', or 'subtle'
 * @param {number} duration - How long to show indicator (ms), 0 for permanent
 */
function markAsNewContent(element, variant = 'normal', duration = NEW_CONTENT_DURATION) {
    if (!element || markedElements.has(element)) return;
    
    markedElements.add(element);
    
    // Determine which class to apply
    let className = 'ca-new-content';
    if (variant === 'glow') {
        className = 'ca-new-content-glow';
    } else if (variant === 'subtle') {
        className = 'ca-new-content-subtle';
    }
    
    // Add the class
    element.classList.add(className);
    
    // Auto-remove after duration (if duration > 0)
    if (duration > 0) {
        setTimeout(() => {
            element.classList.add('ca-new-content-fading');
            
            setTimeout(() => {
                element.classList.remove(className, 'ca-new-content-fading');
                markedElements.delete(element);
            }, 1000); // Fade out duration
        }, duration);
    }
}

/**
 * Mark an element as loading
 * @param {HTMLElement} element - The element to mark
 */
function markAsLoading(element) {
    if (!element) return;
    element.classList.add('ca-content-loading');
}

/**
 * Remove loading indicator and optionally mark as new content
 * @param {HTMLElement} element - The element to update
 * @param {boolean} showAsNew - Whether to show new content indicator after loading
 */
function unmarkLoading(element, showAsNew = true) {
    if (!element) return;
    element.classList.remove('ca-content-loading');
    
    if (showAsNew) {
        markAsNewContent(element, 'normal');
    }
}

/**
 * Stop observing for new content
 */
function stopNewContentObserver() {
    if (contentObserver) {
        contentObserver.disconnect();
        contentObserver = null;
    }
}

/**
 * Toggle the new content observer on/off
 * @param {boolean} enable - Whether to enable the observer
 */
function toggleNewContentObserver(enable) {
    if (enable) {
        if (!contentObserver) {
            initNewContentObserver();
        }
    } else {
        stopNewContentObserver();
        // Clean up any existing indicators
        document.querySelectorAll('.ca-new-content, .ca-new-content-glow, .ca-new-content-subtle, .ca-content-loading').forEach(el => {
            el.classList.remove('ca-new-content', 'ca-new-content-glow', 'ca-new-content-subtle', 'ca-new-content-fading', 'ca-content-loading');
        });
        markedElements = new WeakSet();
    }
}

/**
 * Manually highlight specific elements (useful for AJAX-loaded content)
 * @param {string} selector - CSS selector for elements to highlight
 * @param {string} variant - 'normal', 'glow', or 'subtle'
 */
function highlightNewContent(selector, variant = 'normal') {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => markAsNewContent(el, variant));
}

// Expose functions globally for external use (always available for manual control)
window.caMarkNewContent = markAsNewContent;
window.caMarkLoading = markAsLoading;
window.caUnmarkLoading = unmarkLoading;
window.caHighlightNewContent = highlightNewContent;

} // End of guard clause
