// content.js — NoteCraft Generator Content Script (React + Vite version)
// This file contains the core recording logic and mounts the React UI.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import styles from './src/styles/global.css?inline';

(function () {
  if (window.notecraftInjected) return;
  window.notecraftInjected = true;

  const BACKEND_URL = 'http://localhost:8000';
  const CHUNK_INTERVAL_MS = 30000;
  const POLL_INTERVAL = 2000;

  let isRecording = false;
  let currentSession = null;
  let chunkIndex = 0;
  let chunkInterval = null;
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
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    setInterval(() => {
      if (isRecording) participants = scrapeParticipants();
    }, 10000);
  }

  // ── RECORDING LOGIC ──────────────────────────────────────────
  async function startRecording() {
    // Reset any lingering variables before attempting
    micStream = null;
    tabStream = null;
    audioStream = null;
    audioCtx = null;
    chunkIndex = 0;
    speakerTimeline = [];

    try {
      // 1. Wait for permissions FIRST before toggling ANY state
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tabStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      
      const tabAudioTrack = tabStream.getAudioTracks()[0];
      
      // We don't need the video track, stop it immediately to save resources
      tabStream.getVideoTracks().forEach(t => t.stop());

      if (!tabAudioTrack) {
        throw new Error('Tab audio not shared. Please ensure you select the "Share tab audio" checkbox.');
      }

      // 2. Permissions & Tracks succeeded, NOW initialize recording state
      currentSession = crypto.randomUUID();
      isRecording = true;
      recordingStart = Date.now();

      audioCtx = new AudioContext();
      const destination = audioCtx.createMediaStreamDestination();
      audioCtx.createMediaStreamSource(new MediaStream([tabAudioTrack])).connect(destination);
      const micSource = audioCtx.createMediaStreamSource(micStream);
      
      // Boost mic gain slightly for clarity alongside tab stream
      const gain = audioCtx.createGain(); 
      gain.gain.value = 1.5;
      micSource.connect(gain); 
      gain.connect(destination);

      audioStream = destination.stream;
      
      // If user stops sharing within Chrome's native UI bar
      tabAudioTrack.onended = stopRecording;

      // 3. Sync state to React via Background Storage
      chrome.storage.local.set({ 
        currentSession, 
        currentState: 'recording',
        elapsedSeconds: 0
      });

      chunkInterval = setInterval(recordChunk, CHUNK_INTERVAL_MS);
      setTimeout(recordChunk, 1000);

    } catch (err) {
      console.warn('NoteCraft Recording Cancelled/Failed:', err.message);
      
      // Full logical cleanup on failure or denial
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (tabStream) tabStream.getTracks().forEach(t => t.stop());
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
      
      // Reset variables so subsequent attempts start fresh
      isRecording = false;
      currentSession = null;
      recordingStart = null;
      
      // Sync idle state so the React UI returns to "Start Recording" elegantly
      chrome.storage.local.set({ currentState: 'idle' });
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
        chrome.runtime.sendMessage({
          action: 'UPLOAD_CHUNK_DATA',
          sessionId: currentSession,
          chunkIndex: index,
          timeline: JSON.stringify(speakerTimeline),
          participants: JSON.stringify(participants),
          audio: new Uint8Array(buffer)
        });
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
    mediaRecorder?.stop();
    
    [micStream, tabStream].forEach(s => s?.getTracks().forEach(t => t.stop()));
    audioCtx?.close();

    chrome.storage.local.set({ currentState: 'processing' });

    try {
      await fetch(`${BACKEND_URL}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSession, participants, speaker_timeline: speakerTimeline })
      });
      startPolling();
    } catch (err) {
      chrome.storage.local.set({ currentState: 'idle' });
    }
  }

  function startPolling() {
    const pollId = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/status?session_id=${currentSession}`);
        const data = await res.json();
        if (data.status === 'ready') { 
          clearInterval(pollId); 
          chrome.storage.local.set({ currentState: 'ready' }); 
        }
      } catch (e) {}
    }, POLL_INTERVAL);
  }

  // ── UI MOUNTING ──────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'notecraft-react-root';
  document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: 'open' });
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  shadow.appendChild(styleTag);
  
  const container = document.createElement('div');
  shadow.appendChild(container);

  // Inject fonts and icons if needed
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';
  document.head.appendChild(fontLink);

  // Message listener for React UI communication (from Popup)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'START_RECORDING') startRecording();
    if (msg.action === 'STOP_RECORDING') stopRecording();
  });

  // Local event listeners for React UI communication (from Widget)
  window.addEventListener('nc-start-recording', startRecording);
  window.addEventListener('nc-stop-recording', stopRecording);
  window.addEventListener('nc-session-reset', () => {
    isRecording = false;
    currentSession = null;
    chunkIndex = 0;
    if (chunkInterval) {
      clearInterval(chunkInterval);
      chunkInterval = null;
    }
    recordingStart = null;
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
    audioCtx = null;
    [micStream, tabStream].forEach(s => s?.getTracks().forEach(t => t.stop()));
    micStream = null;
    tabStream = null;
    audioStream = null;
    mediaRecorder = null;
    speakerTimeline = [];
    participants = [];
    lastSpeaker = null;
    console.log('🔄 NoteCraft Session fully reset');
  });

  // Also handle direct calls if React is in the same bundle
  // (Since we are importing App here, we can use a bridge)
  
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App mode="widget" />
    </React.StrictMode>
  );

  startScraping();
})();
