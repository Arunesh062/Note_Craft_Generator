import os
import io
import httpx
import tempfile
import subprocess
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY  = os.getenv("SARVAM_API_KEY")
STT_URL         = "https://api.sarvam.ai/speech-to-text-translate"
MAX_DURATION_SEC = 25  # Sarvam limit is 30s — use 25s to be safe


# ── Transcribe one audio chunk ─────────────────────────────────
async def transcribe_chunk(audio_bytes: bytes, chunk_index: int) -> dict:
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY not found in .env")

    if len(audio_bytes) < 1000:
        print(f"STT chunk {chunk_index}: too small ({len(audio_bytes)} bytes), skipping")
        return _failed_result()

    print(f"STT chunk {chunk_index}: received {len(audio_bytes)} bytes")

    # Convert to WAV first
    wav_bytes = _convert_to_wav(audio_bytes, chunk_index)
    if not wav_bytes:
        print(f"STT chunk {chunk_index}: WAV conversion failed")
        return _failed_result()

    print(f"STT chunk {chunk_index}: converted to WAV — {len(wav_bytes)} bytes")

    # Get duration
    duration = _get_duration(wav_bytes, chunk_index)
    print(f"STT chunk {chunk_index}: duration = {duration:.1f}s")

    # Split into 25s segments if needed
    if duration > MAX_DURATION_SEC:
        segments = _split_wav(wav_bytes, chunk_index, duration)
        print(f"STT chunk {chunk_index}: split into {len(segments)} segment(s)")
    else:
        segments = [wav_bytes]
        print(f"STT chunk {chunk_index}: split into 1 segment(s)")

    # Transcribe all segments and combine
    full_transcript = ""
    all_words       = []
    time_offset     = 0.0

    for seg_index, seg_bytes in enumerate(segments):
        result = await _transcribe_segment(seg_bytes, chunk_index, seg_index)
        if result["status"] == "ok":
            full_transcript += " " + result["transcript"]
            # Offset word timestamps
            for word in result.get("words", []):
                word["start"] = word.get("start", 0) + time_offset
                word["end"]   = word.get("end",   0) + time_offset
                all_words.append(word)
        time_offset += MAX_DURATION_SEC

    full_transcript = full_transcript.strip()

    if not full_transcript:
        print(f"STT chunk {chunk_index}: empty transcript after all segments")
        return _failed_result()

    print(f"STT chunk {chunk_index}: {len(full_transcript)} chars transcribed")
    return {
        "transcript": full_transcript,
        "words":      all_words,
        "status":     "ok",
    }


# ── Transcribe one segment ─────────────────────────────────────
async def _transcribe_segment(wav_bytes: bytes, chunk_index: int, seg_index: int) -> dict:
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                STT_URL,
                headers={"api-subscription-key": SARVAM_API_KEY},
                files={"file": (f"chunk_{chunk_index}_seg{seg_index}.wav", wav_bytes, "audio/wav")},
                data={
                    "model":                "saaras:v2.5",
                    "with_timestamps":      "true",
                    "target_language_code": "en-IN",
                },
            )

        if response.status_code != 200:
            print(f"STT error chunk {chunk_index} seg {seg_index}: {response.status_code} {response.text}")
            return _failed_result()

        result     = response.json()
        transcript = result.get("transcript", "").strip()
        words      = result.get("words", [])

        if not transcript:
            return _failed_result()

        return {"transcript": transcript, "words": words, "status": "ok"}

    except httpx.TimeoutException:
        print(f"STT chunk {chunk_index} seg {seg_index}: timeout")
        return _failed_result()
    except Exception as e:
        print(f"STT chunk {chunk_index} seg {seg_index}: error — {e}")
        return _failed_result()


# ── Convert audio bytes to WAV using ffmpeg ────────────────────
def _convert_to_wav(audio_bytes: bytes, chunk_index: int) -> bytes:
    tmp_in = tmp_out = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            tmp_in = f.name

        tmp_out = tmp_in.replace(".webm", ".wav")

        result = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_in, "-ar", "16000", "-ac", "1", "-f", "wav", tmp_out],
            capture_output=True, timeout=60,
        )

        if result.returncode != 0:
            print(f"ffmpeg error chunk {chunk_index}:", result.stderr.decode()[-300:])
            return None

        with open(tmp_out, "rb") as f:
            return f.read()

    except Exception as e:
        print(f"WAV conversion error chunk {chunk_index}: {e}")
        return None
    finally:
        for p in [tmp_in, tmp_out]:
            try:
                if p: os.unlink(p)
            except Exception:
                pass


# ── Get WAV duration in seconds ────────────────────────────────
def _get_duration(wav_bytes: bytes, chunk_index: int) -> float:
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
            tmp = f.name

        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", tmp],
            capture_output=True, timeout=30,
        )

        return float(result.stdout.decode().strip())
    except Exception:
        # Estimate from file size if ffprobe fails
        # 16kHz mono WAV = 32000 bytes/sec
        return len(wav_bytes) / 32000
    finally:
        try:
            if tmp: os.unlink(tmp)
        except Exception:
            pass


# ── Split WAV into MAX_DURATION_SEC segments ───────────────────
def _split_wav(wav_bytes: bytes, chunk_index: int, duration: float) -> list:
    tmp_in = None
    segment_files = []
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
            tmp_in = f.name

        num_segments = int(duration / MAX_DURATION_SEC) + 1
        segments     = []

        for i in range(num_segments):
            start    = i * MAX_DURATION_SEC
            tmp_seg  = tmp_in.replace(".wav", f"_seg{i}.wav")
            segment_files.append(tmp_seg)

            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_in,
                 "-ss", str(start), "-t", str(MAX_DURATION_SEC),
                 "-ar", "16000", "-ac", "1", tmp_seg],
                capture_output=True, timeout=30,
            )

            if result.returncode == 0 and os.path.exists(tmp_seg):
                with open(tmp_seg, "rb") as f:
                    seg_data = f.read()
                if len(seg_data) > 1000:
                    segments.append(seg_data)

        return segments if segments else [wav_bytes]

    except Exception as e:
        print(f"Split error chunk {chunk_index}: {e}")
        return [wav_bytes]
    finally:
        for p in [tmp_in] + segment_files:
            try:
                if p: os.unlink(p)
            except Exception:
                pass


def _failed_result() -> dict:
    return {"transcript": "", "words": [], "status": "failed"}