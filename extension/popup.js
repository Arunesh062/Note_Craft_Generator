const BACKEND_URL = "http://localhost:8000";
const POLL_INTERVAL = 2000;
const CHUNK_INTERVAL_MS = 30000;

const widget = document.getElementById('nc-widget');
const dragHandle = document.getElementById('nc-drag-handle');
const minimizeBtn = document.getElementById('nc-minimize');
const bubble = document.getElementById('nc-bubble');

const states = {
  idle: document.getElementById("state-idle"),
  recording: document.getElementById("state-recording"),
  processing: document.getElementById("state-processing"),
  ready: document.getElementById("state-ready"),
  error: document.getElementById("state-error"),
};

// UI Elements
const btnStart = document.getElementById("btn-start");
const btnStop = document.getElementById("btn-stop");
const btnRetry = document.getElementById("btn-retry");
const btnNew = document.getElementById("btn-new");
const btnNewError = document.getElementById("btn-new-error");
const btnDocx = document.getElementById("btn-docx");
const timerEl = document.getElementById("timer");
const bubbleTimerEl = document.getElementById("bubble-timer");
const processingTxt = document.getElementById("processing-text");

// Global State
let timerInterval = null;
let pollInterval = null;
let chunkInterval = null;
let elapsedSeconds = 0;
let currentSession = null;
let mediaRecorder = null;
let audioStream = null;
let micStream = null;
let audioContext = null;
let chunkIndex = 0;
let speakerTimeline = [];
let participants = [];
let recordingStart = null;
let isRecording = false;

// ── UI STATE MANAGEMENT ────────────────────────────────────────

function showState(name) {
  Object.values(states).forEach((el) => el.classList.remove("active"));
  if (states[name]) states[name].classList.add("active");
  
  if (name === 'recording') {
    widget.classList.add('recording');
  } else {
    widget.classList.remove('recording');
  }
}

// Minimize / Restore
function toggleMinimize() {
  const isMinimized = widget.classList.toggle('minimized');
  chrome.storage.local.set({ nc_minimized: isMinimized });
  
  // After mode change, ensure position is still valid
  // (CSS transitions might shift things, but we want to stay where we are)
  const rect = widget.getBoundingClientRect();
  widget.style.left = `${rect.left}px`;
  widget.style.top = `${rect.top}px`;
  widget.style.right = 'auto';
  widget.style.bottom = 'auto';
}

minimizeBtn.onclick = (e) => {
  e.stopPropagation();
  toggleMinimize();
};

// Double click to restore or click minimized bubble
widget.onclick = (e) => {
  if (widget.classList.contains('minimized')) {
    toggleMinimize();
  }
};

// ── ROBUST DRAG LOGIC ─────────────────────────────────────────

let isDragging = false;
let startX, startY, initialX, initialY;

// Function to check if we should start dragging based on target
function shouldStartDrag(e) {
  if (widget.classList.contains('minimized')) {
    return true; // Whole bubble is draggable
  }
  // Check if click was on drag handle or its children (but not buttons)
  return dragHandle.contains(e.target) && !e.target.closest('.nc-action-btn');
}

widget.addEventListener('mousedown', (e) => {
  if (!shouldStartDrag(e)) return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  
  const rect = widget.getBoundingClientRect();
  initialX = rect.left;
  initialY = rect.top;
  
  widget.style.transition = 'none'; // Disable animations while dragging
  
  // Use window to capture mouse moves even outside widget
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  
  e.preventDefault(); // Prevent text selection
});

function handleMouseMove(e) {
  if (!isDragging) return;
  
  let dx = e.clientX - startX;
  let dy = e.clientY - startY;
  
  let newX = initialX + dx;
  let newY = initialY + dy;
  
  // Snapping / Boundary logic
  const s = 15; // snapping threshold
  const pad = 10; // margin from edges
  
  if (newX < s) newX = pad;
  if (newY < s) newY = pad;
  
  if (window.innerWidth - (newX + widget.offsetWidth) < s) {
    newX = window.innerWidth - widget.offsetWidth - pad;
  }
  if (window.innerHeight - (newY + widget.offsetHeight) < s) {
    newY = window.innerHeight - widget.offsetHeight - pad;
  }
  
  widget.style.left = `${newX}px`;
  widget.style.top = `${newY}px`;
  widget.style.right = 'auto';
  widget.style.bottom = 'auto';
}

function handleMouseUp() {
  if (!isDragging) return;
  isDragging = false;
  widget.style.transition = ''; // Restore transitions
  
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  
  // Persistent Save
  const rect = widget.getBoundingClientRect();
  chrome.storage.local.set({
    nc_pos: { top: rect.top, left: rect.left }
  });
}

// ── TIMER ─────────────────────────────────────────────────────

