# Inte-Club composer — filters, adjustments, overlays, trim, playhead, journals

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE VIDEO TRIM WOULD NOT MOVE (owner, 2026-08-22)

*"when trying to add a story that is a video, the tool doesn't allow me to move to a different section
of the video for the 15 second clip, it just keeps jumping back to the start"*

Two causes, both arithmetic, both invisible to a source read. Suite 1215 → **1227**; 9 deliberate
re-breaks, all caught (two after a guard was restated). Web-only, so it reaches his phone on the next
launch.

⚠️⚠️ **`wireClubEd`'s `onloadedmetadata` RESET THE WINDOW, AND `clubEdDraw` REBUILDS THE `<video>` ON
EVERY REDRAW.** So a new element fired the handler again and set `inS = 0`, `outS = 15`. And the end of
every handle drag called `clubEdDraw` — so the window moved under his finger (`clubTrimPaint` is live)
and snapped back the instant he let go. Exactly what he described.
- **`sl.trimSet` is the flag**, and it is a flag rather than a test of whether `inS` is zero: a window
  a runner deliberately left starting at zero legitimately reads zero, and re-initialising it would
  silently drag its END back out to the cap — undoing a shortened clip rather than a moved one.
- ⚠️ **AND THE END OF A DRAG NO LONGER REDRAWS AT ALL.** Nothing needs it: the strip is painted in
  place throughout, labels included. A redraw there rebuilt the video, restarted the load, flickered,
  and re-ran the metadata handler — which is what got to reset the window in the first place. It now
  refreshes the two `aria-valuetext`s and puts the preview back to looping the chosen window.

⚠️⚠️ **THE WINDOW DRAG COMPOUNDED, AND ONLY DRIVING IT IN A BROWSER FOUND THAT.** The move handler
mutates `sl.inS`, so computing the new position from the live value applies the displacement once per
`pointermove` — a dozen times in one gesture. **Measured over CDP: a 70px nudge left (about 4.5 s)
walked the window from 9.23 s to 0 and pinned it there.** `in0` is captured at press time; a drag is a
displacement from where the finger went DOWN. After: 9.23 → **4.77**, exact.

⚠️ **THE WINDOW ITSELF IS NOW DRAGGABLE, and that is what he literally asked for.** Two handles can
express any window, but sliding a fifteen-second one later means dragging one end and letting the other
follow — which works, and which nobody thinks to try. Worse, a window SHORTER than the cap cannot be
moved by a handle at all: dragging an end only slides the other once the span is already at the cap.
`data-ctrim="w"` on `.club-win`, clamped as a PAIR (`inS` then `outS = inS + span`) so it slides to an
edge and stops rather than shrinking against it — a selection that changes length when you move it is
not a move.

⚠️ **THE HANDLES' HIT AREAS NOW GROW OUTWARD ONLY, AND SYMMETRICAL WAS WRONG THE MOMENT THE WINDOW
BECAME DRAGGABLE.** At `left: -15px; right: -15px` the two zones met in the middle of a short selection
and left no interior to grab — and a short selection is exactly the one a handle cannot move. Split per
side (`-30px` outward, `0` inward), each handle keeps its 14 + 30 = 44px and the whole visible interior
belongs to the move.

⚠️ **THE PREVIEW FOLLOWS THE END BEING DRAGGED** (`clubVidScrub`, paused not playing), because "move to
a different section" is a thing you do by LOOKING. Without it the runner picks a window blind and finds
out what is in it afterwards.

⚠️ **`med.play()` RETURNS A PROMISE AND A `try/catch` CANNOT SEE IT REJECT.** Seeking straight after
aborts the play request, so every scrub logged an uncaught rejection — harmless to the runner and a
console error all the same. Caught explicitly.

### The guard, and the two versions of it that could not fail

`test/club-trim.test.ts` drives the real `wireClubTrim` against a fake strip whose geometry is known,
so what is asserted is where the window ENDS UP. Both faults are arithmetic — one a missing flag, the
other a variable read one line too late — and neither is visible to a source grep.
⚠️ **THE DISCRIMINATING CLAIM IS THAT THE ANSWER DOES NOT DEPEND ON THE EVENT COUNT.** The compounding
bug is invisible at one `pointermove` and worst at fifty, so the test runs the same gesture at both and
requires the same landing place.
⚠️ **THE DRAG TARGETS ARE DERIVED FROM THE REAL MARKUP, AND A HAND-WRITTEN SET ESCAPED ITS RE-BREAK.**
With `["a","b","w"]` hardcoded, deleting `data-ctrim="w"` from `.club-win` left the harness still
offering a "w" node — so the window stopped being draggable in the app and every arithmetic test carried
on passing. It now calls `clubStripHtml` and pulls the attributes out of the output. A guard over a
collection is only as good as the collection.
⚠️ **AND THE ACCESSIBLE-NAME CLAIM HAD TO BE ADDED**: deleting the window's `aria-label` escaped
everything. Derived over every `data-ctrim` target, so the one added last cannot be the one missed.
⚠️ **`clubTrimMin` HAD TO BE LIFTED WITH THE CONSTANT IT READS** (`CLUB_TRIM_MIN_S`), or the lifted
function throws a `ReferenceError` and five guards fail for a reason that is not the code's.

⚠️ **THE BACKTICK RULE FIRED FOR THE TWELFTH TIME**, in my own comment, and the build failed outright —
which is the good outcome and the reason to read the exit code.

## THE COMPOSER IS THE REFERENCE'S POSTING EXPERIENCE (owner's screen recording, 2026-08-23)

