#!/usr/bin/env python3
"""Compare the built debrief against the supplied reference PNGs.

Produces, for each state: a 50% opacity overlay, an absolute-difference image, and a printed table
of LANDMARK ROW POSITIONS so a geometry error is a number rather than an impression.

⚠️ IT ALIGNS BY VIEWPORT EDGES, NOT BY AN INTERNAL COMPONENT, as the checklist requires — both
images are scaled to the reference canvas (450x954) and overlaid corner to corner.
"""
import sys, os
from PIL import Image, ImageChops

REF = "/Users/adampalmer/Downloads/InteRun_Claude_Implementation_Pack/references"
PAIRS = [("01-map-hero-target.png", "A-map-hero-light.png", "A"),
         ("02-coach-debrief-target.png", "B-coach-light.png", "B"),
         ("03-run-analysis-target.png", "C-analysis-light.png", "C")]
W, H = 450, 954


def load(p):
    im = Image.open(p).convert("RGB")
    return im if im.size == (W, H) else im.resize((W, H), Image.LANCZOS)


def ink_rows(im, thresh=140):
    """Rows containing dark ink — the crude but reliable way to locate text bands."""
    px = im.load()
    out = []
    for y in range(im.height):
        n = 0
        for x in range(0, im.width, 3):
            r, g, b = px[x, y]
            if (r + g + b) / 3 < thresh:
                n += 1
        out.append(n)
    return out


def bands(rows, minrun=3, floor=4):
    """Contiguous runs of inky rows -> (start, end) text bands."""
    res, s = [], None
    for y, n in enumerate(rows):
        if n >= floor and s is None:
            s = y
        elif n < floor and s is not None:
            if y - s >= minrun:
                res.append((s, y))
            s = None
    if s is not None:
        res.append((s, len(rows)))
    return res


def main(shots):
    outdir = "/tmp/rd-diff"
    os.makedirs(outdir, exist_ok=True)
    worst = 0.0
    for refname, mine, tag in PAIRS:
        rp, mp = os.path.join(REF, refname), os.path.join(shots, mine)
        if not os.path.exists(mp):
            print("MISSING BUILD SHOT:", mp)
            continue
        a, b = load(rp), load(mp)

        diff = ImageChops.difference(a, b)
        stat = diff.convert("L")
        hist = stat.histogram()
        total = sum(hist)
        # Share of pixels differing by more than a mild antialiasing margin.
        material = sum(hist[26:]) / total * 100
        worst = max(worst, material)

        Image.blend(a, b, 0.5).save(f"{outdir}/{tag}-overlay.png")
        diff.save(f"{outdir}/{tag}-absdiff.png")

        ra, rb = bands(ink_rows(a)), bands(ink_rows(b))
        print(f"\n=== STATE {tag}  ({refname})")
        print(f"  materially different pixels: {material:.1f}%")
        print(f"  {'reference band':>22}   {'build band':>22}   delta")
        for i in range(max(len(ra), len(rb))):
            x = f"{ra[i][0]}-{ra[i][1]}" if i < len(ra) else "-"
            y = f"{rb[i][0]}-{rb[i][1]}" if i < len(rb) else "-"
            d = f"{rb[i][0]-ra[i][0]:+d}" if i < len(ra) and i < len(rb) else ""
            print(f"  {x:>22}   {y:>22}   {d}")
    print(f"\nworst material difference: {worst:.1f}%")
    print("overlays and diffs in", outdir)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/rd-shots")


def spacing(shots="/tmp/rd-shots"):
    """Gaps BETWEEN consecutive landmarks — the geometry check that survives a scroll misalignment.

    ⚠️ ABSOLUTE ROW POSITIONS DEPEND ON WHERE THE STATE WAS SCROLLED TO, so a whole-page offset makes
    every row look wrong and hides the differences that are real. The distance between one heading and
    the next does not move with the scroll, so this is what actually tests the layout.
    """
    for refname, mine, tag in PAIRS:
        a, b = load(os.path.join(REF, refname)), load(os.path.join(shots, mine))
        ra, rb = bands(ink_rows(a)), bands(ink_rows(b))
        ga = [ra[i + 1][0] - ra[i][0] for i in range(len(ra) - 1)]
        gb = [rb[i + 1][0] - rb[i][0] for i in range(len(rb) - 1)]
        n = min(len(ga), len(gb))
        print(f"\n=== STATE {tag}: gaps between consecutive landmarks")
        over = 0
        for i in range(n):
            d = gb[i] - ga[i]
            flag = "  <-- over 4pt" if abs(d) > 4 else ""
            if abs(d) > 4:
                over += 1
            print(f"  ref {ga[i]:>4}   build {gb[i]:>4}   delta {d:>+4}{flag}")
        print(f"  {over} of {n} gaps outside the 4pt tolerance")
