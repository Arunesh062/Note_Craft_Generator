from typing import List, Dict


# ── Main function ──────────────────────────────────────────────
def assign_speakers(
    chunks: List[dict],
    speaker_timeline: List[dict],
    chunk_duration_ms: int = 30000,  # 30 seconds per chunk to match extension
) -> str:
    """
    Combines all chunk transcripts and assigns real speaker
    names using the DOM speaker timeline.

    Returns a single string with speaker-tagged lines:
        [Priya]: We should move the deadline to Friday.
        [Rahul]: I agree, that gives us more time to test.
    """

    # ── Step 1: Build full transcript with absolute timestamps ──
    tagged_words = _build_tagged_words(chunks, chunk_duration_ms)

    if not tagged_words:
        # No word timestamps — return plain joined transcript
        return _plain_transcript(chunks)

    # ── Step 2: Assign speaker to each word ────────────────────
    labeled_words = _label_words_with_speakers(tagged_words, speaker_timeline)

    # ── Step 3: Group words into speaker segments ──────────────
    segments = _group_into_segments(labeled_words)

    # ── Step 4: Format as readable transcript ──────────────────
    return _format_transcript(segments)


# ── Build words with absolute timestamps ──────────────────────
def _build_tagged_words(chunks: List[dict], chunk_duration_ms: int) -> List[dict]:
    """
    Each chunk's word timestamps are relative to that chunk's start.
    Convert them to absolute timestamps from recording start.
    """
    tagged = []

    for chunk in chunks:
        if chunk.get("status") != "ok":
            continue

        chunk_index = chunk.get("chunk_index", 0)
        chunk_start_ms = chunk_index * chunk_duration_ms
        words = chunk.get("words", [])

        for word in words:
            absolute_start = chunk_start_ms + int(word.get("start", 0) * 1000)
            absolute_end   = chunk_start_ms + int(word.get("end",   0) * 1000)
            tagged.append({
                "word":       word.get("word", ""),
                "start_ms":  absolute_start,
                "end_ms":    absolute_end,
                "speaker":   "Unknown",
            })

    return tagged


# ── Label each word with the active speaker at that time ───────
def _label_words_with_speakers(
    words: List[dict],
    speaker_timeline: List[dict],
) -> List[dict]:
    """
    For each word, find who was speaking at that timestamp
    by looking at the speaker_timeline from content.js.

    speaker_timeline is sorted by timestamp_ms.
    The active speaker at time T is the last event where
    event.timestamp_ms <= T.
    """
    if not speaker_timeline:
        return words

    # Sort timeline by timestamp just in case
    timeline = sorted(speaker_timeline, key=lambda e: e["timestamp_ms"])

    for word in words:
        word_time = word["start_ms"]
        speaker   = "Unknown"

        # Find the last speaker event before this word
        for event in timeline:
            if event["timestamp_ms"] <= word_time:
                speaker = event["name"]
            else:
                break

        word["speaker"] = speaker

    return words


# ── Group consecutive words by same speaker into segments ──────
def _group_into_segments(words: List[dict]) -> List[dict]:
    """
    Merges consecutive words spoken by the same speaker
    into one text segment.
    """
    if not words:
        return []

    segments = []
    current_speaker = words[0]["speaker"]
    current_words   = [words[0]["word"]]

    for word in words[1:]:
        if word["speaker"] == current_speaker:
            current_words.append(word["word"])
        else:
            segments.append({
                "speaker": current_speaker,
                "text":    " ".join(current_words).strip(),
            })
            current_speaker = word["speaker"]
            current_words   = [word["word"]]

    # Add the last segment
    segments.append({
        "speaker": current_speaker,
        "text":    " ".join(current_words).strip(),
    })

    return segments


# ── Format segments into readable tagged transcript ────────────
def _format_transcript(segments: List[dict]) -> str:
    """
    Converts segments into:
        [Priya]: We should move the deadline...
        [Rahul]: I agree with that...
    """
    lines = []
    for seg in segments:
        if seg["text"]:
            lines.append(f"[{seg['speaker']}]: {seg['text']}")
    return "\n".join(lines)


# ── Fallback: plain transcript if no word timestamps ──────────
def _plain_transcript(chunks: List[dict]) -> str:
    """
    Used when Sarvam STT does not return word-level timestamps.
    Just joins all clean transcripts in order.
    """
    parts = []
    for chunk in sorted(chunks, key=lambda c: c.get("chunk_index", 0)):
        text = chunk.get("clean") or chunk.get("raw", "")
        if text:
            parts.append(text)
    return "\n".join(parts)