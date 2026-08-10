# Inte-Run anatomical stretch motion — Claude upload package

This is the complete production package, reduced to fit Claude's 30 MB upload limit. Nothing required by the app has been removed.

## Upload and instruction

1. Upload the complete ZIP to Claude Code.
2. Paste the contents of `PASTE-INTO-CLAUDE.md` into the same conversation.
3. Tell Claude to preserve the folder structure exactly and make no visual adjustments.

Claude must read `CLAUDE-BUILD-BRIEF.md` before changing the app.

## Included

- `src/AnatomicalStretchMotion.tsx` — finished React Native animation component.
- `src/index.ts` — exports.
- `assets/frames/` — all 24 production PNG frames: four frames for each of six stretches.
- `assets/anatomical-stretch-overview.png` — visual source of truth for all six demonstrations.
- `CLAUDE-BUILD-BRIEF.md` — exact integration and acceptance requirements.
- `PASTE-INTO-CLAUDE.md` — the instruction to paste into Claude Code.
- `GENERATION-SPEC.md` — locked artwork and movement specification.
- `verify_assets.py` — confirms that the package is complete.

## Intentionally excluded

The larger package also contained animated GIF previews, high-resolution hold images and high-resolution sprite sheets. Those were review duplicates, not app dependencies. The supplied React Native component uses only the 24 PNG files under `assets/frames/`.

## Exact stretches

1. Standing quad stretch.
2. Standing hamstring stretch.
3. Calf stretch against a wall.
4. Kneeling hip-flexor stretch.
5. Figure-four glute stretch.
6. Child's pose.

## Locked implementation rule

Keep `src/` and `assets/` as sibling folders. Do not rename, crop, regenerate, recolour, redraw, compress or substitute the supplied PNG artwork. Do not replace the supplied component with GIF, video, Lottie or remote assets.

