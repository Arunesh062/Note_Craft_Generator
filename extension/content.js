// content.js — NoteCraft Generator Content Script
// Injected into meeting pages to provide the floating assistant widget.

(function () {
  if (window.notecraftInjected) return;
  window.notecraftInjected = true;

  const BACKEND_URL = 'http://localhost:8000';
  const CHUNK_INTERVAL_MS = 30000;
  const POLL_INTERVAL = 2000;

  let shadowRoot = null;
  let container = null;
  let widget = null;
  let isRecording = false;
  let currentSession = null;
  let chunkIndex = 0;
  let timerInterval = null;
  let chunkInterval = null;
  let elapsedSeconds = 0;
  let recordingStart = null;
  let mediaRecorder = null;
  let audioStream = null;
  let micStream = null;
  let tabStream = null;
  let audioCtx = null;
  let speakerTimeline = [];
  let participants = [];
  let lastSpeaker = null;

  const PLATFORM = (() => {
    if (location.href.includes('meet.google.com')) return 'meet';
    if (location.href.includes('zoom.us')) return 'zoom';
    if (location.href.includes('teams.microsoft')) return 'teams';
    return 'unknown';
  })();

  const SELECTORS = {
    meet: {
      participants: '.zWGUib, .ZjG79c, .dwS77e',
      activeSpeaker: '.KF4T6b, [data-speaking="true"] .zWGUib',
    },
  };

  // ── HELPER: Safe Storage ──────────────────────────────────────
  function safeStorageSet(data) {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set(data);
      }
    } catch (e) {
      console.warn("Storage access failed (likely context invalidated). Please refresh the page.");
    }
  }

  function safeStorageGet(keys, callback) {
    try {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.get(keys, callback);
      }
    } catch (e) {
      console.warn("Storage access failed (likely context invalidated).");
    }
  }

  // ── SCRAPING LOGIC ───────────────────────────────────────────

  function scrapeParticipants() {
    const sel = SELECTORS[PLATFORM]?.participants;
    if (!sel) return [];
    return [...new Set(Array.from(document.querySelectorAll(sel)).map(el => el.textContent.trim()).filter(n => n.length > 0))];
  }

  function startScraping() {
    const observer = new MutationObserver(() => {
      const sel = SELECTORS[PLATFORM]?.activeSpeaker;
      if (!sel) return;
      const el = document.querySelector(sel);
      const name = el?.textContent.trim();

      if (name && name !== lastSpeaker && isRecording) {
        lastSpeaker = name;
        const elapsed = Date.now() - (recordingStart || Date.now());
        speakerTimeline.push({ name, timestamp_ms: elapsed });
        console.log('🗣️ Speaker detected:', name);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    setInterval(() => {
      if (isRecording) participants = scrapeParticipants();
    }, 10000);
  }

  // ── UI INJECTION ─────────────────────────────────────────────

  async function injectUI() {
    if (document.getElementById('notecraft-root')) return;

    const host = document.createElement('div');
    host.id = 'notecraft-root';
    document.body.appendChild(host);
    shadowRoot = host.attachShadow({ mode: 'open' });

    container = document.createElement('div');
    container.id = 'nc-container';
    shadowRoot.appendChild(container);

    try {
      const cssUrl = chrome.runtime.getURL('popup.css');
      const response = await fetch(cssUrl);
      const cssText = await response.text();
      
      const style = document.createElement('style');
      style.textContent = cssText + `
        #nc-widget { 
          position: fixed !important; 
          bottom: auto !important; 
          right: auto !important; 
          opacity: 1 !important;
          background: #111827 !important;
          background-color: #111827 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          /* Remove !important from left/top to allow dragging via JS */
          left: 20px;
          top: 20px;
        }
      `;
      shadowRoot.appendChild(style);
    } catch (err) {
      console.error("Failed to load popup.css:", err);
    }

    updateUI('idle');
    initWidgetPosition();
  }

  function updateUI(state, data = {}) {
    const html = `
      <div id="nc-widget" class="${isRecording ? 'recording' : ''}">
        <div class="nc-header" id="nc-drag-handle">
          <div class="nc-logo-group">
            <div class="nc-dot"></div>
            <span class="nc-title">NoteCraft AI</span>
          </div>
          <div class="nc-actions">
            <button class="nc-action-btn" id="nc-minimize" title="Minimize">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </div>

        <div class="nc-bubble-content" id="nc-bubble">
          <div class="nc-pulse"></div>
          <div class="nc-dot" style="width: 16px; height: 16px; margin: 0 auto 4px;"></div>
          <div class="nc-bubble-timer" id="bubble-timer">00:00</div>
        </div>

        <div id="nc-main-body">
          ${getStateContent(state, data)}
        </div>
      </div>
    `;

    container.innerHTML = html;
    widget = shadowRoot.getElementById('nc-widget');
    
    attachListeners(state);
    initDraggable();
  }

  function getStateContent(state, data) {
    switch (state) {
      case 'idle':
        return `
          <div id="state-idle" class="nc-content active">
            <div style="text-align: center; padding: 10px 0;">
              <p class="nc-status">Ready to capture your meeting insights.</p>
              <button id="btn-start" class="nc-btn nc-btn-primary">Start Recording</button>
            </div>
          </div>
        `;
      case 'recording':
        return `
          <div id="state-recording" class="nc-content active">
            <div style="text-align: center;">
              <div class="nc-recording-badge">Live Recording</div>
              <div id="timer" class="nc-timer">00:00:00</div>
              <button id="btn-stop" class="nc-btn nc-btn-danger">Stop Meeting</button>
            </div>
          </div>
        `;
      case 'processing':
        return `
          <div id="state-processing" class="nc-content active">
            <div style="text-align: center;">
              <p class="nc-title">Orchestrating Notes</p>
              <div class="nc-progress-container"><div class="nc-progress-bar"></div></div>
              <p class="nc-status" style="font-size: 11px;">Synthesizing AI insights...</p>
            </div>
          </div>
        `;
      case 'ready':
        return `
          <div id="state-ready" class="nc-content active">
            <div style="text-align: center;">
              <p class="nc-title" style="color: white;">Notes Ready!</p>
              <button id="btn-download" class="nc-btn nc-btn-success">Download DOCX</button>
              <button id="btn-reset" class="nc-btn nc-btn-danger" style="background:transparent">New Session</button>
            </div>
          </div>
        `;
      default:
        return `<div class="nc-content active"><p class="nc-status">Something went wrong.</p></div>`;
    }
  }

  function attachListeners(state) {
    const btnStart = shadowRoot.getElementById('btn-start');
    const btnStop = shadowRoot.getElementById('btn-stop');
    const btnDownload = shadowRoot.getElementById('btn-download');
    const btnReset = shadowRoot.getElementById('btn-reset');
    const minimizeBtn = shadowRoot.getElementById('nc-minimize');
    const bubble = shadowRoot.getElementById('nc-bubble');

    if (btnStart) btnStart.onclick = startRecording;
    if (btnStop) btnStop.onclick = stopRecording;
    if (btnDownload) btnDownload.onclick = () => window.open(`${BACKEND_URL}/download/${currentSession}`);
    if (btnReset) btnReset.onclick = () => updateUI('idle');
    
    if (minimizeBtn) minimizeBtn.onclick = (e) => { e.stopPropagation(); toggleMinimize(); };
    
    // Bubble click to restore
    widget.onclick = (e) => {
      if (widget.classList.contains('minimized')) {
        toggleMinimize();
      }
    };
  }

  // ── WIDGET BEHAVIOR ──────────────────────────────────────────

  function toggleMinimize() {
    const isMinimized = widget.classList.toggle('minimized');
    safeStorageSet({ nc_minimized: isMinimized });
    
    // Fix position after transition
    const rect = widget.getBoundingClientRect();
    widget.style.left = `${rect.left}px`;
    widget.style.top = `${rect.top}px`;
    widget.style.right = 'auto';
  }

  function initWidgetPosition() {
    safeStorageGet(['nc_pos', 'nc_minimized'], (data) => {
      if (data.nc_pos) {
        widget.style.top = `${data.nc_pos.top}px`;
        widget.style.left = `${data.nc_pos.left}px`;
      } else {
        widget.style.top = '20px';
        widget.style.right = '20px';
      }
      if (data.nc_minimized) widget.classList.add('minimized');
    });
  }

  function initDraggable() {
    const dragHandle = shadowRoot.getElementById('nc-drag-handle');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    widget.onmousedown = (e) => {
      const isMinimized = widget.classList.contains('minimized');
      const isHeader = dragHandle.contains(e.target) && !e.target.closest('.nc-action-btn');
      
      if (!isMinimized && !isHeader) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = widget.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      widget.style.transition = 'none';
      
      const onMouseMove = (me) => {
        if (!isDragging) return;
        let nx = initialX + (me.clientX - startX);
        let ny = initialY + (me.clientY - startY);
        
        // Edge snapping
        const s = 15;
        const pad = 10;
        if (nx < s) nx = pad;
        if (ny < s) ny = pad;
        if (window.innerWidth - (nx + widget.offsetWidth) < s) nx = window.innerWidth - widget.offsetWidth - pad;
        if (window.innerHeight - (ny + widget.offsetHeight) < s) ny = window.innerHeight - widget.offsetHeight - pad;

        widget.style.left = `${nx}px`;
        widget.style.top = `${ny}px`;
        widget.style.right = 'auto';
      };

      const onMouseUp = () => {
        isDragging = false;
        widget.style.transition = '';
        const rect = widget.getBoundingClientRect();
        safeStorageSet({ nc_pos: { top: rect.top, left: rect.left } });
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      
      e.preventDefault();
    };
  }

  // ── RECORDING LOGIC ──────────────────────────────────────────

  async function startRecording() {
    currentSession = crypto.randomUUID();
    chunkIndex = 0;
    speakerTimeline = [];
    isRecording = true;
    recordingStart = Date.now();

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tabStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const tabAudioTrack = tabStream.getAudioTracks()[0];
      tabStream.getVideoTracks().forEach(t => t.stop());

      if (!tabAudioTrack) throw new Error('Tab audio not shared.');

      audioCtx = new AudioContext();
      const destination = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaStreamSource(new MediaStream([tabAudioTrack])).connect(destination);
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const gain = audioCtx.createGain(); gain.gain.value = 1.5;
      micSource.connect(gain); gain.connect(destination);

      audioStream = destination.stream;
      tabAudioTrack.onended = stopRecording;

      updateUI('recording');
      startTimer();
      chunkInterval = setInterval(recordChunk, CHUNK_INTERVAL_MS);
      setTimeout(recordChunk, 1000);

    } catch (err) {
      console.error(err);
      isRecording = false;
      updateUI('idle');
      alert(err.message);
    }
  }

  function recordChunk() {
    if (!audioStream || !isRecording) return;
    const index = chunkIndex++;
    const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      try {
        if (chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            action: 'UPLOAD_CHUNK_DATA',
            sessionId: currentSession,
            chunkIndex: index,
            timeline: JSON.stringify(speakerTimeline),
            participants: JSON.stringify(participants),
            audio: new Uint8Array(buffer)
          });
        }
      } catch (e) { console.warn("Message sending failed."); }
    };
    recorder.start();
    setTimeout(() => recorder.state === 'recording' && recorder.stop(), CHUNK_INTERVAL_MS - 200);
    mediaRecorder = recorder;
  }

  async function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    clearInterval(chunkInterval);
    stopTimer();
    updateUI('processing');
    mediaRecorder?.stop();
    cleanupStreams();

    try {
      await fetch(`${BACKEND_URL}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession, participants, speaker_timeline: speakerTimeline })
      });
      startPolling();
    } catch (err) {
      updateUI('idle');
    }
  }

  function cleanupStreams() {
    [micStream, tabStream].forEach(s => s?.getTracks().forEach(t => t.stop()));
    audioCtx?.close();
  }

  function startPolling() {
    const pollId = setInterval(async () => {
      const res = await fetch(`${BACKEND_URL}/status?session_id=${currentSession}`);
      const data = await res.json();
      if (data.status === 'ready') { clearInterval(pollId); updateUI('ready'); }
    }, POLL_INTERVAL);
  }

  function startTimer() {
    elapsedSeconds = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      const m = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(elapsedSeconds % 60).padStart(2, '0');
      const h = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
      const timerEl = shadowRoot.getElementById('timer');
      const bubbleTimerEl = shadowRoot.getElementById('bubble-timer');
      if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
      if (bubbleTimerEl) bubbleTimerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function stopTimer() { clearInterval(timerInterval); }

  injectUI();
  startScraping();
})();