*"the next sequence of screenshots is the process that you follow on instagram before posting a photo or
carousel. if you need clarification about what happens when in order for Instagram please ask….i want the
same user experience when posting to inte-run"* — eight screenshots: the tool row (Audio, Text, Overlay,
Filter, Edit, Ratio), the filter swatches, four screens of adjustment dials, and Portrait/Landscape/Square.
Suite 1256 → **1265**; 18 deliberate re-breaks, all 18 caught. Web-only, so it reaches his phone on the
next launch.

⚠️ **TWO THINGS IN IT WERE HIS DECISIONS AND WERE ASKED RATHER THAN ASSUMED.** *"Show it, marked as
coming"* for **Audio** — music over a post needs a licensed catalogue, which is a subscription and a
rights agreement, and the phone's own library cannot stand in because those tracks are DRM-locked to
their apps. And *"Now, in the same go"* for **Overlay**. Everything else is a straight replication.

### ⚠️⚠️ NOTHING IS RE-ENCODED, AND THAT IS THE WHOLE DESIGN

The original file is stored untouched and the look is **a name and a few numbers applied at display
time** — exactly the model the video trim already uses (two points, never a re-cut clip). Baking a
filter into pixels in a web view means decoding to a canvas and encoding back: slow on a phone, lossy,
and it destroys the original the runner may want back. So a filter can be changed or taken off a post
that is already up, and a future export still starts from the untouched photograph.
⚠️ **ONE BUILDER AND ONE APPLIER.** `clubLook(sl)` returns the three things that are applied by three
different mechanisms — a CSS filter list, an opacity on a radial overlay, and a rotation — and
`clubApplyLook(node, look)` is the only place any of them is set. The composer's preview, the grid tile,
the post feed and the full-screen viewer all go through it; two copies is the composer and the grid
disagreeing about one picture, which is the debrief hero's two-framings fault. A guard sweeps every
top-level function for a second `style.filter =` and requires the list to be empty.
⚠️ **THE LOOK TRAVELS TO A POSTED SURFACE AS ATTRIBUTES**, because the media element does not exist when
the builder runs — `clubFillMedia` creates it once the blob is out of IndexedDB. So the span carries what
to do and the one loader does it.

⚠️ **A ROTATED PICTURE HAS TO BE SCALED TO COVER, AND HOW MUCH DEPENDS ON THE BOX** — so it cannot be a
constant and cannot live in the stylesheet. Measured through the real function: the same 8° needed
**scale 1.1942 on the 4:5 stage, 1.1294 once the ratio became square, and 1.1758 on the 3:4 grid tile**.
That is why `clubApplyLook` measures the node instead of taking a style string.

⚠️⚠️ **THE DIAL SET IN THIS SECTION IS SUPERSEDED — HIGHLIGHTS AND SHADOWS WERE ADDED THE SAME DAY, and
the claim that they could not be done was WRONG. See the chapter below.** What shipped in this phase was
Lux, Brightness, Contrast, Saturation, Warmth, Fade, Vignette and Straighten; **Structure**, **Sharpen**
and **Tilt Shift** are still out, now with a measurement behind that rather than an assumption. A dial
that moves and changes nothing useful is worse than one that is not there.
⚠️ **WARMTH GOES BOTH WAYS AND THE TWO DIRECTIONS ARE DIFFERENT FUNCTIONS** — `sepia()` only warms, so a
one-armed dial does nothing on half its travel. Cooling is a hue rotation. Guarded in both directions.
⚠️ **LUX IS ONE DIAL DRIVING THREE**, which is what an auto-enhance is rather than a fake.
⚠️ **VIGNETTE IS ONE-WAY AND IS NOT A FILTER** — it comes back from `clubLook` separately because it is a
radial overlay, and a negative value is clamped to zero rather than inverting into a glow.

### ⚠️⚠️ CANCEL GENUINELY REVERTS, AND THE SNAPSHOT IS PER TOOL

A Cancel that only closes the sheet keeps every change the runner was trying out — worse than no Cancel
at all, because the word promises the opposite. `S.snap` is taken in `clubToolOpen` and holds **only what
that tool can touch**: cancelling the filter sheet cannot undo a crop made before it, and a snapshot of
the whole slide would take the crop with it. Driven rather than read — the snapshot is an object copy and
the restore a field-by-field assignment, neither visible in the source text — and both wrong versions
(no snapshot, and a whole-slide snapshot) were re-broken and caught.
⚠️ **`Done` CLEARS THE SNAPSHOT**, or a later Cancel on a different sheet reverts to it.

⚠️ **THE SHEET IS A FLEX SIBLING OF THE STAGE, NOT A PANEL OVER IT**, so the picture shrinks and stays
whole — measured, the stage goes 803 → 637px when a sheet opens. That is what the reference shows and it
is the point: you cannot judge a filter through the panel covering the half you are filtering.

⚠️ **THE TOOL ROW WRAPS, IT DOES NOT SCROLL.** Six tools do not fit one line on a small screen at the
largest text setting, and he ruled the same day that nothing may slide sideways — so it is the shape the
profile's times row uses. A scrolling tool row also hides tools behind a gesture nobody is told about.
⚠️ **TEXT MOVED INTO THE ROW** from a floating `Aa` in a corner rail, which is not where the reference
puts it and not where a runner looks. The rail now carries only the delete for a **selected** word.

⚠️⚠️ **THE ADJUSTMENT SLIDER DOES NOT REDRAW ON INPUT, AND THAT IS NOT AN OPTIMISATION.** `clubEdDraw`
rebuilds the whole editor, so redrawing per input event destroys the input the finger is holding — the
trap the Support search field needed its caret restored for, and the one that made the video trim snap
back to the start on every drag. It applies the look directly and redraws once, on `change`.

