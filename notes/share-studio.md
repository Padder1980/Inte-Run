# The share studio (part 1)

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> ⚠️ Continued in notes/share-studio-outputs.md, whose later chapters are the CURRENT rules: two outputs only (Story 9:16, Feed 4:5), a photo on any card, the session's own colour. The Square and Sticker outputs described below were withdrawn.

## THE SHARE STUDIO, REBUILT TO A COMMISSIONED CONTRACT (2026-08-18/19)

The owner supplied `InteRun_Share_Studio_Claude_Pack` — a binding contract with four authoritative 9:16
reference PNGs, template contracts, an editor spec and a release gate. ⚠️ **ITS "existing weak output
that must not survive" LIST DESCRIBES THE PREVIOUS BUILD'S OUTPUT ALMOST ITEM BY ITEM** (card-within-
card framing, an outer border, neon glow, a route stranded in empty space). So the visual layer was
replaced and the plumbing kept. Four templates: **The Moment**, **The Execution**, **The Route
Poster**, **The Progression**, at exactly **1080×1920** and **1080×1350** (reflowed, never cropped).

⚠️⚠️ **READ THE LAST TWO SUBSECTIONS OF THIS CHAPTER FIRST — "TWO OUTPUTS ONLY, AND A PHOTOGRAPH ON
EVERY CARD" and "THE SESSION'S OWN COLOUR, THE DESTINATIONS ROW, AND NO TOP FADE" (both 2026-08-20).** Everything below it about **Square 1:1** and the **transparent sticker** describes
outputs that were built, measured, signed off and then WITHDRAWN by the owner. Those passages are kept
because the findings they record are still true and still useful — the reflow lesson, the seam
measurement, the guards that could not fail — but the shapes themselves are gone from the code and from
the editor. Two outputs: Story 9:16 and Feed 4:5.

**The owner's three rulings** (`scratchpad/share/DECISIONS.md`, binding): conservative centre-person
exclusion instead of Vision — **which is what keeps the whole feature shippable over the air**; The
Execution **restricted** to sessions judgeable against the 1000 m splits that exist; **per-run** share
privacy starting safe, so the global PRIVACY that governs already-recorded debrief maps is untouched.

⚠️ **THEN HE AMENDED THE CONTRACT, AND THE AMENDMENT IS THE BETTER DESIGN.** Verbatim: *"screenshot
one shows the full picture of the person behind, where the others seem to cut the person off (I want
the full picture to be in view....the data and text should always be just an overlay)"*. The pack's own
sections 2 and 4 ask for a "lower panel [that] blends into deep ink"; measured, that panel was **flat
(pixel sd 0.00) below 52%, and the photograph was simply gone**. Now the photo reaches the last row on
every photo template (pass-through 12.4–14.4%) and one **gradient** scrim carries legibility — which is
what the pack's own shared visual language asked for all along ("subtle photo scrims, not opaque
cards"). The Moment was already correct and is byte-identical: **0 of 1920 rows changed**.
⚠️ **THE SCRIM IS SOLVED, NOT CHOSEN.** `shareScrimFade` derives the fade from the content block's own
height, so one function serves four layouts; alpha is solved per text tier against the measured ground
and **clamped below 1 so an opaque lower section is structurally unrequestable**. On a white photograph
it legitimately solves deep — that is the honest answer, not a bug.
⚠️ **THE CHART AND THE LADDER NEEDED THEIR OWN ANSWER**, because a tint over a photograph is not a
ground: every mark on the target band carries a **deep keyline** (the device `shareRouteDraw` already
used), and the ladder's track is **two passes** — fix the ground inside the bar, then lighten it — so
the track reads the same grey whatever is behind it.

⚠️ **I REPORTED A DEFECT THAT DID NOT EXIST.** I told the owner the grey boxes behind "/KM" and "M"
were opaque plates. They were the **synthetic test figure's legs showing through the scrim**, identical
before and after. Look at the before/after render before believing a visual diagnosis of a card drawn
over a test image.

### What the preflight found, and it is the more valuable half

Ten contract assumptions did not hold. The four that were safety-relevant:
- ⚠️ **`run.pain` was read in three places and WRITTEN NOWHERE** — `runVerdict`'s highest-precedence
  branch was unreachable, and the card's only rule for keeping a private disclosure off a shared image
  guarded a field nothing sets.
- ⚠️ **NO confidence signal existed anywhere.** The contract feared a false celebration; the real risk
  was inverted and worse — a GPS-mangled run uppercased into a false **accusation** on a picture that
  leaves the phone. `runEvidenceConfidence` now exists at the source.
- ⚠️ **Hidden start/finish defaulted OFF**, so a first-time sharer exported a polyline ending at their
  front door.
- ⚠️ **`BRAND_MARK` had no `xmlns`**, so the real vector silently failed to load as a data URI — one
  attribute between the true logo being usable in an export and not.

Also established, each with a measurement: **`navigator.share({files})` DOES work under
`interun://app`** (a code comment asserting otherwise was false, and that path had been live and
unexamined); **no Vision, and `FaceDetector` is `undefined`** in WKWebView; **no Photos purpose strings
— a probe app was KILLED by TCC**, not refused; **no feature flag and no analytics** exist at all; **no
per-rep data** is persisted, which is why The Execution is restricted; **canvas has no tabular
numerals**; and **both design ratchets sit exactly on their ceilings with zero headroom**, so one
literal radius or font-size in new CSS fails the suite.

⚠️ **STILL NATIVE-ONLY, SO IT WAITS FOR AN XCODE BUILD:** saving straight to Photos and the camera
branch of the picker (`NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription`). Until then the
system share sheet plus the existing download path is the compliant fallback the spec permits.

### BUILD 2 — THE EDITOR (spec sections 2 and 3, shipped 2026-08-19)

The four templates were done; the editor was a card above a long settings page. The spec forbids exactly
that shape in as many words — *"Do not show all toggles in one long settings page while shrinking the
preview to a postage stamp"* — so the shape chips, the photo buttons, the route switch, four privacy
switches and the Strava block came off the primary screen and the five tools it names (**Photo, Route,
Metrics, Style, Privacy**) each open a sheet over the preview. Suite 880 → **897**.

⚠️ **THE PREVIEW IS THE CAROUSEL, AND THE SPEC SETTLES THE GESTURE COLLISION ITSELF.** A horizontal drag
cannot mean both "move my photograph" and "show me the next style". Section 3: *"Tapping the preview
enters edit mode without changing the selected template."* So a **tap** is the mode switch, the carousel
owns the drag until it happens, and the photograph owns it afterwards. A **pinch** is unambiguous and
enters the mode by itself. A tap always leads somewhere: framing when the card carries a photograph, a
second tap inside 320 ms resets the framing, and on a card with no photograph it opens the Photo tool —
the discoverability the old panel got from having the button permanently on screen.

