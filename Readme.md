# 🎙️ NoteCraft AI
### *Intelligence-Driven Minutes of Meeting (MoM) & Class Notes Generator*

[![Version](https://img.shields.io/badge/version-2.0.0-blueviolet.svg?style=for-the-badge)](https://github.com/Arunesh062/Note_Craft_Generator)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![SarvamAI](https://img.shields.io/badge/AI-Sarvam--M-orange?style=for-the-badge)](https://www.sarvam.ai/)

**NoteCraft AI** is a professional-grade, automated ecosystem designed to capture, transcribe, and synthesize live audio from virtual sessions (Google Meet, Zoom, MS Teams). It transforms raw classroom or meeting dialogue into structured, institutional-standard **Minutes of Meeting (MoM)** documents using a high-performance React extension and a robust FastAPI backend.

---

## ✨ Premium Experience & Features

### 🎨 High-End Dark Aesthetic
*   **Solid Neutral Design**: A transition from generic translucency to a high-contrast, premium solid dark UI optimized for professional focus.
*   **Fluid Floating Widget**: A persistent, draggable FAB (Floating Action Button) that overlays seamlessly on active meeting tabs.
*   **Lag-Free Interaction**: Implemented **React Reference-based dragging** that bypasses state-update cycles, ensuring 60FPS fluid UI movement even during resource-heavy video calls.
*   **Viewport Guardians**: Advanced coordinate normalization prevents the widget from ever being lost outside the browser's viewable area.

### 🎧 Precision Audio Capture
*   **Unified Loopback**: Simultaneously captures Tab Audio (remote speakers) and Microphone Input into a single high-fidelity stream.
*   **MV3 Compliant**: Utilizes a dedicated **Offscreen Document loopback** to maintain continuous recording under strict Chrome Manifest V3 regulations.
*   **Async Chunking**: Audio is fragmented into 30-second segments and dispatched via background non-blocking workers for immediate processing.

### 🧠 Advanced AI Synthesis
*   **Sarvam Saaras STT**: Optimized for diverse speech profiles and accents, delivering high-accuracy transcription with minimal latency.
*   **Map-Reduce Pipeline**: Our proprietary sequential aggregation engine handles long sessions by summarizing blocks of text, preserving context while avoiding LLM token limits.
*   **Institutional Intelligence**: Specifically pre-configured for **Nandha Engineering College (CSE)** templates, auto-generating compliant headers, member lists, and structured action-item grids.

---

## 🛠️ The Tech Stack

| Layer | Architecture | Core Technologies |
| :--- | :--- | :--- |
| **Frontend** | Browser Extension | React 18, Vite, Lucide Icons, CSS3 Variables |
| **Backend** | Microservice API | Python 3.11+, FastAPI, Uvicorn |
| **Processing** | Audio Signal Engine | FFmpeg (WAV/WebM Signal Processing) |
| **Speech** | Transcription Core | Sarvam Saaras v2.5 (High-Precision STT) |
| **Cognition** | LLM Orchestration | Sarvam-M (Map-Reduce & Refinement) |
| **Egress** | Document Engine | `python-docx` (XML-level Document Control) |

---

## 📂 Project Anatomy

```text
Note_Craft_Generator/
├── extension-react/          # Modern React Extension
│   ├── background.js         # Service Worker & State Sync
│   ├── offscreen.html        # Audio Stream Capture Engine
│   └── src/
│       ├── App.jsx           # Core Widget Logic (Drag/State/UI)
│       └── components/       # Premium UI Modules
└── backend/                  # FastAPI Intelligence Layer
    ├── main.py               # API Orchestration & CORS
    ├── routers/              # Chunks, Finalize & Status Endpoints
    ├── services/             # STT, LLM & DOCX Export Services
    └── outputs/              # Volatile Session Storage (Auto-Cleaned)
```

---

## 🚀 Setup & Installation

### 1️⃣ Prepare Environment
*   **Node.js**: v18+ 
*   **Python**: v3.11+
*   **FFmpeg**: Installed and added to system `PATH`
*   **Sarvam AI Key**: Obtain from [sarvam.ai](https://www.sarvam.ai)

### 2️⃣ Extension Deployment
```bash
cd extension-react
npm install
npm run build
```
> **Manual Step**: Go to `chrome://extensions`, enable **Developer Mode**, click **Load Unpacked**, and select the `dist` folder.

### 3️⃣ Backend Activation
```bash
cd backend
pip install -r requirements.txt
# Create .env with SARVAM_API_KEY=your_key
python run.py
```

---

## 📋 Operational Workflow

1.  **Activate**: Ensure the backend is running on `localhost:8000`.
2.  **Capture**: Open Google Meet, click the NoteCraft icon, and share **Tab Audio**.
3.  **Monitor**: A floating badge tracks your time. Expand it to see live status.
4.  **Finalize**: Click "Stop Meeting" to trigger the Map-Reduce synthesis.
5.  **Export**: Download your professional, structured MoM as a `.docx` file.

---

## 🔒 Privacy & Security

NoteCraft AI is built with a **Privacy-First** architecture. Audio segments and transcripts are stored in volatile session memory. Once the final document is generated and downloaded, all associated session data is purged from the server, ensuring your meetings remain confidential.

---

<p align="center">
  <i>Developed for professional excellence by the NoteCraft Team.</i><br>
  <b>Nandha Engineering College | Department of CSE</b>
</p>