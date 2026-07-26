#!/usr/bin/env python3
"""Extract a still thumbnail from every exercise animation.

Run from the repo root:  python3 tools/make-stills.py
Requires Pillow with WebP animation support (PIL >= 9; check features.check('webp_anim')).

See tools/make-stills.ts for why this exists and how the frame is chosen.
"""
import glob
import os

from PIL import Image, ImageChops

SRC = "assets/exercise-animations"
DST = "assets/exercise-stills"
SIZE = 256
QUALITY = 78


def most_distinct_frame(im: Image.Image) -> int:
    """Index of the frame furthest from frame 0 — the movement's working position."""
    im.seek(0)
    base = im.convert("RGB").copy()
    best_idx, best_diff = 0, -1
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        diff = sum(ImageChops.difference(base, im.convert("RGB")).convert("L").getdata())
        if diff > best_diff:
            best_idx, best_diff = i, diff
    return best_idx


def main() -> None:
    os.makedirs(DST, exist_ok=True)
    total = 0.0
    for path in sorted(glob.glob(os.path.join(SRC, "*.webp"))):
        slug = os.path.basename(path)[:-5]
        im = Image.open(path)
        idx = most_distinct_frame(im)
        im.seek(idx)
        still = im.convert("RGB").copy().resize((SIZE, SIZE), Image.LANCZOS)
        out = os.path.join(DST, slug + ".webp")
        still.save(out, "WEBP", quality=QUALITY, method=6)
        kb = os.path.getsize(out) / 1024
        total += kb
        print(f"  {slug:34s} frame {idx}  {kb:.1f} KB")
    print(f"\n{len(glob.glob(os.path.join(DST, '*.webp')))} stills, {total:.0f} KB total")


if __name__ == "__main__":
    main()