### THE OVERLAY, AND WHY IT IS SLIDERS RATHER THAN A PINCH

⚠️ **DRAGGING MOVES IT; SIZE AND ANGLE ARE SLIDERS.** A pinch on the stage already zooms the photograph
underneath, so making pinch mean "scale the overlay" too would be one gesture meaning two things
depending on what the finger landed on — the class of thing this app refuses (a tap edits a word and a
drag moves it precisely BECAUSE they are told apart). Sliders are also the only version a switch-control
or keyboard user can reach.
⚠️ **AN OVERLAY IS A PHOTOGRAPH, NEVER A VIDEO** — a second moving picture is a compositing problem this
app cannot export or keep in sync — and it is capped at four.
⚠️ **ITS BYTES LIVE AND DIE WITH THE POST.** Each overlay is its own blob written in the SAME
all-or-nothing pass as the slides', and `clubKeys` includes their keys, or deleting a post leaves them in
IndexedDB for ever — which the delete dialog promises will not happen.
⚠️ **AND THE OVERLAY'S OBJECT URLS ARE RELEASED WITH THE SLIDE'S.** Each is its own
`createObjectURL`; releasing only the slide's leaks a whole photograph per overlay for the session.

⚠️⚠️ **THE ZOOM GUARD CAUGHT A REAL DEFECT: `.club-ovim` HAD `touch-action: none` OF ITS OWN.**
touch-action is computed from the element AND its ancestors, so the editor's stage already covers dragging
an overlay — while on a POSTED surface the same declaration silently kills the scroll wherever an overlay
happens to lie, because the feed and the viewer are scrolled past. **Exactly what `.club-tx`'s own note
records, in a second place**, and `test/ios-input-zoom.test.ts`'s allowlist is what found it.
⚠️ **BUT `.club-ovim` DOES NEED COMPOUND SELECTORS.** Each posted surface has its own child-img rule at
specificity (0,1,1) setting `height: 100%` and `object-fit: cover`, which would stretch an overlay to fill
the whole picture. A bare single-class selector loses to those whatever the source order.

⚠️ **THE RATIO IS ON THE POST, NOT THE SLIDE** — a carousel is one shape you swipe through, so a per-slide
ratio would change the frame under the finger. `.cp-slide` falls back to **4:5**, which is what every post
made before the tool existed was composed at, so nothing already up moves.

### Traps this build paid for again

⚠️ **THE BACKTICK RULE FIRED THREE TIMES, ALL IN MY OWN CSS COMMENTS**, and one of them failed as
**`ReferenceError: img is not defined`** rather than a syntax error — the backticks closed the outer
template literal, so the CSS after them became live TypeScript. And in the same breath **`node --check`
and the design-system test both reported OK on the STALE build**, exactly as this file warns. Read the
build's exit code before trusting anything after it. Running total for this stretch: **fourteen**.
⚠️ **THE QUOTE-ESCAPING RULE FIRED ONCE** — `phone\'s` inside a single-quoted runtime string collapses to
a bare apostrophe and breaks it. A real typographic apostrophe needs no escaping at all and is what
shipped.
⚠️ **THE REGEX RULE FIRED ONCE** — `/^image\//` emitted as `/^image//`, which is a syntax error rather
than a silent mismatch this time. Sweep the EMITTED page.
⚠️⚠️ **AND `--r-sm` DOES NOT EXIST.** The ladder is `--r-card` / `--r-ctl` / `--r-pill` / `--r-hero`; I
used `--r-sm` in four places on the strength of a sentence **in this very file** that listed it. The
undeclared-token guard caught all four, and that sentence is now corrected — an undeclared custom
property invalidates the whole declaration in silence.

⚠️ **THREE EXISTING GUARDS WERE SCOPED TO MARKUP AND FAILED ON CORRECT CODE — all restated, none
deleted.** The Aa guard looked for a button id that moved into the tool row; the object-URL guard matched
the exact old release line; and the all-or-nothing guard matched `Promise.all(slides.map` where the puts
are now collected into an array so the overlays ride in the same pass. **That is four guards in two days
scoped to a place rather than to a fact** — the pattern to watch for.
⚠️ **AND A HAND-WRITTEN LIFT LIST WENT STALE AND FAILED LOUDLY** (`clubLookAttrs is not defined`, four
tests). That is the acceptable kind of stale. It now lifts `clubLook`, `clubFilterCss` and
`clubLookAttrs` for REAL rather than stubbing them, so the viewer's markup is proved to carry the look —
a stub returning "" would let the viewer stop carrying it with every assertion still passing.
⚠️ **`clubKeys` NOW CONTAINS THE OVERLAYS' KEYS, so two callers reading `clubKeys(p)[0]` as "the first
slide's media" became a coupling to the order they are pushed in.** Both now read `clubSlides(p)[0].media`,
which is what they mean.

**Driven end to end in a real browser** (430×932): six tools in one row, the sheet shrinking the stage,
Punch applied then **Cancel reverting it to nothing**, Mono kept by Done, Lux 60 stacking after the
filter, Vignette 0.7, Straighten 8° with its box-dependent scale, Square making the stage 430×430, the
Audio sheet with only Cancel and Done, an overlay placed and sized, a text committed, then **posted** —
the row carrying `ratio: "sq"`, `filter: "mono"`, `adj: {lux:60, vig:70, rot:8}`, one overlay and **two
media keys** — and the grid tile then rendering that same filter string, its own rotation scale, the
overlay and the vignette. **Zero console errors, page overflow 0 throughout.**

## ⚠️⚠️ HIGHLIGHTS AND SHADOWS ARE REAL TONE CURVES, AND "CSS CANNOT" WAS THE WRONG CLAIM (2026-08-23)

