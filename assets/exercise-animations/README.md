# InteRun Exercise Animations — Version 2

This pack contains 16 looping exercise animations created from the supplied reference images.

## Recommended files

- `webp/` — use these in the InteRun app. They are compact, animated, 512 × 512 px and loop continuously.
- `gif/` — use these for quick previews, messages or systems that do not support animated WebP.
- `sprite-sheets/` — the four-pose source artwork for future editing or alternative animation timing.
- `integration.css` — safe app styling that preserves the full 512 × 512 animation without cropping.

## Version 2 improvements

- Complete pose panels are retained, so extended hands, feet, heads and equipment are not trimmed during export.
- Every figure sits inside a fixed 46 px outer safety area.
- Each ping-pong loop lasts 3.2 seconds, more than twice the duration of version 1.
- The start and effort positions pause briefly to create a gentler, more natural turnaround.
- GIF and WebP files use identical framing and timing.

The active muscles use the InteRun teal family:

- Primary teal: `#0e8c7f`
- Highlight teal: `#2bb3a3`

All animations use a white background and contain no labels, controls or pause icons. In the app, use `object-fit: contain`; `object-fit: cover` will crop the square asset.

## Exercises

1. Goblet Squat
2. Step Up
3. Split Squat (Dumbbell)
4. Reverse Lunge
5. Romanian Deadlift (Dumbbell)
6. Glute Bridge
7. Clamshell
8. Standing Calf Raise
9. Single Leg Standing Calf Raise
10. Plank
11. Side Plank
12. Dead Bug
13. Bird Dog
14. Push Up
15. Incline Push Up
16. Box Jump

These are AI-assisted anatomical illustrations. A qualified strength and conditioning or clinical professional should review them before they are used as definitive exercise-prescription guidance.
