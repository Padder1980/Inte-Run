# Inte-Club text editor — typing on the picture, styles, gestures, guides

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## HIS SIX SCREENSHOTS OF THE TEXT EDITOR AND THE TRIM (owner, 2026-08-24)

Six issues, written on the pictures: the playhead past the slider wall; the text-editing layout too
cluttered; pinching and moving still jittery; the plate far too big while editing; changes only taking
effect on Done; and the screen flashing black on finger-up. **Two of them turned out to be one cause and
one of them was a cause nobody had named** (the media element being rebuilt on every redraw). Suite 1284 →
**1293**; 30 deliberate re-breaks, all 30 caught — two only after a guard was restated, and those two are
the useful half. Web-only, so all of it reaches his phone on the next launch.

### ⚠️⚠️ THE PLAYHEAD WAS A SIBLING OF THE WINDOW, AND "INSIDE IT" WAS NOT ENOUGH ON ITS OWN

As a sibling it was placed as a fraction of the **whole strip**, so at the start and end of playback it
sat on top of the 14px white bracket ends — a white line over a white wall, which reads as the marker
having escaped. Two changes, and the second is the half that would be missed:
1. **It is a child of `.club-win` now**, so it is positioned against the padding box the border has
   already inset and physically cannot reach them.
2. ⚠️ **AND THE TRAVEL IS INSET BY THE MARKER'S OWN WIDTH.** Centred on its position (`margin-left:
   -1.5px`) **half** of the 3px marker still sat over each wall — measured 1.5px at both ends, which is
   his complaint in miniature. `left: calc(f * (100% - 3px))` with no negative margin: at 0 its left edge
   is the wall's inner face and at 1 its right edge is. Measured after: overlap **0 at both extremes**,
   `phL 38 = innerL` and `phR 257.9 = innerR`.
⚠️ **The width in the CSS and the inset in the arithmetic are one measurement**, and the guard compares
them rather than pinning either — two owners drift.

⚠️⚠️ **`requestAnimationFrame` FIRES ZERO TIMES IN THE HEADLESS CHROME THIS REPO TESTS IN.** Measured: **0
frames in 1.2 s while `setInterval` managed 25 in 0.4 s**, with `--disable-renderer-backgrounding`, a
screencast forcing the compositor, and every other flag tried. So the playhead's MOTION cannot be driven
in a browser here at all — which is why `clubPhFrac` was split out as a pure function: **the arithmetic
is provable in node and the containment is provable in pixels, and neither claim has to be taken on
trust.** Worth knowing before anyone re-measures this, and worth knowing that the previous phase's
playhead verification was therefore geometry only.
⚠️ **The fraction is over the SELECTION, not the clip** — 0 is the first chosen frame and 1 the last,
which is the only reading that means anything to somebody watching their own fifteen seconds. The
discriminating case is a window that does **not** start at zero: mapped over the clip, a 4–19 window puts
its own start at 4/19 = 0.21. And it is **clamped as well as hidden**, because a frame can land between
the clamp and the class.

⚠️⚠️ **CORRECTION, 2026-08-28: "requestAnimationFrame FIRES ZERO TIMES IN THIS REPO'S HEADLESS CHROME"
IS FALSE, AND THIS FILE ASSERTED IT IN THREE PLACES.** Re-measured four times — by me and by three
independent reviewers — at **112–122 frames per second in the loaded app**. The original zero was taken
with the headless window at its default size, where `window.innerHeight` is **1** and there is nothing
to composite; `Browser.setWindowBounds` fixes it, and the same 1px window is what made `#view` measure
112px and read as a broken layout. **So the harness was the fault, not the browser** — and the two
design decisions that cited the zero (splitting `edgeScrollDelta` from `dragEdgeTick`, and rejecting an
rAF-gated aperture) are still right for other reasons, but the reason they gave was wrong. An
rAF-driven loop IS provable here. What genuinely does not work is **pausing an animation and then
calling `Page.captureScreenshot`** — that hangs, measured twice.


### ⚠️⚠️ THE BLACK FLASH WAS THE MEDIA ELEMENT, AND FIXING IT AT SOURCE FIXED FIVE THINGS AT ONCE

*"the screen flashed black once you take your finger off"*. `clubEdDraw` writes a fresh `<video src>` into
`innerHTML`, which starts a new load — and a loading video paints black for a frame or two. **Every
redraw did it**, so any tap or drag that redrew flashed.

`clubEdKeepMedia(sl)` **adopts** the existing element instead: detached before `innerHTML` wipes it,
re-attached immediately after, keeping the decoder, the `currentTime` and the playing state. Measured
through the real editor: opening the text editor, tapping five tools and pressing Done all left **the same
element** with the video playing straight through (4.22 → 5.02 → 8.2 s).
- ⚠️ **ONE PLACE DECIDES, so no call site has to know to avoid redrawing.** Individual paths still avoid
  it where they can — the drag paints in place — but a path that *has* to redraw no longer costs a flash.
  That is what let `clubTextOpen` redraw once on open, which it must (below).
- ⚠️ **ONLY WHEN THE SOURCE AND THE KIND BOTH MATCH.** Reusing across sources shows the wrong picture,
  which is far worse than a flash.
- ⚠️⚠️ **A REUSED VIDEO NEVER FIRES `loadedmetadata` AGAIN**, so everything `wireClubEd` hangs off that
  event has to be driven by hand — the trim rebuild, the thumbnails and the playhead. Without it the
  reuse trades a **visible** flash for an **invisible dead trim**, which is worse. The guard asserts the
  gate is exactly `keepMed && sl.isVid && sl.dur`, because `if (false && …)` leaves every call in place.
- ⚠️ **`CLUBED_MED` IS CLEARED WITH THE EDITOR.** Left set, the next session adopts a `<video>` whose blob
  URL was revoked two lines earlier in `clubEdClose` — a picture that cannot load, held deliberately.

### ⚠️⚠️ THE JITTER WAS ARITHMETIC, AND THE FIX FOR IT EXPOSED A DEAD WORD

*"the pinching and moving is a bit jittery still....its not smooth"*. The move handler read
**`ev.clientX` — the ORIGINAL pointerdown — for the whole gesture**. So a second finger landing moved the
word by however far the first had already dragged, and lifting one finger moved it back again.
`clubTxAnchor()` takes the midpoint of the fingers that are **down right now**, and every later move is a
displacement from that; it is called on **every change of finger count**, in both directions.
**Measured through real PointerEvents on the word: jump on the second finger landing 0, jump on lifting
it 0, jump on release 0, and after the lift the remaining finger moves the word by exactly its own 25px.**

⚠️⚠️ **AND THE FIRST VERSION OF THAT FIX KILLED THE WORD AFTER ONE DRAG.** It answered the second finger by
overwriting `node.onpointerdown` with its own handler and **nulling it on release** — destroying the
binding `wireClubEd` had put there, so the word could not be dragged **or tapped** again until something
redrew. **It went unnoticed for as long as a finished drag redrew; taking the redraw away is what exposed
it.** Measured: a tap after a drag did nothing at all. The gesture is a module-level record (`CLUB_TXG`)
now and a second finger **joins** it; `onpointerdown` belongs to `wireClubEd` and is never touched, so
there is nothing to restore and nothing to forget to restore.
⚠️ **A finished drag calls `clubSelPaint`, which puts the bin up without rebuilding anything** — that is
the only reason no redraw is needed. `clubRailHtml` is one builder read by both paths.

### THE CLUTTER WAS A TRANSLUCENT OVERLAY, AND THE PREVIEW WAS IN THE WRONG PLACE

*"the layout when editing text, its too cluttered"* and *"i want the text and and changes you make to the
text to be viewable accurately in real time, not when you have clicked done"* — one cause each.
- **`.club-txed` was `position: fixed; inset: 0` with `background: rgba(4,16,13,.48)`**, so the composer's
  tool row, strip and foot showed straight through it. It is an **opaque bottom panel** now with a
  one-line field, and the composer's own chrome **steps aside** while a word is being typed (`drafting`).