*"i want you to see if you can sort the highlights and shadows out....there must be a way"* — and he was
right. Suite 1265 → **1268**; 13 deliberate re-breaks, all 13 caught (one only after the harness was
fixed). Web-only, so it reaches his phone on the next launch.

⚠️⚠️ **THE MISTAKE WAS LUMPING A LOOKUP IN WITH A CONVOLUTION.** These two sliders are a tone curve
limited to part of the luminance range — no CSS filter *function* expresses that, which is what the
previous chapter said and it is true. But **SVG's `feComponentTransfer` with `type="table"` is exactly a
per-channel lookup table**, and `filter: url(#id)` composes into a CSS filter chain. A component transfer
reads one channel of one pixel; `feConvolveMatrix` (Sharpen, Structure) reads a pixel's *neighbours*.
Those are different costs and I had treated them as one. **"CSS cannot" is not the same claim as "the
platform cannot", and that is the transferable lesson.**

**Measured in a real browser before anything was built** — a greyscale ramp through a hand-written table,
read back from a screenshot: every sample landed **within one level of 255** of what the table asks for.
**Then measured again after**, on a 12-megapixel photograph, per frame while dragging the dial:

| filter chain | p50 | p95 | max |
|---|---|---|---|
| a plain CSS `brightness()` | 8 ms | 10 ms | 24 ms |
| **+ the tone curve** | **8 ms** | **9 ms** | **10 ms** |
| + a 3×3 convolution (Sharpen) | **17 ms** | 18 ms | 18 ms |

So the tone curve is **free** — indistinguishable from a CSS filter — and the convolution is **over the
16.7 ms frame budget**, in software rendering on a desktop. Structure, Sharpen and Tilt Shift are
therefore still out, but now with a number rather than an assertion. ⚠️ **That 17 ms is "would stutter",
not "impossible"** — if it is ever wanted anyway, that is a decision to take with the figure in hand.

### The curve, and the two things that bound it

⚠️ **BOTH ARMS OF BOTH DIALS COME FROM ONE WEIGHT ANCHORED AT ITS OWN END.** Shadows moves black and the
darks and fades to nothing by the mid; Highlights moves white and the lights and does the same. A raised
half-cosine gives zero slope at the anchor (no visible kink) and reaches zero at the far edge of its
window, **which is what keeps the two dials independent** — measured, Shadows at +100 leaves the top four
samples within 0.02 of the identity and Highlights at +100 leaves the bottom four.

⚠️⚠️ **THE STRENGTH IS BOUNDED BY MONOTONICITY, NOT BY TASTE.** A curve that folds back on itself inverts
tones and posterises. The steepest slope of this weight is `π/(2·W)`, so the move must satisfy
`k·π/(2·W) < 1`: at `W = 0.65` that is `k < 0.41`, and the shipped `k = 0.32` leaves the minimum slope at
0.226. **The guard checks the inequality rather than pinning the constants**, so either can be retuned as
long as the curve still cannot fold. The table is **also** forced monotone as a belt: measured **0 folds
and 0 out-of-range curves across all 1,681 quantised pairs**.

⚠️ **`color-interpolation-filters="sRGB"` IS NOT OPTIONAL.** SVG filters default to linearRGB, and the
same table then produces a washed-out result **that reads as a bad curve rather than a colour-space
mistake** — the hard kind of bug to find.

⚠️⚠️ **AN UNRESOLVABLE `url()` MEANS THE ELEMENT IS NOT RENDERED AT ALL — not unfiltered, ABSENT.** Three
consequences, all load-bearing: the def is created **before** the style that names it (guarded by
comparing the two positions in `clubApplyLook`); `clubToneUrl` re-checks the defs element on every call
rather than trusting a flag, because the defs live in the body and nothing guarantees a future render
leaves them there; and **nothing is ever evicted**, since dropping a def a picture still points at makes
that picture vanish. Quantising to fives is what bounds the count instead — measured, a 40-step drag
creates 39 defs of a few hundred bytes each, reused across every surface.

⚠️ **`clubLook` STAYS PURE AND RETURNS THE TONE AS TWO NUMBERS.** Minting an SVG def in there would give
it a DOM dependency, and it is driven as arithmetic by the tests. `clubApplyLook` resolves them — the same
division of labour the rotation already needed.

⚠️ **NEITHER DIAL IS ONE-WAY.** Recovering highlights and deepening shadows are the halves that matter
most, and a dial clamped at zero cannot reach them. Vignette is the only one-way dial there is.

**Measured on real composited pixels through the app's own applier** (input → output, 0–255):

| in | plain | Shadows +100 | Highlights −100 |
|---|---|---|---|
| 0 | 0 | **81** | 0 |
| 80 | 80 | 122 | 80 |
| 176 | 176 | **176** | 132 |
| 255 | 255 | **255** | **173** |

Shadows lifts black and leaves the top alone; Highlights pulls white down and leaves the bottom alone.
Posted, the row stored `adj: {hi: 100}` and the grid tile rendered `url("#ct100x0")` with the def
resolving.

### ⚠️ THE ESCAPE WAS MY OWN HARNESS SUPPLYING THE CONSTANTS

Twelve of thirteen re-breaks were caught first time. The one that escaped — shrinking the table from 17
samples to 8 — escaped because **the lift preamble typed `const CLUB_TONE_N = 17` in itself**, so the
lifted function ran against the TEST's constant and not the app's. `clubToneConsts()` now reads all four
out of the built page. **Same probe-supplies-its-own-table trap this file already records for the
engine's distance tables**, in a new place.
⚠️ **AND TWO HAND-WRITTEN LIFT LISTS WENT STALE AND FAILED LOUDLY** (`clubToneQ is not defined`, four
tests in one file and one in another) — the acceptable kind of stale, and the second time in two days.

