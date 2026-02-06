# ContextAware: Focus & Accessibility - Merged Extension

**Version 4.0** - Complete Feature Set

## 🎯 Overview
This is a unified browser extension that combines all features from both `browser-extension-f` and `browser-extension-m` into a single, comprehensive accessibility and focus tool.

## ✨ All Features Included

### **From browser-extension-f:**
- **🎯 Focus Mode** - SVG overlay that highlights interactive elements (buttons, links, inputs) while dimming the rest of the page
  - Keyboard shortcut: `Alt+Shift+F`
  - Dynamic updates on scroll and resize
  - Swiss cheese SVG masking technique

### **From browser-extension-m:**
- **🎨 Sensory Tint** - Color overlays for Irlen syndrome and visual stress reduction
  - Options: Cool Blue, Soft Green, Pale Rose, Warm Peach, Dim Gray
- **🌗 High Contrast Modes** - Enhanced visibility options
  - Dark Shield: Black background with neon yellow text
  - Light Definer: White background with pure black text
- **📝 Enhanced Summary View** - Beautiful on-page summary display with close button

### **Common Features (Enhanced):**
- **📖 Reader View** - Simplified, distraction-free reading mode
  - Keyboard shortcut: `Ctrl+Shift+Q` (Mac: `MacCtrl+Q`)
  - Form rescue feature
- **📏 Reading Ruler** - Highlight current line for easier reading
- **⚡ Bionic Reading** - Bold word beginnings for faster reading
- **🧠 Dyslexia Font** - Specialized fonts for better letter distinction
- **🗣️ Read Aloud (TTS)** - Text-to-speech with word highlighting
  - Adjustable speed and pitch
  - Snappy or smooth animations
- **📝 Quick Summary** - AI-powered text summarization (3-25 sentences)

## 🎹 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + Shift + F` | Toggle Focus Mode |
| `Ctrl + Shift + Q` (Mac: `MacCtrl + Q`) | Toggle Reader View |

## 📁 Project Structure

```
browser-extension-merged/
├── manifest.json          # Extension configuration (v4.0)
├── background.js          # Service worker with both shortcuts
├── popup.html            # Complete UI with all controls
├── popup.js              # Unified popup logic
├── content.js            # Merged content script with all features
├── content.css           # All styles including Focus Mode, Tint, Contrast
├── popup.css             # UI styles
├── readability.js        # Mozilla's Readability library
├── summarizer.js         # Text summarization algorithm
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🚀 How to Install

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `browser-extension-merged` folder
5. The extension is now ready to use!

## 🔧 Technical Details

**Manifest Version:** 3  
**Permissions:** activeTab, scripting, storage, commands  
**Injection Strategy:** Smart injection with fallback (from extension-f)  
**State Management:** Chrome storage API with live sync

## 📝 Feature Comparison

| Feature | Extension-F | Extension-M | Merged |
|---------|------------|-------------|---------|
| Reader View | ✅ | ✅ | ✅ |
| Focus Mode | ✅ | ❌ | ✅ |
| Reading Ruler | ✅ | ✅ | ✅ |
| Bionic Reading | ✅ | ✅ | ✅ |
| Dyslexia Font | ✅ | ✅ | ✅ |
| TTS | ✅ | ✅ | ✅ |
| Summarization | ✅ | ✅ | ✅ |
| Sensory Tint | ❌ | ✅ | ✅ |
| High Contrast | ❌ | ✅ | ✅ |
| Summary View | ❌ | ✅ | ✅ |
| 2 Shortcuts | ❌ | ❌ | ✅ |

## 🎨 New Combined Features

1. **Dual Keyboard Shortcuts** - Quick access to both Focus Mode and Reader View
2. **Complete Accessibility Suite** - All visual adjustment tools in one place
3. **Enhanced State Management** - Both shortcuts update popup UI in real-time
4. **Robust Injection Logic** - Smart script injection from extension-f
5. **Beautiful Summary Display** - On-page summary view from extension-m

## 💡 Usage Tips

- Use **Reader View** (`Ctrl+Shift+Q`) to simplify articles
- Enable **Focus Mode** (`Alt+Shift+F`) when filling out forms or navigating complex pages
- Combine **Sensory Tint** with **Dyslexia Font** for maximum reading comfort
- Use **High Contrast** modes in bright environments or for enhanced visibility
- **Bionic Reading** works great with **Read Aloud** for multisensory learning

---

**Created:** February 2026  
**Merged from:** browser-extension-f (v3.2) + browser-extension-m (v1.0)