function startTimer() {
  elapsedSeconds = 0;
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    const h = String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(elapsedSeconds % 60).padStart(2, "0");
    
    const timeStr = `${h}:${m}:${s}`;
    const bubbleTimeStr = `${m}:${s}`;
    
    if (timerEl) timerEl.textContent = timeStr;
    if (bubbleTimerEl) bubbleTimerEl.textContent = bubbleTimeStr;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ── RECORDING & API LOGIC ─────────────────────────────────────

async function uploadChunk(audioBlob, index) {
  const formData = new FormData();
  formData.append("audio", audioBlob, `chunk_${index}.webm`);
  formData.append("chunk_index", index);
  formData.append("session_id", currentSession);
  formData.append("speaker_timeline", JSON.stringify(speakerTimeline));
  formData.append("participants", JSON.stringify(participants));

  try {
    await fetch(`${BACKEND_URL}/upload-chunk`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    console.error(`Chunk ${index} error:`, err);
  }
}

async function finalizeSession() {
  try {
    await fetch(`${BACKEND_URL}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSession,
        participants: participants,
        speaker_timeline: speakerTimeline,
      }),
    });
  } catch (err) {
    console.error("Finalize error:", err);
  }
}

function recordChunk() {
  if (!audioStream || !isRecording) return;
  const currentIndex = chunkIndex++;
  const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
  const chunks = [];

  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.onstop = async () => {
    if (chunks.length > 0) {
      const blob = new Blob(chunks, { type: "audio/webm" });
      await uploadChunk(blob, currentIndex);
    }
  };

  recorder.start();
  setTimeout(() => recorder.state === "recording" && recorder.stop(), CHUNK_INTERVAL_MS);
  mediaRecorder = recorder;
}

function startPolling(sessionId) {
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/status?session_id=${sessionId}`);
      const data = await res.json();
      if (data.status === "ready") {
        stopPolling();
        const docxUrl = data.docx_url ? `${BACKEND_URL}${data.docx_url}` : "";
        showState("ready");
        if (btnDocx && docxUrl) btnDocx.href = docxUrl;
      } else if (data.status === "failed") {
        stopPolling();
        showState("error");
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, POLL_INTERVAL);
}

function stopPolling() {
  clearInterval(pollInterval);
  pollInterval = null;
}

// ── BUTTON LISTENERS ──────────────────────────────────────────

btnStart.onclick = async () => {
  currentSession = crypto.randomUUID();
  chunkIndex = 0;
  speakerTimeline = [];
  participants = [];
  isRecording = true;

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const tabAudioTrack = displayStream.getAudioTracks()[0];
    displayStream.getVideoTracks().forEach(t => t.stop());

    if (!tabAudioTrack) {
      alert("Tab audio required.");
      isRecording = false;
      return;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {}

    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(new MediaStream([tabAudioTrack])).connect(destination);
    
    if (micStream) {
      const micSource = audioContext.createMediaStreamSource(micStream);
      const gain = audioContext.createGain();
      gain.gain.value = 1.5;
      micSource.connect(gain);
      gain.connect(destination);
    }

    audioStream = destination.stream;
    recordingStart = Date.now();
    tabAudioTrack.onended = () => isRecording && btnStop.click();

    recordChunk();
    chunkInterval = setInterval(() => isRecording && recordChunk(), CHUNK_INTERVAL_MS);

    await chrome.storage.local.set({ currentSession, currentState: "recording" });
    showState("recording");
    startTimer();
  } catch (err) {
    isRecording = false;
    console.error(err);
  }
};

btnStop.onclick = async () => {
  isRecording = false;
  stopTimer();
  clearInterval(chunkInterval);
  
  if (mediaRecorder?.state === "recording") mediaRecorder.stop();
  [audioStream, micStream].forEach(s => s?.getTracks().forEach(t => t.stop()));
  audioContext?.close();

  showState("processing");
  await chrome.storage.local.clear();
  await finalizeSession();
  startPolling(currentSession);
};

btnNew.onclick = btnNewError.onclick = async () => {
  isRecording = false;
  stopPolling();
  stopTimer();
  clearInterval(chunkInterval);
  currentSession = null;
  await chrome.storage.local.clear();
  showState("idle");
};

btnRetry.onclick = async () => {
  showState("processing");
  await finalizeSession();
  startPolling(currentSession);
};

// ── INITIALIZATION ─────────────────────────────────────────────

(async () => {
  const stored = await chrome.storage.local.get(["currentSession", "currentState", "nc_pos", "nc_minimized"]);
  
  // Restore position
  if (stored.nc_pos) {
    widget.style.top = `${stored.nc_pos.top}px`;
    widget.style.left = `${stored.nc_pos.left}px`;
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }
  
  // Restore minimized state
  if (stored.nc_minimized) {
    widget.classList.add('minimized');
  }

  if (stored.currentSession && stored.currentState === "recording") {
    currentSession = stored.currentSession;
    showState("recording");
    startTimer();
    startPolling(currentSession);
  } else {
    showState("idle");
  }
})();