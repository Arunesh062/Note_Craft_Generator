# from fastapi import APIRouter, HTTPException
# from fastapi.responses import FileResponse
# from starlette.background import BackgroundTask
# import os
# from models import StatusResponse
# from session.store import get_session, delete_session

# router = APIRouter()

# OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs")


# # ── GET /status ────────────────────────────────────────────────
# @router.get("/status", response_model=StatusResponse)
# async def get_status(session_id: str):
#     """
#     Called by popup.js every 2 seconds after End Meeting.
#     Returns current pipeline status and download URLs when ready.
#     """
#     session = get_session(session_id)

#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")

#     return StatusResponse(
#         session_id = session_id,
#         status     = session.get("status", "processing"),
#         pdf_url    = session.get("pdf_url"),
#         docx_url   = session.get("docx_url"),
#     )


# # ── GET /outputs/{filename} ────────────────────────────────────
# @router.get("/outputs/{filename}")
# async def download_file(filename: str):
#     """
#     Serves the generated PDF or DOCX file for download.
#     Deletes the file AFTER it is fully sent to the user.
#     """
#     file_path = os.path.abspath(
#         os.path.join(OUTPUTS_DIR, filename)
#     )

#     if not os.path.exists(file_path):
#         raise HTTPException(status_code=404, detail="File not found")

#     # Extract session_id from filename (e.g. "test-001.pdf" -> "test-001")
#     session_id = filename.rsplit(".", 1)[0]

#     # Determine media type
#     if filename.endswith(".pdf"):
#         media_type = "application/pdf"
#     elif filename.endswith(".docx"):
#         media_type = (
#             "application/vnd.openxmlformats-officedocument"
#             ".wordprocessingml.document"
#         )
#     else:
#         raise HTTPException(status_code=400, detail="Invalid file type")

#     # ── KEY FIX: use BackgroundTask ────────────────────────────
#     # BackgroundTask runs AFTER the file is fully sent to the user
#     # Previously cleanup ran BEFORE serving — causing the 500 error
#     return FileResponse(
#         path        = file_path,
#         filename    = filename,
#         media_type  = media_type,
#         background  = BackgroundTask(
#             _cleanup_after_download, session_id, file_path
#         ),
#     )


# # ── GET /download/{session_id} ──────────────────────────────────
# @router.get("/download/{session_id}")
# async def download_by_session(session_id: str):
#     """
#     Convenience endpoint for the extension to download by session ID.
#     Retrieves the actual filename from the session store.
#     """
#     session = get_session(session_id)
#     if not session or not session.get("docx_url"):
#         raise HTTPException(status_code=404, detail="Download not ready or session not found")

#     docx_url = session.get("docx_url") # e.g. "/outputs/Meeting_Notes_abc123.docx"
#     filename = os.path.basename(docx_url)
#     file_path = os.path.abspath(os.path.join(OUTPUTS_DIR, filename))

#     if not os.path.exists(file_path):
#         raise HTTPException(status_code=404, detail="File has been deleted or not found")

#     media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
#     return FileResponse(
#         path=file_path,
#         filename=filename,
#         media_type=media_type,
#         background=BackgroundTask(_cleanup_after_download, session_id, file_path)
#     )


# # ── Cleanup runs AFTER file is fully downloaded ────────────────
# def _cleanup_after_download(session_id: str, file_path: str):
#     """
#     Deletes the served file.
#     If no more output files exist for this session — delete session.
#     """
#     try:
#         if os.path.exists(file_path):
#             os.remove(file_path)
#             print(f"Deleted file: {file_path}")

#         # Check if any other output files remain for this session
#         remaining = [
#             f for f in os.listdir(OUTPUTS_DIR)
#             if f.startswith(session_id)
#         ]

#         if not remaining:
#             delete_session(session_id)
#             print(f"Session {session_id} deleted — all files downloaded")

#     except Exception as e:
#         print(f"Cleanup error: {e}")


#  new code 
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

import os

from models import StatusResponse
from session.store import get_session, delete_session

router = APIRouter()

OUTPUTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "outputs")
)

os.makedirs(OUTPUTS_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# GET STATUS
# ─────────────────────────────────────────────
@router.get("/status", response_model=StatusResponse)
async def get_status(session_id: str):

    session = get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    return StatusResponse(
        session_id=session_id,
        status=session.get("status", "processing"),
        pdf_url=session.get("pdf_url"),
        docx_url=session.get("docx_url"),
    )


# ─────────────────────────────────────────────
# DIRECT FILE DOWNLOAD
# ─────────────────────────────────────────────
@router.get("/outputs/{filename}")
async def download_file(filename: str):

    file_path = os.path.abspath(
        os.path.join(OUTPUTS_DIR, filename)
    )

    print("📥 Download request:", file_path)

    if not os.path.exists(file_path):

        print("❌ File not found")

        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    # DOCX MIME
    if filename.endswith(".docx"):

        media_type = (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        )

    # PDF MIME
    elif filename.endswith(".pdf"):

        media_type = "application/pdf"

    else:

        raise HTTPException(
            status_code=400,
            detail="Invalid file type"
        )

    # IMPORTANT
    # DO NOT DELETE FILE IMMEDIATELY
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )


# ─────────────────────────────────────────────
# DOWNLOAD BY SESSION
# ─────────────────────────────────────────────
@router.get("/download/{session_id}")
async def download_by_session(session_id: str):

    session = get_session(session_id)

    if not session:

        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    docx_url = session.get("docx_url")

    if not docx_url:

        raise HTTPException(
            status_code=404,
            detail="DOCX not ready"
        )

    filename = os.path.basename(docx_url)

    file_path = os.path.abspath(
        os.path.join(OUTPUTS_DIR, filename)
    )

    print("📥 Session download:", file_path)

    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="Generated file missing"
        )

    # FILE SIZE DEBUG
    size = os.path.getsize(file_path)

    print(f"📄 File size: {size} bytes")

    if size < 1000:

        raise HTTPException(
            status_code=500,
            detail="Generated DOCX is corrupted or empty"
        )

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
    )


# ─────────────────────────────────────────────
# OPTIONAL CLEANUP
# ─────────────────────────────────────────────
def cleanup_file(file_path: str):

    try:

        if os.path.exists(file_path):

            os.remove(file_path)

            print(f"🗑 Deleted: {file_path}")

    except Exception as e:

        print("Cleanup error:", e)
