# The share studio (part 2) — outputs, destinations, the fade

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> Part 1 is notes/share-studio.md.

### THE TRANSPARENT STICKER — A FOURTH OUTPUT, FROM THE OWNER'S OWN RESEARCH (2026-08-19)

He researched the reference app and reported it offers three outputs, not two: *"Card Only (Transparent):
Saves your metrics card without any background so you can overlay it manually as a sticker."* Under his
standing instruction — *"I want to at least match what they do in terms of UI and UX. I'm not settling for
worse"* — that is an **addition to the pack rather than a departure from it**: a third output of the same
four templates, so it costs the contract nothing. Suite 955 → **969**; 38 deliberate re-breaks, 34 caught
first time, and all four misses were informative.

**It is a fourth chip in the SAME row as Story, Feed and Square** ("Sticker PNG"), which is exactly where
the reference puts it. A screen of its own would be a second place the output is decided, with the preview
underneath able to disagree with it. Measured through the real editor: chip → chequer on → note filled →
canvas 1020×1044 → `prepareShareCard` hands back `InteRun-2026-08-17-Easy-run-6.31km.png`, `image/png`,
282 KB, zero console errors, no horizontal page scroll at 375×812 in both themes.

⚠️⚠️ **THE SCRIM MUST NOT BE BAKED IN, AND THE APP'S OWN SAMPLER MAKES THAT A LIVE DEFECT ONE GATE AWAY.**
`shareGroundUnder` answers **white** when it cannot look — right for a photograph we have but cannot sample
(fail towards protecting the type) and catastrophic where there is no photograph at all: solved from 255 the
alpha comes back near its 0.92 cap and the export carries a near-opaque dark gradient over its lower half,
on genuine alpha, to be dropped onto somebody's own picture. **`probe === null` is the sticker;
`probe.data === null` is the tainted card**, and the two must not share an answer. Gated inside
`sharePhotoScrim` and `shareTopScrim` rather than at the call sites, because all four templates draw with no
photograph here. **Measured against a control** — the same card with a scrim deliberately painted on:
translucent-dark share **4.9–15.2% against the control's 56.6%**, and the widest full-width translucent-dark
band **0–9 rows against 677**. The 9 rows are The Execution's target-band lane and the 6 are The
Progression's ladder track, both designed marks.

⚠️ **THE NAIVE VERSION LEAVES A VOID IN THE MIDDLE, NOT A MARGIN ROUND THE EDGE.** Drawing the story layout
on alpha pins the wordmark to the top and the block to the bottom with the photograph's space between them:
measured before the fix, the wordmark ends at y120, the block starts at y560 and **46% of the bounding box
is nothing at all**. So the height is **derived from the block the template plans** and the result is then
trimmed to its own alpha bounding box. Both, deliberately: the derivation removes the void, the trim proves
the claim from pixels rather than arguing it from arithmetic.

⚠️ **ONE PASS, AND IT IS ONE PASS ONLY BECAUSE TWO PLANS WERE MADE CANVAS-INDEPENDENT.** Every template
builds bottom-up from `safe.y1`, so the height below the block top is the same at any canvas — except that
The Execution's verdict room and The Progression's ladder pitch were budgets measured **from the canvas**,
because both exist to protect the photograph. A sticker has no photograph and its height is free, so both
are unbounded there. Without that the derivation spirals: a smaller canvas gives less room, less room
shrinks the headline, and the verdict settles at its floor looking like somebody's design decision.
⚠️ **AND THE GUARD FOR IT MISSED BOTH DEFECTS ON THE FIRST ATTEMPT.** It swept 700/1080/1350/1920 — every
one of them roomy enough for the verdict to take its top rung — so reverting either read left it green. The
binding height is **the one the sticker comes out at** (751px for The Execution), which is now in the sweep
along with two smaller points. **A sweep whose points are all on the comfortable side of a constraint cannot
see the constraint.**

⚠️ **THE TYPE'S OWN TREATMENT IS A KEYLINE, NEVER A PLATE — AND IT IS COMPOSITED UNDERNEATH.** A plate is a
scrim by another name. This is the device `shareRouteDraw` and the chart's marks have always used: a deep
ink outline, so a glyph is defined by an edge rather than by contrast with a ground nobody can measure.
`destination-over` is load-bearing: every letter-spaced run and every figure on these cards is drawn one
character at a time, so a keyline stroked OVER the canvas would be drawn after the previous character's fill
and would eat into its right-hand edge.
⚠️ **THE THREE LAYERS GO GLYPH, KEYLINE, HALO, AND THE OBVIOUS ORDER COST THE KEYLINE A THIRD OF ITS
STRENGTH.** Written as "fill with the ambient shadow, then stroke underneath", the halo is painted before
the keyline and the keyline lands under it — at halo alpha 0.45 only 0.55 of it survives. **The sign was
that strengthening the halo made things WORSE** (0.45 → 0.75 took the small type's edge contrast 5.45 →
4.69), which is what a pair of fighting effects looks like. Now the fill carries no shadow and the keyline
stroke carries it, so the halo ends up beneath the keyline.
⚠️ **THE HALO HAS A MEASURED INTERIOR OPTIMUM**: 0.22/6 → 4.74, 0.32/7 → 5.16, **0.45/9 → 5.54**, 0.60/11 →
5.09, 0.75/13 → 4.94. "Stronger is safer" would have shipped the worse end of it. The translucent share
rises monotonically with it (3.9% → 8.0%), so the light end is also the end least like a plate.

**LEGIBILITY, FROM RENDERED PIXELS, 31 ELEMENTS × 2 GROUNDS.** Over **black** every tier stands on its own:
**7.12:1 (the poster's faint meta line) to 21.0:1**. Over **white** warm-white type is 1.00:1 against its
ground *by construction* — which is why the honest measurement is the glyph core against its own keyline:
**3.60:1 to 15.62:1, median 14.88**. The weakest is the poster's `inkFaint` meta line at its smallest rung
(2.95:1 against the raw white, 3.60:1 against its keyline) and it is reported rather than hidden. Composited
onto three scenes and looked at, mean edge contrast: bright **6.50–7.77**, dark **9.03–10.10**, busy
**7.73–9.04**.
⚠️ **THE "WORST PIXEL" FORM OF THAT METRIC IS AN ANTI-ALIASING ARTEFACT AND MUST NOT BE QUOTED AS A
VERDICT.** Its first version took every opaque pixel and looked 6px out, which lands inside the same glyph
for anything bigger than a caption — 1.00:1 on all twelve composites, reading as catastrophic failure of a
card that plainly reads. Restricted to edge pixels it still bottoms out at 1.00 where two adjacent ink
elements meet. **The mean is the meaningful figure; the per-element table is the load-bearing one.**

⚠️ **PNG, AND THE EXTENSION COMES OUT OF THE SAME FUNCTION AS THE MIME TYPE.** JPEG has no alpha channel at
all, so a JPEG "transparent" export is a silent white rectangle — correct dimensions, correct filename,
correct-looking preview. `shareExportSpec(m)` decides mime, quality and extension together;
`canvasToShareFile` takes them from it, with the name's own `.png` as the belt. Verified from the IHDR:
**8-bit, colour type 6 (truecolour with alpha)** on all four, and no `tEXt`/`iTXt`/`zTXt`/`eXIf` chunk.

⚠️ **IT NEEDS NO PHOTOGRAPH, WHICH MAKES IT THE ONE OUTPUT EVERY RUN CAN HAVE — and the photograph gate was
BACKWARDS here, not merely unnecessary.** The three photo templates are gated because their composition IS
the picture; strip the picture and what is left is the data card, which is what a sticker is for. Written
without the relaxation, choosing Sticker leaves only The Route Poster eligible and a treadmill run has no
sticker at all. Every OTHER reason still applies: an interval session's Execution is refused whatever shape
it is exported at. And `shareCardModel` hands a sticker **no photograph even when one is supplied**, because
three things downstream are gated on `m.photo`.

⚠️ **THE ROUTE NEEDS A RESERVED BAND OR IT SIMPLY DISAPPEARS.** `shareRoutePlacement` scores candidates
between the top of the safe region and the top of the block, and on a sticker those are **36px apart by
construction** — so every candidate is refused and the switch reading "show my route" would be on over a
card with no route on it. `shareStickerField` is the ONE definition of that band, read by the height
derivation and by the card that draws into it. Two derivations is how the reserved space and the drawn route
come to differ by a few pixels, which presents as a route clipped along one edge for no reason.

⚠️ **THE TWO BAND HEIGHTS AND THE KEYLINE WIDTH WERE SWEPT AND THEN LOOKED AT.** Bands 520/700, 380/620,
320/560: the numbers barely move (transparent share 86.6 / 85.5 / 84.8%, no type size changes anywhere), so
it is air against nothing measurable — **at 520 the route sits marooned above the block** (the pack's own
"route stranded in excessive empty space"), at 320 The Moment's route is smaller than its own hero.
**380/620.** Keyline 0.10/2 → mean 13.85, 0.13/3 → 14.12, 0.16/4 → 14.40 — a real but small gain, and by
0.16/4 the counters of the small split times close up. **0.13/3**, and the FLOOR matters more than the
fraction because it is the 19px footer that has least outline to work with.

⚠️ **THE STICKER IS THE SQUARE'S LAYOUT FAMILY, NAMED ONCE.** `shareAspectFamily` is a lookup rather than
seven two-armed comparisons: seven is seven chances for the eighth reader to be written without the second
half, and the failure is silent — a sticker drawn at the story's type ladder simply comes out enormous. The
guard is **derived from the five square-family tables**, so a sixth cannot arrive unguarded.

⚠️ **`cardGeom("sticker")` THROWS WITHOUT A MODEL.** Its size is a function of what is on it, so a caller
that forgets would otherwise get the nominal 1080 — a card drawn at one height into a buffer sized for
another, which reads as content cut off the bottom and points at the renderer rather than the caller. Three
call sites had to learn it: `shareCardCanvas`, `studioPaintSlide` and `studioMount`, the last of which needs
a **per-slide** geometry because a sticker's four templates are four different shapes.

⚠️ **THE OUTPUT SIZE IS NOT THE LAYOUT SIZE, AND ONLY THE STICKER SEPARATES THEM.** `gm.OW/OH/ox/oy` are
`W/H/0/0` for the other three by construction, so every canvas-sizing site reads correctly for all four
without a branch to forget; the trim is applied as a **translation**, so every template still lays out in
the same 1080-wide space. A renderer that reflowed for a cropped box would be two layouts, which is the
two-disagreeing-transforms fault that stretched the debrief hero.

⚠️ **THE TRANSPARENCY CHEQUER IS A CSS BACKGROUND ON THE CANVAS ELEMENT.** An element's background is
painted behind its bitmap and is not part of it — `toBlob` is handed the bitmap alone — so the pack's rule
that no editor chrome appears in an export is kept by construction. A pseudo-element on the slide would also
never reach the export but would be the wrong SIZE: the canvas is centred in its slide and is usually
narrower.

⚠️ **THE TRIM'S PADDING WAS DOUBLE-COUNTED AND THE GUARD CAUGHT IT.** A hit at probe row *n* means real ink
in `[n·e, (n+1)·e)`, so floor and ceil already bracket it — expanding by a cell as well left **33px of empty
margin on a sticker whose stated padding is 24**. Ink faint enough to be missed at a sixth scale is what the
padding is for; a second allowance protects against nothing.

**Produced, measured:** The Moment **1020×1044** (83.5% fully transparent), The Execution **1020×720**
(64.0%), The Progression **1020×730** (64.9%), The Route Poster **1014×1188** (87.1%); 240–344 KB. Every
privacy state changes the picture: ends shown 61 route points → ends hidden 46 → route hidden 0, and Hide
location and Hide date each move the bytes on their own.

⚠️ **THREE MISSES IN THE RE-BREAK RUN WERE MINE, NOT THE GUARDS'.** Two were the invariance sweep above; the
third aimed a break at the wrong test file. The fourth was a claim a hash cannot make: **rewiring the
progression branch to `shareMomentCard` left all four sticker hashes different**, because the two templates
are handed different models, so the result is a different *wrong* picture rather than a duplicate. Exactly
the trap this file already records for the dispatch — the one-to-one mapping is asserted where it lives, and
the four-different-pictures line now says out loud that it is a sanity check and not that.

⚠️ **AND THE BACKTICK RULE FIRED, PLUS THE COMMENT-QUOTING-A-FORBIDDEN-STRING TRAP.** A comment containing
backticks failed the build outright (the good outcome). Then a comment explaining why the shadow is switched
off with the `transparent` keyword **quoted the zero-alpha colour function it exists to avoid**, and the
palette sweep flagged the sentence rather than the code. Fifth firing.

**Still open, and not mine to close:** saving straight to Photos still needs `NSPhotoLibraryAddUsageDescription`
and an Xcode build, so a sticker reaches the camera roll through the system share sheet for now. The Road Map
step `pc-share` therefore stays **unticked**; `pc-sticker` is ticked.

### THE STICKER, VERIFIED INDEPENDENTLY (2026-08-20) — AND ONE FINDING THE BUILD DID NOT REPORT

Re-measured without reusing the build's numbers: my own PNG decoder (stdlib zlib + all five scanline
filter reconstructions) and JPEG SOF/APPn/EXIF walker, my own connected-component legibility method,
and a live drive of the real editor. **969/969, 0 fail**; build exit 0, `docs/voices/` clean,
`node --check` OK on all three emitted blocks, tsc clean apart from the one pre-existing
`test/onboarding-wizard.test.ts` Date error.

