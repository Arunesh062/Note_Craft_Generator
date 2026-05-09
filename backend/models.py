from pydantic import BaseModel, field_validator
from typing import List, Optional


# ── /upload-chunk ──────────────────────────────────────────────
class SpeakerEvent(BaseModel):
    name: str
    timestamp_ms: int

    @field_validator("timestamp_ms", mode="before")
    @classmethod
    def coerce_to_int(cls, v):
        return int(v)


class ChunkMeta(BaseModel):
    session_id:       str
    chunk_index:      int
    speaker_timeline: List[SpeakerEvent] = []
    participants:     List[str] = []


# ── /finalize ──────────────────────────────────────────────────
class FinalizeRequest(BaseModel):
    session_id:       str
    participants:     List[str] = []
    speaker_timeline: List[SpeakerEvent] = []

    @field_validator("speaker_timeline", mode="before")
    @classmethod
    def parse_timeline_string(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return []
        return v

    @field_validator("participants", mode="before")
    @classmethod
    def parse_participants_string(cls, v):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return []
        return v


# ── /status ────────────────────────────────────────────────────
class StatusResponse(BaseModel):
    session_id: str
    status:     str
    pdf_url:    Optional[str] = None
    docx_url:   Optional[str] = None


# ── Internal chunk data ────────────────────────────────────────
class ChunkData(BaseModel):
    raw:     str = ""
    clean:   str = ""
    summary: str = ""
    status:  str = "pending"


# ── Example / Problem solved in class ─────────────────────────
class Example(BaseModel):
    question:       Optional[str] = None
    solution_steps: Optional[str] = None
    final_answer:   Optional[str] = None


# ── Topic covered in class ─────────────────────────────────────
class Topic(BaseModel):
    name:            str
    explanation:     Optional[str] = None
    key_points:      Optional[List[str]] = None
    examples:        Optional[List[str]] = None
    important_notes: Optional[str] = None


# ── Concept explained in class ─────────────────────────────────
class Concept(BaseModel):
    name:         str
    definition:   Optional[str] = None
    explanation:  Optional[str] = None
    real_example: Optional[str] = None


# ── Q&A during session ─────────────────────────────────────────
class QnA(BaseModel):
    question: str
    answer:   str


# ── Class Notes Output — all fields optional ──────────────────
# Only fields with actual content will appear in the DOCX
class ClassNotesOutput(BaseModel):
    # Session details
    course_name:        Optional[str] = None
    subject_topic:      Optional[str] = None
    session_title:      Optional[str] = None
    date:               Optional[str] = None
    time:               Optional[str] = None
    platform:           str = "Google Meet"
    instructor_name:    Optional[str] = None

    # Content sections — all optional
    session_overview:       Optional[List[str]] = None
    learning_objectives:    Optional[List[str]] = None
    topics_covered:         Optional[List[Topic]] = None
    concepts:               Optional[List[Concept]] = None
    examples:               Optional[List[Example]] = None
    key_takeaways:          Optional[List[str]] = None
    formulas_definitions:   Optional[List[str]] = None
    questions_answers:      Optional[List[QnA]] = None
    assignments:            Optional[List[str]] = None
    study_resources:        Optional[List[str]] = None
    additional_notes:       Optional[List[str]] = None
    revision_summary:       Optional[List[str]] = None

    # Metadata
    prepared_by: str = "Notes Generator"