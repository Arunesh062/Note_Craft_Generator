// offscreen.js — Chrome Extension Offscreen Document
// Handles microphone capture and provides audio chunks to the background script.

let micStream = null;
let mediaRecorder = null;
let isRecording = false;
let chunkQueue = [];
let maxChunks = 5; // ~5 seconds buffer
let lastGoodChunk = null; // Backup buffer to prevent 0B chunks

// Handle messages from the background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false;

  switch (msg.action) {
    case 'PING':
      sendResponse({ ok: true });
      break;
    case 'START_MIC':
      startMic().then(sendResponse);
      return true;
    case 'STOP_MIC':
      stopMic();
      sendResponse({ ok: true });
      break;
    case 'GET_MIC_CHUNK':
      getChunk().then(sendResponse);
      return true;
    default:
      return false;
  }
});

/**
 * Starts microphone capture using getUserMedia and initializes MediaRecorder.
 */
async function startMic() {
  try {
    if (isRecording) {
      console.log('🎤 Mic already recording');
      return { ok: true };
    }

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    const track = micStream.getAudioTracks()[0];
    if (!track) throw new Error('No audio tracks found');

    console.log('🎤 Mic track captured:', track.label);

    mediaRecorder = new MediaRecorder(micStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    // mediaRecorder.ondataavailable = async (event) => {
    //   if (event.data.size > 0) {
    //     chunkQueue.push(event.data);
    //     // Store as fallback
    //     lastGoodChunk = event.data;
    //   }
    // };

    mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) {
    chunkQueue.push(e.data);

    // 🔥 keep only last few chunks
    if (chunkQueue.length > maxChunks) {
      chunkQueue.shift();
    }
  }
};

    // Use a 500ms timeslice for higher reliability
    mediaRecorder.start(500);
    isRecording = true;
    console.log('🎤 MediaRecorder started with 500ms timeslice');

    return { ok: true };
  } catch (err) {
    console.error('🎤 Mic start failed:', err);
    cleanup();
    return { ok: false, error: err.message };
  }
}

/**
 * Combines all accumulated chunks in the queue and returns them as an ArrayBuffer.
 * Uses lastGoodChunk as fallback if queue is empty.
 */


function getChunk() {
  return new Promise((resolve) => {

    if (chunkQueue.length === 0) {
      console.warn("⚠️ No mic data");
      resolve({ ok: false });
      return;
    }

    // 🔥 combine recent chunks
    const blob = new Blob(chunkQueue, { type: "audio/webm" });

    blob.arrayBuffer().then(buffer => {
      resolve({
        ok: true,
        data: buffer
      });
    });
  });
}
// async function getChunk() {
//   let blob = null;

//   if (chunkQueue.length > 0) {
//     // We have fresh data
//     blob = new Blob(chunkQueue, { type: 'audio/webm' });
//     chunkQueue = []; // Reset queue
//     console.log('🎤 Serving fresh mic chunk from queue');
//   } else if (lastGoodChunk) {
//     // Fallback to last successful chunk
//     blob = new Blob([lastGoodChunk], { type: 'audio/webm' });
//     console.log('🎤 Serving fallback mic chunk (lastGoodChunk)');
//   } else {
//     // Truly empty
//     console.warn('🎤 No mic data available in queue or fallback');
//     return { ok: false, error: 'No data available' };
//   }

//   try {
//     const buffer = await blob.arrayBuffer();
//     return { ok: true, data: buffer };
//   } catch (err) {
//     console.error('🎤 Error creating chunk buffer:', err);
//     return { ok: false, error: err.message };
//   }
// }

/**
 * Stops recording and cleans up resources.
 */
function stopMic() {
  isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  cleanup();
  console.log('🎤 Mic recording stopped');
}

/**
 * Releases microphone and resets state.
 */
function cleanup() {
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  chunkQueue = [];
  lastGoodChunk = null;

  console.log("🎤 Mic resources released");
}