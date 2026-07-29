# Apple Watch UI redesign — brief (opened 2026-07-29)

**Status: not started.** This is a captured brief, not a plan of record. Nothing here is built.

## Why

The owner ran the watch app and found the current screens hard to read mid-run. He supplied 18
screenshots of **Runna's** watch app as a legibility reference and said "this is probably a redesign
job".

⚠️ **The reference is a competitor's app, and InteRun's brand rule is an original visual identity**
(see `CLAUDE.md` and `DESIGN.md`). So take the *structure and legibility decisions* below — page
counts, what earns the biggest type, colour-as-status, what is reachable without stopping — and render
them in InteRun's own tokens and type. Do not reproduce Runna's palette, wording or logo.

⚠️ **The screenshots themselves are gone** — they lived in a chat session. This file is the record.
Everything below was transcribed from them on 2026-07-29. Don't assume a future session can see them.

## What the reference actually does

Five groups, confirmed with the owner.

### 1. Home — 2 horizontal pages

- **Page 1:** brand mark top-left. One large full-width primary button, **"Free Run"**. Below it a
  section header "Today's workouts", then a card per session: the date in a coloured accent
  (`Wed 29 Jul`), the session name big and bold (`Tempo 2-1-1`), and a thin subtitle
  (`Tempo · 6km`). A vertical coloured bar runs down the card's left edge — amber for the quality
  session. Page dots at the bottom.
- **Page 2:** header "Upcoming", then the same card shape for the next sessions
  (`Fri 31 Jul / 5km Easy Run / Easy run · 5km`), with a green-yellow left edge bar for easy runs.

**Lesson:** the left-edge colour bar carries session type at a glance, and the date is coloured while
the name is big — you can identify the run without reading it properly.

### 2. Settings — 7 horizontal pages, reached by swiping LEFT from home

Grouped, one concern per page, each a stack of large labelled toggles:

1. `RUN SETTINGS` header — Auto-Pause, Start on Motion, Tips during Countdown
2. Double-Tap to End Lap (+ a one-line explanation under it), Apple Health Effort Score
3. A full-screen explainer with a **Close** button: where audio cues play depending on how headphones
   are connected (watch speaker / headphones on watch / headphones on phone)
4. (continuation of that explainer)
5. Audio cue toggles: Start, Stop · Run Splits · Pace Alerts · Lap Summary
6. Lap Summary · Pause Warning, then a `Podcasts and audiobooks` group with "Duck spoken audio"
7. "Duck spoken audio" with its explanation, then `AUDIO CUE VOLUME` and a speaker control

**Lesson:** settings are paged rather than one long scroll, toggles are big enough to hit while
moving, and each non-obvious toggle carries a one-line explanation directly beneath it.

### 3. Session detail — 3 horizontal pages, with Start at the end

1. Back chevron, the date in accent top-right, then name (`Tempo 2-1-1`), distance (`6km`), duration
   range (`35m - 40m`), an **OUTDOOR / TREADMILL** segmented toggle, then the warm-up in plain words:
   "1km warm up at a conversational pace (no faster than 5:45/km)"
2. The full step list as readable prose, one step per line pair:
   `2km at 4:55/km, 120s walking rest` / `1km at 4:45/km, 90s walking rest` (×2) / `1km cool down at a
   conversational pace (or slower!)`
3. A **Comment** card attributed to a named human coach with a photo, then a large full-width
   **Start** button with a runner glyph.

**Lesson:** the prescription is given in sentences, not a table. Start is the last thing you reach,
after you've seen what you're about to do.

### 4. Countdown

A single huge numeral, centred, with a one-line tip underneath. (InteRun already stitches its 3-2-1
from separate number beats — see the voice section of `CLAUDE.md`.)

### 5. Active run — 4 horizontal pages

1. **Metrics.** Status word top-left in amber (`Auto-Pause`). Then, largest thing on screen, the lap
   target in green (`1.00KM`) labelled `NEXT LAP`. Heart rate below it, large (`66BPM`) with a heart
   glyph. Then two smaller stacked rows, `CUR /KM PACE` and `AVG. /KM PACE`, with the value large and
   the label small beside it. A thin segmented progress bar across the bottom, then
   `TOTAL DIST: 0M`. A small ⋮ affordance top-right.
2. **Steps.** `Current step` → the step in green caps (`1KM WARM UP`), a rule, `UPCOMING STEP` → the
   next in green caps (`2KM AT 4:55/KM`), a rule, then the session name and its details again.
3. **Now Playing** — standard media transport (scrub back / play / forward).
4. **Paused** — a 2×2 grid of large labelled tiles: RESUME (green), END (red), SETTINGS (grey),
   LOCK (blue).

Then **End confirmation:** "Do you want to end?" with a red `End Workout` and a neutral
`Resume Workout`.

**Lesson:** one number dominates each page; labels are small and values are big (InteRun currently
does the reverse in places); status lives in one colour-coded word at the top; and destructive actions
are one tap away but always confirmed.

## Where InteRun is today

| File | Lines | Note |
|---|---|---|
| `ios/InteRunWatch/TodayView.swift` | 294 | the home screen |
| `ios/InteRunWatch/WorkoutView.swift` | 340 | the active run — **the only screen already paged** |
| `ios/InteRunWatch/SettingsView.swift` | 139 | settings, a single list not paged |
| `ios/InteRunWatch/PaceView.swift` | 190 | |
| `ios/InteRunWatch/PaceBandView.swift` | 88 | InteRun's own pace-band marker — keep, it beats the reference |
| `ios/InteRunWatch/EffortView.swift` | 109 | the 1–10 RPE crown picker |
| `ios/InteRunWatch/RouteMapView.swift` | 57 | |
| `ios/InteRunWatch/CompanionView.swift` | 82 | |

Only `WorkoutView` uses a `TabView`. Home and Settings are not swipeable pages, which is the biggest
structural gap against the reference.

## Things InteRun already does that the reference does NOT — do not lose these in a redesign

- **A live pace band with a verdict** (`PaceBandView`) — GOOD PACE / EASE OFF / PICK IT UP, against
  the band the *plan* prescribed for the current step, not a number typed in beforehand.
- **Per-step bands**, so a threshold rep and its recovery carry different targets.
- **RPE on the crown after the run**, feeding the adaptive-flags engine rather than just Health.
- **Wrist tap on every step change**, because nobody is looking at the screen mid-rep.

## Suggested order, if this is picked up

1. Home → 2 pages, with the left-edge session-type colour bar and big name / small subtitle.
2. Active run → adopt the value-big / label-small hierarchy and the single dominant number per page.
   Keep the pace band as InteRun's page 1 hero rather than a lap target.
3. Settings → break the single list into paged groups, each toggle with its one-line explanation.
4. Session detail → 3 pages ending in Start, prescription as sentences.

Verify on a real Ultra (the owner has one — screenshots above are from an Ultra, 49mm) and remember
`xcodebuild` needs `-destination`, never `-sdk`, for this project.