- ⚠️⚠️ **`clubTextOpen` HAD TO REDRAW ONCE, AND THAT IS WHY THE FLASH FIX CAME FIRST.** The draft being a
  real word on the picture and the chrome stepping aside are **both decided in `clubEdDraw`'s markup**, so
  the panel alone could bring about neither: the word appeared nowhere until a keystroke happened to fall
  back to a redraw, and the tool row and strip stayed on screen under the panel — measured, exactly the
  clutter he photographed. It costs no flash because the media element is adopted.
- **Every control repaints the word in place** (`clubDraftPaint`), so nothing waits for Done. Measured
  through the real panel — style, colour, plate, alignment and size — then compared against the committed
  word: **not one of eleven properties differs.** What you see while editing is what Done gives you.
- ⚠️ **The size slider repaints the word and NOT the panel**, or it destroys the slider the finger is on.

⚠️ **THE PLATE'S PADDING IS PROPORTIONAL TO THE TYPE** — his *"text background is far too big during the
editing phase"*. A flat `4px 12px` is right at one size and wrong at every other; it is
`max(1, px·0.04)` / `max(6, px·0.26)` with a `line-height: 1.18`, so **both** axes scale. Measured:
`1px 9px` at 34px → `1px 6px` at 20px. The guard **counts the scaling factors**, because its first
version needed only one and passed with the vertical term replaced by a flat 4.

### ⚠️⚠️ A DEFECT NOBODY REPORTED: THE KEYBOARD WOULD HAVE BURIED THE WHOLE PANEL

`.club-txed` is `position: fixed; bottom: 0` — right, because it has to sit directly above the keyboard —
and **only `.app`, `.view` and `.sheet-ov` have ever been lifted by `html.kbup`**. So on a real phone the
field, Done, the rails, the tool row and the size slider would all have been behind the keyboard the
moment it came up: every control the runner needs while typing, unreachable, on the one screen whose whole
purpose is typing. `html.kbup .club-txed { bottom: var(--kbh, 0px); }`.
⚠️ **`bottom`, NOT `padding-bottom`.** `.sheet-ov` is a full-screen overlay whose sheet sits at its foot,
so padding moves the sheet inside it; this **is** the foot, so the panel itself has to move — padding
would stretch its background down behind the keyboard and leave the controls exactly where they were.
⚠️ **FOUND BY SWEEPING, NOT BY LOOKING — a headless browser raises no keyboard.** Every rule that is
`position: fixed` and bottom-anchored, against everything `html.kbup` moves. Thirteen such rules exist;
`.club-txed` is the only one holding a text input that was not covered.

### Five guards that were scoped to a HOW instead of a WHAT — all restated, none deleted

⚠️ **THIS IS NOW THE SIXTH THROUGH TENTH FIRING OF THAT PATTERN IN THIS FILE, AND ONE OF THEM PINNED THE
DEFECT ITSELF.** `test/community.test.ts`'s pointer-ownership guard **required `node.onpointerdown = add`**
— the exact line whose removal was the fix — so it failed on correct code and would have argued for
putting the dead-word bug back. The invariant it protected (the pointers belong to the word, so one
gesture has one owner) is unchanged and better served; it asserts `setPointerCapture` plus that the
gesture is joined rather than restarted, and that **neither** drag function writes `onpointerdown`.
The other four: the tap-versus-drag guard pinned `moved = true`, `if (!moved) { clubTextOpen(i) }` and the
literal `> 4`; the pinch guard pinned `pts.size === 2` and `pinch = {`; the one-styler guard pinned the
panel's **own** preview word, which no longer exists **because there is one builder where there were two**
— so that guard got stronger, not weaker; and the size-slider guard required a multi-line handler body
ending in `"\n  };"`, which is a shape rather than a rule.

⚠️ **AND THREE OF MY OWN NEW GUARDS WERE WRONG IN THE SAME FAMILY.** The opacity check swept the whole
`.club-txed` rule and matched its **border's** legitimate `rgba(255,255,255,.12)`; the base-rule regex was
unanchored, so `.club-txed {` matched `html.kbup .club-txed {` — declared far earlier — and reported the
panel as having no background at all; and the reused-video guard looked for two calls *below*
`wireClubEd` rather than for the gate around them. **A guard that reads a neighbouring declaration, or
whichever rule comes first, is measuring something it was not asked about.**

⚠️ **THE RE-BREAK HARNESS REPORTED `0 of 25 caught` WHILE EVERY BREAK WAS BEING CAUGHT.** Its fail-line
regex was `^\W*fail (\d+)`, and **Python treats node's leading `ℹ` (U+2139) as a word character**, so
`\W*` never matched it. `\bfail (\d+)` does. Same class as this file's documented `# fail` versus
`ℹ fail` note, one layer deeper — and a harness that cannot parse a result must say so rather than report
a verdict.

⚠️ **A PYTHON SLICE RAN BACKWARDS AND DUPLICATED 115 LINES.** `s[:a] + NEW + s[b:]` where `b < a`, because
the anchor I sliced to sits **above** the function I sliced from. `node --check` caught it as
`Identifier 'CLUB_TX_MIN' has already been declared` — which is the whole reason that step is a test
rather than a documented manual step.

