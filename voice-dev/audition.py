#!/usr/bin/env python3
"""InteRun — Kokoro-82M voice audition generator (Stage 2).

Generates the five standard audition lines with each of the four British voices
(bf_emma, bf_isabella, bm_george, bm_lewis) so the team can listen and choose
before the full prompt library is produced.

This is a DEVELOPMENT-TIME tool only. Kokoro / PyTorch / espeak-ng are never
bundled into the shipped app — the app only ever ships the generated audio.

Dependencies:
  pip install "kokoro>=0.9.2" soundfile          (Python packages)
  espeak-ng                                       (system: Ubuntu -> apt-get install -y espeak-ng)

Usage:
  python3 voice-dev/audition.py                   # all four voices
  python3 voice-dev/audition.py bm_george         # a single voice

Output: mono audio (MP3 when the encoder is available, else WAV) at
  voice-dev/audition/<voice>__<lineId>.<ext>
"""
from __future__ import annotations
import os
import sys
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "audition")
SAMPLE_RATE = 24000  # Kokoro's native output rate

# The four British voices to audition (Kokoro British English = lang_code "b").
VOICES = ["bf_emma", "bf_isabella", "bm_george", "bm_lewis"]

# (lineId, text, energetic) — the countdown is delivered slightly quicker and
# brighter (energetic=True), but never shouted; everything else is calm and
# natural for a runner wearing headphones.
LINES = [
    ("1_welcome",   "Welcome to InteRun. Let's make today's session count.", False),
    ("2_settle",    "Settle into a comfortable rhythm. Keep your shoulders relaxed and your breathing controlled.", False),
    ("3_countdown", "Your interval begins in three, two, one. Go.", True),
    ("4_halfway",   "You are halfway through. Hold your form and keep working.", False),
    ("5_complete",  "Session complete. Excellent work today. Recover well.", False),
]


def die(msg: str) -> None:
    print("\n[audition] ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def check_deps() -> None:
    """Fail clearly and early when a dependency is missing."""
    try:
        import soundfile  # noqa: F401
    except Exception:
        die('`soundfile` is not installed. Run: pip install "kokoro>=0.9.2" soundfile')
    try:
        import kokoro  # noqa: F401
    except Exception:
        die('`kokoro` is not installed. Run: pip install "kokoro>=0.9.2" soundfile')
    if shutil.which("espeak-ng") is None and shutil.which("espeak") is None:
        die("espeak-ng was not found. On Ubuntu/Debian: apt-get install -y espeak-ng")


def to_np(chunk):
    """Coerce a Kokoro audio chunk (torch tensor or array) to a float32 numpy array."""
    import numpy as np
    try:
        return chunk.detach().cpu().numpy().astype("float32")
    except AttributeError:
        return np.asarray(chunk, dtype="float32")


def trim_silence(audio, sr: int, thresh: float = 0.01, pad_ms: int = 60):
    """Remove excessive leading/trailing silence, leaving a small natural pad."""
    import numpy as np
    a = np.asarray(audio, dtype="float32")
    if a.size == 0:
        return a
    loud = np.abs(a) > thresh
    if not loud.any():
        return a
    pad = int(sr * pad_ms / 1000)
    first = max(0, int(np.argmax(loud)) - pad)
    last = min(a.size, a.size - int(np.argmax(loud[::-1])) + pad)
    return a[first:last]


def normalize(audio, peak: float = 0.95):
    """Peak-normalise so every line sits at a consistent, comfortable level."""
    import numpy as np
    a = np.asarray(audio, dtype="float32")
    m = float(np.max(np.abs(a))) if a.size else 0.0
    return a * (peak / m) if m > 0 else a


def write_audio(path_noext: str, audio, sr: int) -> str:
    """Write MP3 (mobile-friendly) when the encoder is present, else WAV."""
    import soundfile as sf
    try:
        out = path_noext + ".mp3"
        sf.write(out, audio, sr, format="MP3")
        return out
    except Exception:
        out = path_noext + ".wav"
        sf.write(out, audio, sr)
        return out


def main() -> None:
    check_deps()
    import numpy as np
    from kokoro import KPipeline

    only = sys.argv[1] if len(sys.argv) > 1 else None
    voices = [only] if only else VOICES
    if only and only not in VOICES:
        die(f"unknown voice {only!r}; expected one of {', '.join(VOICES)}")

    os.makedirs(OUT_DIR, exist_ok=True)
    # lang_code "b" = British English, which is what the bf_/bm_ voices use.
    pipe = KPipeline(lang_code="b")

    made = []
    for voice in voices:
        for line_id, text, energetic in LINES:
            speed = 1.06 if energetic else 1.0
            chunks = [to_np(a) for _, _, a in pipe(text, voice=voice, speed=speed)]
            if not chunks:
                print(f"[audition] WARN: no audio produced for {voice} {line_id}")
                continue
            audio = np.concatenate(chunks)
            audio = normalize(trim_silence(audio, SAMPLE_RATE))
            out = write_audio(os.path.join(OUT_DIR, f"{voice}__{line_id}"), audio, SAMPLE_RATE)
            size = os.path.getsize(out)
            made.append((out, size))
            print(f"[audition] {os.path.basename(out):34s} {size / 1024:6.1f} KB")

    total = sum(s for _, s in made)
    print(f"\n[audition] wrote {len(made)} files, {total / 1024:.1f} KB total")
    print(f"[audition] location: {OUT_DIR}")
    if made and made[0][0].endswith(".wav"):
        print("[audition] note: MP3 encoder unavailable in libsndfile — wrote WAV. "
              "Install ffmpeg or a newer libsndfile for MP3, or I can convert on request.")


if __name__ == "__main__":
    main()