⚠️ **`touch-action` IS `pan-y` IN BROWSE MODE AND `none` ONLY WHILE FRAMING.** The stage is now most of
the viewport, so refusing every touch there means a vertical drag on the biggest thing on the screen
scrolls nothing. `test/ios-input-zoom.test.ts`'s "two surfaces may disable touch entirely" list is now
`.crop-stage` and **`.sst-stage.sst-editing`** — and both selectors must stay in the document-wide
`gesture*` suppressor, or a pinch there zooms the page and pinch-to-zoom is off.

⚠️ **THE SLIDE IS THE CARD'S OWN WIDTH, PUBLISHED AS `--sstslide`, AND A FLAT 86% IS WRONG.** The card is
not always as wide as `SST_SLIDE` allows: on a short screen the height cap binds first. Left at the
allowance the slide stayed wide while the card shrank inside it, so the neighbour's CARD was pushed past
the edge of the stage while its empty slide sat in the gutter — measured on **320×568: the card 49% of the
stage, the neighbour's near edge 33px past the right edge, no peek at all and half the stage empty.** That
is the "42% of the stage empty" complaint reappearing on the smallest supported screen. Slide == card
means the gutters ALWAYS hold the neighbours. ⚠️ **One slide width, read by the CSS, the transform and the
drag scale** — three derivations put the card off centre at every position but the first.

⚠️ **THE FRAMING IS INDEXED BY (template, aspect) — `SPHOTO.crops` — AND ONE SHARED `{ox, oy, k}` COULD
NEVER HAVE BEEN RIGHT.** A 9:16 story and a 4:5 feed post crop the same picture along different edges, and
the four templates put their type in four different places, so switching shape to see what it looked like
destroyed the framing just set, with nothing to undo it. `sharePhotoView` hands each card a fresh view of
one bitmap; `shareCropRead` never creates a slot (the model runs on every preview frame) and
`shareCropWrite` is the editing path. **The whole crop map is in `shareCardKey`** — naming only the visible
slot would mean resolving the template a second time, and serialising all of them can only invalidate
more, never less.

⚠️ **A FALL-THROUGH IS NOT A CHOICE, AND WRITING THE ANSWER BACK INTO THE ASK WAS A REAL DEFECT.** It
looked tidy — the cache key would then always name the drawn card. Measured: opening on a run with a route
and no photograph leaves only The Route Poster eligible, so the answer is "route"; written back, **adding
a photograph kept the poster selected and the runner had to page three cards back to reach The Moment**,
which the contract calls "the default, most broadly useful card". Only `studioSelectTemplate` writes
`SCARD.template`. The key does not need it: eligibility is decided by the photograph, the route and the
analysis, and all three are already in there.

⚠️ **CAROUSEL = ELIGIBLE ONLY; THE STYLE TOOL LISTS ALL FOUR WITH THE REASON IN WORDS.** Both halves of
the spec's own instruction rather than one: a swipe through a card that cannot be drawn is a dead page,
and hiding a style with no explanation anywhere means a runner never learns that The Route Poster exists.
An ineligible row is a **`div` with `aria-disabled`**, never a button — the rule
`test/design-system.test.ts` already enforces on plan session rows.

⚠️⚠️ **AND DIMMING IT MADE THE REASON UNREADABLE — MEASURED FROM RENDERED PIXELS, WHICH IS THE ONLY WAY
THIS COULD BE SEEN.** Opacity on an ancestor appears in no declared colour, so `getComputedStyle` reports
the token and the eye reports something else. With the shared `.sst-off`: the ineligible row's **REASON
2.55:1 dark / 2.13:1 light**, a disabled metric chip **3.25 / 2.46**, a disabled carousel arrow
**3.49 / 2.57**. The reason is the most important sentence in that row and a chip's label is the name of a
number. Now a **dashed edge** marks unavailability without touching the ink (which also keeps colour from
being the only signal): **5.72 / 5.18** and **5.72 / 5.18**, arrow **5.53 / 3.94** (a glyph with an
accessible name, above the 3:1 non-text floor).

⚠️ **THE METRIC PICKER'S CAP AND FLOOR ARE EXPRESSED BY DISABLING CHIPS, NEVER BY REFUSING A TAP.** With
three chosen the fourth cannot go on and with one left it cannot come off, so a swap is deliberately two
taps — turning one off is what lights the others. `shareMetricPool` climbs `runMetricLadder(run, true)`, so
**RPE is structurally unreachable**: the effort rating is something the runner told the app about
themselves and never reaches a picture that leaves the phone. The default is the pool's own head, so a
runner who never opens the tool gets a **byte-identical card** to the one signed off against the
references. ⚠️ **The Execution and The Progression say in words that they do not use this row** —
references 02 and 04 print distance, time and average pace under a hero that is the verdict or the
headline, so a picker appearing to govern them would be a control that looks live over a card it cannot
change.

⚠️ **THE TOOL SHEET IS THE THIRD DIALOG AND IT GOES THROUGH `overlayModal`, WHICH GAINED A `behind`
ARGUMENT.** A sheet that only paints over the panel leaves every control under it in the tab order, so a
keyboard user tabs out of the sheet into carousel arrows they can no longer see. ⚠️ **And fixing it
exposed a latent fault in that helper: it inerted BEFORE reading `document.activeElement`, and making an
element inert while it holds focus blurs it** — so the return node was always BODY. Invisible on iOS,
where a tap does not focus a button; a keyboard user met it every time.

⚠️ **EVERY ROW IS REBUILT FROM ITS BUILDER ON EVERY CHANGE, WHICH DESTROYS THE NODE THE RUNNER IS STANDING
ON.** `studioSyncRows` remembers the action attribute of the focused control and restores it — the same
answer the Support search field uses for its caret. Without it, toggling a metric chip dropped a keyboard
user onto BODY with the panel behind them inert.

⚠️ **ONLY THREE CARDS HOLD A CANVAS, AND THE NEIGHBOURS ARE DRAWN AT A THIRD.** Four story cards at the
preview scale is 8.3 MB of resident RGBA on a device whose web view is jetsammed with no exception and
nothing in the console; the two neighbours cost 1.84 MB instead of 4.15 MB, and a dropped canvas has its
backing store **zeroed** before removal because removing the node does not free the bitmap. The paint
reads its scale back off the canvas rather than taking a constant.

