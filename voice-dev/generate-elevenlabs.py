#!/usr/bin/env python3
"""Generate the coach voice clips with ElevenLabs instead of Kokoro.

Same contract as generate.py — reads voice-dev/prompts.json (dump it first with
`node voice-dev/dump-catalogue.ts`), writes web/voices/<coach>/<promptId>.mp3 plus manifest.json,
trims silence and peak-normalises, and regenerates only clips whose (text, voice, version) hash
changed. The app is untouched: it plays whatever MP3s ship in docs/voices/.

THE KEY NEVER SHIPS AND NEVER PRINTS. It is read from the ELEVENLABS_API_KEY environment variable
or the gitignored file voice-dev/elevenlabs-key.txt, and exists only on this machine. The public
page cannot hold a secret, which is why generation is a dev-side step and not a runtime feature.

Usage:
  voice-dev/venv-el/bin/python voice-dev/generate-elevenlabs.py --list-voices
  voice-dev/venv-el/bin/python voice-dev/generate-elevenlabs.py --audition "Halfway. You look strong." --coach guide
  voice-dev/venv-el/bin/python voice-dev/generate-elevenlabs.py            # everything stale
  voice-dev/venv-el/bin/python voice-dev/generate-elevenlabs.py --coach pacer --force

Voice casting lives in voice-dev/elevenlabs-voices.json (committed — it is config, not a secret).
If the file is missing, sensible defaults are chosen from the account's voices by accent/gender
labels and written there for editing.
"""
from __future__ import annotations
import argparse
import io
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate import trim_silence, normalize, clip_hash  # stdlib-only at import time

ROOT = os.path.dirname(HERE)
OUT_ROOT = os.path.join(ROOT, "web", "voices")
MANIFEST = os.path.join(OUT_ROOT, "manifest.json")
PROMPTS = os.path.join(HERE, "prompts.json")
PERSONAL_ROOT = os.path.join(ROOT, "web", "voices-personal")
CASTING = os.path.join(HERE, "elevenlabs-voices.json")
KEY_FILE = os.path.join(HERE, "elevenlabs-key.txt")

API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"
SAMPLE_RATE = 44100
# Bumping this forces a full regenerate even where text+voice are unchanged.
VERSION = 10

# Who each coach IS, so casting from an unknown account's voice list lands close. Preferred names
# first (ElevenLabs' stock voices), then label-based fallbacks.
CASTING_PREFS = {
    "guide": {"names": ["Lily", "Alice", "Matilda", "Rachel"], "gender": "female", "note": "warm, steady, reassuring"},
    "pacer": {"names": ["George", "Daniel", "Callum", "Adam"], "gender": "male", "note": "calm, metronomic"},
    "motivator": {"names": ["Jessica", "Charlotte", "Domi", "Elli"], "gender": "female", "note": "bright, energetic"},
    "technician": {"names": ["Brian", "Liam", "Chris", "Antoni"], "gender": "male", "note": "precise, measured"},
}


def api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key and os.path.exists(KEY_FILE):
        key = open(KEY_FILE, encoding="utf-8").read().strip()
    if not key:
        sys.exit(
            "No ElevenLabs key. Put it in the environment or the gitignored file:\n"
            '  echo "YOUR_KEY" > voice-dev/elevenlabs-key.txt\n'
            "(voice-dev/elevenlabs-key.txt is in .gitignore; it never leaves this machine.)"
        )
    return key


def api(path: str, payload: dict | None = None, raw: bool = False):
    req = urllib.request.Request(API + path)
    req.add_header("xi-api-key", api_key())
    if payload is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(payload).encode("utf-8")
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
    return body if raw else json.loads(body)


def account_voices() -> list[dict]:
    return api("/voices").get("voices", [])


def list_voices() -> None:
    for v in account_voices():
        labels = v.get("labels") or {}
        bits = " ".join(f"{k}={labels[k]}" for k in ("gender", "accent", "age") if labels.get(k))
        print(f'{v["voice_id"]}  {v["name"]:<18} {bits}')