### TWO FROM THE PHONE: THE JUMPING DIAL ROW, AND SWIPE RIGHT TO LEAVE THE FEED (2026-08-23)

*"everytime i click on an adjustment type when editing the picture, it jumps back to the start of the
list"* and *"when i click on a photo from the grid and it opens it up to allow me to scroll through all my
posts i want to be able to get back to the grid view by swiping right on the screen."* Suite 1268 →
**1270**; 10 deliberate re-breaks, all 10 caught. Web-only, so both reach his phone on the next launch.

⚠️⚠️ **A REDRAW REBUILDS A SCROLLER, AND A NEW SCROLLER STARTS AT ZERO.** `clubEdDraw` rebuilds the whole
editor, so picking a dial gave back a fresh `.club-dls` with `scrollLeft` 0 — which made the dials on the
RIGHT of the row **effectively untappable**, because tapping one scrolled the row away from it. The same
class as the Support search field's captured caret and the video trim snapping back to the start, in the
one place a new row had just been added.
⚠️ **DERIVED FROM THE SELECTION, NOT SAVED.** Restoring a remembered offset needs somewhere to keep it
and is wrong the moment the row's contents change width; scrolling the CHOSEN chip into view is correct
on every path — after a pick it brings the chip you tapped into sight, and after the slider settles the
selection has not moved so nothing moves either.
⚠️ **AND A CHIP ALREADY IN VIEW MUST NOT MOVE.** A row that re-centres on every redraw is its own
jumpiness, one step subtler than the fault being fixed. Guarded in both directions.
⚠️ **IT SETS `scrollLeft` ON THE ROW RATHER THAN CALLING `scrollIntoView`**, which would also scroll the
PAGE sideways — the one thing this app's oldest layout rule forbids, and the thing he ruled on the same
day.
⚠️ **THE FILTER AND OVERLAY ROWS HAD THE IDENTICAL FAULT** and he did not have to report them separately.
The guard **derives the covered rows from the stylesheet** — every `overflow-x: auto` row in the composer
must be named in a `clubRowKeep` call — so a fourth row added without one fails.

**Measured on the served build, picking each dial in turn:** `scrollLeft` walks 0 → 41 → 130 → 213 → 291
→ 380 with the chosen chip visible at every step, and stays put across the redraw that follows the slider
being let go. Before, every pick returned it to 0.

⚠️⚠️ **THE BACK SWIPE NEVER CALLS `preventDefault` AND NEVER TOUCHES `touch-action`,** so it cannot break
the two scrolls that screen already has: the page scrolls vertically and a carousel swipes sideways
exactly as before. It only READS where the finger went and acts once it has lifted. **A back-swipe that
claims the touch up front is how one kills the scrolling it sits on top of** — and this app has three
surfaces whose `touch-action` notes exist for that reason.
⚠️ **A CAROUSEL'S RAIL IS EXEMPT WHILE IT HAS SOMEWHERE TO GO.** Starting the finger on a post with
several pictures means "show me the next picture", not "leave"; on a single-picture post the rail cannot
scroll, so a swipe there is unambiguous and does go back. Both halves are guarded.
⚠️ **IT DEMANDS A CLEARLY HORIZONTAL, CLEARLY RIGHTWARD TRAVEL** — more than 64px across and more than
twice as far across as down. A loose test fires on the diagonal drift of an ordinary scroll and throws
the runner off the screen they were reading.
⚠️ **THE SWIPE AND THE CHEVRON GO TO THE SAME PLACE**, asserted as the same statement, or two ways back
mean two different backs.

**Measured on the served build:** a rightward swipe on a post leaves (`state.screen` null); a LEFTWARD
swipe, a 30px swipe, a 90×120 diagonal and a swipe on a two-picture carousel all stay on `clubpost`.

⚠️ **`node --check` CAUGHT A DUPLICATE `const`** — my new `ovr` collided with `wireClubTools`' own overlay
rotation slider in the same scope. Legal-looking, invisible to the build, and the reason that step is a
test rather than a documented manual one.

### ⚠️⚠️ THE STORY TRIM: A CLASS COLLISION AND A MAGIC OFFSET (owner, 2026-08-23)

*"There are issues when trying to edit a story (the 15 second slide bar looks messy on the corners and
the slide bar overlaps the edit tools"* — with a screenshot circling the tool row and both handle
corners. **Two separate faults and a third found on the way.** Suite 1270 → **1272**; 6 deliberate
re-breaks, all 6 caught. Web-only, so it reaches his phone on the next launch.

⚠️⚠️ **THE "MESSY CORNERS" WAS A CSS CLASS COLLISION, NOT A CORNER PROBLEM.** `.club-fr` has been the
filmstrip's frame cell since the trim was built; the composer's filter swatch row **reused that name**,
and being later in the stylesheet it gave **every frame of a story's fifteen-second strip**
`display: flex` and 12px of side padding. Measured, all eight frames read `flex/12px` where they should
read `block/0px`. **A class that means two things is legal CSS** — the build, the typecheck and 1270
tests all passed. Renamed to `.club-fsr`.
⚠️ **THE GUARD IS A RATCHET, NOT A BAN.** Seventeen single-class rules in this stylesheet are
legitimately declared twice (a base plus a scoped override), so a blanket rule would need an allowlist
that goes stale. `CSS_DUP_CEILING = 17` is what must never grow — the same shape as the radius and
font-size ratchets — **plus the pair that actually bit is named**, so a rename back cannot slip under it.