⚠️ **THE STAGE'S RESERVE NOW ANCHORS ON `[data-sst-keep]`, THE PRIMARY ACTION.** The old anchor was the
photo row, which has moved into a sheet — and a reserve measured against something no longer on the
primary screen is a reserve of zero. Measured at `--tscale` 1.3 on 430×932: the card holds **79.5% of the
viewport width**, the Share button's bottom lands at y=931 of 932, and `documentElement.scrollWidth ===
clientWidth` (no horizontal page scroll) at 430 and at 320.

**No Instagram row, and the sheet says where it is.** There is no `LSApplicationQueriesSchemes` entry, so
a direct Story handoff cannot work until somebody rebuilds in Xcode; the system share sheet is the
fallback the spec requires, and the note tells the runner their apps are inside it. The guard sweeps the
row **labels** (the destinations) rather than the whole builder — the first version looked for URL schemes
and a row reading "Instagram Story" sailed past it.

**Verified:** build 0, `node --check` on all three emitted blocks, tsc clean apart from the pre-existing
`test/onboarding-wizard.test.ts` Date error, **897/897**, exports still exactly **1080×1920 / 1080×1350**
through the real editor for all four templates (89–341 KB JPEG), zero console errors across dark, light
and 320×568. **60 deliberate re-breaks: 58 caught first time; two of my own guards were refuted by their
own re-break** — one checked "the input is written after a closing div" and read the nearest one, which is
satisfied by both orderings (nesting in a string-concatenation builder can only be settled by counting
tags), the other swept URL schemes for a defect that is a row label. Both restated, and their three
re-breaks then all caught.

### THE PHOTO-FIT RULING: THE WHOLE PHOTOGRAPH BY DEFAULT, FILL BY CHOICE (owner, 2026-08-19)

His question, verbatim: *"Is the photograph going to be across the full page with the text as an overlay,
I dont really want the photo cutting off? I don't mind a subtle fade but i want the full photo the user
uploads to be shown."* Offered three answers he chose **whole photo by default, plus a Fill toggle**
(`scratchpad/share/DECISIONS.md`, ruling 4). Suite 932 → **948**; 34 deliberate re-breaks, all caught.

⚠️ **THIS REVERSES A GUARD THAT HAD SHIPPED THE DAY BEFORE, AND THE INVARIANT WAS SPLIT RATHER THAN
DELETED.** `test/share-render.test.ts` carried *"the photograph covers the whole canvas, at every source
shape and every crop"*. It is now two claims: **FILL still covers** (1 drawImage, 0 fillRect, no gap at
any shape/zoom/pan) and **CONTAIN shows everything** while the card is still filled edge to edge. Deleting
the assertion would have been the lazy fix; `sharePhotoBox` takes the base scale as
`p.fill ? max(kx, ky) : min(kx, ky)`.

⚠️ **AN AXIS WITH SLACK IS CENTRED, AND WITHOUT THAT RULE THE DRAG INVERTS.** `(W - dw)` is NEGATIVE under
cover and POSITIVE under contain, so one fraction cannot mean the same thing in both modes — read as a
pan, the same finger movement pushes the picture left in one and right in the other. Centring the slack
axis also keeps the two bands equal, which is most of what makes the result read as deliberate rather than
as a photograph that has slipped. Pinch past the fit and the axis overflows again and pans as it always
did. ⚠️ **`studioGestures` had a SECOND copy of the cover arithmetic** (`Math.max(gm.W / p.w, …) * c.k`)
and the ruling gave that copy two fresh ways to be wrong at once; it asks `sharePhotoBox` now, and the pan
is gated on `hx < -1` (actually overflowing) rather than on `Math.abs(hx) > 1`.

⚠️⚠️ **THE SPACE IS FILLED BY THE PHOTOGRAPH'S OWN EDGE, REFLECTED — AND THAT IS THE DIFFERENCE BETWEEN
THIS READING AS A DESIGN AND READING AS A FALLBACK.** The first cut built the surround as a blurred cover
crop of the whole picture. A cover crop of a 3:4 photograph shows its vertical MIDDLE, so on a sunset the
band above the picture came out **muddy brown while the picture's own top row is deep blue sky** — at full
size a hard coloured line across the card, exactly the "arbitrary blur block" the pack names as a defect.
⚠️ **I chased blur strength first and it was the wrong variable**: swept 24 → 4 and the smudge improved
while the line stayed exactly where it was, because the fault is the COLOUR at the seam, not the sharpness.
The band now **mirrors** the strip it touches, so the two are the same colour by construction.
⚠️ **MIRRORED, NOT REPEATED AND NOT STRETCHED FROM THE EDGE.** A repeat puts the far edge against the near
one (a second seam); a stretch of rows 0..s meets the picture at row s rather than row 0 (the same
discontinuity, smaller). Reflection is the only mapping continuous at the join, which is why it is what
image processing pads with.
⚠️ **AND IT IS A TRUE 1:1 REFLECTION, SO THE STRIP IS AS DEEP AS THE BAND.** Written as a fixed 45% of the
photograph, 720 source rows were squashed into a 3px band and the pixel touching the seam was the mean of
the top 229 rows — blue averaged with brown — so the line survived a "fix". `sh = bc.y / kc`, clamped to
the picture; when the clamp binds (a 3:1 panorama leaves a band four times the photo's own height) the
reflection IS squashed and that is stated rather than hidden.
⚠️ **THE REFLECTION IS TAKEN AGAINST THE CARD'S BOX SCALED DOWN, not a fresh fit inside the tiny canvas** —
the tiny height is rounded, so a fit computed there can put its slack on the other axis from the card's,
and a reflection on the wrong axis guarantees nothing.

⚠️ **`tiny` IS THE BLUR RADIUS AS A FRACTION OF THE CARD, AND 9 IS MEASURED.** Swept 24/16/14/12/11/10/9/
8/7/6/5/4 and looked at each: at 24 the reflected runner is legible in the band as a dark oval floating
above his real head; by 9 there is no readable form; below 7 it flattens towards one colour and stops
looking like the photograph. Worst case is the 3:1 panorama, where the surround is **81% of the card**.

⚠️ **NO `CanvasRenderingContext2D.filter`.** It is a recent Safari addition and this app runs in a
WKWebView on whatever iOS the runner is on, so a blur built on it silently does not happen on an older
phone — and a sharp enlargement behind a photograph reads as a rendering fault, not a missing effect. A
downscale plus a chain of doubling enlargements is a blur every canvas has always had. Guarded by walking
the renderer's closure.

⚠️ **THE SURROUND IS CACHED ON (photograph, card geometry) AND NOTHING ELSE.** Keyed on the framing too it
would rebuild on every `pointermove` — this is drawn under a finger. Stored at full card size it would be
8.3 MB of resident RGBA, the allocation this file already records getting a web view jetsammed; it is
**216px wide**. Leaving the framing out is also why it looks right: the surround holds still while the
picture moves inside it, and it is only visible on an axis the box centres anyway. **Measured: 40 drag
frames rebuild it zero times (same object, same key), 0.58 ms per frame; a change of aspect rebuilds it
exactly once; a real drag through the editor is p50 0.2 ms / p95 0.3 ms / max 0.6 ms per event.**

⚠️ **THE PROBE HAD TO COMPOSITE WHAT THE CARD COMPOSITES, AND THE FIT IS IN ITS KEY.** In contain mode the
ground under the copy is frequently the surround rather than the photograph's lower half, and a blurred
bright sky is still a bright ground. `sharePhotoCompose` is the ONE composite, used by the card and by the
tenth-scale probe — the probe asks for the surround against the CARD's geometry so the two share one
cached bitmap instead of evicting each other.

⚠️⚠️ **AND RE-MEASURING FOUND A REAL LEGIBILITY REGRESSION: 4.41:1.** The eyebrow on
`moment/feed/split_bright_top` fell under its 4.5 target in contain mode (4.53 in fill). The cause is not
the surround, it is that the scrim **solved for equality**: the ground comes from a tenth-scale average, so
solving at exactly 4.5 delivers "about 4.5" — before this work the same element measured 4.52 and 4.53,
i.e. it had always been on a knife edge and contain mode tipped it. `SHARE_SCRIM_MARGIN = 1.10` solves
above the target by the estimator's own measured error. **Floor now 4.93 (contain) / 4.98 (fill) across
276 renders; nothing under 4.5 in either mode.**
⚠️ **THE CAP NOW HAS 0.02 OF HEADROOM AND THAT IS A REAL CONSTRAINT.** The hungriest colour on a pure-white
photograph needed 0.78 before the margin and needs **0.90** against `SHARE_SCRIM.max` 0.92 — so the margin
cannot be raised again without the CLAMP deciding the answer instead of the solver. The pair is asserted
together; raise either and one number moves into the other.

⚠️ **SUBJECT SAFETY IS RECOMPUTED PER MODE, AND THE BRIEF'S OWN PREDICTION WAS WRONG.** It said the subject
sits "higher and smaller" under contain. **Smaller holds everywhere; higher does not** — a 4:3 source in a
9:16 card goes LOWER, because the picture is centred in a tall card while the cover crop was pinned to its
top edge (face base y634 under fill, y868 under contain). So the guard asserts DISPLACEMENT, not a
direction. Measured across the five shapes: the face zone moves **8 to 517px** and its area changes by up
to **620,110 px²**. A consequence worth knowing: in FILL mode the route-zone scorer **refuses on 6 of 10
shape/aspect combinations** (a wide source enlarged puts the conservative person across the whole canvas
width, which vetoes every candidate), and in CONTAIN it always finds one — so the whole-photo default makes
the over-photo route reachable on far more photographs than the cover crop did.

**The fit is part of the framing, so it is per (template, aspect)** — `SPHOTO.crops[…].fill`, in
`shareCropSig` (the cache key), in the undo entry, and NOT in Reset. ⚠️ **Reset does not touch it**: pan
and zoom are what a finger did, Fill is a named switch the runner can see, and Reset is also reached by a
double-tap on the card — folding it in would mean a gesture flipping a switch in a sheet that is not open.
⚠️ **Toggling Fill returns the zoom to the fit** (`c.k = 1`): k is a multiple of whichever base scale is in
force, so a card left at k 2.4 under contain is cropped HARDER than cover the instant Fill comes on — the
runner asks to see more of their photograph and sees less of it.

**Measured whole-photo presence** (`test/share-photo-fit.test.ts` plus a pixel probe over the isolated
photograph layer, 24 × 32 = 768 identifiable source cells, five shapes × two aspects): **768/768 cells
present, 0 off-canvas, 0 misplaced, worst channel error 0, every row (32/32) and every column (24/24)** in
all ten contain cases. In fill, **all four edges are the photograph itself in 10/10**. The surround is not
flat — band sd 7.35–24.43 against a band mean 32–68, and 45–81 luma darker than the photograph's own mean.
⚠️ **The first version of that probe measured cell identity on the FINISHED card and reported 109–190 of
192 cells "wrong".** That was the ruler: the scrim and the type are drawn over the lower half by design, so
a pixel there legitimately no longer reads back as its own colour. The claim has to be made about the layer
under test, with the finished-card pass keeping only what survives an overlay (nothing clipped).

⚠️ **THE TWO PHOTOGRAPH FIXTURES IN THE SCRATCHPAD ARE FLAT GREY NOISE** (`ph-real.jpg`, `photo.jpg`), so
the seam defect is invisible in them and every blurred surround reads as a flat block whatever it is. Three
synthetic scenes with real structure (a sunset trail with a runner, a bright overcast beach, dark woodland)
are what made the fault visible and the fix judgeable. **Judge a background against a picture, never
against noise.**

⚠️ **THE BYTE GATE NOW CAPTURES BOTH FIT MODES — 32 exports, not 16** — and `SPHOTO` is a supplied global
with a setter in `share-export-harness.ts`, because `shareCardModel` reads the fit out of the framing store
and a photograph handed in as an option carries none. Without that seam every card would be drawn at the
default and the opt-in half of the ruling would have no proof of its own dimensions. All 32 are exactly
1080×1920 / 1080×1350 in their own SOF headers; the two modes differ over more than a tenth of the coarse
signature; and **the Route Poster is byte-identical in both modes, which is asserted rather than omitted** —
it carries no photograph, so a poster that MOVED would mean the fit had reached something it must not touch.

⚠️ **A `--test-name-pattern` CONTAINING PARENTHESES SELECTS NOTHING AND READS AS "THE BREAK WAS NOT
CAUGHT".** It is a regex. Six of the seven apparent misses on the first re-break run were that, not weak
guards. The harness escapes the pattern now AND requires the output to contain the title before believing
its verdict.
⚠️ **AND ONE GUARD WAS GENUINELY REFUTED BY ITS OWN RE-BREAK: a source grep cannot tell live code from
dead code.** "The source contains `scale(1, -1)`" passed with both reflection branches switched off at
`if (false)`. It asserts on the recorded draw calls now — two vertical flips for a letterboxed-vertically
surround, two horizontal for the other, each drawing a STRIP of the source taken from opposite edges.

**Still open:** the 3:1 panorama is the weakest case and honestly so — at 81% surround the card is mostly a
soft out-of-focus field, and the answer for it is the Fill toggle in one tap rather than more blur.

### SECTION G, THE EXPORT GATE — THE FIRST TIME THIS SUITE HAS LOOKED AT AN EXPORTED BYTE (2026-08-19)

⚠️ **NOTHING IN 69 TEST FILES ASSERTED AN EXPORTED PIXEL DIMENSION, ENCODING, QUALITY, FILENAME OR PIECE
OF METADATA.** `test/share-render.test.ts` proves `cardGeom` *answers* 1080×1920, which is a different
claim from a JPEG's own frame header *saying* 1080×1920 — and between the two sit `canvas.width`, the 2D
context, `toBlob`, the platform's colour management and whatever it decides to embed. Every fault the
checklist's release gate names lives in that gap. Suite 898 → **932**.

**Two files, split on what they need**, and splitting it the other way would have been the bug:
- **`test/share-export.test.ts`** (15 guards, node only) — the mechanism, the filename, the reflow
  arithmetic. Runs everywhere.
- **`test/share-export-bytes.test.ts`** (19 guards) + **`test/share-export-harness.ts`** — the artefact.

⚠️ **THE SUITE NOW HAS A HEADLESS-BROWSER DEPENDENCY, AND ABSENCE IS A FAILURE RATHER THAN A SKIP.** node
has no canvas, so the bytes cannot be produced without one. A gate that vanishes when its instrument is
missing reports a release as verified and has verified nothing — this file's whole history is guards that
could not fail. Discovery covers `CHROME_PATH`, the three macOS bundles, five Linux paths and the
sandbox's Playwright root; measured with none of them present, **all nineteen tests fail, each carrying
the reason and the command that fixes it**. The other fifteen guards still run.

⚠️ **THE HARNESS LIFTS THE REAL PIPELINE INTO A REAL BROWSER, AND THE CLOSURE IS DERIVED FROM SIX ROOTS
RATHER THAN LISTED.** 114 functions and 39 const statements walked out from `drawShareCard`,
`shareCardCanvas`, `canvasToShareFile`, `shareFileName`, `shareCanvasGeom` and **`shareCardModel`** — so
the gate starts at a **run record**, not a hand-built model, and a privacy switch has to change the
picture through the app's own `sharePrivacyFor` and `runRoutePresentation`. Three faults the derivation
found, each of which a hand-written list would have hidden and each of which the browser throws on:
a const's initialiser can call a function (`DEFAULT_PROFILE` calls `futureIso`) exactly as a function
reads a const (`SHARE_LADDER` reads `SHARE_EVEN_SPREAD_S`), so **one worklist has to carry both kinds
until it stops growing**; a dependency need not be call-shaped (`shareMetricsFor` passes
`shareMetricUnit` to `.map` as a value); and the const statements must be emitted in the page's own
declaration order or a temporal-dead-zone `ReferenceError` fires. **The renderer turned out to be pure
with respect to app state** — the only global it touches is `PHOTODIAG`, as an error sink.

**What the bytes say, measured:** all 16 cards exactly **1080×1920 / 1080×1350** in their own SOF
headers; JPEG at a quantisation-table fingerprint that matches **0.92** and differs from 0.80 / 0.86 /
0.90 / 0.94 / 0.98, so the quality is recovered from the artefact rather than read off the call site;
an embedded ICC profile whose description is literally **sRGB** (RGB / XYZ / `mntr`); **no APP1, no GPS
IFD and no other metadata segment**, from a source photograph carrying a real GPS IFD; and the same card
**byte-for-byte identical** across a 320pt 1× window, a 430pt 3× phone and a 1440pt 2× desktop.
⚠️ **THE GPS SOURCE PHOTO IS CONSTRUCTED, NOT COMMITTED** — a checked-in binary would make the guard
depend on a file nobody can read, and the interesting half is that the parser finds GPS in the source
and not in the export, which is only evidence if the source's tags are known exactly.

⚠️ **"THE FEED IS A REFLOW" IS PROVED AGAINST A CONTROL, NOT AGAINST A NUMBER CHOSEN BY TASTE.** For each
template the gate builds the two things the contract forbids — a centre crop of the story to 4:5 and a
uniform squash of it — and measures how well the best crop-or-scale explains each. Controls: **0.0000**
(the squash, by construction) and **0.0047–0.0074** (the crop, whose residual is only resampling). The
real feeds: **0.026–0.165**. Bar set at 3× the control.

⚠️ **A GOLDEN-FILE SNAPSHOT WAS CONSIDERED AND REJECTED.** A committed baseline fails on a Chrome
upgrade or a one-pixel move, so its failures mean "something changed" rather than "something is wrong" —
and a test whose failures are usually noise is one people re-baseline without reading. What is pinned
instead is every property a broken render violates (not blank, not flat, no empty quarter, no repeated
rows, distinct from the states it should differ from), and the 16 exports plus an index are written to
`$TMPDIR/interun-export-gate/` every run as the evidence section H asks for.

**34 deliberate re-breaks; 29 caught on the first attempt. The five misses were the valuable part:**
1. ⚠️ **A FILENAME PATTERN CANNOT SEE AN EXTRA SEGMENT.** `^InteRun-date-kind-distance\.jpg$` is
   satisfied by `…-distance-PLACE.jpg`, because a place is made of the same characters as a session
   name — watched passing with `coarseLocation` appended. Replaced by an **allowlist of tokens** derived
   from the four fields the name may carry, and the fixture model now carries a place, a route and an id
   **by default** so there is something to leak.
2. ⚠️ **ASKING THE MODEL WHICH TEMPLATE IT DREW IS NOT ASKING WHAT WAS DRAWN.** Rewiring the poster
   branch to call `shareMomentCard` left the model still answering "route", and the picture was somebody
   else's — and a hash comparison cannot see it either, because the poster carries no photograph so the
   result is a *different* wrong picture rather than a duplicate. The claim moved to the **dispatch**:
   the four template names must map one-to-one onto four distinct `share*Card` functions.
3. ⚠️ **THE DATE IS GATED TWICE AND AN END-TO-END TEST CAN ONLY SEE THE PAIR.** `shareCardModel` empties
   `completedAt` when the date is hidden AND `shareFileName` refuses to print one, so deleting either
   alone leaves the filename dateless. Belt and braces, correctly — so the per-gate proof lives in the
   node-only file (which calls `shareFileName` with a date in hand) and the byte file now captures
   `completedAt` and `dateLabel` so the upstream gate is pinned where it can be seen.
4. ⚠️ **A THRESHOLD SET FROM TASTE CAUGHT NOTHING.** "No quarter of the canvas is empty" was written at
   sd > 0.004 while the quietest quarter the app actually draws measures **0.0228** and the busiest
   0.2476 — so disabling the poster's entire topographic texture did not trip it. Now 0.012, with the
   measured table quoted beside it.
5. ⚠️ **AND ONE MISS WAS THE BREAK'S FAULT, NOT THE GUARD'S.** Scaling the feed's geometry and type
   ladder by 1350/1920 is **not** a uniform scale — every gap constant (`MOMENT_GAP`, `EXEC_GAP`, the
   tracking) stays absolute, so the picture came out genuinely recomposed and the guard rightly passed.
   To test a crop guard you have to make a crop: the break now composes the feed by drawing the story
   canvas and squashing it, which is the forbidden artefact itself.

⚠️ **AN UNCLEARED `setTimeout` HUNG THE TEST FILE FOR TWO MINUTES AND DID NOT APPEAR IN
`process._getActiveHandles()`.** Each CDP call left a 120-second rejection timer, so the file finished its
work and then sat until the last one expired — while the handle diagnostic showed only stdout and stderr
and read as "nothing is holding this open". Under `node --test` every file runs in a child the runner
waits on, so that is not a slow test, it is a hung suite. ⚠️ **The CDP WebSocket is also hand-rolled over
`node:http`** for the same reason: node's global `WebSocket` offers `close()` and no handle, and `close()`
begins a handshake the peer has to answer — and the peer is a browser the harness has just killed.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` on all three emitted blocks, tsc clean
apart from the pre-existing `test/onboarding-wizard.test.ts` Date error, **932/932** (898 → 932, and the
suite got *faster*: 70 s → 65 s, because the files run in parallel and the capture is 3.4 s). `web/app.ts`
was restored byte-identical after the re-breaks and **no app source changed in this phase** — the
behaviour already passed; what was missing was the proof.

