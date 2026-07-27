#!/usr/bin/env python3
"""Build the pogo-hops animation from the standing calf raise.

Run from the repo root:  python3 tools/make-pogo-hops.py

WHY THIS IS LEGITIMATE, not a fudge: a pogo hop IS a stiff-legged bounce on the balls of the feet.
The standing-calf-raise render already shows exactly that body position — legs near-straight, ankles
plantarflexed, calves highlighted — and the calf/Achilles is precisely the working tissue in a pogo
hop. So the anatomy is correct as drawn; the only thing missing is flight. We take the toes-up pose
and translate it vertically to lift the figure off the ground, and use the flat-footed pose for
ground contact. No anatomy is invented.

The lift is capped at 20 px of a 512 px canvas — on a ~343 px figure (~1.75 m) that is roughly 10 cm,
which is what a pogo hop actually looks like. It also keeps the figure inside the pack's 46 px safe
inset. The loop is deliberately quicker than the 3.2 s house timing: a pogo hop is a fast, elastic
bounce and animating it slowly would misrepresent the movement.
"""
import os

from PIL import Image

SRC = "assets/exercise-animations/standing-calf-raise.webp"
OUT = "assets/exercise-animations/pogo-hops.webp"
FLAT_FRAME = 0   # heels down — ground contact
TOES_FRAME = 2   # up on the balls of the feet — the flight pose
LIFT = 20        # px at peak

# (source frame, lift px, duration ms) — one hop, loops seamlessly
SEQUENCE = [
    (FLAT_FRAME, 0, 90),    # contact / load
    (TOES_FRAME, 2, 70),    # drive
    (TOES_FRAME, 11, 70),   # leaving the ground
    (TOES_FRAME, 18, 80),   # rising
    (TOES_FRAME, LIFT, 110),  # apex — brief hang
    (TOES_FRAME, 16, 80),   # falling
    (TOES_FRAME, 8, 70),    # about to land
    (TOES_FRAME, 1, 70),    # touch down on the toes
]


def main() -> None:
    src = Image.open(SRC)
    frames, durations = [], []
    for idx, lift, ms in SEQUENCE:
        src.seek(idx)
        pose = src.convert("RGB").copy()
        canvas = Image.new("RGB", pose.size, "white")
        canvas.paste(pose, (0, -lift))   # negative y == up the screen
        frames.append(canvas)
        durations.append(ms)
    frames[0].save(
        OUT, "WEBP", save_all=True, append_images=frames[1:],
        duration=durations, loop=0, quality=82, method=6,
    )
    print(f"wrote {OUT}  {len(frames)} frames  {sum(durations)} ms  {os.path.getsize(OUT)/1024:.1f} KB")


if __name__ == "__main__":
    main()