⚠️⚠️ **THE DECISIVE CHECK IS THAT THE 48 PRE-EXISTING EXPORTS ARE BYTE-FOR-BYTE IDENTICAL.** Captured
the same 48 photo cards from the pre-sticker tree (`git stash`, rebuild, capture, restore) and from
this one and compared sha256: **48 of 48 identical, 0 changed.** That is a stronger statement than any
re-measured floor, because the gradient scrim, the whole-photo default and the Fill crop are all baked
into those bytes — if any had moved, a hash would have moved. ⚠️ **The pre-sticker tree has no
`shareExportSpec`**, so a probe spanning both trees must call whichever contract the tree it is
measuring actually has; a single-contract probe throws on one side and reads as a defect.

**Re-derived from the artefacts, my parsers:** 16 story **1080×1920**, 16 feed **1080×1350**, 16 square
**1080×1080**, every one from its own SOF header; all 48 carry an ICC whose description is literally
`sRGB`; **zero APP1/EXIF/GPS in any of the 48**, from a source photograph my parser confirms carries a
GPS IFD. Four stickers **1020×1044 / 1020×720 / 1020×730 / 1014×1188**, PNG **bit depth 8, colour type
6**, every CRC valid, **no `tEXt`/`iTXt`/`zTXt`/`eXIf`**, trim margins 21–25px against a stated pad of
24. Fully transparent (alpha exactly 0): **82.6 / 61.9 / 62.6 / 86.3%**.
⚠️ **THOSE ARE A POINT OR TWO UNDER THE BUILD'S 83.5 / 64.0 / 64.9 / 87.1% AND NEITHER IS WRONG** — mine
counts alpha **exactly** 0, the build's counts a near-zero threshold, and the gap is the outermost ring
of the glyph halo. Any "transparent share" figure in this section is metric-dependent, so quote it with
its definition or not at all; the claim that carries weight is the **coverage** measurement below.

⚠️ **AND THE ALPHA-CLAMP HEADROOM IS NOT GUARDED BY ANY TEST AS A NUMBER — it had to be re-derived, and
it comes out at exactly 0.0200** (hungriest tiers on a pure-white photograph solve to **0.9000** against
`SHARE_SCRIM.max` 0.92). Every text tier clears 4.5 on a 432-case sweep (8 hostile grounds × 3 aspects ×
6 tiers × 3 block positions): worst text tier **4.87**, consistent with the recorded 4.93/4.98 floors
measured a different way. `fast`/`slow` are marks with a 3.2 target and deliver 3.51/3.47.
⚠️ **MY FIRST RUN OF THAT PROBE REPORTED ZERO HEADROOM AND IT WAS THE PROBE.** `shareVeilPlan`'s
`colours` is an array of `{hex, target}` OBJECTS; I passed bare hex strings, so it read `undefined` for
both fields and returned the cap for all 288 cases — against a committed test asserting 0.88–0.90 that
passes. Third firing in this area of *a plain probe has no typechecking, so it can feed the renderer a
shape no caller can produce and the result reads as a product defect*. **Check the argument shape before
believing a sweep that disagrees with a green test.**

⚠️ **NO BAKED SCRIM — BUT MY FIRST METRIC CONFLATED THE TREATMENT WITH THE DEFECT.** Counting
translucent-dark pixels read **27.7%** on The Execution where the build reported 15.2%, because a dark
translucent pixel is exactly what the glyph halo IS. A scrim is not "some dark translucent pixels", it
is a region that covers the card whether or not there is anything to protect there — so the
discriminating measurement is per-row **coverage**. Measured: The Moment has **no row even 50% covered**;
every full-width covered band on the other three was located and identified as a designed mark — The
Execution's target-band lane (72 rows, **teal**, rgb 32/112/100 at alpha 0.44), The Progression's ladder
track, the Route Poster's divider rule above its metrics row. Rendered the alpha channel as a picture to
settle it; a number cannot tell a lane from a wash.