**Still open, and not mine to close:** saving straight to Photos and the camera branch of the picker need
`NSPhotoLibraryAddUsageDescription` / `NSCameraUsageDescription` and an Xcode build; and a real-device pass
(photo pick, system share, Instagram handoff) is the one thing no headless run can settle. ⚠️ **Square 1:1
was open here and is now built — see the next section.**

### SQUARE 1:1, WHICH THE CONTRACT PERMITS ONLY AS A RECOMPOSITION (2026-08-19)

*"Support Square 1:1 if the existing renderer can do so without delaying the required two formats"*, and
*"Recompose to a compact poster; allow two metrics rather than crushing three. Never hide the primary
distance/session outcome to retain secondary data."* The byte gate above is what discharged the condition,
so the third shape went in. Suite 948 → **955**; 19 deliberate re-breaks, 18 caught first time.

⚠️ **THE OLD `1:1 IS NOT OFFERED` NOTE WAS TRUE OF WHAT IT MEASURED AND WAS NOT AN ARGUMENT AGAINST THE
SHAPE.** It read *"measured, it leaves the photograph 32.3% of the card"* — which was the STORY LAYOUT
dropped onto a 1080-tall canvas: the same rungs, the same three metrics, the same six-row ladder, 840px
less to put them in. Re-measured that way now: **33.6 / 21.4 / 20.0 / 43.7%** clear photograph across the
four templates. So it was evidence that a scale is not a reflow, which is the contract's own point.

