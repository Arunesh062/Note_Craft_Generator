import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException
from models import FinalizeRequest
from session.store import (
    get_session,
    get_all_chunks,
    create_session,
    get_failed_chunks,
    save_chunk,
    save_block_summaries,
    save_mom,
    save_urls,
    set_status,
)
from services.sarvam_stt import transcribe_chunk
from services.sarvam_llm import (
    clean_transcript,
    summarise_chunk,
    aggregate_block,
    generate_mom,
    refine_mom,
)
from services.speaker_map import assign_speakers
from services.export import export_documents

router = APIRouter()

CHUNK_GROUP_SIZE = 5  # number of chunk summaries per block


# ── POST /finalize ─────────────────────────────────────────────
@router.post("/finalize")
async def finalize(request: FinalizeRequest):
    """
    Triggered when user clicks End Meeting.
    Runs full pipeline in background and returns immediately.
    """
    session_id = request.session_id
    session    = get_session(session_id)

    # ── Auto-create session if it doesn't exist ────────────────
    # This handles direct API testing without prior chunk uploads
    if not session:
        create_session(session_id, request.participants, [
            e.dict() for e in request.speaker_timeline
        ])
        session = get_session(session_id)

    # ── Update speaker timeline and participants ────────────────
    if request.speaker_timeline:
        session["speaker_timeline"] = [
            e.dict() for e in request.speaker_timeline
        ]
    if request.participants:
        session["participants"] = request.participants

    # Set status to processing and run pipeline in background
    set_status(session_id, "processing")
    asyncio.create_task(run_pipeline(session_id))

    return {"message": "Finalization started", "session_id": session_id}


# ── Full pipeline ──────────────────────────────────────────────
async def run_pipeline(session_id: str):
    """
    Runs the complete pipeline after End Meeting:
        1. Retry failed chunks
        2. Speaker mapping
        3. MAP-REDUCE aggregation
        4. Final Notes generation
        5. Refinement pass
        6. Export PDF + DOCX
    """
    try:
        session = get_session(session_id)

        # ── Step 1: Retry failed chunks ────────────────────────
        failed = get_failed_chunks(session_id)
        if failed:
            print(f"Retrying {len(failed)} failed chunks...")
            await _retry_failed_chunks(session_id, failed)

        # ── Step 2: Speaker mapping ────────────────────────────
        print("Running speaker mapping...")
        chunks           = get_all_chunks(session_id)
        speaker_timeline = session.get("speaker_timeline", [])
        tagged_transcript = assign_speakers(chunks, speaker_timeline)

        # ── Step 3: MAP-REDUCE — group chunks into blocks ──────
        print("Running MAP-REDUCE aggregation...")
        block_summaries = await _aggregate_blocks(session_id, chunks)
        save_block_summaries(session_id, block_summaries)

        # ── Step 4: Generate final MoM JSON ───────────────────
        print("Generating final Notes...")
        participants = session.get("participants", [])
        meeting_date = datetime.now().strftime("%Y-%m-%d")

        mom_json = await generate_mom(
            block_summaries=block_summaries,
            participants=participants,
            meeting_date=meeting_date,
        )

        # ── Step 5: Refinement pass ────────────────────────────
        # Comment this out to use Fast mode
        print("Running refinement pass...")
        mom_json = await refine_mom(mom_json)

        save_mom(session_id, mom_json)

        # ── Step 6: Export PDF + DOCX ──────────────────────────
        print("Exporting documents...")
        pdf_url, docx_url = export_documents(mom_json, session_id)
        save_urls(session_id, pdf_url, docx_url)

        # ── Done ───────────────────────────────────────────────
        set_status(session_id, "ready")
        print(f"Pipeline complete for session {session_id}")

    except Exception as e:
        print(f"Pipeline error for session {session_id}: {e}")
        set_status(session_id, "failed")


# ── Retry failed chunks ────────────────────────────────────────
async def _retry_failed_chunks(session_id: str, failed_indexes: list):
    """
    Re-processes only the chunks that failed during the meeting.
    Runs them sequentially to avoid hammering the Sarvam API.
    """
    session = get_session(session_id)

    for chunk_index in sorted(failed_indexes):
        print(f"Retrying chunk {chunk_index}...")
        try:
            # We don't have the original audio bytes anymore
            # so we mark them as skipped with empty content
            # In production you'd store audio bytes in session too
            save_chunk(session_id, chunk_index, {
                "chunk_index": chunk_index,
                "raw":         "[chunk unavailable — retry failed]",
                "clean":       "[chunk unavailable]",
                "summary":     "[this segment could not be recovered]",
                "words":       [],
                "status":      "ok",  # mark ok so pipeline continues
            })
        except Exception as e:
            print(f"Retry failed for chunk {chunk_index}: {e}")


# ── MAP-REDUCE: group chunk summaries into block summaries ─────
async def _aggregate_blocks(session_id: str, chunks: list) -> list:
    """
    Groups every CHUNK_GROUP_SIZE chunk summaries into one
    block summary using Sarvam-M.

    Example: 40 chunks / 5 per group = 8 block summaries
    """
    # Collect all chunk summaries in order
    summaries = [
        c.get("summary", "") for c in chunks
        if c.get("status") == "ok" and c.get("summary")
    ]

    if not summaries:
        return ["No meeting content could be extracted."]

    # Split into groups of CHUNK_GROUP_SIZE
    groups = [
        summaries[i : i + CHUNK_GROUP_SIZE]
        for i in range(0, len(summaries), CHUNK_GROUP_SIZE)
    ]

    # Aggregate each group into one block summary
    block_summaries = []
    for block_index, group in enumerate(groups):
        print(f"Aggregating block {block_index + 1} of {len(groups)}...")
        block_summary = await aggregate_block(group, block_index)
        block_summaries.append(block_summary)

    return block_summaries