⚠️ **ONE FINDING THE BUILD DID NOT REPORT: THREE DECORATIVE RULES FALL UNDER THE 3:1 NON-TEXT FLOOR, each
on one of the two extreme grounds.** The build reported the accent tag (2.09, no keyline) and stopped
there. Measured by connected component, core against the ring just outside it: the poster's short **teal
accent dash 1.77:1 on white**; the **vertical metric-column divider 2.20:1 on black**; the poster's
**full-width horizontal rule 2.20:1 on black**. **No datum is lost** — all three are dividers and
ornament, and every text component measures ≥8.33 on white and ≥7.12 on black (that 7.12 is the poster's
faint meta line, matching the build's own figure exactly). So this is cosmetic: on a white photo the teal
dash nearly vanishes, on a black one the two rules do. Worth a keyline on the rules if it is ever
reported; not worth reopening the type treatment, which measures excellently on both grounds.
⚠️ **THE "WORST PIXEL" FORM OF THIS METRIC REMAINS UNQUOTABLE** — restricted to component rings it still
bottoms out where two adjacent ink elements touch, which is a fact about anti-aliasing.

**The live editor, driven at 430×932 in both themes at all four shapes:** `documentElement` and `body`
horizontal overflow **0 in all 8 combinations**, and **0 again with each of the five tool sheets open**
(48 readings). **39 distinct buttons** enumerated from the live DOM across shapes, sheets and themes,
**0 not reached by a handler**, all via an attribute family the delegated listener reads; 6 are disabled
and correctly still reached (they decline). Exports through the real editor: 1080×1920 / 1080×1350 /
1080×1080 `image/jpeg` `.jpg`, and **1020×1044 `image/png` `.png`** — the extension follows the mime.
⚠️ **MY SHEET MEASUREMENTS WERE VACUOUS ON THE FIRST RUN.** The studio's sheet is `.sst-sheet.on`
/ `[data-sst-sheet]`, not the app's `.sheet-ov.on`; my selector matched nothing, so the overflow sweep
measured an empty node set and printed "none" for every case, and the button sweep found **13** where
there are 39. A check that reports clean against nothing is the failure mode this file is mostly about,
and the tell was a suspiciously round "none" plus a button count too small for the screen. **Confirm a
sweep found real nodes before believing what it says about them.**

⚠️ **THE PORT SQUATTER FIRED AGAIN — 8899 WAS STILL HELD** by a `http.server` from an earlier session.
`lsof` first, then `curl … | grep` for a symbol only the new build contains (`shareStickerPatch`,
`shareAspectFamily`), before believing anything on screen. Both done here.

**On the pack's own prohibition, stated rather than glossed.** `CLAUDE.md` in the pack forbids copying
"Runna branding, logo, points, **stickers** or exact layouts". What ships is a transparent-PNG **export
of our own four templates** — a file format capability the owner asked for by name after researching what
the reference offers — not their sticker artwork, wording or layout. The prohibition is about copying
their design; this is our card with its background removed. Recorded here because the two sentences sit
close enough together that a later reader deserves to see the distinction drawn deliberately.

**Deviations, unchanged and restated:** the sticker is an **ADDITION to the pack, not a departure** —
the owner's own words, *"Card Only (Transparent): Saves your metrics card without any background so you
can overlay it manually as a sticker"*, under his standing instruction *"I want to at least match what
they do in terms of UI and UX. I'm not settling for worse, I want to strive to be better than them"*.
It has **no fixed pixel size** by design, so section G's exact-dimension guards do not apply to it and it
is deliberately not a member of `GATE_ASPECTS`; it is **PNG, not the spec's JPEG 0.90–0.94**, because
alpha is the feature; it **reuses the square's layout family** (4 ladder rows, 2 metric columns); and its
route is an inset in a reserved band rather than a scored zone. **The five BLOCKED checklist items are
unchanged by this work** — Save to Photos, the real-device pass, Vision, the feature flag and locale
units — and **the Road Map's `pc-share` therefore stays UNTICKED until a real device confirms it**.
`pc-sticker` is ticked because the sticker itself is done and measured; the camera roll is what is not.

### ⚠️ I DESTROYED EIGHT COMMITTED-NOWHERE GUARDS WITH `git checkout` (2026-08-20)

Undoing a deliberate re-break, I ran `git checkout -- test/share-export-bytes.test.ts
test/share-export-harness.ts`. Both files held UNCOMMITTED work — the sticker phase's own additions —
so the checkout reverted them to HEAD and took **eight guards** with it. The suite went 976 → 968 and
the loss was invisible except as a count. Recovered from a verifier's re-break tree copy under
`scratchpad/share/stconfirm/rbtree/test/`, which existed only by luck.
⚠️ **NEVER `git checkout` A FILE TO UNDO A RE-BREAK. Copy it to /tmp first and copy it back.** This file
already warned that a `git checkout` during parallel work silently discarded another change; this is the
same fault committed deliberately, by me, on my own work.

⚠️ **AND THE "DEAD" CONST WAS NOT DEAD.** A verifier graded `const OW = fr.OW, OH = fr.OH` in
`studioStageHeight` a nit and I deleted it on that word alone. `test/share-studio.test.ts` reads that
exact line to prove the stage frames the OUTPUT box rather than the 1080-wide layout box. Restored, with
`void OW; void OH;` so its purpose is legible — and recorded here that the guard pins a SOURCE PATTERN
rather than the behaviour, which is a weakness worth restating one day. Verify a dead-code claim before
acting on it.

### ⚠️ A GUARD I WROTE TO FIX A GUARD THAT COULD NOT FAIL, ALSO COULD NOT FAIL

`BLOCKER: every export embeds an sRGB profile` skipped every PNG (`if (imageKind !== "jpeg") continue`),
so the four sticker exports sailed through a claim that is false for them — they carry no profile at
all. My repair added a PNG branch **to that test's own loop**, and it could never run: the sticker is
deliberately **not** a member of `GATE_ASPECTS` (its size is its own ink, so every dimension claim that
list drives is inapplicable), so it never appears in `shots()`. **Two re-breaks both passed**, which is
the only reason it was caught.
The claim now lives in its own test over `G.stickers`, the map the stickers actually reach, and asserts
what matters for a PNG: not that it SAYS sRGB (an untagged PNG is read as sRGB everywhere) but that it
carries no CONFLICTING claim — no `iCCP`, no `gAMA`/`cHRM`. Both re-breaks caught.
⚠️ **A GUARD OVER A COLLECTION IS ONLY AS GOOD AS THE COLLECTION.** Ask what the loop actually contains
before believing the assertion inside it, and re-break rather than reading.

### THE STICKER'S ELEVEN FINDINGS, WORKED (2026-08-20) — AND TWO OF THE THREE MAJORS WERE DOCUMENTS

Two verifiers attacked the transparent sticker and produced eleven findings. Suite 969 → **976**;
every new and restated guard was re-broken and watched failing before it was believed.
⚠️ **NO TOTAL IS QUOTED HERE ON PURPOSE.** The fixer's report said 29 and this file said 26, and a
re-break count is narrative rather than derivable — so it is exactly the two-copies-of-one-number
fault the release-gate figures guard was just built to prevent, in a place no guard can reach. State
the practice, not a tally nobody can recount. The decisive measurement is that **all 48 photo exports are
byte-for-byte identical** before and after (sha256, captured from both trees) and **exactly the four
stickers moved** — every change here is gated on `gm.sticker`, and that is asserted rather than argued.

⚠️⚠️ **THE ONE THAT MATTERED WAS INVISIBLE AT 430×932 AND 76px WIDE AT 320×568.** A sticker's canvas is
cut to its own ink, so its four templates are **four different shapes** (aspect 0.98 / 1.42 / 1.40 /
0.85) — the first output in this app where that is true. `studioStageHeight` sized the stage from the
SELECTED card and `studioMount` then fitted each canvas to `slide.clientWidth`. Two faults compounded:
1. **`.sst-slide` had no `min-width: 0`**, so — a flex item refusing to shrink below its content — the
   slide was widened by its own canvas. And a canvas whose **bitmap is set but whose style width is not
   yet assigned has an intrinsic width of that bitmap**: 337px for a 1020-wide sticker at the neighbour
   scale.
2. **`bw` was then read from that widened box**, so the fit chased its own input and settled at whatever
   the STAGE HEIGHT allowed rather than at the slide's width. Self-sustaining: identical after a forced
   second mount, so arithmetic and not stale layout.

Measured live at 320×568 with a sticker selected: slides **[248, 298, 293, 248]** against a published
248, the card being edited **115px off centre with 75px of it clipped** by the stage's own
`overflow: hidden` — i.e. the runner tapping Share on a card whose right-hand edge they cannot see.
Every fixed output measured 0–1px off centre and 0px clipped at every width, which is why nothing had
ever seen it.

⚠️ **THE FIX IS ONE FRAME FOR THE WHOLE CAROUSEL, AND THE TALLEST CARD'S SHAPE IS NOT A TASTE CALL.**
It is the **only** frame aspect that keeps "slide == card" for every template at once, which is the
invariant the peek depends on: fit a card into a box at least as tall as its own aspect and the WIDTH
binds, so the card comes out exactly the frame's width. Anything shallower makes the tall cards
height-bound — narrower than their own slide, gutters swallowing the neighbour's card, which is the
fault `.sst-slide`'s note already records measuring at 320×568. Anything taller costs every card width
for nothing. The cost is symmetric letterboxing on the wider templates, which reads as a mat.

**Measured, before → after, over 96 combinations (4 outputs × 4 templates × 3 viewports × 2 themes):**
| | before | after |
|---|---|---|
| worst centre error | 115px | **1px** |
| worst clipped | 75px | **0px** |
| slide-width spread within one carousel | 114px | **0px** |
| stage-height swing while paging | 159px | **0px** |
| Share-button swing while paging | 159px | **0px** |
| smallest neighbour peek | **0px** | 24px |
| page horizontal overflow | 0 | 0 |

⚠️ **THE JUMPING PREVIEW WAS THE SAME DEFECT AND IS FIXED BY THE SAME CHANGE.** `studioStageHeight` was
re-run per template, so the stage was 302/210/211/346 at 375×812 and 350/242/245/401 at 430×932 — the
Share button carrying the whole 136–159px under the runner's thumb. Now one frame per carousel: 346 and
401, unchanged across all four templates.

⚠️ **AND THE ARITHMETIC WAS SPLIT OUT AS TWO PURE FUNCTIONS SO THE INVARIANT CAN BE SWEPT WITHOUT A DOM.**
`studioFrameFit(cardW, room, fr)` and `studioCardFit(sg, slideW, stageH)`. The guard sweeps **138
card/screen pairs** — the four real sticker sizes, the three fixed outputs, a deliberately wilder set
than the renderer can produce, plus a two-template and a one-template carousel — and asserts every card
comes out exactly `slideW` wide and no taller than the stage, AND that the frame is identical under every
rotation of the list (which is the no-swing claim, stated so it cannot be satisfied by the order the
editor happens to hold). ⚠️ **`SST_STAGE_MIN` and `.sst-stagewrap`'s `min-height` are the same number and
the test compares them** — two owners of one measurement is a fault this very function already records.

⚠️ **A GUARD RUN ONLY AT THE COMFORTABLE SIZE CANNOT SEE THIS.** 0px at 430×932, 76px at 320×568. Same
lesson as the sticker-height sweep whose four points were all roomy enough for the verdict to take its
top rung.

### THE FIGURES IN TWO DOCUMENTS ARE NOW DERIVED, NOT RETYPED

⚠️ **THE RELEASE-GATE COUNT HAD BEEN WRONG IN THREE PLACES AND WAS FIXED IN ONE AT A TIME.** "63 of 74,
eleven blocked" → corrected to "67 items: 62 PASS, 5 BLOCKED" → and then still said **"eleven"**
ninety-four lines later in the same section, two paragraphs below its own correction; while
`docs/roadmap/index.html` — the page the owner reads to know where the project is — carried the stale
pair in its **hero** and the corrected pair in the step detail four paragraphs below. A cold session, and
the owner, believe whichever copy they reach first.

**The durable fix is `test/release-gate-figures.test.ts`, and nothing in it is retyped.** The TOTAL is
counted from the gate's own `- [ ]` lines (A5 B7 C8 D8 E7 F8 G9 H7 I8 = **67**, and the per-section
working recorded in CLAUDE.md is compared against the count rather than trusted); the PASS/BLOCKED/FAIL
split must add up to it; the blocked paragraph's spelled word must equal `spell(blocked)` **and**
enumerate exactly that many `(n)` items; and the Road Map's own spelled-out sentences must spell those
figures, **computed** — with every OTHER spelled number in the "…checks" shape forbidden anywhere on the
page, which is what catches a second stale copy.

⚠️ **`SHARE_STUDIO_RELEASE_GATE.md` IS NOW COMMITTED, VERBATIM, FOR EXACTLY THIS REASON.** Left in the
supplied pack directory the count would depend on a file outside the repo, so the guard would have to
skip when it was absent — and a gate that vanishes when its instrument is missing reports a release as
verified having verified nothing.

⚠️ **THE SWEEP'S FIRST TWO VERSIONS FAILED ON CORRECT PROSE.** A bare `"<word> of the"` flagged the
ordinary English *"one of the two"* elsewhere on the page; scoped to `"…checks"` but unanchored, `two`
matched inside **sixty-two** and condemned the corrected sentence. It carries a `(?<![a-z-])` lookbehind
now, and it was re-broken against the real stale text (`"sixty-three of the seventy-four checks"`), not
against an invented one. Nine doc re-breaks, all caught.

⚠️ **`pc-share` STAYS UNTICKED and a guard now says so**: it is ticked in no dated batch while Save to
Photos is still blocked on a native build, every batch id must name a step that exists on the page, and
`pc-sticker` must be ticked because the sticker itself is done and measured.

### THREE DECORATIVE RULES UNDER THE 3:1 NON-TEXT FLOOR — FIXED, NOT WAIVED