**FOUR REDUCTIONS, AND THE MEASUREMENT OF EACH IS THE INTERESTING PART.** Reverted one at a time:

| | moment | execution | progression | poster |
|---|---|---|---|---|
| all four in place | **51.7%** | **43.1%** | **42.2%** | **59.0%** |
| type left at the feed's factors | 47.1 | 38.7 | 40.8 | 55.4 |
| ladder left at six rows | 51.7 | 43.1 | **31.9** | 59.0 |
| metric cap removed | 51.7 | 43.1 | 42.2 | 59.0 |
| none of them, gaps at 1.0 | 33.6 | 21.4 | 20.0 | 43.7 |

⚠️ **THE METRIC CAP BUYS WIDTH, NOT HEIGHT — I HAD WRITTEN THE OPPOSITE AND THE SWEEP REFUTED IT.**
Measured, capping the row moves the clear photograph by **0.0 points on every template**, because a metric
row is exactly as tall with two columns as with three. What it changes is the column: `(952 - 2×24)/3` =
301px against `(952 - 24)/2` = **464px**. "Crushing" is a statement about the horizontal and so is the fix.
Do not restore the third column on the reasoning that it costs nothing — it costs the contract's own word.

⚠️ **THE LADDER IS THE BIGGEST SINGLE LEVER (10.3 POINTS) AND ITS PITCH IS NOT WHAT GIVES WAY.** At six
rows the pitch stays at 56 in both cases, so the ladder simply grows downward into the picture. Four rows
is still **every kilometre** — `shareLadderRows`'s block strategy widens the blocks rather than dropping
any — and a guard asserts the members are a partition of the splits, and that shuffling the paces cannot
change which kilometre lands in which row.