⚠️⚠️ **THE OVERLAP WAS A MAGIC OFFSET THAT STOPPED CLEARING THE CHROME.** `.club-trim` was
`position: absolute; bottom: 118px`, which cleared the chrome exactly while the chrome was one row of
buttons — and the moment the tool row and the tool sheets went in below it, the strip was drawn straight
over them. It is a **flex child** now, so it cannot overlap whatever is beneath it however much is added
later. **That is the point: a number that has to be updated whenever the chrome changes is a number
somebody forgets.** Guarded by asserting it is not absolutely positioned, has no bottom offset, carries
`flex: none`, and is emitted before the sheet and the tool row.

⚠️ **AND THE HANDLE RADIUS WAS GENUINELY OUT OF PHASE — the third fault, the other half of what he
circled.** The selection window is a 2px white border with radius `--r-ctl`, so the curve a handle has to
continue is the border's INNER one: `calc(var(--r-ctl) - 2px)`. At a flat 12px the two white shapes met
slightly off, leaving a lumpy notch at each top corner. The guard **derives** the border width from the
window's own rule rather than pinning 10px, so retuning `--r-ctl` cannot reintroduce it.

**Measured after, at 430×932 and 320×568, text scale 1.0 and 1.3, sheet closed and open:** trim/tools
overlap **0** and trim/foot overlap **0** in every combination; the eight film frames read `block/0px`;
handle radius 10px against the window's 12px; both handles inside the strip; page overflow 0; no console
errors.

⚠️ **ONE OF MY OWN GUARDS WENT STALE FROM MY OWN RENAME AN HOUR LATER** — the row-keep sweep named
`club-fr` in its derived list. Correct to update, but it is the fifth guard in three days whose scope was
a NAME rather than a fact.

### THE COMPOSER SWEPT FOR NAME CLASHES, AND THE TRIM'S CORNERS FIXED PROPERLY (2026-08-23)

*"can you check the whole composer for any other name clashes"* after the `.club-fr` bite, then *"the
corners of the slide bar still look untidy"* — the third report on those corners. Suite 1272 → **1274**;
10 deliberate re-breaks, all 10 caught (one apparent escape was my re-break naming the wrong test).

### The sweep: six kinds of clash, checked across 22 composer functions

`/tmp/clash.mjs` and `/tmp/clash2.mjs` (throwaway, but the durable half is in the guards below).

| checked | result |
|---|---|
| CSS classes shared with a non-composer builder | 8, **all deliberate** (`.club-stage`/`.club-fit`/`.club-txs`/`.club-x` are the viewer reusing the editor's shell; `.club-tx`/`.club-vig`/`.club-ovim` are shared components; `.num` is the tabular-figures utility) |
| club/cm/cp classes declared twice in the stylesheet | **none** |
| `data-*` names shared | 6, **all the composer writing and `clubFillMedia` reading** — the design |
| ids shared with anything else | **none** |
| ids the composer emits from two of its own builders | **none** |
| custom properties shared | 1, `--car`, same meaning both places |
| **classes the composer emits with NO rule at all** | **1 — `.club-fs-l`** |
| `data-*` written and never read | **none** |
| `dataset` read with nothing writing it | **none** |
| `$("id")` looked up but never rendered | **none** |

⚠️ **`.club-fs-l` WAS THE ONE REAL FIND — the invented-class trap in miniature.** The filter swatch's
label inherited the swatch's type, so the class did nothing at all. **Given a real rule rather than
deleted**, because it needed one: a filter named longer than the 76px swatch would wrap onto a second
line and push that one swatch taller than its neighbours, which is a ragged row.

### ⚠️⚠️ THE CORNERS WERE TWO FAULTS, AND MY FIRST TWO ATTEMPTS EACH FIXED ONLY ONE

⚠️ **THE FIRST ATTEMPT (matching the handle's radius to the border's inner curve) WAS RIGHT ARITHMETIC AND
STILL LEFT A SEAM.** Two white shapes with coincident curves anti-alias twice: magnified 24× there is an
unmistakable hairline arc inside every corner, and at 1× it reads as a ragged double edge. **The bracket
is one shape now** — the white comes entirely from `.club-win`'s border, whose left and right sides are
handle-width, and `.club-h` is a transparent grab area sitting over it carrying only the grip line.
⚠️ **THREE NUMBERS MUST AGREE AND THE GUARD SAYS SO**: the border's side width, the handle's width, and
the handle's negative offset. The handle is positioned against the padding box, which the border has
already inset — if they drift, the grab area sits off the white it is meant to be on.

⚠️⚠️ **AND THE REAL "UNTIDY CORNERS" WAS THE DIMMING, NOT THE BRACKET.** The strip outside the selection
was dimmed by **two square rectangles** while the bracket is rounded — so at each of the four corners a
sliver of BRIGHT, undimmed video sat inside the window's box but outside its curve: **four pale pips
against a dark strip**, which is exactly what he circled three times. It is now the selection's **own
outer box-shadow**, so the dark follows the curve *by construction* rather than by an arithmetic
coincidence a change of border width would undo. **Measured from rendered pixels: all four corners read
luma 13–58 against the dimmed strip's 61 and the selection's 154** (they would read ~154 before).
⚠️ **THE TWO `.club-shade` SPANS AND THEIR RULE ARE DELETED, NOT LEFT UNUSED**, and `clubTrimPaint` no
longer positions anything but the window — two rectangles that had to be moved in step with the selection
were two more things to keep in step.
⚠️ **500px OF SPREAD COVERS THE STRIP FROM ANY POSITION** and `.club-film`'s overflow clips it.

⚠️⚠️ **MY OWN DUPLICATE-CLASS RATCHET CAUGHT ME WITHIN THE HOUR OF WRITING IT.** I added the box-shadow as
a *second* `.club-win` rule; `CSS_DUP_CEILING` went 17 → 18 and failed. Merged into the one rule. That is
the ratchet doing exactly the job it was built for, on the person who built it.

⚠️ **TWO MORE GUARDS WERE SCOPED TO A MECHANISM RATHER THAN A FACT.** "The time outside the window is
dimmed" matched `club-shade` twice, and the corner guard asserted the handle's radius equalled the
border's inner curve — both failed on the fix. Restated: the outside must be dimmed *somehow* (now the
shadow), and the handle must carry **no** radius. **That is the fourth and fifth guard in three days
scoped to a HOW instead of a WHAT** — the pattern to watch for in this file.