Measured by **connected component against the ground each one sits on**, over pure white and pure black:
| mark | before | after |
|---|---|---|
| Route Poster's teal accent dash, over **white** | **1.60:1** | 12.11:1 |
| vertical metric-column divider, over **black** (all four stickers) | **2.26:1** | 4.43:1 |
| Route Poster's full-width rule above its metrics, over **black** | **2.26:1** | 4.43:1 |

⚠️ **THE HAIRLINE WAS ALREADY A PAIR AND ITS LIGHT HALF WAS SIMPLY TUNED FOR A DIFFERENT PROBLEM.** A
divider is a deep half (`keyline`, `rgba(2,10,8,.82)`) plus a light half (`hair`, `rgba(255,255,255,.28)`)
so that whichever way the ground goes one of the two carries it. On a photo card, under a scrim, .28 is
plenty and the note beside it records how it was measured off the four references. On a **sticker** there
is no scrim: .28 of white over pure black is 2.26:1, and the deep half contributes nothing because it is
dark on dark. `SHARE_INK.hairAlpha` (.45) is used only where `gm.sticker`.
⚠️ **A SECOND VALUE, NOT A RAISED .28** — raising the one constant would move all 48 signed-off photo
exports for a defect that exists only without a scrim. Verified: 48 of 48 identical, only the 4 stickers
moved. And the floor is **arithmetic, not taste**: white at alpha *a* over black has relative luminance
`((a+0.055)/1.055)^2.4`, so 3:1 needs a ≥ 0.349; .45 is margin.

⚠️ **THE ACCENT DASH IS A SINGLE TONE, SO NO ALPHA COULD SAVE IT.** A mid-toned mark has no direction to
win in — lighter fails on white, darker fails on black. What it needed was an **edge**, which is the
device the type already uses. `shareMark` fills the rect and, on a sticker only, strokes the one keyline
underneath with `destination-over` (over the top it would eat into the mark it defines). Teal on black
reads on its own at 10.0:1; on white the keyline's edge is what is seen.

⚠️ **AND THE GUARD IS DERIVED FROM PIXELS, BECAUSE THE EXISTING ONE STRUCTURALLY COULD NOT SEE THESE.**
The legibility gate measures the planned TEXT boxes, and a decorative rule is in no plan — which is
exactly why the build reported one such case and stopped. The byte gate now runs a connected-component
sweep over the alpha channel and measures every component against white and black: **0 of 236 readings
under 3:1, worst 4.43:1** (5 under before). Cost 0.3 s. It takes the **better of the two directions**,
which is not a loosening: every mark here is a pair by design, and requiring both halves to clear the
floor would condemn the type as well.

### FOUR OF OUR OWN CHECKS COULD NOT DO WHAT THEY CLAIMED

⚠️ **THE TRIM GUARD WAS ONE-SIDED, SO IT COULD SEE TOO MUCH MARGIN AND NEVER TOO LITTLE.** `edge[side]`
is the gap from the canvas edge to the nearest ink, so an over-trimmed sticker's gap is **zero — the
smallest value there is — and a ceiling on it passes.** Watched: a break that computed the box correctly
and then shrank it 40px a side sailed through and was caught only incidentally, by an unrelated
transparent-share bound with 1.9 points of headroom. Three claims now: not too loose, **no ink on the
outermost row or column**, and — the load-bearing one — **the trim box contains the UNTRIMMED card's own
full-resolution alpha bounding box**, which needs a render that was not trimmed and is the only form of
the claim that can fail when ink is lost.
⚠️ **AND THE ORDER OF THOSE THREE MATTERS, WHICH TOOK A RE-BREAK TO NOTICE.** node's assert throws on the
first failure and every ink-losing break ALSO puts ink on the outermost row, so with the cheap floor
first the strong claim never ran and its message never appeared: two different breaks were both reported
as *"ink on the outermost top row"*. Containment is asserted first, so a failure now names the defect
(*"11px of the card has been cut off the left"*) rather than its symptom.
⚠️ **The pad-0 re-break also settled the padding's own justification from measurement**: at `pad: 0` the
trim loses **3px** of real ink, i.e. ink faint enough to be missed at the 1/6 probe genuinely exists.

⚠️ **THE "TWO DERIVATIONS OF ONE BAND" GUARD ASSERTED ARITHMETIC TRUE BY CONSTRUCTION.**
`blockTop` was built in the test as `bandTop + field + CLEAR` and `shareStickerField` answers
`blockTop - CLEAR - top`, so the two cancel and **no single-sided edit can make them differ** — an
attempt to break it by changing `posterField` moved both sides together and was correctly not caught.
What is falsifiable is the SHAPE of the derivation: the band's height must track the block top
one-for-one, so a re-derivation returning `SHARE_STICKER.field` as a height of its own — which is the
two-derivations fault the title names — returns a constant and fails. Plus a real-model check in the byte
gate, where the reservation is computed against the NOMINAL canvas and the plan against the DERIVED one,
so their agreement is a genuine statement: **moment 380px, poster 620px, reserved == drawn**, and the
band must lie inside the trimmed canvas. Both re-broken by drifting the reservation 36px and 7px.

⚠️ **TWO ASSERTION MESSAGES STATED THE OPPOSITE OF WHAT THEY ASSERTED** — *"an unknown output does not
land on the default"* on a line requiring that it does, and *"a sticker defaults to the route being off"*
on a line requiring it ON. A message is read at the exact moment somebody is deciding whether the guard
is wrong or the code is, and one that reads backwards argues for the wrong answer. Reworded and each
watched printing the corrected text. ⚠️ **The unknown-aspect line cannot be broken on its own**, because
`shareAspect`'s `indexOf(a) > 0` fallback is the same branch that maps index-0 `"story"` — so a break
fires on whichever assertion comes first. Stated rather than dressed up as an independent guard.

### Refuted, with the measurement

⚠️ **"THE ROUTE POSTER STRANDS ITS ROUTE IN A LANDSCAPE BAND" IS NOT A DEFECT AND WAS ALREADY GRADED A
NIT BY ITS OWN FINDER.** Aspect preservation is a spec requirement, the sliver fixture is the worst case
by construction, and the same finding records a realistic loop filling 57% of the band's width. Nothing
changed, deliberately.

⚠️ **"web/app.html AND docs/index.html CARRY A NEW BUILD STAMP" IS THE DOCUMENTED BUILD STEP, NOT A
DIFF TO EXPLAIN.** `BUILD_STAMP` is `new Date().toISOString().slice(0, 16)`, so any build rewrites it.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date error, **976/976 · 0 fail**, both
ratchets still on their ceilings (143 radii, 322 font sizes — the new CSS is `min-width`/`max-width`,
neither of which is on either ladder). Re-read from the produced bytes with an independently written
JPEG SOF walker and PNG chunk reader: **16 story 1080×1920, 16 feed 1080×1350, 16 square 1080×1080**, all
8-bit 3-channel; four stickers **1020×1044 / 1020×720 / 1020×730 / 1014×1188**, bit depth 8, colour type
6, every CRC valid, no `tEXt`/`iTXt`/`zTXt`/`eXIf` — the derived sticker sizes are **unchanged** by the
keylines, because the marks sit well inside the ink bounding box.

### TWO OUTPUTS ONLY, AND A PHOTOGRAPH ON EVERY CARD (owner, ruling 6, 2026-08-20)

Verbatim: *"I want them to be able to add a photo to any of the cards that you have created, it doesn't
matter if the route line sits over the top of their photo. get rid of the 2 options ive circled...i only
want the two options if story and feed"*. Three binding changes; suite 977 → **960** (every removed test
belonged to a withdrawn output — accounted for below), 32 deliberate re-breaks, 31 caught first time.

⚠️ **SQUARE 1:1 AND THE TRANSPARENT STICKER ARE GONE, AND GONE FROM `SHARE_ASPECTS` RATHER THAN FROM THE
CHIP ROW.** A chip removed while `shareAspect` still validated the name leaves two renderers reachable
through a stored `SCARD.aspect` with nothing on screen to reach them — the computed-and-discarded trap
this file records four times over. **Square was the pack's OPTIONAL third format** ("Support Square 1:1
if the existing renderer can do so"), so dropping it is compliant; **the sticker was his own addition of
2026-08-19**, so dropping it returns to the pack exactly. Neither is a regression to apologise for.