⚠️ **`SHARE_GAP_SQ` IS 0.64 AND THE NUMBERS ALONE COULD NOT CHOOSE IT.** Swept 0.55–0.75: the trade is
monotone and gentle (moment 54.0 → 48.7%) and **no type size changes anywhere across that range**, so it
is air against picture and nothing else. Rendered over a real scene and looked at: at 0.55 The
Progression's last ladder row closes on the metric values beneath it and its interpretation line on the
SPLITS heading above; at 0.75 the block climbs into the subject — the eyebrow lands on the runner's chest
— for 3.0 points less photograph. **A number about air is settled by looking, after the sweep says the
numbers cannot settle it.**

⚠️ **ONE VALIDATOR, `shareAspect`, AND EVERY OTHER READER COMPARES AGAINST WHAT IT RETURNS.** Spelled out
at four call sites, an unknown aspect is four chances to draw a story under a square label — and the
inverse bit me for real: `sharePhotoFloor` read *"is this a feed post"*, so a square inherited the STORY's
photographic floor. 50% of 1080 is 540, which a recomposed block clears anyway, so **nothing looked wrong**
and The Execution's verdict was nevertheless being sized against a constraint belonging to a canvas 840px
taller. `shareQuietPlan` had the same shape of test. Both now ask *"is this a story"*.

⚠️ **`BOT`, `CB` AND `TOP` WERE DELETED FROM THE GEOMETRY, AND THEY HAD BEEN DEAD FOR A WHILE.** Leftovers
from the removed ledger; nothing read any of the three. Adding a third aspect meant inventing three more
numbers nobody reads, and an unread number is what the next template copies.

⚠️ **THE POSTER WAS THE ONE TEMPLATE THAT KEPT ITS STORY-SHAPED ROW, BECAUSE IT APPENDS ITS ADHERENCE
COLUMN AFTER THE CAP.** `sharePosterMetrics` takes two supporting numbers and adds "5 OF 6 KM ON TARGET",
so a cap applied to the ingredients left three columns on a square while the other three templates had
reflowed to two. Fix-one-builder-not-the-other, for the fourth time in this file. ⚠️ **And it is the
adherence column that survives the cap, not a supporting number** — it is the only figure in that row that
says whether the run did what it was set to do, which on a card whose headline is the distance is the
nearest thing to the session outcome.

### ⚠️⚠️ THE SQUARE FOUND A 2.09:1 ON THE BRAND MARK, AND IT WAS NEVER A SQUARE DEFECT

Measured from rendered pixels across 13 hostile grounds × 4 templates × 3 aspects × 2 fit modes — **4472
glyph runs** — one reading was under 4.5: the accent half of the wordmark, **2.09:1 hard / 2.81 local**, on
the three photo templates at square + contain over the `spark` ground (a dark field of 3px pure-white
specks, built precisely to defeat a probe-solved scrim).

**The mechanism.** `shareTopScrim` solved its alpha from the ground under the wordmark's own 146px rect. A
probe cell is an average of about a hundred export pixels, so those specks average away: the solver was
handed 13/21/20, **no scrim was drawn at all**, and a glyph sitting on a speck was set on white.
⚠️ **THE SAME RECT PASSED ON A FEED POST AND FAILED ON A SQUARE BY LUCK, WHICH IS THE REAL FINDING.**
Identical rect, identical ground, identical probe. In contain mode a portrait photograph is inset 90px on a
feed and **180px on a square**, so the wordmark begins in the blurred surround and crosses into the sharp
picture: on the feed twelve probe cells fell on the picture and one caught a highlight (255/255/255, alpha
0.6/0.8, 5.19:1); on the square only three or four did and none caught one. **A guard that depends on how
many cells happened to land on a highlight is not a guard.**