⚠️ **A BLOCK LANDED IN THE WRONG FUNCTION AND BUILT CLEANLY.** The re-attach was anchored on
`clubEdFit(); if (stage) clubEdGestures(stage);`, which is in `wireClubEd` and not `clubEdDraw` — so it
referenced two variables that do not exist there, and **the build passed**, because runtime JS inside the
template literal is neither typechecked nor linted. Check which function an anchor is in.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1293 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`** with `CHROME_PATH` set, both design ratchets
unchanged, and the one backtick in the emitted script is in the minified engine and identical at HEAD.
Driven end to end in a real browser at 430×932 and 320×568, both themes, `--tscale` 1.0 and 1.3:
**document, body and panel horizontal overflow 0 in all eight**, trim-versus-tools and trim-versus-foot
overlap **0**, the field and Done both clearing the 44px floor, the draft always inside the stage, and
**zero console errors**.

## ⚠️⚠️ THERE IS NO TEXT BOX — THE WORD ON THE PICTURE IS THE INPUT (owner, 2026-08-24)

His instruction, verbatim: *"screenshot 1 shows what happens when you try to type text now....i dont want
the text box.....I want the functionality to work like it does in the video i've attached.....study it
closely, ....theres no reason we cant do it like this.....analyse every part and work out how to
replicate it"* — with a 157-second screen recording of the reference. Suite 1293 → **1300**; **49
deliberate re-breaks, all 49 caught** (five only after a guard was tightened — those five are the
useful half). Web-only, so all of it reaches his phone on the next launch.

⚠️ **AND HIS SCREENSHOT WAS A DEFECT I HAD SHIPPED AN HOUR EARLIER — SEE "TWO OWNERS OF --kbh" BELOW.**
The layout he photographed was not the old design failing; it was the keyboard-lift fix I had just
pushed, doubled.

### THE REFERENCE, MEASURED FRAME BY FRAME (frames in /tmp/vid8, spec at /tmp/vid8/spec/REFERENCE.md)

Extracted with a small AVFoundation tool (no ffmpeg on this Mac) so frames could be seized at exact
times, and sampled with an `NSBitmapImageRep` pixel reader.

⚠️⚠️ **THE STRUCTURAL INSIGHT IS THAT A SCRIM REPLACES THE PANEL.** The whole picture is dimmed and
**nothing is covered**. Measured across the scrim's own transition 0.25 s apart, so the handheld camera
had barely moved (`f5/f0006.45.png` against `f0006.70.png`, x=200 y=250):

| | r | g | b |
|---|---|---|---|
| before | 117 | 144 | 165 |
| after | 45 | 57 | 66 |
| ratio | 0.385 | 0.396 | 0.400 |

Three channel ratios agreeing to 1.5% ⇒ **neutral black**, and `out = in × (1 − a)` ⇒ **α ≈ 0.60**. At
that strength white type and floating icon rows are legible over any photograph, which is why the
reference needs no opaque strip anywhere. **My opaque bottom panel was solving a problem the scrim
already solves.**

⚠️ **AND THE ALPHA IS ARITHMETIC, NOT TASTE.** The worst case is a pure-white photograph, where a black
scrim at α leaves a ground of 255(1−α); white text clears 4.5:1 only at **α ≥ 0.535**. The app's own
previous dim was **0.48 — 3.69:1, a fail**. Shipped at `rgba(4,16,13,.62)`, which is the app's own deep
ink at the reference's strength and the exact value `.club-trim` already used. Guarded by the
inequality, so a retune stays legible.

**The rest, from `f0008.00.png` (460×999, a 440×956pt recording; scale 1.0455):**

| element | measured | shipped |
|---|---|---|
| `Done` | plain white text, top right, cap 12px | `.club-txdone`, `background: none`, `min-height: var(--tap)` |
| the caret | **rgb(62,83,245) — the CURRENT TEXT COLOUR**, at x=230 = exact centre | `caret-color: currentColor` |
| the word | 31% down, horizontally centred | opens at `y: 0.34` |
| size knob | **Ø28 centred on x = 0** (half clipped), y 32.7%, pure white | `.club-szk` at `left: -13px` in a 44px track |
| active rail | 38pt pills, **no background strip at all**, scrolls sideways, selected = white pill | `.club-trail` + `.club-tst.on` — already built |
| tool row | 35pt icons on **one translucent blurred bar**, evenly spread | `.club-tts` one bar, `blur(18px) saturate(140%)` |
| keyboard | from 63.8% | chrome's bottom sits exactly on it |

⚠️ **THE RAIL HAS NO STRIP AND THE TOOL ROW DOES** — measured three ways (an inter-frame static mask, a
per-row horizontal-sd profile, and a high-pass "is the photo's texture present" probe, all agreeing).
Between the rail's pills: high-pass 2.10, sd 15.9 — the photograph, unobstructed. Between the tool
icons: high-pass 0.10, sd 0.4, with the fill's MEAN tracking the photograph (42.3→57.9 luma across six
frames) — the signature of a blurred material, not a flat wash. An earlier note in this file said "NO
BACKGROUND STRIPS BEHIND THE RAILS"; that is true of the rail and **false of the tool row**.

⚠️ **THE WORD IS DRAGGABLE WHILE THE KEYBOARD IS UP AND THE RAILS DRAW OVER IT** (`f3/f0046.50.png`
shows it dragged into the colour swatches, half hidden). The reference does not move it out of the way.

⚠️ **DRAGGING A COMMITTED WORD SHOWS "Drag to delete" AND A BIN AT THE BOTTOM CENTRE** (`f2/f0128`) —
not a bin in a corner, which is what the old design had.

### ⚠️⚠️ TWO OWNERS OF --kbh, AND THE CHROME RODE UP TWICE THE KEYBOARD

His screenshot — tool row jammed against the Dynamic Island, picture squeezed into a band at the bottom
— is arithmetic, and it is **my own fix from an hour earlier**. `html.kbup .club-txed { bottom:
var(--kbh) }` was added to lift the panel; `.club-txed-tools` had been reading `--kbh` in its
`padding-bottom` since 2026-08-22, **ungated on `html.kbup`**. Measured at 430×932 with `--kbh: 336`:

| | panel top | height | tools padding-bottom |
|---|---|---|---|
| no keyboard | 703.6 | 228.4 | 12 |
| **as shipped** | **31.6** | **564.4** | **348** |
| either owner alone | 367.6 | — | — |

The top edge moved up by **672 = 2 × 336**, and with a real device's 34pt safe-area inset it computes to
**−2.4, off the top of the screen**. And the rule's own comment asserted the opposite in as many words:
*"AND IT NEEDS NO SECOND OWNER OF --kbh"*. There already was one and I had not looked.
⚠️ **THE GUARD IS A COUNT, NOT A SPOT-CHECK.** Every rule whose selector names a `club` class is swept
for `var(--kbh` and the total must be **exactly 1**. The old guard checked one selector for one extra
term and was structurally blind to a descendant selector doing it.

⚠️ **AND THE PAN WOULD HAVE ADDED A SECOND DISPLACEMENT ON TOP.** `#clubEd` and `#clubTxEd` were both
appended to `document.body`, **outside `.app`** — and `followPan` translates `.app` alone. Measured:
a body-level fixed element's rect is **byte-identical under `followPan(160)`**, because `position:
fixed` resolves against the layout viewport and only a transformed *ancestor* changes that; `.app` is a
sibling. So the app was correcting an invisible shell while the visible panel slid. `openClubEditor`
now mounts into `.app`, which costs nothing when no pan is live and carries the editor when one is.

### TYPING ON THE PICTURE — the platform mechanics, each measured before it was written

The draft is a `contenteditable` `.club-tx` built by the **one** word builder (`clubTextSpan`), keyed on
its own draft key `"d"` so no caller gains an argument and no second builder can mint an editable.

⚠️⚠️ **NOT `contenteditable="plaintext-only"` — IT IS DEAD ON A SUPPORTED OS.** The deployment target is
**iOS 17.0** and that value shipped in WebKit **17.4**; worse, an engine that does not know a
`contenteditable` value treats the element as **not editable at all** (measured: `isContentEditable =
false`). A runner on 17.0–17.3 would tap and get no caret and no keyboard — a silent total failure. The
shipped pairing is **`contenteditable="true"` + CSS `-webkit-user-modify: read-write-plaintext-only`**,
measured equivalent on both axes that matter (Enter → newline text nodes, `insertHTML` stripped), with
the `true` attribute keeping it editable everywhere.

⚠️ **`white-space: pre-wrap` ON THE BASE RULE IS LOAD-BEARING.** The UA stylesheet gives an *editable*
element `pre-wrap` and a read-only one `normal` — measured, the same two-line text **collapsed to one
line the moment it was committed** (82.2px → 43.1px). `text-wrap: balance` went with it: it re-balances
line breaks on every keystroke, which reads as text re-flowing mid-word under the caret.

⚠️ **`caret-color: currentColor`**, because `clubTxCss` already owns `color:` — so the caret can never
disagree with the word it sits in, plate ink included. The reference's own caret colour is a **dark**
blue that worst-cases at 1.03:1 over a mid ground and was deliberately not copied.

⚠️⚠️ **NO `preventDefault()` ON THE EDITABLE'S `pointerdown`.** It is specified to suppress the
compatibility mouse events, and focus is the default action of `mousedown` — so on the draft it would
stop a tap from ever placing the caret or raising the keyboard. `if (!draft) ev.preventDefault()`: the
committed words keep it, where suppressing the default is exactly right.

⚠️⚠️ **A TAP ON THE CHROME MUST NOT STEAL FOCUS.** Focus leaving a contenteditable is what dismisses the
iOS keyboard, so without this every colour swatch and every typeface pill would drop the keyboard
mid-edit. `ov.onmousedown = (ev) => ev.preventDefault()` is the classic toolbar-over-an-editable device
— the focus transfer stops and the click still lands. **Done needs it too**, or the keyboard starts
dismissing mid-tap and the click can be eaten.

⚠️⚠️ **A REPAINT MUST NOT REWRITE THE TEXT UNDER A LIVE CARET.** Every tool tap lands in
`clubDraftPaint`, and setting `textContent` replaces the text nodes — which destroys the selection and
throws the caret away mid-word. None of the tools changes the text, so the write is gated on the text
actually differing; rewriting the style attribute alone leaves the text nodes untouched and the caret
survives it.

⚠️ **FOCUS IS SYNCHRONOUS, IN THE TAP'S OWN TASK.** iOS only presents the keyboard for a programmatic
`focus()` still inside the user-activation window of a real gesture. The old panel's
`setTimeout(focus, 30)` got away with it for a textarea; a deferral is exactly the thing that can break
the chain, so `clubDraftFocus()` has none.

⚠️ **THE BELTS ARE PROPERTY HANDLERS BEHIND A `__wired` FLAG.** `clubDraftWire` runs after every redraw
while drafting; `addEventListener` would stack a second copy of every belt and a paste would insert
twice. The `beforeinput` belt converts Enter to a plain newline and refuses anything that is not typing,
deleting, **composing or replacing** — those last two are how autocorrect arrives, and blocking them
stops iOS correcting at all, which reads as the app being broken rather than strict.

⚠️ **THE COMMIT MUST `blur()`.** The old panel dismissed the keyboard by removing its focused textarea;
the word **stays** in the DOM, so nothing else would ever tell iOS the typing is over. It reads
`textContent`, never `innerHTML` — `esc()` writes entities and an `innerHTML` read would store them
literally.

⚠️ **`CLUB_TX_MIN` ROSE FROM 12 TO 16, AND THE GUARD FOR IT COULD NOT SEE THE PROBLEM.** iOS auto-zooms
on focusing any editable under 16px and pinch-to-zoom is disabled app-wide, so a zoomed viewport could
never be zoomed back. `test/ios-input-zoom.test.ts` scans **the stylesheet for literal px on
input|select|textarea selectors** — and the word's size is *inline*, from `clubTxCss`, on a `<span>`: out
of scope three ways over. The enforceable fact is the floor the knob and the pinch both clamp through,
and that is now guarded. ⚠️ **Words already saved at 12–15 still render** — the floor bounds what can be
*set*, and only a draft is ever focusable.

### THE DECISIONS THAT ARE NOT THE REFERENCE'S, AND WHY

⚠️ **AN EXISTING WORD IS BROUGHT UPRIGHT TO THE EDITING SLOT, AND ITS PLACE IS REMEMBERED.** Two
defences in one move. A word the runner had dragged low would put the caret **under the keyboard** —
the one thing that makes iOS pan the viewport — and a **rotated** editable is where WebKit's selection
UI (drawn outside the page's transform space) has historically been mispositioned. `S.home` holds where
it came from; a drag or a pinch during the edit **clears it**, because that is the runner choosing a
place, and Done then keeps it. Measured: y 0.82/rot 12 → edited at 0.34/rot 0 → Done restores
0.82/rot 12; and with a drag, Done keeps 0.39.

⚠️ **THE ORIGINAL IS NOT DRAWN TWICE.** The draft is a *copy* of `sl.texts[draftAt]`, so rendering both
put the old word underneath as a ghost — invisible until the first change, then two versions of one
caption at once.

⚠️ **TAPPING A SECOND WORD WHILE ONE IS BEING TYPED COMMITS THE FIRST.** Otherwise `clubTextOpen`
overwrites `S.draft` and the uncommitted word is silently lost. The tapped word is re-found **by
object**, because committing an emptied word splices the array and an old index would then name its
neighbour.

⚠️ **A TAP ON THE DIMMED PICTURE COMMITS**, which is why the scrim takes no pointer events — and while
a word is being typed the picture **neither pans nor zooms**, because moving the ground under a live
caret is not something a runner asked for.

⚠️ **DRAG TO DELETE IS THE ONE PLACE A DRAG MAY END IN A REDRAW.** A delete removes a word from the
model, so every other word's index shifts and the stage must be rebuilt or the survivors' bindings point
at the wrong entries. `clubEdKeepMedia` is what makes that redraw flash-free. A **moved** word still
never redraws. The bin is **pre-rendered hidden** and driven by class toggles, because an `innerHTML`
write mid-gesture rebuilds the node the finger is holding.

⚠️ **THE ✕ STEPS ASIDE WHILE TYPING.** It sits at the top left, a thumb-width from Done — offering
"abandon the whole post" beside "keep the word". Done and a tap on the picture are the exits.

⚠️ **THE SIZE TRACK IS INSIDE THE STAGE, twice over.** The stage's `overflow: hidden` is what clips the
knob to its measured half-circle, and the stage's `touch-action: none` is already on the pinch
suppressor's allowlist — a track outside it would need a **fifth** `touch-action: none` surface, which
`test/ios-input-zoom.test.ts` pins to exactly four. And the knob's visible half is 13px, so the whole
44px band takes the finger: measured hit height **44.98** on every control, including the tool icons,
whose hit area grows by a pseudo-element rather than the box.

### What is named rather than offered

The reference's **animations** (Typewriter / Pop / Jump) play on the finished story, so they are their
own piece of work; **Sparkle / Shimmer / Pixel** need an animation or a display face this app cannot
fetch; **Mention** needs accounts and a server; the **eyedropper** needs to sample the picture, which is
a `<video>`/`<img>` rather than a canvas here. The fx rail says so in one sentence, which is better than
a control that does nothing.

### Five guards restated, none deleted — and one of them asserted the rejected design

⚠️⚠️ **`test/club-trim.test.ts`'s "the text panel is opaque and one line tall" ASSERTED THE TEXT BOX.**
It required a `.club-txed` rule with an **opaque** background, a `.club-txed-in` field, and
`rows="1"` — the exact design he then rejected. What it was protecting (two overlapping sets of controls
must never both be on screen) is carried by `clubEdDraw`'s `drafting` gate, which this file already
guards. Inverted rather than deleted: it now asserts the reference — no text box, a scrim above its
arithmetic floor, the chrome inside `#clubEd`, exactly one `--kbh` owner.
The other four: `/clubTxSz/` (an element id, where the fact is that a size can be chosen);
`/if \(!moved\)[\s\S]{0,80}clubTextOpen\(/` (**a character window is not a card** — it could not hold the
commit-then-edit branch; fifth firing); `/clubTxEd/` in `clubEdClose` (the surface is a *child* now, so
the claim moved to the builder never appending outside the editor); and `sz.oninput` for the second time
in a day.

⚠️ **FIVE OF MY OWN NEW GUARDS WERE TOO LOOSE, AND ALL FIVE ESCAPED THEIR RE-BREAK.**
1. The base `.club-tx` rule's own **comment quotes `white-space: pre-wrap`**, so an unstripped capture
   passed with the declaration deleted — **ninth firing** of comment-quotes-what-it-forbids.
2. `/onpaste/` matched a handler renamed to `onpasteDISABLED`. **A handler must be ASSIGNED, not named**
   — restated as `\bn\.onpaste\s*=`, and the same fault was latent on the other two belts.
3. `/club-del/` matched `club-del-l` and `club-del-b`, which survived a break that deleted the wrapper
   `clubDelPaint` actually looks up. Pinned to the **id**.
4. `if (false) clubSzPaint()` left the call exactly where it was — **the gate, not the mention**.
5. A `clubTxIn` sweep matched `clubTxInk`, the live plate-ink function, reporting the styler as the dead
   text box. **Word-bounded.**

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1300 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both ratchets unchanged on their
ceilings (143 radii, 322 font sizes). Driven end to end in a real browser at 430×932, 375×812 and
320×568 at `--tscale` 1.0 and 1.3, with a synthetic keyboard: **the chrome's bottom edge sits exactly on
the keyboard's top edge (clearance 0) at every size**, the word is **238 / 203 / 110 px clear of the
keyboard** so iOS has no reason to pan, `documentElement`, `body` and the chrome all overflow **0**, the
rail scrolls, every control's hit height measures **44.98**, and zero console errors.

⚠️ **NO SCREENSHOT WAS POSSIBLE.** `Page.captureScreenshot` times out in this headless Chrome under
every flag combination tried (`--headless=new`, `--headless=old`, `fromSurface: false`, a forced
screencast) — the same missing compositor that makes `requestAnimationFrame` fire zero times here. So
the visual is **unverified by eye**; the geometry, the hit areas and the contrast arithmetic are what
back this, and the reference's own numbers are what they were checked against.

⚠️ **ONE FLAKE, REPORTED RATHER THAN EXPLAINED AWAY.** One `TZ=Pacific/Kiritimati` run reported 3
failures whose names did not survive to be captured; three consecutive re-runs are **1300 / 0**, HEAD is
1293 / 0 in the same timezone, and this matches the browser-backed `share-export-bytes` flake this file
already records as unreproduced.

## THE VIDEO STORY HAS SOUND, AND THE FIVE THINGS HE FOUND IN THE TEXT EDITOR (owner, 2026-08-25)

Two reports and one instruction, all web, so all of it reaches his phone on the next launch. Suite
1332 → **1335**; 11 deliberate re-breaks, all 11 caught (one only after the guard was brace-matched).

### THE STORY'S SOUND — *"when i try to add a video story to my inte-club page, the sound doesnt play...its muted"*

Every video in the club was `muted`, everywhere, because that is right for a wall of tiles and wrong for
the one clip somebody is deciding about.

⚠️ **THE EDITOR OPENS UNMUTED AND CARRIES A SPEAKER BUTTON; A GRID TILE STAYS MUTED.** Choosing a
fifteen-second window is a decision made largely BY EAR — a silent preview makes the trim a guess — and
`CLUBED.muted` starts `false`. Fifteen tiles all shouting at once is the opposite problem, so the flag
is per-surface rather than global: `clubFillMedia` takes `data-cplay`, and only the surface that is
genuinely playing one clip to one person asks for audio.

⚠️ **AND THE ADOPTED ELEMENT HAS TO BE TOLD.** `clubEdKeepMedia` reuses the live `<video>` across a
redraw precisely so the picture does not flash — so it keeps whatever `muted` it already had, and the
speaker button would appear to do nothing on the next repaint. `if (sl.isVid) keepMed.muted = !!S.muted`
on the adopt path is what makes the button stick.

⚠️ **UNMUTED PLAYBACK CAN BE REFUSED, AND THE FALLBACK IS TO PLAY MUTED RATHER THAN NOT AT ALL.**
Autoplay with sound is blocked without a user gesture in every engine this page meets. `clubPlayHero`
catches the rejection and retries muted, so the worst case is a silent clip rather than a still frame —
and the speaker tap IS a gesture, so pressing it works even where the automatic attempt did not.

### ⚠️⚠️ THE FIVE TEXT-EDITOR FAULTS, AND FOUR OF THEM WERE CONTROLS THAT LOOKED LIVE

His words: *"1. No neon effect takes place when there is a border and the cant slide the text size
because its falling off the edge of the screen / 2. The test doesn't move the alignment in screenshot 2 /
3. Theres 3 dots to show more options on the colours but nothing happens if you try to swipe / Also i
think it would be nice to have more font options and more text effect options"*.

⚠️⚠️ **1a. THE EFFECT WAS DROPPED BEHIND A PLATE BY AN if/else, AND THE FIX IS ONE SENTENCE.**
`clubTxCss` read *if plate → text-shadow: none, else if neon → glow*, so with the highlight on it never
looked at the effect at all. **text-shadow and box-shadow take the same parts**, so the shadow is now
built once and then aimed: **with a plate on, a shadow effect is drawn on the PANEL instead of the
glyphs.** A yellow panel glowing yellow is what a neon sign is.
⚠️ **THE GLOW USES THE PLATE'S COLOUR, NOT THE COMPUTED INK.** The ink is deliberately the opposite of
the plate (black words on a white plate), so a glow in the ink is a black halo — a shadow wearing neon's
name. Verified in the browser: `box-shadow: rgb(255,214,10) 0 0 6px, …` with `text-shadow: none`.
⚠️ **AND THE HOLLOW EFFECT NEEDS ITS CARET BACK.** `.club-tx[contenteditable]` sets
`caret-color: currentColor` so the caret can never disagree with the word — and Outline sets
`color: transparent`, so the word being typed would have had no visible caret at all. Named explicitly,
inline, where it wins. Measured: stroke 2px, fill transparent, caret `rgb(255,214,10)`.

⚠️⚠️ **1b. COPYING THE REFERENCE'S HALF-CLIPPED KNOB WAS THE DEFECT.** It shipped `left: -13px` in a
44px track so 13 of its 26 pixels sat outside the stage's `overflow: hidden` — measured, deliberate, and
faithful. A control the runner can see half of is one they do not believe they can grab, and the visible
half sits in the screen edge iOS reserves for itself. **Reference fidelity loses to being usable when the
owner reports he cannot use it.** Measured after: the knob spans **12→38 within the stage**, wholly
visible.
⚠️ **AND THE TRACK WAS A QUARTER OF THE STAGE FOR AN 80px RANGE** — five sizes in every eight pixels of
travel, so the knob moved further than the finger meant on every drag. 27% → **46%** (459px measured),
and the rail is drawn under the knob's own centre rather than at the screen edge.

⚠️⚠️ **2. `width: max-content` IS WHY ALIGNMENT DID NOTHING VISIBLE.** The box hugs its widest line, so
`text-align` has nowhere to move a SINGLE line to — the lines of a wrapped caption did align, which is
why this looked like it half worked. `clubAlignSnap` adds the other half: Left and Right also put the
BLOCK against that edge of the picture, which is what those two words mean to somebody reading them.
Measured on a 234px caption in a 452px stage: Left 14px from the edge with 205px to the right, Right the
mirror, Centre 109/109.
- ⚠️ **THE ANCHOR IS NEVER CHANGED, ONLY x.** Giving Left its own transform origin would be exact with no
  measurement at all — and would make the word JUMP by half its width the first time it was dragged
  afterwards, because the anchor point would have changed meaning under `clubTextDrag`. One layout read
  on a tap is the cheaper trade.
- ⚠️ **THE CONTAINING BLOCK IS `offsetParent`, NOT A SELECTOR** — `left` is a percentage, so the box it
  resolves against is whichever positioned ancestor the browser chose. Asking the element removes the
  chance of measuring the stage while the percentages resolve against the layer inside it.
- ⚠️ **AND A CAPTION WIDER THAN THE PICTURE CANNOT BE PUSHED OFF IT.** The clamps are the feature, not
  tidiness: swept 100–990px wide, neither edge ever leaves the card.

⚠️⚠️ **3. A PAGE INDICATOR OVER SOMETHING THAT CANNOT BE PAGED.** Three dots sat under a rail that
rendered **only the current page**, so there was nothing to swipe to. All three pages are in the DOM now,
one full-width `scroll-snap` slide each — native scroll rather than a JS drag, because the swatches live
inside a stage that already owns pinch and drag and the browser arbitrates the axes for free. Measured:
`scrollWidth` 1356 = 3 × 452, exactly ten swatches visible per page, the dot following the swipe both
ways.
- ⚠️ **THE DOT SCROLLS THE STRIP AND DOES NOT REDRAW IT**, and its own state is a class toggle for the
  same reason: rebuilding a scroller under the finger is how the composer's dial row came to jump back to
  the start on every tap.
- ⚠️ **THE PAGE IS RESTORED AFTER THE REDRAW A SWATCH TAP DOES CAUSE**, or choosing a colour on page
  three snaps the strip back to page one. Verified: picked `#5a5a5a` on page 3, strip stayed on page 3.
- ⚠️⚠️ **AND THE DOTS' HIT AREA CANNOT REACH 44px HERE, WHICH IS STATED RATHER THAN CLAIMED.** They
  shipped as 6px squares while they were mostly decoration. Measured by bisecting `elementFromPoint`:
  **28 × 19px with zero overlap**, and all four sides are bounded by a neighbour that would otherwise
  lose a tap it deserves — the swatches above carry their own grown areas, the tool row below is a later
  sibling and paints over anything reaching into it, and three dots cannot each take 44px across without
  one winning the middle of its neighbour. **An earlier attempt asked for 44 (`inset: -19px`) and measured
  29**, because the half reaching under the tool row simply never wins; asking for what is reachable
  keeps the source honest. The swatches' own 31 × 35 targets are unchanged, so growing the dots stole
  nothing. The swipe is the primary route — these are the fallback.

⚠️ **4. TEN TYPEFACES AND SIX EFFECTS, AND EVERY FACE IS ONE THE PHONE ALREADY HAS.** Serif, Rounded
(`ui-rounded` = SF Rounded), Script (Snell Roundhand) and Marker (Marker Felt) join the six; Outline,
Shadow, Echo and Lift join Plain and Neon. **No webfont URL**: the app ships with no external network
assets and the artifact CSP blocks font hosts, so a named style is a system stack plus a weight, a case
and a tracking, every chain ending in the sans stack — and the rail sets each pill in its own face, so a
fallback is visible at the moment of choosing rather than after posting.
⚠️ **THE EFFECTS ARE A TABLE AND THE RAIL IS DERIVED FROM IT**, so a seventh cannot arrive without a pill
for it, and the aiming rule above is swept over every member rather than checked on neon alone.

⚠️ **THE fx NOTE'S OLD WORDING CONFLATED TWO DIFFERENT LIMITS** — it said moving effects "need a server",
which is true of a mention and untrue of an animation (that needs animation work, and plays on the
finished story rather than in the editor). Two sentences now, each true.

### The guard weaknesses this round exposed

⚠️⚠️ **A HANDLER BODY MUST BE BRACE-MATCHED, NEVER SLICED TO THE NEXT `});`.** The colour dot's own body
contains `c.scrollTo({ … });` — which IS a `});` — so a window closed inside it and a deliberate
`clubTextDraw()` added two lines below **escaped the guard that forbids one**. Measured escaping.
**Twelfth firing of the character-window-is-not-a-function trap**; `braced()` in
`test/community.test.ts` and the brace-matched dispatcher loop in `test/club-trim.test.ts` are the
remedy, and `test/club-trim.test.ts`'s own pre-existing lazy regex had the same hole.

⚠️ **THE "EVERY CHROME DISPATCHER REPAINTS THE WORD" SWEEP WAS RESTATED, NOT RELAXED.** A control that
changes how the WORD LOOKS must repaint it; a page dot changes which swatches are on screen and nothing
about the word, so demanding a repaint there is demanding one for a change that did not happen. Told
apart by what the dispatcher does — it moves a strip — rather than by its name, and **at most one may
claim the exemption**.

⚠️ **THREE LIFT LISTS WENT STALE AND ALL THREE FAILED LOUDLY** (`clubTxFxOf is not defined`). That is the
acceptable kind of stale. The effect table is read **out of the built page** in both lift sites rather
than typed into the test — a supplied table means the lifted function runs against the TEST's effects,
which is the probe-supplies-its-own-constants trap this project has measured escaping a guard twice.

⚠️ **AND TWO OF MY OWN NEW GUARDS WERE WRONG BEFORE THEY WERE RIGHT.** `fn(src, name)` is
`club-trim`'s signature and `fn(name)` is `community`'s — mixing them passed the whole page as a
function name. And the overhang guard asserted a 900px caption in a 1000px stage lands at exactly 0.5,
which **failed on correct code**: it lands at 0.48, leaving 30px left and 70px right, i.e. genuinely as
flush left as a box that wide can be. The claim is that neither edge leaves the card, swept, because the
clamp only binds past 94%.

⚠️ **THE `\n`-IN-A-STRING TRAP FIRED IN THE PATCH SCRIPT RATHER THAN THE APP.** A single `\n` in a Python
heredoc becomes a real newline, so the test file gained a string literal broken across two lines and
node reported `ERR_INVALID_TYPESCRIPT_SYNTAX`. Double it.

### ✅ A DATE-DEPENDENT TEST FIXED PROPERLY — it failed with no code change at all

`BLOCKER: the conditions square never says Good to run under a warning colour` was **red at HEAD** when
the clock rolled to 2026-08-25. It built its own `assessConditions` call with a hardcoded `minutes: 45`
and a `"mobility"` fallback, while `currentConditions` passes the SESSION'S REAL DURATION and falls back
to `"easy"` — so the ruler and the thing being measured disagreed whenever today's session was not 45
minutes long. The weekday moved, today's session changed length, and at −4 °C / 45 kph the app said "Run
by effort" while the proxy said wind.
⚠️ **THE FIX IS TO DELETE THE SECOND DERIVATION.** The invariant is that the WORDS MATCH THE IMPACT THE
TILE IS PAINTED FROM, so it has to be that impact — `e.api.currentConditions(sess)`. One definition,
date-independent, and two re-breaks (the driver branch always saying Hot, and the warning colour saying
Good to run) were watched failing against it.

### ⚠️⚠️ I TOLD HIM TO INSTALL THE WRONG COMPONENT — THE BETA WAS ALWAYS THE TOOLCHAIN

He reported *"the ios simulator is installed now"*, I measured an **iOS 27.0** runtime against a release
Xcode that wants 26.5, and concluded he had installed the wrong one. **He then corrected me: *"We have
always used the beta version in here because my phone is on ios 27 beta"* — and that settles it, because
an Xcode can only deploy to a device whose iOS it supports, so Xcode 26.6 could never have installed
anything on that phone.** The iOS 27.0 runtime is the RIGHT one; what was wrong was which Xcode I asked.
⚠️ **THE MISTAKE CAME STRAIGHT OUT OF THIS FILE**, whose toolchain section had said since 2026-07-29
*"use the release one for everything"* and *"treat [the beta] as inert"* — true when the beta's runtimes
had just been deleted, false the moment one was installed again. Corrected at the source; see the
toolchain section, which now leads with the reversal.
⚠️ **AND THE ERROR MESSAGE IS WHAT MADE IT PLAUSIBLE.** *"iOS 26.5 is not installed. Please download and
install the platform from Xcode > Settings > Components"* is a true statement about the release Xcode and
an irrelevant one about this project — installing iOS 26.5 would have silenced it and still not put a
build on his phone. **Read `xcode-select -p` before believing a destination error**, and treat a
component name in an Xcode error as a fact about the selected Xcode rather than about the task.
✅ **MEASURED THE SAME DAY, WITH `DEVELOPER_DIR` AT THE BETA: `** BUILD SUCCEEDED **`** — Release,
`generic/platform=iOS`, watch app and widget both embedded, **0 dylibs**, `CURRENT_PROJECT_VERSION = 460`.
So there was never a toolchain to wait for, and the four native fixes that had been reported as blocked
(the lock-screen distance, the Swift half of the coach teardown, the free-run title, Apple Health) build
cleanly. ⚠️ **The remaining gap is the install, not the build:** `devicectl` reports his phone
`unavailable` and refuses with `CoreDeviceError 4016` — a wirelessly paired phone that is asleep or off
this network. That needs the handset awake and on the same Wi-Fi, and nothing here can substitute for it.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1335 pass / 0 fail
under UTC and `TZ=Pacific/Kiritimati`**, both design ratchets unchanged on their ceilings and
`CSS_DUP_CEILING` unchanged at 20. Driven end to end in a real browser: the knob wholly on the stage, the
carousel paging both ways with the dot following, alignment moving the block, neon glowing the panel
behind a plate, Outline hollow with a visible caret, ten typefaces, six effects, the word committing with
its glow intact, and `document`/`body`/chrome horizontal overflow **0** at 430px and 320px in both themes
at `--tscale` 1.0 and 1.3, with zero console errors.
⚠️ **ONE FLAKE, REPORTED RATHER THAN EXPLAINED AWAY.** One `TZ=Pacific/Pago_Pago` run of five reported the
same three browser-backed privacy tests in `test/share-export-bytes.test.ts` failing; that file passes
21/21 alone and the full suite passed 1335/0 on the two immediately following Pago_Pago runs. This is the
capture-stopped-short flake this file already records as unreproduced under parallel load.

## A LINE AND A TAP WHEN A WORD COMES BACK TO CENTRE OR TO LEVEL (owner, 2026-08-25)

*"When positioning text by holding and dragging, it would be helpful if there was a line appears like on
instagram and a haptic to show that its back in the centre and also the same when its back to level
(0 degrees)"*. Web-only, so it reaches his phone **over the air on the next launch** — no rebuild.
Suite 1335 → **1337**; 15 deliberate re-breaks, 13 caught first time and the two misses were both real
guard defects (below).

⚠️ **THE LINE AND THE TAP ONLY MEAN ANYTHING AS A PAIR, AND A THIRD THING HAD TO COME WITH THEM: THE
SNAP.** A haptic with no line is a buzz the runner cannot place; a line with no snap is a hint they have
to keep an eye on; and a snap with neither is a word that mysteriously sticks. `clubTxDetent` does all
three, called from `clubTxMove` **before** `clubTxPaint` so the frame the runner sees is the snapped one.

⚠️⚠️ **THE THRESHOLD IS IN PIXELS, AND ON A 9:16 CARD THAT IS THE DIFFERENCE BETWEEN ONE DETENT AND TWO
DIFFERENT ONES.** The stage measures **452 × 998**, so a fraction of 0.018 is **8px across and 18px
down** — the same number meaning two things, with the vertical detent more than twice as easy to fall
into as the horizontal one. A finger feels pixels. `CLUB_SNAP_PX = 8`, converted per axis from
`g.box`. **The discriminating case is a 12px offset on both axes**: outside the detent on each, and a
fraction-based threshold snaps the vertical one while leaving the horizontal one alone. That is what the
guard drives, and it is what the first re-break restores.

⚠️ **THE SNAP IS APPLIED AFTER THE POSITION IS DERIVED AND NEVER FOLDED INTO THE ANCHOR.** `clubTxMove`
recomputes x and y from the gesture's anchor on every frame, so writing `0.5` cannot accumulate: the next
frame derives the true position again and re-snaps only while the finger is still inside. That is what
makes it magnetic rather than sticky, and it is why dragging back OUT of the centre needs no special
case at all. Measured through real `PointerEvent`s: 10px off → no line, no tap, x 0.5221; **6px off →
line on, x exactly 0.5, one tap**; 3px and 0px → still one tap; out to 40px → line off; back → tap two.

⚠️ **THE TAP FIRES ON ENTERING A DETENT, ONCE — NOT ON THE CONDITION.** `pointermove` arrives many times
a second, so a haptic keyed on *"is it centred"* is a continuous buzz for as long as the word stays
there, which is worse than none. `g.snapX/snapY/snapR` hold the previous state and the tap is the
transition. Re-broken by keying it on the condition.

⚠️ **`haptic("tick")` IS THE RIGHT KIND AND THE ONLY RIGHT KIND HERE.** `HapticService.swift` maps
`tick` → `UISelectionFeedbackGenerator.selectionChanged()`, which IS the detent feel; `lift` is a medium
impact and `success`/`warn` are notifications.
⚠️⚠️ **AND THIS FILE'S OWN CLAIM THAT "an unknown kind silently falls through to the lightest tap" IS
FALSE ON THE PHONE.** The Swift `switch` ends in **`default: break`** — an unknown kind does *nothing at
all* natively. Only the browser fallback falls through to an 8 ms vibrate. So a typo'd kind is silence on
the device and a buzz in a test browser, which is the worst way round. Corrected at that note.

⚠️ **ROTATION IS GATED ON TWO FINGERS, because rotation only moves under a pinch.** A level line on a
one-finger drag announces something the runner is not adjusting. Measured: a one-finger drag of a word
tilted 2° leaves it at 2° with no line; the same word under two fingers snaps to exactly 0 with the line
and a tap. **A deliberate 9° tilt is kept** — four degrees is a detent, not a correction.

⚠️ **THE LEVEL LINE IS DASHED, AND THAT IS NOT DECORATION.** "Level" and "centred vertically" are
different facts about the word, and when both are true the two lines lie **exactly on top of each
other** — so the level one has to read differently or the pair says only one thing. It is also drawn
through **the word's own middle** rather than the stage's, because that is what level is a statement
about: measured `top: 31%` for a word at y 0.31.

⚠️ **THE GUIDES ARE PRE-RENDERED HIDDEN AND DRIVEN BY CLASS ONLY**, for the reason the delete bin beneath
them already carries: an `innerHTML` write mid-gesture rebuilds the node the finger is holding. They sit
**after** `.club-txs` so a guide is never hidden behind the word it is aligning, and carry
`pointer-events: none` so the layer cannot come between a finger and that word.

⚠️ **THE GUIDE NODES ARE RESOLVED ONCE PER GESTURE, NOT PER FRAME.** A `getElementById` per
`pointermove` is a lookup on the one path he has already reported as jittery, and the stage cannot be
rebuilt under a live gesture (a moved word deliberately never redraws), so a cached handle cannot go
stale.

⚠️ **THE GUIDES COME DOWN AFTER THE RE-ANCHOR BAIL IN `clubTxUp`, NOT BEFORE IT.** Lifting one finger of
a pinch leaves the gesture running, so clearing them there blanks the guides mid-drag. **Verified with
real events: one finger up → the level line is still showing; both up → every guide down and the
rotation stored as exactly 0.** An ORDERING claim, and it is guarded as one.

### The two re-breaks that escaped, and both were my guards

1. ⚠️⚠️ **A PER-FRAME GUARD THAT NAMES ONLY THE MOVE HANDLER MISSES THE FUNCTION THE MOVE HANDLER
   CALLS.** I asserted `clubTxMove` contains no `$("clubGds")` — and the re-break put the lookup in
   `clubTxDetent`, which runs exactly as often because the move calls it. **Measured escaping.** The
   guard now sweeps the whole per-frame path, and a companion break (dropping the cached handle from the
   gesture record altogether) is caught too.
2. ⚠️ **`haptic("tick")` OCCURS THREE TIMES IN THE PAGE**, two of them pre-existing, so a re-break
   anchored on it was refused as ambiguous rather than escaping. Anchored on the detent's own line
   instead — and **a re-break whose anchor is not unique silently tests nothing**, which this file
   already records twice.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1337 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both design ratchets unchanged and
`CSS_DUP_CEILING` unchanged at 20. Driven end to end in a real browser with synthetic `PointerEvent`s
for both the one-finger position detent and the two-finger level detent.

### ⚠️⚠️ THE LEVEL DETENT WAS FINE AND COULD NOT BE REACHED (owner, 2026-08-25, same day)

*"it snaps to the middle but it doesn't snap to level horizontally"*. The arithmetic was right; the
gesture that drives it was almost impossible to start. Suite 1337 → **1338**; 10 re-breaks, and three
needed work before they bit.

⚠️ **A ROTATE NEEDED BOTH FINGERS INSIDE THE WORD'S OWN BOX, WHICH IS 234 × 43px FOR AN ORDINARY
CAPTION.** `clubEdGestures`' `stage.onpointerdown` stepped aside only when the touch landed **on** a
word (`closest("[data-ctx], [data-cszk]")`), so a second finger on the picture started a **photo pan**
instead of joining the word's gesture — `CLUB_TXG.pts` kept one pointer, `anchor.two` stayed false, and
the rotation never moved. **Driven with the second finger 163px below the word: the angle sat at 20°
through the whole gesture, no line, no snap.** Turning a pair of fingers takes them out of a 43px-tall
strip immediately, which is why he could reach the centre detent and not the level one.

**A second finger now joins a live word gesture wherever it lands.** After: `pointers: 2`,
`anchor.two: true`, 18° → 12 → 6 → **0 with the line and one tap**, and the photograph untouched (no
accidental pan or zoom).
- ⚠️ **CAPTURED ON THE WORD'S NODE, NOT THE STAGE.** `clubTxMove` is bound to the node, so a pointer
  captured by the stage delivers its moves to the stage and the word does not follow it.
- ⚠️ **BEFORE THE DRAFT BRANCH AND AFTER THE WORD BAIL, AND BOTH HALVES ARE LOAD-BEARING.** Below the
  draft branch, a second finger on the word being typed **commits** it instead of turning it; above the
  word bail, a finger landing on a word is handled twice. Guarded as an ordering claim in both
  directions — and the first re-break of it was not a real break, because moving the block below
  `const S2 = CLUBED;` but still above `if (S2 && S2.draft)` changes nothing.

⚠️⚠️ **AND THE DETENTS ARE NOW SEEDED FROM WHERE THE WORD ALREADY IS.** The latches started false, so
the first `pointermove` read "centred" as a *transition* and tapped — and most words sit at dead
centre, so that was most drags. A tap announces ARRIVING at a detent, and a word that was never
anywhere else has not arrived anywhere.
⚠️ **THE LEVEL LATCH IS ONLY WRITTEN WHILE ROTATION IS LIVE.** One finger cannot change the angle, so
clearing it on a one-finger drag forgets that the word started level and taps the moment a pinch
begins — announcing an arrival at a place it had never left.

### ⚠️⚠️ AND A SECOND DEFECT FOUND ON THE WAY: TWO EDITOR ROOTS FREEZE THE EDITOR COMPLETELY

`openClubEditor` appended `#clubEd` **unconditionally**, and `$()` answers with the **first** match — so
a second open without a close left every builder writing into the root *underneath* while the runner
looked at the one *on top*, which was then inert in every particular. **Measured: two roots, the app
writing into index 0, index 1 visible.** Same duplicate-id class as the recap's `storyShare`, which
shipped a Share button wired to nothing. One line: any existing root is removed first.
⚠️ **IT ALSO CONFOUNDED MY OWN MEASUREMENT FOR HALF AN Hour.** `elementFromPoint` returned the editor
root for **every** point on the stage, including dead centre — because the visible editor was the second
copy and the stage I was measuring belonged to the first. That reads exactly like a stacking bug in the
guides. **`document.querySelectorAll("#id").length` is the first thing to check when hit-testing
disagrees with `getBoundingClientRect`.**

### Guard weaknesses this round, and one of them is a general rule

⚠️⚠️ **A BEHAVIOURAL GUARD THAT HANDS IN THE STATE UNDER TEST CANNOT SEE WHO PRODUCES IT.** The seeding
was covered only by the detent test, which builds a gesture record and seeds it **itself** — so
replacing the real seeds in `clubTextDrag` with `false` escaped entirely. Measured escaping. The claim
is now asserted where it happens too: each latch's initialiser must name the word (`t.x`/`t.y`/`t.rot`)
and the threshold, not a constant. **Where a value comes from is a different claim from what it does.**
⚠️ **AND A `[^,]+` CAPTURE CANNOT READ AN INITIALISER CONTAINING `Math.max(1, box.width)`** — it stops
at that comma and the guard fails on correct code. Line-anchored (`(.+)$` with the `m` flag) instead.
⚠️ **`noUncheckedIndexedAccess` TYPES A DESTRUCTURED PAIR AS POSSIBLY UNDEFINED**, so the loop's array
needs an explicit `Array<[string, string]>` — the same tuple trap this file already records from the
share tests. It surfaced as tsc going to 2 errors while all 1338 tests passed, which is why the recipe
runs both.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1338 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, ratchets unchanged. Driven end to
end in a real browser with the second finger deliberately off the word.

### ⚠️⚠️ "ANYWHERE ELSE ON THE SCREEN" MEANS THE SCREEN, NOT THE PICTURE (owner, 2026-08-25, third pass)

*"it is too difficult to manoeuvre the text (bigger, smaller, rotate etc). I want the functionality to be
if the user presses and holds the text with one finger then the other (used to scale or rotate) can be
placed anywhere else on the screen, it makes it too difficult that both fingers need to be on the actual
word. Once theyve stopped holding it, it can go back to normal."*

⚠️ **HE HAD TO SAY IT TWICE, AND THE FIRST FIX WAS HALF OF IT.** The join lived on
`stage.onpointerdown`, so it covered the **picture** — and the stage is 452 × 868 of a 452 × 998
viewport. **Measured with the second finger on the tool row 50px below the picture, which is exactly
where a thumb goes when the word is low in the frame: `landedOn: club-tool`, one pointer,
`anchor.two: false`, and a pull that should have scaled the word changed nothing at all.** A fix
verified only where it was written is a fix verified against its own assumption.

**`clubTxJoinPointer` is now the ONE join, bound on the full-screen editor root in the CAPTURE phase.**
Measured after, at four places: on the picture, the tool row, the close button, and the very bottom of
the screen — each gives two pointers, `anchor.two: true`, **scale 30 → 48 and rotation → 30°**, with the
photograph untouched and the gesture cleared on release.

- ⚠️ **CAPTURE, AND IT STOPS THE EVENT DEAD.** Capture means the root sees the finger before any control
  under it, so a second finger cannot start a photo pan, press a tool or move the caret; and because the
  pointer is then captured to the WORD, its pointerup goes to the word too, so nothing underneath ever
  completes a click.
- ⚠️ **CAPTURED ON THE WORD'S NODE, NEVER THE ROOT.** `clubTxMove` is bound to the node — a pointer
  captured anywhere else delivers its moves somewhere else and the word does not follow it.
- ⚠️ **BOUND WHERE THE ROOT IS CREATED, NOT IN `clubEdDraw`.** The root survives every redraw while its
  innerHTML does not, so binding it there cannot stack a second copy of the listener. Guarded as a count.
- ⚠️ **"BACK TO NORMAL" NEEDS NO CODE, AND THAT IS WORTH ASSERTING ANYWAY.** `CLUB_TXG` is nulled the
  moment the last finger lifts, so with no gesture live the listener returns immediately. Driven: with a
  null gesture it claims nothing — and re-broken by inverting that guard, which makes **every control in
  the editor inert whenever nothing is held**. Verified in the browser too: photo pinch 1 → 1.667, a tool
  tap opens its rail, a single tap on a word still opens it for editing, and ✕ still closes the editor.
- ⚠️ **A POINTER ALREADY IN THE GESTURE IS IGNORED**, or a re-entrant press re-anchors mid-drag and the
  word jumps.

⚠️ **AND IT IS THE ONLY JOIN — TWO OTHERS WERE DELETED.** `clubTextDrag` carried one for a finger landing
on the word, and `stage.onpointerdown` carried the one from an hour earlier. Three paths for one thing is
three chances to reintroduce the bug `clubTextDrag`'s own comment records: a second finger answered by
overwriting `node.onpointerdown` and nulling it on release destroyed the binding `wireClubEd` had put
there, so after one drag the word could be neither dragged nor tapped. That lesson moved with the code.

### Three guards scoped to the old mechanism, all restated

⚠️ **THIS IS THE ELEVENTH THROUGH THIRTEENTH FIRING OF THE GUARD-SCOPED-TO-A-HOW PATTERN IN THIS FILE.**
Two pinned `CLUB_TXG && CLUB_TXG.node === node` inside `clubTextDrag` — the old join site — and failed on
the fix; one was the join guard I had written an hour before, which named the stage. All three protect the
same invariant (**a second finger ADDS to the running gesture rather than starting one**) and all three
now assert it of `clubTxJoinPointer`, plus that `clubTextDrag` no longer joins at all.

⚠️ **AND ONE OF MY OWN NEW SWEEPS WAS TOO BROAD: `clubEdGestures` KEEPS ITS OWN POINTER MAP.** Forbidding
`pts.set(` there condemned the photograph's own pan and pinch, which has nothing to do with this. Scoped
to `CLUB_TXG.pts.set(` — and `clubTxMove` legitimately writes `g.pts.set` to UPDATE a finger it already
holds, which is why the claim has to name the gesture explicitly rather than the operation.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1338 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, ratchets unchanged, **9 re-breaks all caught**.