**What was deleted, and it is more than the two renderers.** `SHARE_STICKER`, `shareStickerH`,
`shareStickerBox`, `shareStickerGeom`, `shareStickerField`, `shareStickerBandTop`, `shareStickerPatch`,
`SHARE_WM_CLEAR`, `CARD_MEASURE`/`cardMeasureCtx`, `shareFontPx`, `SHARE_TYPE_SQ`, `SHARE_GAP_SQ` +
`shareGaps`, `SHARE_METRIC_CAP` + `shareMetricCap`, `SHARE_LADDER_MAX` + `shareLadderMax`,
`SHARE_CHART_SQ_H` + `shareChartH`, `SHARE_ASPECT_FAMILY` + `shareAspectFamily`, `SHARE_ASPECT_LABEL`,
`shareExportSpec`, `shareCanvasGeom`, `shareGeomAt`, `studioFrameOf`, `studioSlideGeom`,
`SHARE_ZONE_SOFT_VETO`, `SHARE_INK.hairAlpha`, the `.sst-alpha` chequer rule, and `pngChunks` in the test
harness. Plus four fields off the geometry record — **`OW`/`OH`/`ox`/`oy`, which were the sticker's
crop-to-its-own-ink machinery and are identities for a fixed shape**, and `family`/`sticker` with them.
`test/share-export.test.ts` sweeps the whole app script for all of them by name.
⚠️ **AN IDENTITY FIELD IS THE ONE THE NEXT READER BELIEVES MEANS SOMETHING**, which is why they went
rather than being left as a solved generalisation.
⚠️ **AND THE ORPHAN SWEEP FOUND ONE I HAD MADE MYSELF** — `SHARE_ASPECT_LABEL`, whose only reader was the
metrics sheet's "this shape carries two" sentence. It found `SHARE_VEIL_STEPS` too and that one is NOT
dead: a test reads it as the vocabulary the veil plan's `step` must belong to. Verify a dead-code claim
before acting on it (this file already records deleting a `void OW` line on a verifier's word).
⚠️ **AND `.sst-hint` CAME BACK AS A FALSE POSITIVE from the comment recording its own deletion** — the
fifth firing of the guard-tripping-on-its-own-prose trap, this time in my sweep rather than in a test.

⚠️ **THE ONE FINDING THAT SURVIVES THE SQUARE IS WORTH KEEPING: A SHORTER CANVAS NEEDS THE BIG RUNGS
TIGHTENED AND THE SMALL ONES LEFT ALONE.** "1:1 leaves the photograph 32.3% of the card" was the story
layout dropped onto a 1080-tall canvas; recomposed properly it measured 51.7 / 43.1 / 42.2 / 59.0%. So
the number was evidence that a scale is not a reflow, not that a shape cannot work — and it is exactly
what `SHARE_TYPE_FEED` does for the feed post. Measured too, and kept in the source: **the two-metric cap
bought WIDTH, not height** (0.0 points of clear photograph on every template; 301px per column against
464px), so if a shorter shape is ever wanted again that is the lever.

### THE ROUTE POSTER IS PHOTO-OPTIONAL NOW, AND THE PACK IS OVERRIDDEN ON THAT LINE

The pack calls it *"route-led, photo-free"* and `shareCardModel` handed it `null` **by name**. His
instruction wins, so there is no per-template photograph gate at all — every template is handed whatever
the runner chose, and `shareDrawBody`'s `!m.photo` gate is what keeps the matte topographic ground for a
poster with no picture. It composites through the same `sharePhotoDraw`, the same blurred surround, the
same Fill switch and the same ONE gradient scrim as the other three.

⚠️ **ITS FAINTEST TIER IS LIFTED TO THE SOFT ONE WHEN THERE IS A PHOTOGRAPH, FROM ONE VARIABLE READ BY
THE SOLVER AND BY EVERY FILL.** This is The Execution's own finding applied here: against a white ground
the faint tier solves alpha 0.88 where the soft tier solves 0.78, so asking for it costs **ten points of
somebody's photograph on this template alone** — and on a solved scrim the soft tier is what the rest of
the family already sets for exactly these rungs (place, date, metric labels, footer). On the matte ground
the faint tier is right and cheap (6.50:1 by arithmetic) and stays. A palette that disagrees with the
scrim solved for it is the whole class of defect the solver exists to prevent, so it is `const quiet =
m.photo ? SHARE_INK.inkSoft : SHARE_INK.inkFaint` and a guard counts the remaining `inkFaint` reads.

⚠️ **MEASURED FROM RENDERED PIXELS, 304 READINGS — the poster's copy over ten grounds (white, black,
saturated red/green/magenta, a spark field built to defeat a probe-solved scrim, three real scenes, and
the matte), both aspects, both fit modes, eight text elements each. Worst 5.11:1; nothing under 4.5.**
Method deliberately neither the app's own probe nor the byte gate's: 99th-percentile ink against
15th-percentile ground inside each element's own planned box.

⚠️ **AND THE DECISIVE REGRESSION CHECK IS A HASH ACROSS BOTH TREES, NOT AN ARGUMENT.** Eighteen exports
built from a deterministic in-page picture, hashed at HEAD and here: **14 identical, 4 changed, and the
four are exactly the poster WITH a photograph.** Before, its three rows collapsed to one hash because it
ignored the picture; after, whole / fill / bare are three distinct pictures. Every photo template and the
bare poster are byte-for-byte unmoved — which is the proof that removing the raised hairline alpha and
the mark keyline touched nothing, since both were gated on `gm.sticker`.

### THE ROUTE MAY SIT OVER THE PHOTOGRAPH — THE SCORER IS A PREFERENCE, NOT A VETO

⚠️⚠️ **THIS IS WHY HIS SCREENSHOT HAD NO ROUTE ON IT AT ALL.** The conservative centre-person exclusion
was a hard veto, so on a photograph where it reached every candidate column the switch read "show my
route" over a card with no route — the looks-live-does-nothing defect, arrived at by a safety rule eating
the feature. **Measured, with the old veto re-implemented rather than remembered: refused 6 of 20** ⚠️ (the implementer reported 8; an independent replay of the same sweep measures 6, and 6 is what its own following sentence implies — the reproducible figure is the one recorded)
(5 source shapes × 2 aspects × 2 fit modes). **Now: placed 20 of 20.**

⚠️ **REMOVING THE VETO ALONE WOULD NOT HAVE FIXED IT, AND THAT IS THE HALF WORTH KNOWING.** Two things
could refuse a route and only one was the scorer: `shareZoneRect` returns null when the free column
beside the obstacles is narrower than `SHARE_ZONE_MIN_W`, so on a wide source enlarged to cover, the
assumed face spans the whole canvas width and **all four candidates come back null before anything is
scored**. `shareRouteFallback` is the band itself — full content width between the copy above and the
block below — reached only when the four preferred columns have all failed. Measured: 6 of the 20 land
there, and they are exactly the zero-clear-column cases.

⚠️ **THE SCORING STAYS, AND KEEPING IT IS NOT OPTIONAL.** He said a route over the photograph is fine; he
did not ask for one drawn through somebody's face when a clearer placement is free. So the face still
NARROWS the candidate columns (which is how the tall clear strip beside a runner becomes a candidate at
all — 219×545 on reference 01) while no longer being able to refuse one. **14 of the 20 placements land
completely clear of the assumed face**, and where any clear column exists it is always taken.
⚠️ **`SHARE_ZONE_PEN.face` IS 2.2 AND BIGGER THAN 1 ON PURPOSE.** At exactly 1 a fully covered face scores
0, the same as a fully covered torso, so a candidate crossing a face could tie with one crossing a chest
and win on iteration order. At 2.2 the face is always the worse trade at equal coverage.
⚠️ **TEXT IS STILL HARD, AND THAT IS A DIFFERENT RULE.** "Over the photograph" is what he asked for; a
route through the distance hero is not a route, it is a mess. `-1` now means only two things: outside the
safe region, or crossing the card's own copy. And the fallback can still return null — on HEIGHT, which
is a statement about the card's geometry rather than about somebody's photograph.

⚠️ **ONE OF THE OLD GUARDS' OWN FIXTURES COULD NEVER HAVE SEEN THIS.** "A face that fills the frame is
the same refusal by the other route" used a 1000×1000 source at k=9, which maps the face band entirely
above the canvas and clips it to **height 0** — so the assertion under it was vacuous. Restated with a
fixture whose assumed face genuinely spans the card width, and the guard asserts that the fixture does
so before relying on it.

### WHAT THE TEST SUITE LOST, ITEM BY ITEM — AND TWO GUARDS I DESTROYED BY ACCIDENT

977 → **960**. Every one of the 17 is accounted for: `share-export` −7 (the sticker's fourth-output
guard, the family-lookup sweep, the sticker route band, and the five square-recomposition guards, against
one new withdrawn-machinery sweep), `share-export-bytes` −9 (the eight sticker guards plus the sticker
sRGB one), `share-studio` −1 (three editor guards about shapes that no longer exist, replaced by two).
`share-render` and `share-model` are unchanged in count, with three route-placement guards where there
were two and a new poster-photograph guard where the old poster-has-no-photograph one was.

⚠️⚠️ **AND I DESTROYED TWO UNRELATED GUARDS BY SLICING A TEST FILE FROM ONE `test(` TO ANOTHER.** The
range from "all four outputs are offered" to the Photo-tool test also contained *"rebuilding a sheet's
rows puts focus back on the control that was used"* and *"the switch component reaches the 44px tap
floor by growing its hit area"* — nothing to do with shapes. It presented only as a count: 28 → 25 where
I had made one net deletion. **Recovered from `git show HEAD:` and re-run.** The lesson is the same one
this file already records for `git checkout`: **when removing tests, diff the TITLE LIST before and after
and account for every line**, because a slice between two anchors takes whatever sits between them.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date error, **960/960 · 0 fail**, both
ratchets unchanged on their ceilings (**143 of 235 radii, 322 of 442 font sizes** — the deleted CSS was
`background-*` only, so neither total moved and neither ceiling could be lowered). Export dimensions
re-read from the produced bytes with an independently written SOF walker: **18 exports, all exactly
1080×1920 / 1080×1350, 8-bit 3-channel, ICC present, no APP1/EXIF, every filename `.jpg`.** Every
eligibility reason string produced by the state that produces it — nine distinct strings, all still true.

⚠️ **ONE FLAKE OBSERVED AND NOT REPRODUCED, REPORTED RATHER THAN EXPLAINED AWAY.** In one full-suite run
of five, three browser-backed privacy tests in `test/share-export-bytes.test.ts` failed in under a
millisecond each; the file passed alone four times and the whole suite passed the other four. The gate's
headless-browser dependency is pre-existing and my changes to that file were removals, so this is very
probably a CDP timing artefact under parallel load — but it is not proven, and a release gate that flakes
is worth someone's attention.

⚠️⚠️ **IT FIRED AGAIN ON 2026-08-22, AND THE CAUSE OF THE SHORT CAPTURE IS STILL NOT DIAGNOSED — BUT THE
MISLEADING PART IS FIXED.** Those three tests read `G.privacyShots.find(...)!`, and a non-null assertion
does nothing at runtime: a missing label became an instant throw on `undefined` inside three BLOCKER
tests whose names promise that a privacy switch does not work. So a capture that stopped early presented
as a privacy defect, which is the worst thing a flake can look like on a release gate. There is now a
`priv(label)` helper that fails naming the missing card and the ones it does have, plus a completeness
guard over all five labels — the count guard `shots()` already had and the privacy cards did not. Proved
by deleting a privacy case from the harness: it reports **"that is a capture that did not finish, not a
privacy switch that failed"**. Re-measured after: 20/20 alone and **1236/1236 on three consecutive full
runs**, so the flake remains unreproduced and the next occurrence will say what it is.
✅ **DIAGNOSED 2026-09-24 (during Y4): A CDP CALL RUNNING PAST ITS 120-SECOND LIMIT ON A BOGGED-DOWN MAC.**
The error is `Runtime.evaluate timed out` — `rpc`'s 120000 ms timer in `test/share-export-harness.ts`.
Four full runs in a row hit it (under UTC once, under Kiritimati twice, and one plain `node --test` that
took **7,299 s**), including one at four files at a time, while the file ALONE passed **21/21 in 4.4 s**
in the same timezone. The Mac (24 GB) had **4 GB in swap and a load average of 24 with no tests
running**; the default runner puts about 13 files up at once and a few share files hold 1.6–2.7 GB each.
So it is environmental, and it fails all 21 tests together because they all wait on the one capture.
`VERIFY_CONCURRENCY=N npm run verify` now runs N files at a time and says so in its summary line; it did
not rescue that machine that day, so the real remedy is a less loaded Mac before a full check.