**The fix: a scrim painted across the whole width is solved across the whole width.** Same probe, same
solver, no new pixels — and it can only ever raise the sampled ground, so the change is one-way towards
more protection. Measured: **66 of 4472 readings move and every one moves UP**; four grounds are affected;
the story's and feed post's own floors are unchanged at 4.96 and 4.93; the square's contain floor goes
2.09 → **4.73**, and nothing anywhere is under 4.5.
⚠️ **IT COSTS SOME PICTURE ON A PHOTOGRAPH THAT IS BRIGHT WHERE NO TYPE SITS** — a bright right-hand sky
now darkens a top-left wordmark's band too. That is the deliberate trade: the alternative is a scrim whose
strength depends on which 13% of the strip the wordmark happens to occupy.

**Everything else measured at 1:1.** Subject exclusion and the route zone are recomputed per aspect AND per
fit mode (the square's face zone is `[374,0,331,356]` against the story's `[292,101,497,583]`); the route
scorer finds a zone in all six aspect × mode combinations, scoring **0.936** at square + contain, the
highest of the six. The framing store is 12 slots, all distinct, with the Fill switch persisted per slot.
The byte gate captures **48 exports, not 32** — all 16 squares exactly 1080×1080 in their own SOF headers,
sRGB, no EXIF — and the not-a-crop-of-the-story residual test now sweeps both shorter shapes.

### Three guards this phase refuted, restated, and re-broke again

⚠️ **A SOURCE-TEXT ASSERTION PROVES A STRING EXISTS, NEVER THAT ANYTHING REACHES IT.** The metrics sheet's
"a square card carries two" note was re-broken by changing its gate to a literal `false` and the guard
**passed**, because the sentence was still in the source in a branch that can never run. It asserts the
GATE now, and that the gate is the computed flag. Same distinction as id-exists versus control-is-wired,
which this project has shipped twice.

