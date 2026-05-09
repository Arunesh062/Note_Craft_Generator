// background.js — Chrome Extension Service Worker
// Handles data uploads and general background tasks.

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'UPLOAD_CHUNK_DATA') {
    uploadData(message);
    return false;
  }
});

/**
 * Uploads merged audio chunks and metadata to the backend.
 */
async function uploadData(message) {
  const { sessionId, chunkIndex, timeline, participants, audio } = message;

  try {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('chunk_index', chunkIndex);
    formData.append('speaker_timeline', timeline);
    formData.append('participants', participants);

    // Audio is a Uint8Array (serialized from content.js)
    // Combined stream containing both tab and microphone audio
    const audioBlob = new Blob([new Uint8Array(Object.values(audio))], { type: 'audio/webm' });
    formData.append('audio', audioBlob, `chunk_${chunkIndex}.webm`);

    const response = await fetch('http://localhost:8000/upload-chunk', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Merged Chunk ${chunkIndex} uploaded successfully:`, result);
  } catch (err) {
    console.error(`❌ Failed to upload chunk ${chunkIndex}:`, err);
  }
}