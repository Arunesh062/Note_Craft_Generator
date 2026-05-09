# NoteCraft Generator

Automatically generate **Smart Class Notes** and **Minutes of Meeting** from Google Meet, Zoom, or Microsoft Teams using a Chrome Extension and an AI-powered Python backend.

---

## What it does

- Records your online class or meeting audio live via a Chrome extension
- Captures participant names and active speaker timeline from the meeting DOM
- Transcribes audio using **Sarvam AI (Saaras v2.5)**
- Cleans, summarises, and generates structured notes using **Sarvam-M LLM**
- Exports professional **DOCX** documents — class notes or meeting minutes
- Sections appear **only if content exists** — no empty headings ever
- Deletes all data after download — privacy first

-
## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | JavaScript (Manifest V3) |
| Backend | Python, FastAPI |
| Speech-to-Text | Sarvam Saaras v2.5 |
| LLM | Sarvam-M |
| DOCX Export | python-docx |

---

## Project Structure

```
notecraft-generator/
├── .gitignore
├── README.md
├── extension/
│   ├── manifest.json       # Chrome extension config + permissions
│   ├── background.js       # Message relay service worker
│   ├── content.js          # DOM scraping — names + active speaker
│   ├── popup.html          # Extension UI — 5 states
│   ├── popup.js            # UI logic + audio capture + backend polling
│   └── popup.css           # Popup styles
│
└── backend/
    ├── main.py             # FastAPI entry point
    ├── models.py           # Pydantic request/response schemas
    ├── .env                # SARVAM_API_KEY (never commit this)
    ├── requirements.txt    # Python dependencies
    ├── session/
    │   └── store.py        # In-memory session store
    ├── routers/
    │   ├── chunks.py       # POST /upload-chunk
    │   ├── finalize.py     # POST /finalize
    │   └── status.py       # GET /status
    ├── services/
    │   ├── sarvam_stt.py   # Sarvam STT — audio to transcript
    │   ├── sarvam_llm.py   # Clean + summarise + generate notes
    │   ├── speaker_map.py  # Assign real names to transcript
    │   └── export.py       # JSON → DOCX (conditional sections)
    └── outputs/            # Generated files (auto-deleted after download)
```

---

## Prerequisites

- Python 3.11 or higher
- Google Chrome browser
- ffmpeg installed and added to PATH
- Sarvam AI API key — sign up at [sarvam.ai](https://sarvam.ai)

---

## Setup — Step by Step

### 1. Clone the project

```bash
git clone https://github.com/Balahariharan003/NoteCraft-Generator.git
cd notecraft-generator
```

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

`requirements.txt` contains:
```
fastapi
uvicorn
python-dotenv
httpx
python-multipart
python-docx
```

### 3. Install ffmpeg (required for audio processing)

**Windows:**
```
Download from https://ffmpeg.org/download.html
Add to PATH environment variable
```

Verify:
```bash
ffmpeg -version
```

### 4. Add your Sarvam API key

Create `backend/.env`:
```
SARVAM_API_KEY=your_sarvam_api_key_here
```

Get your key from the [Sarvam AI dashboard](https://sarvam.ai) after signing up. Free credits are given on signup.

### 5. Start the backend server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO: Application startup complete.
```

### 6. Load the Chrome extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder

The **NoteCraft Generator** icon will appear in your Chrome toolbar.

---

## How to Use

1. Open **Google Meet**, **Zoom**, or **Microsoft Teams** in Chrome
2. Click the **NoteCraft Generator** extension icon
3. Click **Start Recording**
4. Chrome shows a screen share picker:
   - Select **Chrome Tab**
   - Choose your **Meet tab**
   - Tick **"Share tab audio"**
   - Click **Share**
5. Conduct your class or meeting normally
6. Click **End Meeting** when done
7. Wait ~60–90 seconds while notes are generated
8. Click **Download DOCX**
9. All data is automatically deleted after download

---

## How It Works — Pipeline

```
Class/Meeting audio (every 30 seconds)
        ↓
POST /upload-chunk
        ↓
ffmpeg converts WebM → WAV (splits if > 25 seconds)
        ↓
Sarvam Saaras v2.5 → transcript per segment
        ↓
Sarvam-M → clean transcript → segment summary
        ↓
User clicks End Meeting
        ↓
POST /finalize
        ↓
MAP-REDUCE aggregation (Sarvam-M)
5 chunk summaries → 1 block summary
        ↓
Final notes generation → structured JSON (Sarvam-M)
        ↓
Refinement pass (Sarvam-M)
        ↓
Conditional DOCX export
Only sections with content appear
        ↓
Download → Auto delete all temp data
```

---

## Output Structure

### Class Notes DOCX includes (only if discussed):

| Section | Content |
|---|---|
| Session Details | Date, time, platform, instructor |
| Session Overview | Brief summary |
| Learning Objectives | What students should learn |
| Topics Covered | Each topic with explanation and key points |
| Detailed Concepts | Definition, explanation, real examples |
| Examples Solved | Question, solution steps, answer |
| Key Takeaways | Most important points |
| Formulas & Definitions | Quick reference |
| Q&A | Student questions and answers |
| Assignments | Homework given |
| Study Resources | Books, links, slides |
| Additional Notes | Tips, common mistakes |
| Revision Summary | Ultra-short recall points |

---


## Built With

- [Sarvam AI](https://sarvam.ai) — STT and LLM (Indian language support)
- [FastAPI](https://fastapi.tiangolo.com) — Python web framework
- [python-docx](https://python-docx.readthedocs.io) — DOCX generation
- [ffmpeg](https://ffmpeg.org) — Audio processing
- Chrome Extensions API (Manifest V3)

---

## .gitignore

```
backend/.env
__pycache__/
*.pyc
.venv/
backend/outputs/
.DS_Store
```