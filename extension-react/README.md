# NoteCraft Generator (React + Vite)

This is the modernized UI layer for the NoteCraft Generator Chrome Extension.

## Project Structure
- `src/App.jsx`: Central React UI for both popup and floating widget.
- `content.js`: Main entry point for the content script. Handles recording logic and mounts the React widget.
- `background.js`: Service worker for handling chunk uploads.
- `offscreen.js`: Offscreen document for mic recording.
- `vite.config.js`: Configuration for building multiple entry points.

## How to Install and Build

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```

3. **Load the Extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right).
   - Click "Load unpacked".
   - Select the `dist` folder generated in the project directory.

## Communication Architecture
- **State Management**: Uses `chrome.storage.local` to sync state (recording, processing, etc.) between the popup and the content script widget.
- **Commands**:
  - Popup → Content Script: `chrome.tabs.sendMessage`
  - Widget → Content Script (local): `CustomEvent` (`nc-start-recording`, `nc-stop-recording`)
- **Recording**: All recording and scraping logic is preserved in `content.js`.
- **Backend**: Communicates with FastAPI on `localhost:8000`.

## Features
- ✅ Modern Solid Dark UI (No glassmorphism)
- ✅ Draggable Floating Widget
- ✅ Minimize/Restore Functionality
- ✅ Real-time Recording Timer
- ✅ Progress Tracking
- ✅ Seamless Integration with Google Meet / Zoom