⚠️ **THE NARROWEST SELECTION IS GRACEFUL AND WAS MEASURED**: at a one-second window the box renders 28px
wide with both 14px white ends intact, both handles inside it and the whole thing inside the strip — it
simply cannot be narrower than its own two ends, which is right.

⚠️ **A PROBE THAT NEEDS A DECODER IS A PROBE WITH A SECOND THING THAT CAN FAIL.** Driving a real webm
through MediaRecorder worked once and then produced an unloadable clip, and the probe reported "no
window rendered" — which reads like a defect in the app. The corner geometry is pure markup from
`clubStripHtml`, so the probe now fakes a clip on a photo slide (`isVid`, `dur`, `thumbs`) and needs no
video at all.

## THE TEXT OVERLAY FIXED, A PLAYHEAD, AND A STORY KEPT BEHIND A JOURNAL (2026-08-23/24)

Three reports and two instructions. Suite 1272 → **1284**; 30 deliberate re-breaks, 28 caught first
time and the two escapes were real guard weaknesses (below). Web-only, so all of it reaches his phone on
the next launch.

⚠️⚠️ **THIS PARAGRAPH USED TO SAY THE NODE TOOLCHAIN HAD VANISHED FROM THIS MAC. IT HAD NOT, AND THE
CLAIM WAS THEN REPEATED FOR TWO DAYS — CORRECTED 2026-08-24, and again here at the source rather than
only at the repetition.** `~/.local/node/bin` is a symlink to `node-v24.18.0-darwin-arm64` and **is on
the default PATH**: `which node` resolves and `node --version` answers v24.18.0. Nothing about node is
broken and no PATH export is needed. What is genuinely missing is Xcode's **iOS platform component** —
see the toolchain notes further down. **Check `which node` before writing a claim like this down**, and
correct a wrong one where it was INTRODUCED as well as where it was repeated: a reader believes whichever
copy they reach first, which is the same fault as the release-gate miscount this file records fixing in
one place and leaving stale in another.

### ⚠️⚠️ "IT JUMPS AROUND" WAS THE TEXT RE-WRAPPING UNDER THE FINGER

An absolutely positioned box's available width is its containing block **minus its own `left` offset** —
so dragging a caption to the right squeezed the space left for it and it reflowed at every `pointermove`.
Measured on a two-line caption dragged 80px right and 150px down: **215×82 and two lines became 135×160
and FOUR**, changing at every step. After: **361×82 and two lines, identical at every step of two drags.**
⚠️ **`width: max-content` IS THE WHOLE FIX** — it takes the available width out of the calculation, and
`max-width` (a percentage of the stage, which `left` does not touch) still decides where it wraps.
⚠️ **THE DASHED OUTLINE IS GONE** — his "weird dotted lines on the top and bottom". The bin appearing in
the rail is what says a word is selected; a dashed box as well is the same thing said twice, and on a
three-line caption it reads as part of the picture.
⚠️ **"WONT SCALE UP OR DOWN" WAS NOT A BUG, IT WAS ABSENT.** The stage's own pinch bails out on a touch
that starts on a word, so nothing handled two fingers there. Measured through the real handler: a spread
took the size 34 → 70 and the rotation 0 → 14°. The pointers are tracked on the WORD, so a pinch that
starts on a word cannot also zoom the picture underneath.
⚠️ **THE PINCH BASELINE IS RE-TAKEN WHEN THE SECOND FINGER LANDS**, or it jumps by however far the first
finger had already dragged — the same re-anchoring the stage's own pinch needs.

### THE TEXT STYLING FROM HIS SCREENSHOTS 2-10

Six named styles, three pages of ten colours, a highlight plate, alignment and a neon glow — five tools,
one rail at a time, which is the reference's own shape.
⚠️ **ONE FUNCTION BUILDS THE LOOK AND BOTH THE PREVIEW AND THE RESULT ASK IT** (`clubTxCss`). The editor's
box and the word on the picture are different elements, so two copies would let the runner style one thing
and post another. Driven end to end: the committed word's weight, case, colour, alignment and glow all
match what the preview showed.
⚠️ **THE PLATE COMPUTES ITS OWN INK** from relative luminance, so a white plate gets black words and a
black plate white ones — **his screenshots 3 and 4 both fall out of ONE state** rather than needing two.
Measured: `#ffffff`→dark, `#0a0a0a`→light, `#ffd60a`→dark, `#0a3d62`→light, a token or a missing colour
falls back to white rather than throwing.
⚠️ **THE PLATE AND THE GLOW BOTH REPLACE THE KEYLINE RATHER THAN ADDING TO IT.** A dark halo round black
words on a white plate is dirt; a deep outline under a glow is a dark line inside a halo. They are the
same CSS property, so an effect that only appended would fight it.
⚠️ **SYSTEM STACKS, NOT WEBFONTS.** This app ships with no external network assets, so a named style is a
family stack plus a weight, a case and a tracking. The reference's display faces cannot be reproduced and
are not pretended at — and a guard asserts the six looks are genuinely distinct declarations, because six
pills that render the same is a choice you cannot see.
⚠️ **WHAT IS NAMED RATHER THAN OFFERED:** the animations (Typewriter, Pop, Jump) play on the finished
story rather than in the editor, so they are their own piece; Sparkle, Shimmer and Pixel need an animation
or a display face; Mention needs accounts and a server. The fx rail says so in a sentence.
⚠️ **A WORD STORED BEFORE THE STYLES EXISTED CARRIES A `font` AND NO `style`** and must still look like
itself, so the old family is honoured when there is no named style to resolve.