def cast() -> dict:
    """The coach → ElevenLabs-voice mapping, creating it from the account if absent."""
    if os.path.exists(CASTING):
        return json.load(open(CASTING, encoding="utf-8"))
    voices = account_voices()
    by_name = {v["name"].lower(): v for v in voices}
    chosen = {}
    for coach, pref in CASTING_PREFS.items():
        pick = None
        for name in pref["names"]:
            if name.lower() in by_name:
                pick = by_name[name.lower()]
                break
        if not pick:
            same_gender = [v for v in voices if (v.get("labels") or {}).get("gender") == pref["gender"]]
            pick = (same_gender or voices)[0]
        chosen[coach] = {"voice_id": pick["voice_id"], "name": pick["name"]}
    json.dump(chosen, open(CASTING, "w", encoding="utf-8"), indent=2)
    print(f"Cast from your account's voices (edit {os.path.relpath(CASTING, ROOT)} to recast, then rerun):")
    for coach, v in chosen.items():
        print(f'  {coach:<11} -> {v["name"]}  ({pref_note(coach)})')
    return chosen


def pref_note(coach: str) -> str:
    return CASTING_PREFS.get(coach, {}).get("note", "")


def tts(voice_id: str, text: str) -> bytes:
    return api(
        f"/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}",
        {
            "text": text,
            "model_id": MODEL,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        raw=True,
    )


def polish_and_write(mp3_bytes: bytes, path_noext: str) -> str:
    """Trim silence and normalise like the Kokoro path; fall back to raw bytes if decode fails."""
    try:
        import numpy as np
        import soundfile as sf
        audio, sr = sf.read(io.BytesIO(mp3_bytes), dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        audio = normalize(trim_silence(audio, sr))
        out = path_noext + ".mp3"
        sf.write(out, audio, sr, format="MP3")
        return out
    except Exception:
        out = path_noext + ".mp3"
        open(out, "wb").write(mp3_bytes)
        return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-voices", action="store_true")
    ap.add_argument("--audition", metavar="TEXT")
    # ⚠️ The roster comes from the dumped catalogue, not a list repeated here. This was hardcoded to
    # the original four, so casting five more voices produced "invalid choice" rather than clips —
    # a second copy of a fact that has to agree with coach-prompts.ts and silently did not.
    ap.add_argument("--coach")
    ap.add_argument("--force", action="store_true", help="regenerate even when the hash matches")
    ap.add_argument("--personal", metavar="NAME",
                    help="generate the private pack in which the coaches say this person's name "
                         "(written to web/voices-personal/<slug>/ — gitignored, never published)")
    args = ap.parse_args()

    if args.list_voices:
        return list_voices()

    casting = cast()

    if args.audition:
        coach = args.coach or "guide"
        out = polish_and_write(tts(casting[coach]["voice_id"], args.audition),
                               os.path.join(HERE, "audition-el-" + coach))
        print("Wrote", out)
        os.system(f'open "{out}"')
        return

    data = json.load(open(PROMPTS, encoding="utf-8"))

    if args.personal:
        return generate_personal(args, data, casting)

    old = {}
    if os.path.exists(MANIFEST):
        for c in json.load(open(MANIFEST, encoding="utf-8")).get("clips", []):
            old[(c["coach"], c["id"])] = c.get("hash")

    coaches = [c for c in data["coaches"] if not args.coach or c["id"] == args.coach]
    todo = []
    for c in coaches:
        vid = casting[c["id"]]["voice_id"]
        for p in data["prompts"]:
            text = (p.get("byCoach") or {}).get(c["id"], p["text"])
            h = clip_hash(text, "el:" + vid, VERSION)
            if args.force or old.get((c["id"], p["id"])) != h:
                todo.append((c, p, vid, h, text))
    chars = sum(len(t) for _, _, _, _, t in todo)
    print(f"{len(todo)} clips to generate ({chars} characters). Voices: "
          + ", ".join(f'{c["id"]}={casting[c["id"]]["name"]}' for c in coaches))

    clips, done = [], 0
    for c, p, vid, h, text in todo:
        cdir = os.path.join(OUT_ROOT, c["id"])
        os.makedirs(cdir, exist_ok=True)
        out = polish_and_write(tts(vid, text), os.path.join(cdir, p["id"]))
        done += 1
        print(f'  [{done}/{len(todo)}] {c["id"]}/{p["id"]}')

    # Rebuild the manifest over EVERYTHING on disk, kept + new, so partial runs stay coherent.
    import soundfile as sf
    manifest = {"version": VERSION, "sampleRate": SAMPLE_RATE, "coaches": [], "clips": [], "totalBytes": 0}
    for c in data["coaches"]:
        vid = casting[c["id"]]["voice_id"]
        coach_bytes = 0
        for p in data["prompts"]:
            f = os.path.join(OUT_ROOT, c["id"], p["id"] + ".mp3")
            if not os.path.exists(f):
                continue
            info = sf.info(f)
            size = os.path.getsize(f)
            coach_bytes += size
            manifest["clips"].append({
                "id": p["id"], "coach": c["id"], "voice": casting[c["id"]]["name"],
                "trigger": p["trigger"], "file": f"voices/{c['id']}/{p['id']}.mp3",
                "duration": round(info.frames / info.samplerate, 2), "bytes": size,
                "hash": clip_hash((p.get("byCoach") or {}).get(c["id"], p["text"]), "el:" + vid, VERSION),
            })
        manifest["coaches"].append({"id": c["id"], "name": c["name"], "voice": casting[c["id"]]["name"], "bytes": coach_bytes})
        manifest["totalBytes"] += coach_bytes
    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), indent=1)
    print(f'Manifest: {len(manifest["clips"])} clips, {manifest["totalBytes"] / 1e6:.1f} MB. '
          "Now run: node web/app.ts  (mirrors web/voices -> docs/voices)")