⚠️ **"THE SHORTER SHAPE IS NOT A UNIFORM SCALE" HAD TO BE WRITTEN AS A DISJUNCTION, AND THE SQUARE IS WHY.**
The square's top reserve is 64/1080 = 0.059 and the story's is 120/1920 = 0.063 — four thousandths apart,
for entirely unrelated reasons (a side margin versus Instagram's profile row). So the top inset alone
cannot tell a recomposed square from a scaled story, and requiring it to differ failed on correct code. A
scale keeps EVERY ratio, so the claim is refuted the moment ONE of them differs; the bottom reserve is the
one that carries the meaning and it still has to move.

⚠️ **THERE IS ONE PAIRING WHERE THE TWO FIT MODES MUST AGREE EXACTLY.** When the source and the card have
the same aspect there is nothing to crop and nothing to pad, so contain and cover are the same box — and a
fit mode that moved the subject there would be doing something arbitrary rather than fitting. The
per-mode subject-zone guard demanded a difference at every pairing and failed on a 1:1 source in a 1:1
card. It now asserts equality there and displacement everywhere else.

⚠️ **AND THE HAND-WRITTEN LIFT LIST IN `test/share-render.test.ts` WENT STALE THE MOMENT `cardGeom` GAINED
`shareAspect` — 63 tests threw ReferenceError at once.** That is the acceptable kind of stale: it fails
loudly rather than quietly measuring less, which is why that list survives while the byte gate's closure is
derived. Adding a `share*` function another lifted one calls means adding it to `FNS` too.

⚠️ **THE GATE'S EVIDENCE DIRECTORY HAD BEEN A PHASE OUT OF DATE AND NOTHING SAID SO.**
`s.key.replace("/", "-")` replaces the FIRST slash only, so a fill-mode key became `moment-story/fill.jpg`
— a path into a directory that does not exist. The write threw, the courtesy `catch` swallowed it, and
`index.json` was never written: 16 files describing 16 shots while the gate was capturing 32. Now 48.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` on all three emitted blocks, tsc clean
apart from the pre-existing `test/onboarding-wizard.test.ts` Date error, **955/955**, and the editor checked
in dark and light at 430×932 and 320×568 at `--tscale` 1.0 and 1.3 — three chips, 44/52px tall, no
horizontal page scroll, the stage becoming square and the summary announcing "Square, one by one".

### THE RELEASE GATE, WORKED INDEPENDENTLY (2026-08-19) — AND ITS FIRST FINDING WAS THE VERIFICATION ITSELF

`VISUAL_ACCEPTANCE_CHECKLIST.md` was worked item by item without reusing the earlier phases' numbers:
the suite re-run, the exported bytes re-parsed with a **second, independently written** JPEG walker
(`scratchpad/share/fit/p3/jpegprobe.py`), and 45 cards re-rendered through the real pipeline in a real
browser (`scratchpad/share/fit/p3/probe.html` + `shots/`). Its nine sections carry **67 items: 62 PASS,
5 BLOCKED, 0 FAIL** — plus three further deviations that are not checklist lines (tabular numerals, no
analytics, the sticker export still to come).
⚠️ **AND I FIRST WROTE THAT AS "63 of 74", WHICH IS THE EXACT FAULT THIS PHASE EXISTS TO CATCH.** The
totals were estimated from the section headings rather than counted from the file, in a report whose
whole job is that numbers are measured. Counted: A5 B7 C8 D8 E7 F8 G9 H7 I8. The five blocked are
Save-to-Photos, the real-device pass, Vision, the feature flag and locale units; "eleven" had folded the
Evidence table's own rows and the non-checklist deviations into the same figure.

⚠️ **THE PHASE'S OWN "tsc CLEAN APART FROM THE ONBOARDING DATE ERROR" CLAIM WAS FALSE WHEN CHECKED.**
Two further errors sat in the new share test files — `test/share-export.test.ts` (a `const` with an
inferred-circular `any`) and `test/share-studio.test.ts` (a tuple destructure under
`noUncheckedIndexedAccess`). Neither affects behaviour and both tests passed, which is exactly why
nobody noticed: **the suite being green is not the same claim as the typecheck being clean**, and this
project's own documented verification recipe is both. Fixed with two type annotations; tsc is now back
to the one pre-existing error the recipe names. ⚠️ **Re-run every command in the recipe rather than the
one that is interesting** — a verification step that is quoted from a previous session's notes has not
been run.

**What the independent re-measure agreed with, and it agreed on everything material.** All **48**
exports 1080×1920 / 1080×1350 / 1080×1080 in their own SOF headers, 8-bit, 3-channel; an embedded ICC
whose description is literally `sRGB`; **no APP1, no GPS IFD** in any of the 48, from a source
photograph my own parser confirms carries a 4-tag GPS IFD. Minimum per-quarter pixel sd **0.0416**
against the gate's 0.012 bar. The three Route Poster exports are **byte-identical** across both fit
modes and all nine photo-template exports differ — the asserted invariant, re-derived from md5.
Exporting through the **live editor** (not the lifted closure) gave 1080×1920 / 1080×1350 / 1080×1080
in the bytes as well.

⚠️ **A CONTRAST FLOOR MEASURED A DIFFERENT WAY LANDED IN THE SAME PLACE: 4.88:1 over 57 renders**
(3 hostile photographs × 2 fit modes × 3 photo templates × 3 aspects, plus the poster), worst
`execution/white/whole/story`. Read back from the finished card's pixels as a per-strip 99th-percentile
ink against a 15th-percentile ground, i.e. neither the app's own probe nor the earlier guard's method.

⚠️⚠️ **AND THE GATE FOUND ONE THING THE EARLIER PHASES REPORTED THE OPPOSITE OF: THE SURROUND'S SEAM IS
FOUR AND A HALF TIMES MORE VISIBLE HORIZONTALLY THAN VERTICALLY.** Phase 1 looked at a 3:4 photograph in
a 9:16 card, found "NO visible seam at all", and generalised. Measured across the join on the same
source photograph:

| join | luma either side | step |
|---|---|---|
| 3:4 source, **story** card (bands top and bottom) | 42.0 → 58.0 | **16** |
| 3:4 source, **square** card (bands left and right) | 93.5 → 165.3 | **71.8** |

The mechanism is that the surround is a *darkened* reflection, so the step is proportional to the
brightness of the picture AT the join — and a photograph's top edge is usually its darkest strip while
its mid-height is usually its brightest. So letterboxing **vertically** hides the darkening and
letterboxing **horizontally** exposes it, which is the shorter shapes' normal case. At 1:1 it reads as
a photograph on a matched dark mat rather than as a bar or a blank block (the mirroring keeps the hue
and the sky bands continuous across the join), so it is not the "arbitrary blur block" the pack
forbids — but it is not the "subtle fade" the owner asked for either, and the Fill switch is what
answers it. **Recorded as a material deviation, not passed in silence.** Renders:
`scratchpad/share/fit/p3/shots/z-square-seam-left.png`, `s-shapes.png`.

⚠️ **THE ROUTE ZONE IS SUBJECT-AGNOSTIC, AND THAT IS THE OWNER'S RULING SHOWING THROUGH RATHER THAN A
BUG.** With the subject hard LEFT and hard RIGHT of an otherwise identical photograph, the exclusion
rectangles are **byte-identical** (`face [292,197,497,518]` both times) and the chosen zone is
`upper-right` both times, scoring 0.888. That is the conservative centre-person fallback behaving
exactly as specified — there is no detector, so it cannot know which side the person is on. Measured on
the renders the route clears the head in both cases, but only because the assumed body zone is generous;
a subject higher in frame and off-centre **can** be crossed. The pack's own fallback text permits this
("If detection fails, use conservative centre-person exclusion"); the checklist line "No route, text or
chart crosses a **detected** face" is satisfied vacuously, and it is listed as a deviation.
Evidence: `scratchpad/share/fit/p3/shots/s-subj.png`.

**Two things the poster measured better than expected.** The route's own bounding box holds aspect
**0.2614 / 0.2598 / 0.2565** across story/feed/square for the there-and-back fixture and
**1.0754 / 1.0795 / 1.0779** for a lap — i.e. orientation and proportion are preserved to sub-pixel,
and it is centred within 2.5–7 px. And a *lap* fills **76.6%** of the story's width against the
sliver's 20.6%, so the poster's lateral emptiness is a property of a there-and-back route, not of the
layout. ⚠️ **The committed fixtures are both slivers**, so anyone judging the poster on them alone will
under-rate it; `p3-loop-*.png` is the counter-case.

### ⚠️ FOUR MEASUREMENT TRAPS THIS PHASE PAID FOR, ALL MINE, ALL WORTH KNOWING

Every one produced a confident wrong reading that looked like a product defect.
1. ⚠️ **THE PHOTOGRAPH TRAVELS IN `opts.photo`, NOT ONLY IN `SPHOTO`.** A probe that calls
   `__setPhoto` and then asks for The Moment gets **The Route Poster**, silently — because
   `shareCardModel` reads the bitmap off its options and `SPHOTO` only supplies the framing. Six cards
   were rendered and judged before I noticed. (The upside: it is an accidental proof that the no-photo
   fallback to the poster works.)
2. ⚠️ **`shareCropWrite(tmpl, aspect)` RETURNS THE SLOT TO MUTATE; it takes no values.** Passing a
   third argument writes nothing and every slot reads back as the default, which presents as "crop
   persistence is broken". Mutating what it returns gives **12 slots, 12 distinct, unchanged across
   shape switching**, and the Fill flag reaching the card per slot.
3. ⚠️ **A HIT AREA MEASURED AT INTEGER OFFSETS UNDER-REPORTS BY A PIXEL.** The Fill switch's box is
   46×28; probing `elementFromPoint` at whole pixels said the grown area was 46×**43** and therefore
   failed the 44px floor. Sub-pixel bisection says **44.49** — the last integer inside a half-open
   interval is not its edge. Bisect, do not step.
4. ⚠️ **`[data-sst-keep]` IS A WRAPPER, NOT THE BUTTON.** At `--tscale` 1.3 its box bottom is 939 of a
   932-tall viewport, which reads as the primary action pushed off screen. The Share button itself ends
   at **909.8** with 0 px below the fold and no page scroll. Measure the control, not its container.

⚠️ **AND A FIFTH, WHICH THIS FILE ALREADY WARNS ABOUT FOR THE DEBRIEF: A BRIGHT-PIXEL BOUNDING BOX OVER
A CARD MEASURES THE TYPE, NOT THE PICTURE.** Three attempts to measure the poster's route this way gave
three different aspect ratios (0.65 / 0.84 / 0.97) and I briefly believed the geometry was being
distorted across shapes. The route is a thin line and the title is a thick one, so the honest isolation
is a **row profile** — bands whose per-row pixel count is small are the route. Same class of confounding
as `tools/debrief-diff.py`.

**The FIVE BLOCKED checklist items, and none of them is closeable from here.** (1) Save to Photos and
the camera branch (`NSPhotoLibraryAddUsageDescription` / `NSCameraUsageDescription` are absent and a
probe app was killed by TCC — native, needs Xcode); (2) real-device photo pick, system share and
Instagram Story handoff (no device); (3) Vision face detection (**the owner ruled for the conservative
fallback** — a deviation, not a pass); (4) the feature flag and rollback (no such mechanism exists; the
OTA channel plus the bundle floor is the nearest equivalent); (5) locale-aware units (metric only, by
ruling). ⚠️ **A blocked required item means the feature is not complete**, and that is why `pc-share` on
the Road Map stays unticked.
⚠️ **AND THIS PARAGRAPH SAID "ELEVEN" FOR A DAY, TWO PARAGRAPHS BELOW ITS OWN CORRECTION TO FIVE — the
same fault, in the same section, surviving the fix for it.** The count was corrected where it was
introduced and left stale where it was repeated, which is what makes a miscount durable: a reader
believes whichever copy they reach first. **Tabular numerals is NOT one of the five** — it is a
non-checklist deviation (canvas has none; a uniform digit advance is imposed by hand and the build
deliberately does not claim the feature), and folding it and the Evidence table's own rows into the
figure is exactly how "eleven" was arrived at both times. Fixed 2026-08-20 by the verification phase,
which found the same stale figure in the Road Map's hero paragraph as well.
