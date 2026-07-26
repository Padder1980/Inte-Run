/**
 * Generate a still thumbnail for every exercise animation.
 *
 *   python3 tools/make-stills.py        (see the sibling .py — this file documents the why)
 *
 * The app shows a STILL in exercise lists (a wall of looping animations is distracting) and plays the
 * animation only when the user taps to expand it. Rather than draw new artwork, each still is pulled
 * straight out of the matching animation, so the two can never drift apart stylistically.
 *
 * Which frame? The one furthest (by summed pixel difference) from frame 0 — i.e. the working position:
 * the bottom of the squat, the top of the calf raise, the hinge of the RDL. That reads far better as a
 * thumbnail than the neutral standing start pose.
 *
 * Output: assets/exercise-stills/<slug>.webp, 256x256, quality 78 (~2 KB each, ~32 KB for all 16).
 * web/app.ts inlines them as data URIs alongside the animations.
 *
 * Re-run this whenever assets/exercise-animations/ changes, then rebuild with `node web/app.ts`.
 */
export {};