def slug(name: str) -> str:
    """Mirror personalPackSlug() in src/live/coach-prompts.ts — the app looks the pack up by this."""
    out = "".join(ch if ch.isalnum() else "-" for ch in name.strip().lower())
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")[:24]


def generate_personal(args, data: dict, casting: dict) -> None:
    """The private pack: the same why-moments with a real name in them.

    Kept entirely separate from web/voices — different folder, own manifest, gitignored. The app
    treats it as a bonus: any clip that is missing simply falls back to the shared, name-free line,
    so a runner without a pack loses nothing.
    """
    name = args.personal.strip()
    key = slug(name)
    if not key:
        sys.exit(f'"{name}" has no usable letters or digits — pick a name the app can key a folder on.')
    templates = data.get("personal") or []
    if not templates:
        sys.exit("No personal templates in prompts.json — run: node voice-dev/dump-catalogue.ts")

    root = os.path.join(PERSONAL_ROOT, key)
    manifest_path = os.path.join(root, "manifest.json")
    old = {}
    if os.path.exists(manifest_path):
        for c in json.load(open(manifest_path, encoding="utf-8")).get("clips", []):
            old[(c["coach"], c["id"])] = c.get("hash")

    coaches = [c for c in data["coaches"] if not args.coach or c["id"] == args.coach]
    todo = []
    for c in coaches:
        vid = casting[c["id"]]["voice_id"]
        for p in templates:
            text = ((p.get("byCoach") or {}).get(c["id"], p["text"])).replace("{name}", name)
            h = clip_hash(text, "el:" + vid, VERSION)
            if args.force or old.get((c["id"], p["id"])) != h:
                todo.append((c, p, vid, h, text))
    chars = sum(len(t) for _, _, _, _, t in todo)
    print(f'Personal pack "{name}" -> voices-personal/{key}/  '
          f"{len(todo)} clips to generate ({chars} characters)")

    done = 0
    for c, p, vid, h, text in todo:
        cdir = os.path.join(root, c["id"])
        os.makedirs(cdir, exist_ok=True)
        polish_and_write(tts(vid, text), os.path.join(cdir, p["id"]))
        done += 1
        print(f'  [{done}/{len(todo)}] {c["id"]}/{p["id"]}  "{text}"')

    import soundfile as sf
    manifest = {"version": VERSION, "name": name, "slug": key, "sampleRate": SAMPLE_RATE, "clips": [], "totalBytes": 0}
    for c in data["coaches"]:
        vid = casting[c["id"]]["voice_id"]
        for p in templates:
            f = os.path.join(root, c["id"], p["id"] + ".mp3")
            if not os.path.exists(f):
                continue
            info = sf.info(f)
            size = os.path.getsize(f)
            text = ((p.get("byCoach") or {}).get(c["id"], p["text"])).replace("{name}", name)
            manifest["clips"].append({
                "id": p["id"], "coach": c["id"], "trigger": p["trigger"],
                "file": f"voices-personal/{key}/{c['id']}/{p['id']}.mp3",
                "duration": round(info.frames / info.samplerate, 2), "bytes": size,
                "hash": clip_hash(text, "el:" + vid, VERSION),
            })
            manifest["totalBytes"] += size
    os.makedirs(root, exist_ok=True)
    json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), indent=1)
    print(f'Manifest: {len(manifest["clips"])} clips, {manifest["totalBytes"] / 1e6:.2f} MB. '
          "Now run: node web/app.ts  (mirrors it into your local docs/ only — it is gitignored)")


if __name__ == "__main__":
    main()
