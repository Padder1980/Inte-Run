#!/usr/bin/env python3
"""InteRun — spoken-coaching audio generation pipeline (Stage 3).

Reads the typed prompt catalogue (dumped to voice-dev/prompts.json by
dump-catalogue.ts) and generates one compressed audio clip per (coach voice ×
prompt), with predictable filenames based on the permanent prompt id.

DEVELOPMENT-TIME ONLY. Kokoro / PyTorch / espeak-ng never ship in the app — the
finished app contains only the generated .mp3 assets + manifest.

Features:
  * Skips unchanged clips (content hash of text + voice + catalogue version).
  * Regenerate one coach (--coach guide), one prompt (--prompt halfway_1),
    or everything (--all / default). --force ignores the skip cache.
  * Peak-normalises volume and trims excess leading/trailing silence.
  * Writes mobile-friendly mono MP3 (WAV fallback if no MP3 encoder).
  * Emits voices/manifest.json (per clip: id, coach, voice, file, duration,
    bytes) and reports the total library size.
  * Fails clearly when a dependency or the catalogue is missing.

Deps: pip install kokoro-onnx onnxruntime soundfile   +   espeak-ng (system)
Model: voice-dev/models/{kokoro-v1.0.onnx, voices-v1.0.bin}
Output: web/voices/<coach>/<promptId>.mp3   (the app build mirrors this to docs/voices/)
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CATALOGUE = os.path.join(HERE, "prompts.json")
MODELS = os.path.join(HERE, "models")
ONNX = os.path.join(MODELS, "kokoro-v1.0.onnx")
VOICES_BIN = os.path.join(MODELS, "voices-v1.0.bin")
OUT_ROOT = os.path.join(ROOT, "web", "voices")   # source of truth; build mirrors to docs/voices
MANIFEST = os.path.join(OUT_ROOT, "manifest.json")
SAMPLE_RATE = 24000


def die(msg: str) -> None:
    print("\n[generate] ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def check() -> None:
    try:
        import kokoro_onnx  # noqa: F401
        import soundfile  # noqa: F401
        import numpy  # noqa: F401
    except Exception:
        die("missing Python deps. Run: pip install kokoro-onnx onnxruntime soundfile")
    if shutil.which("espeak-ng") is None and shutil.which("espeak") is None:
        die("espeak-ng not found. On Ubuntu/Debian: apt-get install -y espeak-ng")
    for p in (ONNX, VOICES_BIN):
        if not os.path.exists(p):
            die(f"missing model file {p} (kokoro-onnx model-files-v1.0 assets)")
    if not os.path.exists(CATALOGUE):
        die(f"missing {CATALOGUE} — run: node voice-dev/dump-catalogue.ts")


# ⚠️ pad_ms IS RIGHT FOR A STANDALONE LINE AND WRONG FOR A FRAGMENT. 55ms of silence each end stops a
# cue sounding clipped when it starts on its own; butt two fragments together and those two pads
# become a 110ms hole mid-sentence, which is what made the stitched pace cue sound assembled. The
# pace number bank and sentence fragments are trimmed tight; everything else keeps its breathing room.
FRAGMENT_PAD_MS = 8
def trim_silence(a, sr, thresh=0.01, pad_ms=55):
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


def clip_hash(text: str, voice: str, version: int) -> str:
    h = hashlib.sha1()
    h.update(f"{version}\x1f{voice}\x1f{text}".encode("utf-8"))
    return h.hexdigest()[:16]


def main() -> None:
    check()
    import numpy as np  # noqa: F401
    from kokoro_onnx import Kokoro

    with open(CATALOGUE, encoding="utf-8") as f:
        cat = json.load(f)
    version = cat.get("version", 1)
    coaches = cat["coaches"]
    prompts = cat["prompts"]

    ap = argparse.ArgumentParser(description="Generate InteRun coach audio.")
    ap.add_argument("--coach", help="only this coach id (e.g. guide)")
    ap.add_argument("--prompt", help="only this prompt id (e.g. halfway_1)")
    ap.add_argument("--all", action="store_true", help="generate everything (default)")
    ap.add_argument("--force", action="store_true", help="ignore the skip cache and re-render")
    args = ap.parse_args()

    if args.coach and args.coach not in [c["id"] for c in coaches]:
        die(f"unknown coach {args.coach!r}")
    if args.prompt and args.prompt not in [p["id"] for p in prompts]:
        die(f"unknown prompt {args.prompt!r}")

    sel_coaches = [c for c in coaches if not args.coach or c["id"] == args.coach]
    sel_prompts = [p for p in prompts if not args.prompt or p["id"] == args.prompt]

    # Load an existing manifest so unchanged clips can be skipped.
    prev = {}
    if os.path.exists(MANIFEST):
        try:
            for e in json.load(open(MANIFEST, encoding="utf-8")).get("clips", []):
                prev[(e["coach"], e["id"])] = e
        except Exception:
            prev = {}

    kokoro = Kokoro(ONNX, VOICES_BIN)
    os.makedirs(OUT_ROOT, exist_ok=True)

    clips = []
    made = skipped = 0
    import soundfile as sf
    for coach in sel_coaches:
        cdir = os.path.join(OUT_ROOT, coach["id"])
        os.makedirs(cdir, exist_ok=True)
        for p in sel_prompts:
            h = clip_hash(p["text"], coach["voice"], version)
            stem = os.path.join(cdir, p["id"])
            rel = f"voices/{coach['id']}/{p['id']}.mp3"
            existing = prev.get((coach["id"], p["id"]))
            have_file = os.path.exists(stem + ".mp3")
            if not args.force and existing and existing.get("hash") == h and have_file:
                clips.append(existing)
                skipped += 1
                continue
            audio, sr = kokoro.create(p["text"], voice=coach["voice"], speed=1.0, lang="en-gb")
            audio = normalize(trim_silence(audio, sr))
            out = write_audio(stem, audio, sr)
            info = sf.info(out)
            entry = {
                "id": p["id"], "coach": coach["id"], "voice": coach["voice"],
                "trigger": p["trigger"], "file": rel.replace(".mp3", os.path.splitext(out)[1]),
                "duration": round(info.duration, 2), "bytes": os.path.getsize(out), "hash": h,
            }
            clips.append(entry)
            made += 1
            print(f"[generate] {coach['id']:10s} {p['id']:22s} {info.duration:4.2f}s  {os.path.getsize(out)/1024:5.1f} KB")

    total = sum(c["bytes"] for c in clips)
    per_coach = {}
    for c in clips:
        per_coach[c["coach"]] = per_coach.get(c["coach"], 0) + c["bytes"]
    manifest = {
        "version": version, "sampleRate": SAMPLE_RATE,
        "coaches": [{"id": c["id"], "name": c["name"], "voice": c["voice"],
                     "bytes": per_coach.get(c["id"], 0)} for c in coaches],
        "clips": sorted(clips, key=lambda c: (c["coach"], c["id"])),
        "totalBytes": total,
    }
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[generate] {made} generated, {skipped} unchanged (skipped)")
    for c in coaches:
        b = per_coach.get(c["id"], 0)
        if b:
            print(f"[generate]   {c['name']:16s} {b/1024:7.1f} KB")
    print(f"[generate] total library: {total/1024:.1f} KB ({total/1024/1024:.2f} MB) across {len(clips)} clips")
    print(f"[generate] manifest: {MANIFEST}")


if __name__ == "__main__":
    main()
