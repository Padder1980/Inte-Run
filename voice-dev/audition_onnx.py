#!/usr/bin/env python3
"""InteRun — Kokoro-82M voice audition generator (ONNX build).

Identical intent to audition.py, but sources the SAME open Kokoro-82M model as
its ONNX export (kokoro-onnx), so it can run where huggingface.co egress is
blocked but GitHub release assets are reachable. Model files live in
voice-dev/models/ (kokoro-v1.0.onnx, voices-v1.0.bin).

Dev-time only. Nothing here ships in the app.

Deps:  pip install kokoro-onnx onnxruntime soundfile   +   espeak-ng (system)
Usage: python3 voice-dev/audition_onnx.py [voice]
Out:   voice-dev/audition/<voice>__<lineId>.mp3   (mono; WAV fallback)
"""
from __future__ import annotations
import os
import sys
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "audition")
MODELS = os.path.join(HERE, "models")
ONNX = os.path.join(MODELS, "kokoro-v1.0.onnx")
VOICES_BIN = os.path.join(MODELS, "voices-v1.0.bin")

VOICES = ["bf_emma", "bf_isabella", "bm_george", "bm_lewis"]

# Spoken-pronunciation overrides: the brand is written "InteRun" but said "inter-run".
# We feed the synthesizer the phonetic spelling; the app's on-screen text is unaffected.
PRON = {"InteRun": "Inter-run"}

def pron(text: str) -> str:
    for k, v in PRON.items():
        text = text.replace(k, v)
    return text

# (lineId, text, energetic) — the countdown ("__countdown__") is assembled from
# separately-synthesized beats so 3-2-1 lands on an exact one-second metronome.
LINES = [
    ("1_welcome",   "Welcome to InteRun. Let's make today's session count.", False),
    ("2_settle",    "Settle into a comfortable rhythm. Keep your shoulders relaxed and your breathing controlled.", False),
    ("3_countdown", "__countdown__", True),
    ("4_halfway",   "You are halfway through. Hold your form and keep working.", False),
    ("5_complete",  "Session complete. Excellent work today. Recover well.", False),
]


def die(msg: str) -> None:
    print("\n[audition] ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def check() -> None:
    try:
        import kokoro_onnx  # noqa: F401
        import soundfile  # noqa: F401
    except Exception:
        die("Run: pip install kokoro-onnx onnxruntime soundfile")
    if shutil.which("espeak-ng") is None and shutil.which("espeak") is None:
        die("espeak-ng not found. On Ubuntu/Debian: apt-get install -y espeak-ng")
    for p in (ONNX, VOICES_BIN):
        if not os.path.exists(p):
            die(f"missing model file {p} — download the kokoro-onnx model-files-v1.0 assets")


def trim_silence(a, sr, thresh=0.01, pad_ms=60):
    import numpy as np
    a = np.asarray(a, dtype="float32")
    loud = np.abs(a) > thresh
    if a.size == 0 or not loud.any():
        return a
    pad = int(sr * pad_ms / 1000)
    first = max(0, int(np.argmax(loud)) - pad)
    last = min(a.size, a.size - int(np.argmax(loud[::-1])) + pad)
    return a[first:last]


def normalize(a, peak=0.95):
    import numpy as np
    a = np.asarray(a, dtype="float32")
    m = float(np.max(np.abs(a))) if a.size else 0.0
    return a * (peak / m) if m > 0 else a


def write_audio(path_noext, audio, sr):
    import soundfile as sf
    try:
        out = path_noext + ".mp3"
        sf.write(out, audio, sr, format="MP3")
        return out
    except Exception:
        out = path_noext + ".wav"
        sf.write(out, audio, sr)
        return out


def build_countdown(kokoro, voice):
    """Assemble 'Your interval begins in … three · two · one · Go' with the numbers on an
    exact one-second metronome, so the 3-2-1 spans three seconds and 'Go' lands on zero."""
    import numpy as np
    lead, sr = kokoro.create("Your interval begins in.", voice=voice, speed=1.0, lang="en-gb")
    lead = normalize(trim_silence(lead, sr), 0.95)
    beats = {}
    for w in ("three", "two", "one", "Go"):
        a, _ = kokoro.create(w + ".", voice=voice, speed=1.06, lang="en-gb")
        beats[w] = normalize(trim_silence(a, sr, pad_ms=25), 0.98)
    beat = sr  # one second, in samples
    gap = np.zeros(int(sr * 0.4), dtype="float32")   # breath after the lead-in
    prefix = np.concatenate([lead, gap])
    start = len(prefix)
    total = start + beat * 3 + len(beats["Go"]) + int(sr * 0.25)
    out = np.zeros(total, dtype="float32")
    out[:start] = prefix
    for i, w in enumerate(("three", "two", "one")):     # onsets at +0s, +1s, +2s
        pos = start + i * beat
        out[pos:pos + len(beats[w])] += beats[w]
    go = start + 3 * beat                               # 'Go' onset at exactly +3s
    out[go:go + len(beats["Go"])] += beats["Go"]
    return out, sr


def main() -> None:
    check()
    from kokoro_onnx import Kokoro

    only = sys.argv[1] if len(sys.argv) > 1 else None
    if only and only not in VOICES:
        die(f"unknown voice {only!r}; expected one of {', '.join(VOICES)}")
    voices = [only] if only else VOICES

    os.makedirs(OUT_DIR, exist_ok=True)
    kokoro = Kokoro(ONNX, VOICES_BIN)

    made = []
    for voice in voices:
        for line_id, text, energetic in LINES:
            if text == "__countdown__":
                audio, sr = build_countdown(kokoro, voice)
            else:
                audio, sr = kokoro.create(pron(text), voice=voice, speed=(1.06 if energetic else 1.0), lang="en-gb")
                audio = normalize(trim_silence(audio, sr))
            out = write_audio(os.path.join(OUT_DIR, f"{voice}__{line_id}"), audio, sr)
            size = os.path.getsize(out)
            made.append((out, size))
            print(f"[audition] {os.path.basename(out):34s} {size / 1024:6.1f} KB")

    total = sum(s for _, s in made)
    print(f"\n[audition] wrote {len(made)} files, {total / 1024:.1f} KB total  ->  {OUT_DIR}")


if __name__ == "__main__":
    main()