### THE PLAYHEAD (his own diagram)

⚠️ **A FRAME LOOP, NOT `timeupdate`** — which fires about four times a second, and a marker moving in four
visible steps reads as broken rather than as a playhead.
⚠️ **IT CANCELS ITSELF** rather than being cleared from somewhere else: every frame it checks the editor is
still open, on this slide, with this element. A loop cancelled by its caller is a loop that keeps running
behind a closed sheet, which this app has paid for twice.
⚠️ **HIDDEN WHILE PAUSED OR OUTSIDE THE CHOSEN WINDOW**, and `pointer-events: none` above the bracket —
over a handle it would otherwise swallow that handle's drag. Measured: 0% hidden, 20% / 45% / 70% shown
across the window, 86.7% hidden, hidden while paused, gone after the editor closes.

### ⚠️⚠️ A STORY KEPT BEHIND A PLAN JOURNAL — AND THE SWEEP WOULD HAVE EATEN IT

His instruction: *"the individual story theyre on can be added to the plan journal ... if the user has
more than one journal on their profile, they're given the option to choose which one to add it to"*.

⚠️⚠️ **THE JOURNAL KEEPS A SNAPSHOT OF THE ROW, NOT A REFERENCE, AND THAT IS THE WHOLE POINT.** A story is
swept 24 hours after posting and its blobs go with it — a journal holding only the post's id would show a
hatched cell the next morning, which is worse than not offering this at all.
⚠️ **AND THE BYTES ARE SHARED, NOT DUPLICATED.** Copying a fifteen-second video into a second IndexedDB
entry doubles it for nothing. What makes that safe is `clubMediaInUse`: **nothing deletes a blob a journal
still points at**, and both deleters ask it.
⚠️ **THE ROWS ARE SAVED BEFORE THE BLOB SWEEP** — asked first, the in-use check still sees the story on its
way out and concludes its own bytes are wanted, so nothing is ever collected. An ORDERING claim.
⚠️ **MEASURED AGAINST IndexedDB ITSELF, NOT `clubUrl`.** My first probe asked `clubUrl`, which **caches its
object URLs** — so it answered "the blob is there" for a blob that had been deleted, and both halves of the
headline claim were unproven. Re-measured through `clubMediaGet`: with the story expired and swept the
kept copy's blob **is still in the store**; remove the kept copy and it **is gone**. Ask the store.
⚠️ **A KEPT COPY MUST BE REMOVABLE**, or a kept video is in IndexedDB for ever with no way for the runner
to clear it — the sweep cannot touch it, which is the point, and nothing else would.
⚠️ **THE CHOOSER IS ITS OWN OVERLAY AT z-index 98**, above the viewer's 96. The app's bottom sheet is 70,
so a chooser drawn there would open BEHIND the story it is asking about — the z-order fault this file
records shipping twice. Measured: 98 vs 96, `aria-modal`, focus on Cancel.
⚠️ **ONE JOURNAL KEEPS IT STRAIGHT AWAY; NONE SAYS WHY.** A journal exists once a plan does, so somebody
with no plan has nowhere to put it and is told that rather than watching nothing happen.

### The delete button

⚠️ **THE EXPLANATION IS GONE** — his instruction: *"This needs to be a more obvious delete button and
there's no need for the explanation underneath."* A paragraph about features that do not exist yet, in a
menu whose whole job is one destructive action, buried the action itself. Two icon-and-word buttons now.
⚠️ **THE "NAMES WHAT DOES NOT EXIST" GUARD WAS RESTATED, NOT RELAXED.** It asserted the menu offers ONLY
delete; the menu may offer anything that WORKS, and the three that need a shared feed (commenting, likes,
who can see this) are forbidden by name instead.

### ⚠️⚠️ TWO GUARD WEAKNESSES THE RE-BREAKS FOUND, AND ONE IS GENERAL

1. **`indexOf(a) < indexOf(b)` PASSES WHEN `a` IS ABSENT.** `indexOf` returns −1 for a missing needle, and
   −1 is less than any real index — so deleting the `clubSave` call outright SATISFIED an ordering guard
   written that way. **An ordering check must first assert both halves exist.** Two such guards fixed.
2. **A MENTION IS NOT THE THING.** "The editor's preview is styled by `clubTxCss`" was satisfied by the
   size slider also calling it, so the preview could be styled by hand with the guard green. Pinned to the
   textarea's own `style` attribute.

⚠️ **AND `test/community.test.ts` NEEDED MEMOISING BEFORE IT WOULD FINISH AT ALL.** The built page is
~13 MB and that file asks for it a hundred times; adding two `appBlock()` calls to one test pushed the
file past a seven-minute timeout and then got it killed outright. `page()`, `appBlock()` and a new
`noApp()` are cached — the content cannot change while the suite runs, so reading it once is both faster
and more honest than reading it repeatedly and hoping.
⚠️ **A CALLER-COUNT CEILING IS NOT AN INVARIANT.** `clubFillMedia` had a "2 to 4 callers" guard which the
journal's kept strip broke at six. Restated to what it was protecting: **no function may fill a
`data-cmed` span itself**, derived over every top-level function.