### THE SESSION'S OWN COLOUR, THE DESTINATIONS ROW, AND NO TOP FADE (owner, ruling 7, 2026-08-20)

Verbatim: *"Two other changes, if they decide not to add a photo, the background needs to be the same
colour as the run that they've done, e.g. an easy run is teale, a tempo is yellow etc..... Also the
options to share straight to their socials need to appear like the attached image. Also, i don't want
the fade at the top of the card. again, i dont mind if there is something that sits underneath the
Inte-Run logo"*

⚠️⚠️ **THE FIRST CUT OF THIS SHIPPED THE CODE AND NOT ONE GUARD, AND THAT IS THE LESSON OF THE WHOLE
SECTION.** Suite went 960 → 960. An adversarial verifier then applied **eleven deliberate breaks and
five landed silently**: every easy run painted as a hard one; the easy colour changed to a blue; the
Copy-caption tile unwired; the ground's lightness moved from 0.125 to 0.30 (small type at **2.57:1**);
and the topographic contours losing the session colour. Those five are exactly the claims part 1 is
about. Suite is now **966**; every guard below was watched failing against a re-break before it was
believed, and the verifier's own eleven were repeated against the finished tree.

⚠️ **AND A COMMENT CLAIMED A GUARD THAT DID NOT EXIST — THE SECOND TIME IN THIS AREA.** The note above
`SHARE_EFFORT` stated that `test/share-render.test.ts` "parses these three out of the stylesheet's own
`data-theme="dark"` block and asserts they match". No such assertion existed; the derived token table
there covers `SHARE_INK` only. `test/share-render.test.ts` records the first occurrence eight lines
above its own palette guard ("an earlier version of the renderer's comment claimed a test file pinned
them when no such file had ever existed"). **The guard now exists**, over all three effort colours, and
it reads **both** dark declarations — the `prefers-color-scheme` block and the `data-theme="dark"` block
— because this file already records that FOUR places declare these tokens and that a change applied to
three leaves the fourth stale.

### ONE SESSION-TO-EFFORT-COLOUR MAPPING, AND A TEMPO IS AMBER

⚠️ **THE OWNER'S OWN EXAMPLE WAS THE ONE THE CARD GOT WRONG.** "a tempo is yellow" — and a tempo had
three colours at once: the **Add-a-session grid** he taps drew `--eff-moderate` (amber), the
**training-log calendar** drew `--eff-hard` (rust), and the **card's new ground** drew rust as well
because `runEffort` carried its own list of hard types with "threshold" in it. Tap the amber tile, run
it, get a rust card of it.

`SESSION_EFFORT` + `sessionEffort(type)` is the single truth, keyed on the session TYPE, and
`effortVar(effort)` is the one place an `--eff-*` name is built. `effortOf` (planned sessions),
`runEffort` (logged runs), `RUN_TYPES` (the grid), `RUN_KIND` (the calendar) and the card all resolve
through it. **Threshold is `moderate` — the owner's decision, and also what the engine already said:**
`src/plan/session-templates.ts` assembles a threshold session at intensity moderate, so the plan dot has
always been amber; it was the two type-keyed readers that invented a rust one.

| session type | loggable run? | effort | card ground | Add-a-session tile | calendar dot | plan dot / Logbook rail |
|---|---|---|---|---|---|---|
| easy | yes | easy | `#4cb98a` | `--eff-easy` | `--eff-easy` | `--eff-easy` |
| long | yes | easy | `#4cb98a` | `--taper` | `--taper` | `--eff-easy` |
| recovery | yes | easy | `#4cb98a` | `--steady` | `--eff-easy` | `--eff-easy` |
| **threshold** | yes | **moderate** | **`#e6ac3e`** | **`--eff-moderate`** | **`--eff-moderate`** | **`--eff-moderate`** |
| vo2 | yes | hard | `#e56f49` | `--eff-hard` | `--eff-hard` | `--eff-hard` |
| strides | yes | easy | `#4cb98a` | `--build` | `--eff-easy` | `--eff-easy` |
| race-specific | yes | hard | `#e56f49` | `--rest` | `--eff-hard` | `--eff-hard` |
| race | yes | hard | `#e56f49` | (not in grid) | `--eff-hard` | `--eff-hard` |
| strength | no | moderate | `#e6ac3e` | (not in grid) | (default) | `--eff-moderate` |
| cross-training | no | moderate | `#e6ac3e` | (not in grid) | (default) | `--eff-moderate` |
| mobility | no | none | plain ink | (not in grid) | (default) | `--eff-none` |
| rest | no | none | plain ink | (not in grid) | (default) | `--eff-none` |

⚠️ **KEYED ON TYPE, NOT ON THE `intensity` FIELD, AND THAT IS WHAT MAKES IT ONE MAPPING.** A logged run
stores its type and throws the intensity away — `liveRunRecord` never keeps it — so a mapping that read
intensity could answer for a planned session and not for the run of that session, which is exactly how
the rail and the chip came to disagree. The one case that MOVED is **`race-specific`**: the generator
calls it moderate, every type-keyed reader in the app already called it hard, and hard is what it now is
everywhere. A rehearsal at goal race pace is not the same afternoon as a tempo.

⚠️ **THE MIDDLE OF THE THREE-COLOUR FAMILY WAS PREVIOUSLY UNREACHABLE.** "moderate" was reached only by
strength and cross-training, and `PRIMARY_TYPES` cannot start either — so the amber ground was undrawable
and the derivation's whole legibility argument was about a card no runner could produce. Guarded: every
one of the three bands must be reachable from some member of `PRIMARY_TYPES`.

⚠️ **FOUR OF THE SEVEN GRID TILES KEEP A DELIBERATE IDENTITY ACCENT AND THAT IS NOT DRIFT.** Recovery,
the long run and easy + strides are all EASY by effort, so an effort-coloured grid is four identical teal
tiles and a picker that cannot be picked from. The rule is not "everything is an effort colour" — it is
that anything WEARING one must be wearing the right one, which is what the guard sweeps for.

⚠️ **THE CALENDAR'S LEGEND IS DERIVED FROM `RUN_KIND`, BECAUSE IT WENT STALE THE MOMENT A TEMPO BECAME
AMBER.** It was three hand-written pairs promising "Quality → `--eff-hard`" over a grid drawing
`--eff-moderate`. `logCalendarLegend()` lists every distinct colour a dot can actually be, exactly once:
**Easy / Long / Tempo / Hard**. The bucket word (`lab`) and the colour (`c`) are two different sentences
— `k`/`lab` answer "which of the three kinds of day was that", `c` answers "how hard was it" — and
`long` keeps `--taper` because picking the long run out of the other easy days is the whole point of that
bucket.

⚠️ **`RUN_HARD_TYPES` IS GONE, AND `test/share-model.test.ts`'S CONST LIST FAILING LOUDLY IS HOW THAT
WAS NOTICED** rather than left behind as a second list of hard types beside the mapping.

### THE PHOTOGRAPH GATE IS GONE FROM EVERY TEMPLATE — AND RULING 6 HAD RECORDED THIS AS DONE

⚠️ **`shareTemplateStates` STILL REFUSED THREE OF THE FOUR WITHOUT A PHOTOGRAPH, so ruling 7 part 1
reached ONE CARD OF FOUR.** Measured through the real editor at 430×932: a run with a route and no
photograph rendered **1 slide**. `DECISIONS.md` filed this clause under "RULING 6 IS IMPLEMENTED — all
three parts are in", which it was not. After: **4 slides**, all four Style rows enabled `<button>`s, The
Moment the default (the pack's own "default, most broadly useful card"), page overflow 0.

⚠️ **THE GATES ARE NOW FACTS ABOUT THE RUN, AND THE MOMENT'S IS THAT THERE IS A HEADLINE.** A distance,
or failing that a time — which is what `shareHeroFor` needs. The Execution still needs a judgeable band,
The Progression three measured splits, the poster a route. **No reason string anywhere may ask for a
photograph**, swept over five run shapes with and without one.

⚠️ **AND `template: null` IS STILL REACHABLE, BUT IT TAKES A RUN THAT FAILS ALL FOUR GATES.** Written
with only the headline removed the test measured **"execution"** — The Execution and The Progression are
gated on the SPLITS, not on the hero. So `sharePlaceholderCard` survives as a total-function safety net
and its copy changed: it used to say **"ADD A PHOTO"**, which would now be a lie on a card family where
a photograph is optional everywhere. It says what is actually missing.

⚠️ **AND `SHARE_TEMPLATE_BLURB.moment` PROMISED A PHOTOGRAPH TOO** — *"Your photograph, the distance,
and the coach's read"* — which a runner with no photo would read as an instruction to go and find a
picker they no longer need.

### THE EMPTY FIELD WAS REAL, MEASURED, AND FIXED WITH THE ROUTE

The earlier deviation said a photo-free version of the three photo templates "would leave the upper half
empty". That was true when written, and the session ground plus the contours answers most of it — but not
all of it. ⚠️ **MEASURED ON A STORY CARD WITH NO PHOTOGRAPH: The Execution put 44.4% and The Progression
42.4% of the canvas into ONE continuous ink-free band, with a second-quarter luminance sd of 0.0121
against the byte gate's own 0.012 emptiness bar** — i.e. on the line this project already drew once, in
the workflow that rebuilt the recap over "46% empty".

`shareFieldRoute` draws the route in that field **when there is no photograph**, which is exactly what
The Moment has always done — so this removed a difference between the templates rather than adding a
variant. After: **26.1% and 25.1%**.
- ⚠️ **GATED ON `probe`, WHICH IS THE PRESENCE OF A PHOTOGRAPH, AND THE PHOTO CARDS ARE UNTOUCHED DOWN TO
  THE BYTE.** Proved by hash across both trees: **all 36 captured exports identical**.
- ⚠️ **NO PLAN CHANGE WAS NEEDED**, because the scored region stops 32 px above the block top, so the
  only copy inside it is the wordmark.
- ⚠️ **IT DOES NOTHING FOR A RUN WITH NEITHER A PHOTOGRAPH NOR A ROUTE** — a treadmill run, a refused
  GPS, a hidden route. That field stays a plain coloured ground and it is stated rather than papered
  over: there is nothing true left to put there.

⚠️ **THE PER-QUARTER sd METRIC IS CALIBRATED FOR PHOTOGRAPHS AND SHOULD NOT BE READ AS A VERDICT HERE.**
Its 0.012 bar was set from "the quietest quarter the app actually draws measures 0.0228", and every card
measured then carried a photograph. A quarter of matte ground is *supposed* to be low-variance — that is
what a ground is — and the texture is genuinely there (**13.08–13.27% of ground pixels differ from a flat
gradient of the same colour**). The quietest no-photo quarter is still **0.0121**, on The Moment's feed
card, and the byte gate does not capture these cards at all. Reported, not tuned.

### WHAT THE COLOURS AND THE TYPE MEASURE, FROM RENDERED PIXELS

72 no-photo renders (4 templates × 2 aspects × 9 session types, **0 skipped**), each text tier read as
its exact fully-opaque glyph colour against a ground-only twin of the same card at the same coordinates:

| tier | worst across every no-photo card | where |
|---|---|---|
| `ink` | 11.04:1 | easy / moment / story |
| `inkSoft` | 5.97:1 | easy / progression / feed |
| `accent` | **5.28:1** | easy / moment / story |
| `inkFaint` | **5.23:1** | no type / route / story |

Ground stops measured `[13,50,34]→[9,33,23]` easy, `[50,37,13]→[35,26,8]` moderate,
`[50,22,13]→[35,16,9]` hard. Nothing under 4.5 anywhere.

⚠️ **`SHARE_GROUND.lTop`'S STATED CEILING WAS WRONG AND IS NOW GUARDED BY ARITHMETIC.** The comment
claimed "the honest ceiling is between 0.145 and 0.165". Re-derived against the FAINTEST tier on the
ground's own top stop, `--ink-faint` runs **5.17 : 4.70 : 4.25 : 3.86 : 3.53** across lTop 0.105 / 0.125
/ 0.145 / 0.165 / 0.185 and **1.79 at 0.30** — so **0.145 is already under AA** and the real ceiling is
between 0.125 and 0.145. The shipped 0.125 carries 0.20 of margin on the tightest tier there is. The
guard drives `shareGroundStops` through the real ratio arithmetic for all three colours and every tier.
⚠️ **Its hue tolerance is 2.5° because 8-bit quantisation at this lightness is the floor** — the bottom
stops drift 1.33–1.75° since `#1d1607` has 22 levels between its brightest and dimmest channel. Written
at 1.5° the guard failed on correct code.

⚠️ **THE CONTOUR GUARD IS ASSERTED ON WHAT WAS STROKED, NOT ON THE SOURCE.** The texture draws into an
offscreen canvas and then `drawImage`s it, so `env()` now keeps every created canvas with a stable
recording context. That also catches the second break in the same place: if the stroke colour ever leaves
`shareTopoCanvas`'s cache key, two grounds share one picture and whichever drew first wins.

⚠️ **`shareGroundUnder` ANSWERS WHITE WHEN IT CANNOT LOOK, AND THAT IS WRONG FOR A CARD WITH NO
PHOTOGRAPH.** Right for a picture we hold and cannot sample (fail towards protecting the ink), wrong
where the ground is known exactly — left unfixed, every no-photo card thickened the route's deep keyline
to its bright-ground weight over a ground whose lightest pixel is lightness 0.125. `shareRectGroundRGB`
is the one answer to "what is under this rect", and it reads the top stop because that is the brightest
the ground gets anywhere on the card.

### THE DESTINATIONS GUARD PROVED THE DISPATCH *MENTIONED* AN ACTION, WHICH IS NOT HANDLING IT

The row's shape was confirmed sound by re-break. Its guard was not. `test/share-studio.test.ts`'s
"every control is reached by its delegated handler" BLOCKER matched `=== "<action>"` in `studioClick`, so
replacing the Copy-caption branch with a bare `return;` passed — the looks-live-is-inert class this
project has shipped three times (`rdMore`, `#saveSetup`, the profile confirm button). It now bounds each
branch to **its own statement** and requires it to reach a function that exists in the app script.
- ⚠️ **THE OBVIOUS SLICE IS THE COLLECTION-TOO-WIDE TRAP.** From this action's test to the next one, the
  LAST branch's slice runs to the end of `studioClick` — which contains the tool, template, metric,
  aspect and privacy families and their calls, so an emptied final branch is "handled" by somebody else's
  code. A block closes at its matching brace, a one-liner at its own semicolon.
- ⚠️⚠️ **AND THE ACTION LIST ITSELF HAD A HOLE, WHICH IS WHY THE FIRST RESTATEMENT STILL DID NOT CATCH
  IT.** `studioDestTile` writes `data-sst="' + action + '"`, so **`share` and `caption` appeared in no
  literal attribute anywhere** — the derived set held fourteen actions and neither of those two. The
  sweep now enumerates the builder's own call sites, asserts there is exactly ONE builder writing a
  computed `data-sst` (a second one forces this list to be updated), and asserts the builder still writes
  its first argument into the attribute. **A guard over a collection is only as good as the collection.**
- ⚠️ The function-name set is bounded to the app's own `<script>` block, not the whole page: the built
  page carries the MINIFIED engine, so a whole-page set contains dozens of one-letter names and a branch
  calling any of them would count as handled.

### The eleven re-breaks, repeated against the finished tree

(see the phase report for the table; the five that used to escape are the five listed at the top of this
section, and every one of them now fails a named guard)

⚠️ **THE BACKTICK RULE FIRED ONCE MORE, IN A COMMENT** — `` `intensity: "moderate"` `` inside the new
mapping's note. The build failed outright, which is the good outcome, and it is the only reason to keep
reading the build's exit code before trusting anything after it.

## THE SHARE DESTINATIONS BECOME APP TILES, AND THE BOTTOM FADE IS HALVED AND EASED (ruling 8, items 3 and 4)

Both web-only, so both reach the phone over the air on the next launch. Suite 1104 → **1111**; 33 deliberate
re-breaks, **all 33 caught** (two only after the guard or the break was restated — both recorded below).

### ⚠️ A TILE MAY NAME AN APP; IT MAY NOT CLAIM TO POST TO IT — AND THAT REVERSES A GUARD FROM THE DAY BEFORE

*"I want the icons to the different social media options like shown in the screenshot, with the more button
allowing the further options that we already have when pressing share."* The row was two tiles plus a
paragraph explaining that named apps were the honesty limit. **They are not: the limit is on claiming a
DIRECT POST, not on naming where a card can go.** `test/run-debrief.test.ts` carried *"a destination row is a
named third-party app, which cannot be guaranteed installed"* — that assertion is **inverted, not deleted**,
exactly as the PRICE/RICE reversal was: a destination MAY name an app, and if it does it must open the system
share sheet and its accessible name must say so.

- **`SST_DEST` is the four records** (Instagram, WhatsApp, Messages, More), each carrying a label, a glyph
  and a **`native` note saying what a direct handoff would need** — asserted to exist, so a fifth tile cannot
  arrive without somebody having thought about it.
- ⚠️ **ONE ROUTE, ASSERTED AS A COUNT.** `studioDest` has exactly one `doShareRun` and no branching on the
  id. Four tiles each dispatching for themselves is four chances for one to be wired to something its own
  logo does not imply, and a per-branch guard can only ever prove a branch calls *something*. Re-broken by
  giving one id its own branch, by swapping in `saveShareCard`, and by opening a URL scheme.
- ⚠️ **THE ROUTE IS IN EVERY ACCESSIBLE NAME, FROM ONE CONSTANT.** `SST_VIA` is appended by the builder;
  typed into four records it could be omitted from one, and the one omitted is the tile that would appear to
  post directly. The visible label stays the app's name so WCAG's "label in name" holds and a voice-control
  user saying "tap Instagram" still matches.
- ⚠️ **NO CAPABILITY FLAG WAS ADDED, DELIBERATELY.** The coach-audio shim is gated on
  `window.__interunCoachNativePlay` because the page owns that sequencing and only playback moved; here the
  whole handoff is native, so a flag would gate a branch nothing can reach — which this project treats as a
  defect in its own right. `LSApplicationQueriesSchemes` now carries instagram-stories, instagram, whatsapp,
  fb-messenger-share-api and sms, so a native build can at last **ask** whether an app is installed; asking
  is not handing off.
- ⚠️ **COMMUNITY IS DELIBERATELY OMITTED** and a guard forbids it. His screenshot's row carries the reference
  app's own community feed; ours is a placeholder tab with no backend.
- ⚠️ **THE MARKS ARE OURS AND THE TWO BUBBLES HAD TO BE MADE TO DIFFER.** Inline SVG on the app's 24-unit
  grid, `currentColor`, no hex, no gradient, nothing fetched — the app ships with no external network assets
  at all, and a third-party logo embedded as a data URI would be their artwork inside our bundle. A chat
  glyph and a messages glyph are the same shape, so the first cut was two identical marks with only the label
  to tell them apart, which is the row's whole job undone. One carries a handset, the other three dots.
  ⚠️ The single-point paths (`M17 7h.01`) are **dots**: a round cap on a zero-length segment paints a disc,
  where a 1-unit circle renders as a ring and reads as a second camera lens.
- ⚠️ **COPY CAPTION LEFT THE ROW, AND THAT IS NOT A DEMOTION.** It is the only control here that puts nothing
  on screen, so it has to report — and "Copied" / "Not copied" does not fit a 66px tile at the top of the
  text-size range. It is a full-width secondary now, still `data-sst="caption"`.

⚠️ **IT WRAPS, IT DOES NOT SCROLL.** Measured: at 320px with `--tscale` at its 1.3 cap the four labels plus
their padding need ~346px against 288px of sheet, so one row cannot hold them — and a scroller then puts
**More**, the one honest fallback, half off screen with no cue. `flex-wrap` with `flex: 1 1 auto` puts it on
a second row at full size. **Measured live in the served page across 8 combinations (2 themes × {430×932,
320×568} × `--tscale` {1.0, 1.3}): 4 tiles always present, 1 row at 430px and 2 at 320px, every tile ≥ 44px
in both dimensions, 8 buttons all reached by a handler attribute, 0 inline `onclick`, and
`documentElement`/`body`/sheet horizontal overflow 0 in all 8.** Driving the tiles with `doShareRun` stubbed:
all four call it with the studio's own run and with the sheet already dismissed; an unknown id does nothing
and leaves the sheet open.

⚠️ **CONTRAST FROM RENDERED PIXELS** (`Page.captureScreenshot`, hand-decoded PNG): tile labels **14.45:1
dark / 15.73:1 light**, the marks **7.40 / 4.83** (aria-hidden, so the 3:1 non-text floor is the applicable
one), the note **5.72 / 5.18**, Copy caption 14.45 / 15.73. Nothing under 4.5.

### ⚠️ THE BOTTOM FADE: HALVED IS ONLY HALF THE FIX, AND HALVING ALONE MAKES THE LINE WORSE

*"the gradient at the bottom of the card is too high, it needs to be halved in distance and also needs a more
natural fade, i can see the line where it stops on the current one."*

`fadeK 0.34 → 0.17`, `fadeMin 200 → 100`, `fadeMax 360 → 180`. ⚠️ **THE CLAMPS HAD TO HALVE WITH THE
COEFFICIENT**: two of the eight real fades sat ON the lower clamp (the poster at both aspects), so halving
`fadeK` alone would have left the owner's own template completely unchanged while the other six moved.
Measured: story 282/312/325/250 → **141/156/163/125**, feed 228/272/291/200 → **114/136/146/100**.

⚠️ **THE VISIBLE LINE IS A MACH BAND AND `shareEase` IS SMOOTHERSTEP (6t⁵−15t⁴+10t³), WHOSE FIRST *AND*
SECOND DERIVATIVES VANISH AT BOTH ENDS.** smoothstep zeroes only the first and its curvature is at its
**maximum exactly at the boundary** — the one place it must not be. The curvature did not vanish, it moved
into the middle, where there is no boundary for the eye to lock onto.

⚠️ **MEASURED AS BOUNDARY PROMINENCE — the curvature AT the fade's top row over the worst curvature
elsewhere in the same fade: 7.13 before → 1.21 after, median 5.38 → 0.95 across 504 cards.** The raw
profile says it without a metric: before 1000.0 / 1000.0 / 962.2, a 37.8-unit step in four rows; after
1000.0 / 1000.0 / 1000.0 / 991.1 / 964.7.
⚠️ **AN EARLIER VERSION OF THIS NOTE CLAIMED "0.069889 → 0.008898, 7.9× smaller" AND THAT WAS THE PROBE
READING ITS OWN FLOOR.** 0.008898 is one 8-bit step at white and is never the shipped boundary on any of
the 32 flat cards (min 0.007224, median 0.034495, max 0.069023); the tell was the stop sweep below
reporting it identically for 12/24/48/96. The absolute figure really moves 0.072318 → 0.069023 (1.05×),
and at lag 12 the shipped state reads 1.35× **worse** — because the fade is now half as long, so its
curvature per pixel is 1.76× steeper and an absolute reading is confounded by the change the ruling
asked for. **Prominence is scale-free, which is why it is the ruler.** Do not reinstate an absolute
threshold: two of the three instruments tried here reported this fix backwards or not at all. What is
still true is that
smooth as the encoding can express (at lag 4 it is **0.000000**). Against the sunset photograph's own
vertical structure at the same lag (0.0065) the old edge stood **5.2–5.8× above the picture** and the new one
sits at **0.3–1.2× of it**. ⚠️ **HALVING ALONE MEASURES 0.120783**, i.e. 1.7× *worse* than what he reported
seeing — which is why the two halves of the ruling ship together.

⚠️⚠️ **THREE INSTRUMENTS WERE TRIED AND THE FIRST TWO REPORTED THE FIX AS BARELY WORKING.** Worth knowing
before anyone re-measures this:
1. **A pointwise second difference measures the ENCODER, not the edge.** The fade changes alpha by well under
   1/255 per row, so the delivered bytes step in whole units and d² is a train of quantisation spikes: the
   residual on flat white was **0.00099 both before and after**, which is one byte smoothed over nine rows.
2. **A slope difference over a ±12px window is no better.** 12px is 12% of a *halved* fade, by which point an
   eased curve has picked up real slope — it reported the fix as **1.7×** while the boundary had gone flat,
   and its ±30px form reported the fix as **worse than before**.
3. **The lag has to be matched to the scale of the thing being measured.** At lag 8 the answer is unambiguous
   and stable across lags 4 and 16.

⚠️ **`stops: 48` IS MEASURED, NOT PICKED, and `stops: 1` reproduces the old straight line EXACTLY** —
smootherstep sampled at its two endpoints *is* a line — which is what makes the A/B one field in one process
rather than an appeal to history. Swept 8/12/24/48/96: boundary Laplacian at lag 8 **0.017749 / 0.008898 /
0.008898 / 0.008898 / 0.008898** and at lag 4 **0.008898 / 0.008898 / 0.000000 / 0.000000 / 0.000000** — it
**converges at 24** and 48 is margin bought for nothing (a gradient stop costs no draw call). Below 12 it does
not converge: at 8 the first segment is an eighth of the fade long and is still a straight line.

⚠️ **AND HALVING IT CANNOT LOWER THE ALPHA UNDER ANY GLYPH, WHICH IS WHY IT IS SAFE.** The alpha is solved
from the brightest ground inside the BLOCK rect and the gradient reaches it at `blockTop - knee`, ten pixels
above the topmost glyph; the fade's length decides only where the ramp *begins*, all of which is above the
copy. **Measured over 160 card states (10 hostile grounds × 2 aspects × 4 templates × both fit modes): the
solved alpha identical in 160 of 160, and comparing the finished cards pixel by pixel from `blockTop - knee`
down, the worst byte anywhere differs by 1, in 8 of the 160, at 257 bytes of 2,721,600** — gradient-LUT
rounding in the tail below the copy, not a change in the picture. Against a ground-only twin the tier floors
are unmoved to three decimals: **ink 10.349, accent 4.948, inkSoft 5.031, fast 5.093, slow 3.303**, nothing
under its target either side. The clamp-headroom pair (0.90 solved against a 0.92 cap) is untouched.

⚠️ **A FLOOR SWEEP MUST GIVE EACH TEMPLATE ITS OWN TIER SET.** Applying all six to all four reported
`inkFaint` at 3.508 and "106 readings under target" — `inkFaint` is in no template's list but The
Execution's, exactly as `shareScrimText`'s own note says.

⚠️ **THE GROUND-ONLY TWIN IS `shareGroundPaint` + `sharePhotoDraw(g, m.photo, gm)` — AND `sharePhotoDraw`
TAKES THE PHOTO, NOT THE MODEL.** The first version passed the model and called `shareGroundFill`: nothing
drew, the twin was a flat sheet of `#04100d`, and it reported the fade band on a **pure-white** photograph as
luminance 0.0047 — which is the ground's own value, and the tell that the picture was never there.

### Four measurement traps this phase paid for, all mine

1. ⚠️ **A BOX-PERCENTILE CONTRAST PROBE REPORTS AN ARTEFACT AS A DEFECT.** 99th/15th percentile inside each
   planned rect: a rect that is mostly empty ground has ground at both percentiles and the ratio collapses to
   ~1. It reported a **2.016 floor** on type that plainly reads, identically before and after.
2. ⚠️ **MATCHING PIXELS TO A TIER'S OWN HEX FAILS ON A WHITE PHOTOGRAPH.** The picture's own pixels are within
   6 of the warm-white ink, so "glyph cores" included half the sky and the floor came out at **1.03**.
3. ⚠️ **`Page.captureScreenshot` CAME BACK AT A SCALE I ASSUMED RATHER THAN DERIVED**, and separately **the
   launch splash holds for two seconds** — `openShareStudio` exists long before the transition finishes, so
   the boot check passed, the studio opened underneath the splash, and every reading came back at ~1.01:1 off
   a flat teal field, which reads exactly like catastrophic contrast failure. The probe now derives the scale
   and **refuses to believe a sweep in which no tile label reads as ink**.
4. ⚠️ **AN EXTREME, NOT A PERCENTILE, FOR SMALL TYPE.** At 11px the strokes are a few device pixels wide, so a
   2nd-percentile "ink" lands inside the anti-aliased ramp: it read the note at **3.87:1** where the token
   delivers 4.56.

⚠️ **AND SHIPPING PIXELS BACK FROM THE PAGE RAN NODE OUT OF HEAP** — 2.9M numbers per card × 160. The
before/after comparison is done inside the page and only the summary crosses.

### Two of the 33 re-breaks needed a restatement, and one was the break's fault

⚠️ **"THE ALPHA IS SOLVED FROM THE FADE RECT, NOT THE BLOCK" ESCAPED A GUARD WHOSE FIXTURE WAS A FLAT
GROUND.** The brightest pixel is the same either way, so the rect could grow upwards and change nothing —
the fixture-too-kind trap, in the one test whose whole subject is which rect is sampled. The probe is now
**banded** (white above the block, near-black inside it) and the test **proves the fixture can see the
difference** before relying on it.

⚠️ **AND ONE APPARENT ESCAPE WAS THE BREAK AIMED AT THE WRONG FILE.** Deleting *"cannot post to them
directly"* leaves `run-debrief`'s assertion (which pins the sentence saying WHERE the apps are) correctly
passing; the clause is `share-studio`'s. The break was re-aimed, not the guard weakened.

⚠️ **A PRE-EXISTING GUARD PINNED THE COUNT OF GRADIENT STOPS AT THREE**, which the ease breaks by design.
Restated to the ends plus `> 3` — because a count of three IS the artefact — with the count itself moved to
the ease's own guard. Its real claim (interpolate the gradient at the top of the copy and require more than
the solved alpha) was untouched and still fails when the knee is removed.

⚠️ **THE BACKTICK RULE FIRED ONCE, in my own comment** (backticks around a field name), and the build failed
outright — which is the good outcome and the reason to read the exit code.

**Verified:** build exit 0, `docs/voices/` clean after every build, `node --check` OK on all three emitted
blocks, `npx tsc --noEmit` clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date
overload, **`node --test` 1111 pass / 0 fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**
with `CHROME_PATH` set, both design ratchets unchanged (the new CSS is `flex`/`min-height`/`white-space`,
`var(--r-ctl)` and `var(--t-label)`/`var(--t-body)`), and all four Xcode targets compiling — `InteRun` Debug
on the simulator with the watch app and widget embedded, `InteRunUITests` build-for-testing, and `InteRun`
Release for `generic/platform=iOS`, 0 dylibs in the watch app in either configuration. No test titles were
removed; 7 added, accounted for one by one.

⚠️ **STILL NATIVE, STILL WAITING FOR AN XCODE BUILD:** the three privacy strings and
`LSApplicationQueriesSchemes` already in `ios/InteRun-Info.plist` (which is what fixes the camera crash), and
every direct handoff named in `SST_DEST`'s `native` fields. `pc-share` on the Road Map therefore stays
**unticked**.
