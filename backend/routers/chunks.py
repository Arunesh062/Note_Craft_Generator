import json
import asyncio
import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from session.store import save_chunk, get_session, create_session
from services.sarvam_stt import transcribe_chunk
from services.sarvam_llm import clean_transcript, summarise_chunk

router = APIRouter()

# ── POST /upload-chunk ─────────────────────────────────────────
@router.post("/upload-chunk")
async def upload_chunk(
    audio:           UploadFile = File(...),
    session_id:      str        = Form(...),
    chunk_index:     int        = Form(...),
    speaker_timeline: str       = Form(default="[]"),
    participants:    str        = Form(default="[]"),
):
    """
    Receives a single merged audio chunk (tab + mic) from the extension.
    """

    # ── Validate ───────────────────────────────────────────────
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # ── Parse JSON strings from form fields ───────────────────
    try:
        timeline     = json.loads(speaker_timeline)
        participants_list = json.loads(participants)
    except json.JSONDecodeError:
        timeline          = []
        participants_list = []

    # ── Create session if first chunk ─────────────────────────
    session = get_session(session_id)
    if not session:
        create_session(session_id, participants_list, timeline)

    # ── Read audio bytes ───────────────────────────────────────
    audio_bytes = await audio.read()

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file received")

    print(f"Chunk {chunk_index} received: {len(audio_bytes)}B (merged stream)")

    # ── Save chunk as pending immediately ─────────────────────
    save_chunk(session_id, chunk_index, {
        "chunk_index": chunk_index,
        "raw":         "",
        "clean":       "",
        "summary":     "",
        "words":       [],
        "status":      "pending",
    })

    # ── Process chunk in background ───────────────────────────
    asyncio.create_task(
        process_chunk(session_id, chunk_index, audio_bytes)
    )

    return {
        "message":     "Chunk received",
        "session_id":  session_id,
        "chunk_index": chunk_index,
    }


# ── Background task: STT → clean → summarise ──────────────────
async def process_chunk(session_id: str, chunk_index: int, audio_bytes: bytes):
    """
    Runs in the background while the meeting continues.
    """
    try:
        # ── Step 1: Speech to text ─────────────────────────────
        stt_result = await transcribe_chunk(audio_bytes, chunk_index)

        if stt_result["status"] == "failed":
            save_chunk(session_id, chunk_index, {
                "chunk_index": chunk_index,
                "raw":         "",
                "clean":       "",
                "summary":     "",
                "words":       [],
                "status":      "failed",
            })
            return

        raw_transcript = stt_result["transcript"]
        words          = stt_result["words"]

        # ── Step 2: Clean transcript ───────────────────────────
        cleaned = await clean_transcript(raw_transcript)

        # ── Step 3: Get previous chunk summary for context ─────
        prev_summary = _get_prev_summary(session_id, chunk_index)

        # ── Step 4: Summarise this chunk ───────────────────────
        summary = await summarise_chunk(
            clean_transcript=cleaned,
            prev_summary=prev_summary,
            chunk_index=chunk_index,
        )

        # ── Save all results ───────────────────────────────────
        save_chunk(session_id, chunk_index, {
            "chunk_index": chunk_index,
            "raw":         raw_transcript,
            "clean":       cleaned,
            "summary":     summary,
            "words":       words,
            "status":      "ok",
        })

        print(f"Chunk {chunk_index} processed successfully for session {session_id}")

    except Exception as e:
        print(f"Chunk {chunk_index} processing error: {e}")
        save_chunk(session_id, chunk_index, {
            "chunk_index": chunk_index,
            "raw":         "",
            "clean":       "",
            "summary":     "",
            "words":       [],
            "status":      "failed",
        })


# ── Get previous chunk summary for context carryover ──────────
def _get_prev_summary(session_id: str, chunk_index: int) -> str:
    if chunk_index == 0:
        return ""
    from session.store import get_chunk
    prev = get_chunk(session_id, chunk_index - 1)
    return prev.get("summary", "")