# Claude build brief — anatomical stretch graphics

## Absolute requirement

The supplied anatomical artwork is final and is the visual source of truth. Do not replace it with the earlier simplified vector body. Do not redraw it, regenerate it, recolour it, trace it, substitute a stock exercise library or reinterpret the muscle highlights.

## Copy unchanged

```text
src/AnatomicalStretchMotion.tsx
src/index.ts
assets/frames/
```

Keep `src/` and `assets/` as sibling folders so the static `require()` paths remain valid.

## Exact stable-ID mapping

```ts
const STRETCH_MOTION_IDS = {
  standingQuad: 'standing-quad',
  standingHamstring: 'standing-hamstring',
  wallCalf: 'wall-calf',
  kneelingHipFlexor: 'kneeling-hip-flexor',
  figureFourGlute: 'figure-four-glute',
  childsPose: 'childs-pose',
} as const;
```

Map the app’s existing database IDs to these exact values. Do not use partial name matching.

## Exact render contract

```tsx
<AnatomicalStretchMotion
  stretch={motionId}
  side={currentSide}
  playing={routineIsRunning && exerciseIsActive && screenIsFocused}
  size={Math.min(contentWidth, 360)}
/>
```

- Maintain a square canvas.
- Maximum rendered size: 360 points.
- Minimum recommended rendered size: 280 points.
- Centre horizontally.
- Never crop the model or place text over it.
- Keep the white canvas.
- Do not apply tint, filters, masks, gradients, shadows or background replacement.
- Do not modify the animation sequence or timings in the supplied component.

## Bilateral behaviour

Pass `side="left"` and `side="right"` for every stretch except child’s pose. Complete the side timer before mirroring. The component mirrors the entire demonstration consistently.

## Playback

- Play only the active stretch.
- Pause when the routine pauses, the modal closes, navigation loses focus or the app backgrounds.
- Show the hold frame when paused or when Reduce Motion is enabled.
- Do not synchronise the frame speed to the 30- or 45-second countdown.
- Keep the written instruction and safety copy outside the image.

## Required visible copy

Above the image: movement name, target area, duration and current side when relevant.

Below the image: the existing setup instruction and `Move gently. Do not bounce. Stop if you feel pain.`

## Prohibited

- Do not use the old `StretchMotionGraphic.tsx` vector component.
- Do not use the GIFs in production.
- Do not use remote image URLs.
- Do not add Lottie, Reanimated, WebView or a video player.
- Do not change teal coverage or artwork.
- Do not add labels, arrows or UI inside the square artwork.
- Do not make unrelated changes.

## Acceptance

Test all six animations at 320 and 360 points, on the smallest supported iPhone and Android width, with both left and right sides, paused state and Reduce Motion. No body part may crop or overlap surrounding content.
