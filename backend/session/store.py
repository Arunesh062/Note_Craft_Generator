from typing import Dict, Any, List, Optional

# ── In-memory store ────────────────────────────────────────────
sessions: Dict[str, Any] = {}


def create_session(session_id: str, participants: List[str], speaker_timeline: List[dict]):
    sessions[session_id] = {
        "status":           "processing",
        "participants":     participants,
        "speaker_timeline": speaker_timeline,
        "chunks":           {},
        "block_summaries":  [],
        "mom_json":         None,
        "pdf_url":          None,
        "docx_url":         None,
    }


def save_chunk(session_id: str, chunk_index: int, data: dict):
    if session_id not in sessions:
        return
    sessions[session_id]["chunks"][chunk_index] = data


def get_chunk(session_id: str, chunk_index: int) -> dict:
    return sessions.get(session_id, {}).get("chunks", {}).get(chunk_index, {})


def get_all_chunks(session_id: str) -> List[dict]:
    chunks = sessions.get(session_id, {}).get("chunks", {})
    return [chunks[i] for i in sorted(chunks.keys())]


def get_failed_chunks(session_id: str) -> List[int]:
    chunks = sessions.get(session_id, {}).get("chunks", {})
    return [i for i, c in chunks.items() if c.get("status") == "failed"]


def set_status(session_id: str, status: str):
    if session_id in sessions:
        sessions[session_id]["status"] = status


def save_block_summaries(session_id: str, summaries: List[str]):
    if session_id in sessions:
        sessions[session_id]["block_summaries"] = summaries


def save_mom(session_id: str, mom_json: dict):
    if session_id in sessions:
        sessions[session_id]["mom_json"] = mom_json


def save_urls(session_id: str, pdf_url: str, docx_url: str):
    if session_id in sessions:
        sessions[session_id]["pdf_url"]  = pdf_url
        sessions[session_id]["docx_url"] = docx_url


def get_session(session_id: str) -> Optional[dict]:
    # Returns None (not {}) when session doesn't exist
    # so finalize.py's `if not session` check works correctly
    return sessions.get(session_id, None)


def delete_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]