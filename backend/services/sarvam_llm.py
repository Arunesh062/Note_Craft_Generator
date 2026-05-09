import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
LLM_URL        = "https://api.sarvam.ai/v1/chat/completions"
MODEL          = "sarvam-m"


# ── Base LLM caller ────────────────────────────────────────────
async def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str:
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY not found in .env")

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                LLM_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "model":       MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    "max_tokens":  max_tokens,
                    "temperature": 0.3,
                },
            )

        if response.status_code != 200:
            print(f"LLM error: {response.status_code} {response.text}")
            return ""

        result  = response.json()
        content = result["choices"][0]["message"]["content"]
        return content.strip()

    except httpx.TimeoutException:
        print("LLM request timed out")
        return ""
    except Exception as e:
        print(f"LLM unexpected error: {e}")
        return ""


# ── Parse JSON safely ──────────────────────────────────────────
def _parse_json(raw: str) -> dict | None:
    if not raw:
        return None
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass
    try:
        start = clean.index("{")
        end   = clean.rindex("}") + 1
        return json.loads(clean[start:end])
    except Exception:
        return None


# ── JOB 1: Clean transcript ────────────────────────────────────
async def clean_transcript(raw_transcript: str) -> str:
    system = (
        "You are a transcript editor. "
        "Clean the given transcript by removing filler words (uh, um, hmm, like), "
        "fixing obvious speech recognition errors, and removing repeated phrases. "
        "Do not summarise — preserve all content and meaning. "
        "Return only the cleaned transcript text, nothing else."
    )
    user    = f"Clean this transcript:\n\n{raw_transcript}"
    cleaned = await _call_llm(system, user)
    return cleaned if cleaned else raw_transcript


# ── JOB 2: Segment summary ─────────────────────────────────────
async def summarise_chunk(
    clean_transcript: str,
    prev_summary:     str = "",
    chunk_index:      int = 0,
) -> str:
    system = (
        "You are a class note taker. "
        "Summarise the given class session segment in 3 to 5 bullet points. "
        "Focus on: topics explained, concepts taught, examples given, and questions asked. "
        "Be concise. Each bullet should be one clear sentence."
    )
    context = (
        f"Context from previous segment:\n{prev_summary}\n\n"
        if prev_summary and chunk_index > 0 else ""
    )
    user = f"{context}Summarise this class segment (segment {chunk_index + 1}):\n\n{clean_transcript}"
    return await _call_llm(system, user)


# ── JOB 3a: Block aggregation ──────────────────────────────────
async def aggregate_block(chunk_summaries: list, block_index: int) -> str:
    system = (
        "You are a class note taker. "
        "You are given several segment summaries from an online class. "
        "Merge them into one coherent block summary. "
        "Remove redundancy. Preserve all topics, concepts, and examples. "
        "Return a clean paragraph-style summary in 4 to 6 sentences."
    )
    summaries_text = "\n\n".join(
        [f"Segment {i+1}:\n{s}" for i, s in enumerate(chunk_summaries)]
    )
    user = f"Merge these into one block summary (block {block_index + 1}):\n\n{summaries_text}"
    return await _call_llm(system, user)


# ── JOB 3b: Generate class notes ──────────────────────────────
async def generate_mom(
    block_summaries: list,
    participants:    list,
    meeting_date:    str,
) -> dict:

    system = (
        "You are an expert class note taker for online sessions. "
        "Generate structured class notes from the given session summaries. "
        "Return ONLY valid JSON — no markdown, no code blocks, no extra text.\n\n"

        "CRITICAL RULES:\n"
        "1. Include a section ONLY if actual content exists for it in the transcript.\n"
        "2. If a section has no content — set it to null. Do NOT include empty arrays.\n"
        "3. Every string must be a complete sentence or phrase, never a single character.\n\n"

        "The JSON must use exactly these keys (all optional except date and session_title):\n"
        "  session_title       → string: descriptive title of what was taught\n"
        "  course_name         → string or null\n"
        "  subject_topic       → string or null: main subject area\n"
        "  date                → string: session date\n"
        "  time                → string or null\n"
        "  platform            → string: always 'Google Meet'\n"
        "  instructor_name     → string or null: name of instructor if mentioned\n"
        "  session_overview    → array of strings or null: 2-4 sentence overview\n"
        "  learning_objectives → array of strings or null: what students should learn\n"
        "  topics_covered      → array of objects or null: each object has:\n"
        "                          name (string), explanation (string), \n"
        "                          key_points (array of strings), \n"
        "                          examples (array of strings), \n"
        "                          important_notes (string)\n"
        "  concepts            → array of objects or null: each object has:\n"
        "                          name, definition, explanation, real_example\n"
        "  examples            → array of objects or null: each has:\n"
        "                          question, solution_steps, final_answer\n"
        "  key_takeaways       → array of strings or null: most important points\n"
        "  formulas_definitions→ array of strings or null: any formulas or definitions\n"
        "  questions_answers   → array of objects or null: each has question and answer\n"
        "  assignments         → array of strings or null: homework or tasks given\n"
        "  study_resources     → array of strings or null: books, links, slides mentioned\n"
        "  additional_notes    → array of strings or null: tips, common mistakes\n"
        "  revision_summary    → array of strings or null: 3-5 ultra-short recall points\n"
    )

    summaries_text = "\n\n".join(
        [f"Block {i+1}:\n{s}" for i, s in enumerate(block_summaries)]
    )
    user = (
        f"Session date: {meeting_date}\n"
        f"Participants: {', '.join(participants) if participants else 'Unknown'}\n\n"
        f"Class session summaries:\n{summaries_text}\n\n"
        f"Generate the class notes JSON now. "
        f"Only include sections where actual content was discussed. "
        f"Set all other sections to null."
    )

    raw    = await _call_llm(system, user, max_tokens=2000)
    parsed = _parse_json(raw)

    if parsed:
        # Ensure date is set
        if not parsed.get("date"):
            parsed["date"] = meeting_date
        if not parsed.get("platform"):
            parsed["platform"] = "Google Meet"
        parsed["prepared_by"] = "Notes Generator"
        return parsed

    print("Failed to parse class notes JSON — using fallback")
    return _fallback_notes(participants, meeting_date)


# ── JOB 4: Refinement pass ────────────────────────────────────
async def refine_mom(mom_json: dict) -> dict:
    system = (
        "You are a professional editor for class notes. "
        "Improve the given class notes JSON. "
        "Fix grammar, remove duplicate points, improve clarity. "
        "Keep null values as null — do not add empty content. "
        "Return ONLY valid JSON with the same structure. No extra text, no markdown."
    )
    user   = f"Refine this class notes JSON:\n\n{json.dumps(mom_json, indent=2)}"
    raw    = await _call_llm(system, user, max_tokens=2000)
    parsed = _parse_json(raw)
    return parsed if parsed else mom_json


# ── Fallback ───────────────────────────────────────────────────
def _fallback_notes(participants: list, date: str) -> dict:
    return {
        "session_title":    "Class Session Notes",
        "date":             date,
        "platform":         "Google Meet",
        "prepared_by":      "Notes Generator",
        "session_overview": ["Class content could not be extracted from the recording."],
        "key_takeaways":    ["Please review the recording manually."],
    }