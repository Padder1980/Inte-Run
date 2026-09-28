# Inte-Club — story viewer, menus, delete, logbook entries, share-to-club

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## ⚠️⚠️ A TEMPORAL DEAD ZONE MADE EVERY UPLOADED STORY A BLACK SCREEN (owner, 2026-08-22)

*"when i've saved a video to my story and try to play it, this is what shows"* — with a screenshot of
nothing at all: the app's own dark, no progress bar, no ✕, no video.

`clubOpenMedia`'s `texts` line read `first.texts` **one line above** `const first = clubSlides(p)[0]`.
A `const` read before its own declaration throws `ReferenceError` every single time, so the function
appended a full-screen overlay to the body and then died **before assigning any content to it**. The
black screen IS the empty overlay.

⚠️ **IT ARRIVED BY AN EDIT, NOT BY BEING WRITTEN THAT WAY.** Moving the crop, trim and texts onto
`clubSlides` — so a carousel keeps its framing per slide — introduced that declaration BELOW a line
that already used it. The end-to-end drive recorded for the round before it ("pick → frame → type →
post → tile → viewer") was true when it was written; the refactor came after.

⚠️ **POSTED TILES WERE NOT AFFECTED, AND SAYING WHICH MATTERS.** `openClubPost` renders its own screen,
so `clubOpenMedia` has exactly ONE caller — `openClubStories`. A first version of this note claimed both
paths, which would have sent the next reader looking at the wrong one.

⚠️ **NOTHING IN THIS PROJECT COULD SEE IT.** A dead zone is legal syntax: `node --check` passes, the
build passes, and the app block's duplicate-top-level-declaration sweep is a different question. **Third
firing here** — `JOURNAL_KEY` threw at every boot inside a silent `try/catch`, `SHARE_LADDER` read
`SHARE_EVEN_SPREAD_S` — and the first to reach a runner's screen.

### ⚠️ A STATIC SWEEP FOR THE PATTERN WAS WRITTEN, MEASURED AND REJECTED

Over the whole app script it produced **57 candidates for this one real fault**. The noise is structural
rather than fixable: a function declared above a `const` it captures is both extremely common and
perfectly legal, because it is called later. A guard that reports fifty-six false positives is one people
stop reading, which is this file's own standing rule about ratchets and sweeps.

**So the guard EXECUTES the function.** `test/club-trim.test.ts` lifts `clubOpenMedia` with `clubSlides`
and `clubKeys` beside it, hands it a fake overlay, and asserts what it drew. A dead zone throws, so the
test fails loudly and names the line.
⚠️ **`clubKeys` CALLS `clubSlides`, so lifting them into separate scopes gives the second one a
ReferenceError of its own** and the test then fails for its own reason rather than the code's. Lift them
together.
⚠️ **AND THE SLIDE'S KEY FIELD IS `media`, NOT `key`.** A fixture using the wrong name renders an empty
slot and reports the viewer as broken when it is the fixture — the fixture-too-kind trap inverted.

**Verified end to end in a real browser afterwards**, not just by the guard: a 180-frame webm recorded
in the page, posted as a story through the real editor with the window dragged to 3.1–18.1s, then opened
— `readyState` 4, `currentTime` 5.5 → 7.0 across a second and a half (so genuinely playing, and starting
inside the trimmed window), the ✕ and Delete present, **zero console errors**, and a screenshot showing
frame 69 of the clip.

⚠️ **THE BACKTICK RULE FIRED TWICE MORE IN THE COMMENTS EXPLAINING THIS**, both times failing the build
outright. Running total for this stretch of work: **fourteen**.

## ⚠️⚠️ THE INTE-CLUB TILE ASKED BEHIND THE CARD (owner, 2026-08-22)

*"when I try to share an end of session share card to my inte-club, it just jumps straight back to the
share card instead of opening directly in the story or grid area of Inte-club."*

`shareToClub` drew the story-or-grid ask with `ensureSheet()` — **`.sheet-ov` is z-index 70 and the share
studio is `.sst-ov` at 92**, so the ask rendered BEHIND the card: invisible and untappable. The
destinations sheet closed (the dispatch opens with `studioSheet(null)`), the runner was looking at the
share card again, and the ask was sitting there underneath the whole time.

⚠️ **THE ASK IS A STUDIO SHEET NOW (`studioSheet("club")`), NOT THE APP'S.** The studio already has its
own sheet at z-index 2 *inside itself*, which is what the five tools use.
⚠️ **INSIDE THE STUDIO RATHER THAN CLOSING IT FIRST**, because a cancelled ask must land back on the
destinations row it came from — closing the studio to ask would make Cancel cost the whole card.
⚠️ **AND THE GENERALISABLE GUARD IS THE Z-ORDER ONE**: `test/share-studio.test.ts` now sweeps
`studioDest`, `shareToClub`, `studioClubHtml`, `studioClick` and `studioSheet` for `ensureSheet(`,
`sheetBody`, `sheetOv` and `closeSheet(`. That catches the class anywhere in the studio rather than this
one tile.

⚠️ **MY OWN VERIFICATION MISSED IT BECAUSE I DROVE THE FUNCTION, NOT THE TILE.** The round that built
this recorded "the club tile asking story-or-grid then opening the editor" — true when `shareToClub` is
called directly, and false through the tile, because calling it directly means the studio is not on
screen to hide the sheet. **Drive the control, not the function it calls.**

⚠️ **TWO GUARDS PINNED THE IMPLEMENTATION AND HAD TO BE RESTATED, NOT DELETED.** `share-studio`'s
"the club branch no longer posts to the club" asserted `return shareToClub`, and `community`'s asserted
`data-cshk="story"` inside `shareToClub`. Both claims are still right; the ask moved. They now assert the
CHAIN — branch → club sheet → its two picks → `shareToClub` — with every link falsifiable, plus the
z-order sweep. Per this repo's own rule, the guard's address moved with the guard.
⚠️ **AND ONE RESTATEMENT ESCAPED ITS FIRST RE-BREAK**: "the club sheet renders a body" matched a branch
returning an empty string, which is an empty sheet. It names the wrap now.

### ✅ AND THE PHOTOGRAPH DOES TRAVEL — MEASURED, NOT REASONED

He asked whether a picture added on the share card reaches Inte-Club. It does, because it is **baked
into the rendered card** before the club editor ever sees it. Driven in a real browser with a magenta
photograph, counting actual decoded pixels:

| | size | magenta of 21,377 sampled |
|---|---|---|
| card with no photo | 1080×1920 | 0 |
| card with the photo | 1080×1920 | 19,803 |
| handed to the club as a STORY | 1080×1920 | **19,803** — the same picture |
| handed to the club as a GRID post | 1080×1350 | **9,638** |

⚠️ **THE GRID'S LOWER COUNT IS THE PER-SHAPE FRAMING, NOT A LOSS.** The grid card is 4:5, and a 9:16
photograph fitted into it shows whole with the blurred surround at the sides — that is the whole-photo
default (ruling 4), and the framing store is keyed on (template, aspect) so a pan and zoom set for a
story is not carried across to a different shape.

⚠️⚠️ **AND MY FIRST MEASUREMENT REPORTED THE GRID AS LOSING THE PHOTO ENTIRELY (0 magenta), WHICH WAS
THE HARNESS.** `closeShareStudio` releases `SPHOTO` by design — session-only storage — and `shareToClub`
closes the studio, so the probe's second run had no photograph at all. **A probe that reuses state the
code under test deliberately clears measures a different thing and reports a defect that is not there.**
Same class as this file's other harness traps; the fix is a fresh photograph per case.

## FIVE INSTRUCTIONS WRITTEN ON FOUR SCREENSHOTS (owner, 2026-08-22)

Suite 1237 → **1243**; 10 deliberate re-breaks, all 10 caught. All of it web, so all of it reaches his
phone on the next launch.

⚠️⚠️ **ONE PART OF HIS BRIEF IS NOT BUILT AS ASKED AND HE NEEDS TO SETTLE IT — see PREMIUM below.**

### 1. The grid cell is 3:4

*"This to be 3:4 ratio rather 4:5"*, pointing at a posted tile. It was **square**, not 4:5 — the design
handoff asked for square tiles and that is what shipped; the 4:5 he named is the share card's feed shape.
Either way the target is unambiguous.

⚠️ **AND THE PICTURE DRAWN FOR A CELL HAD TO FOLLOW IT.** `clubRunTileBlob` rendered 1080 SQUARE, so a
3:4 cell would have cropped a quarter off every auto-posted run. `CLUB_TILE_W`/`CLUB_TILE_H` are now read
by the canvas AND by all four drawers — two owners of one shape is how they come to disagree.
⚠️ **`clubTileLine`'s FIT WAS WRITTEN AGAINST `S` TWICE**, so it framed every route for a square; in a
3:4 cell the line ran off the bottom. It takes both sides of the box now.
⚠️ **A POSTED CARD IS FITTED, NOT CROPPED** (`.cm-t-med-fit`), so a 4:5 share card leaves about 5% as
bars rather than losing its edges. Measured live: `aspect-ratio` reads `3 / 4`.

### 2. The story is navigated by tapping, and the two buttons are gone

*"Tapping the screen on the right hand side should move the story the next one along, tapping it on the
left should move it back one"* and *"Remove the next and delete buttons, the option to delete should come
from opening a 3 little dot menu"*.

⚠️ **THE ZONES ARE z-index 2 AND EVERY CONTROL IS 3, and this project has shipped the other way round
once** — a full-width invisible "next" over a panel carrying real actions ate every tap on the button
underneath it. Guarded by comparing the two numbers rather than trusting DOM order. Measured live: left
zone 0–138, right 138–430, ✕ and ⋮ both above.
⚠️ **BACK ON THE FIRST STORY DOES NOTHING RATHER THAN CLOSING.** Closing on a tap is how somebody loses
what they were reading by aiming slightly left, and the ✕ is two centimetres away.
⚠️ **AND THE ZONES STOP 22% SHORT OF THE BOTTOM**, so a caption long enough to read is readable without
the story jumping on under the finger.

### 3. ⚠️ THE ⋮ MENU: ONE OF HIS FOUR ACTIONS IS REAL TODAY, AND THREE ARE NAMED RATHER THAN OFFERED

His list was **Delete post / Turn off commenting / Hide likes / Make post private**. There is no server,
no accounts and nobody else to see a post — so there is nothing to comment, nothing to like, and a post
is already private to the one phone it is on. Three switches over features that do not exist is the
looks-live-does-nothing defect this project has shipped three times, and the watch settings carry the
rule in as many words: **no toggle ships before the feature behind it exists.**

So the menu carries Delete, and one sentence naming the other three — the same answer the Create sheet
gives reels, highlights and going live. When the club has a shared feed they become three real switches
in this exact menu and the runner already knows where to look. `clubPostAction` is the one place the
work happens, so a later post menu cannot diverge from the story one.

### 4. The run's notes are the LOGBOOK, and an entry can go up

*"Call this the logbook and when the user adds their thoughts and feelings, they have the option to save
it to the logbook area of Inte-Club with the option of overlaying these comments on top of a photo, if
not it can be on top of a branded logbook card that you can design"*.

- **A third tab** beside All and Videos, gated on there being an entry — the same rule Videos was held
  to, because a tab that can never have a member is why Videos waited months.
- **A logbook entry is an ordinary post carrying a `logbook` flag**, so the grid, the viewer, the ⋮ menu
  and delete all keep working on it. A second kind of grid entry would be a second of everything.
- **On a photo**, the words arrive as a **moveable overlay** rather than burned in, so a line that lands
  badly can be dragged, resized or deleted before it goes up.
- **Or on a card the app draws.** The session's effort colour as a rule down the left edge, through
  `runEffort` — the one mapping ruling 7 established, so a tempo entry is amber here exactly as on the
  tile you tapped and the calendar dot. 1080×1440, the cell's own shape.
- ⚠️ **THE PRIVACY LINE SURVIVES.** "Saved on this device only" would be a false sentence if posting were
  automatic; what changed is that there is now a way OUT, not that the words leave by themselves.
- ⚠️ **THE BUTTON ONLY EXISTS ONCE THERE ARE WORDS**, or an offer to post nothing sits under the box on
  every run ever recorded.
- ⚠️ **THE BUTTON READS THE BOX, NOT THE RECORD.** The note is kept synchronously and written to disk on a
  400 ms debounce, so the record can be four tenths of a second behind the screen — posting the stale
  version would drop the last words somebody typed.
- ⚠️ **WRAPPED BY MEASUREMENT, NEVER A CHARACTER COUNT.** A count is right for one font at one size and
  wrong for every other, and the failure is a line running off the edge of a posted picture.
- ⚠️ **AND THE WORDS ARE CENTRED IN THEIR BAND, NOT PINNED TO THE TOP OF IT.** Pinned, a short entry —
  most of them — left the bottom HALF of the card empty: measured at 46%, which is the figure this
  project's own recap rebuild treats as a defect rather than a floor. Found by rendering the card and
  looking at it, not by reading the code.

✅ **"PREMIUM" MEANT THE LOOK, NOT A PAYWALL — ASKED AND ANSWERED, 2026-08-22.** His words were *"this
would need to be premium"*, which reads as a subscription and contradicts his own recorded ruling
(*"Leave the subscription one out.....thats not something we are doing (yet)"*, filed as "do not
reinstate"). So it shipped ungated and the question was put to him. His answer: **"I meant that I wanted
you to redesign that section with a premium feel."** Same sense he used a day earlier for the profile
buttons ("need to look far more premium than that"). **There is no paywall and there is not going to be
one from this brief** — do not build one from the word.

### THE LOGBOOK SECTION, REDESIGNED TO THAT (2026-08-22)

⚠️ **IT IS A JOURNAL PAGE, NOT A FORM FIELD, and every rule is a decision rather than decoration.** A
bare 16px textarea on a grey plate with a 1px border reads as a support ticket. The writing surface is
inset with **no border at all**, so the surface is the paper; the runner's own words are the **only serif
in the app** (Georgia, with a serif stack behind it), which is what says *this is the part where you
write* rather than the part where you enter data; the placeholder is an invitation rather than a list of
fields; and the focus state is an inset ring in the session's own colour rather than a border swap.

⚠️ **THE SESSION'S COLOUR ARRIVES AS `--lbc`, SET INLINE FROM `runEffort`** — the one mapping ruling 7
established — so the card belongs to the run above it instead of looking like a component that landed
there, and a threshold entry is amber exactly as its tile and its calendar dot are.

⚠️⚠️ **AND MEASURING IT FOUND A REAL DEFECT THE EYE MISSED: THE EYEBROW WAS 2.44:1 IN LIGHT MODE.** Set
to the raw `--lbc` it measured **8.30:1 dark / 2.44:1 light** — amber on a white card, under AA, on the
label naming the section. That is the SAME fault this file records twice (the URGENT band title at
2.41:1, the accent at 4.14:1 on white), both of which passed a dark-only review, and the remedy is the
one already written down: `color-mix(in srgb, var(--lbc) 58%, var(--ink))`, which darkens in light and
lightens in dark from ONE declaration. After, measured from rendered pixels in both themes:

| | dark | light |
|---|---|---|
| LOGBOOK eyebrow | 10.91 | **5.28** |
| the entry (serif) | 14.45 | 15.73 |
| privacy line | 8.20 | 7.16 |
| button title | 11.31 | 14.23 |
| button subtitle | 5.89 | 6.07 |

⚠️ **THE HAIRLINE ALONG THE TOP KEEPS THE RAW COLOUR, DELIBERATELY.** It is decoration carrying the same
information as the eyebrow, so colour is never the only signal — this app's own rule — and it is the one
mark on the card where a category tint is doing what a category tint is for.
⚠️ **`ICON.journal` WAS ADDED BECAUSE `ICON.book` READS AS A RECTANGLE AT 18px.** Found by rendering the
button and looking at it; invisible in the source. A journal with a pen says *write*, which a plain book
outline at that size does not.
⚠️ **AND THE ENTRY IS `var(--t-card)` = 17px, WHICH IS BOTH ON THE LADDER AND ABOVE THE iOS AUTO-ZOOM
FLOOR.** Under 16px the phone zooms in on focus and pinch is disabled app-wide, so the runner can never
zoom back out. Guarded by `test/ios-input-zoom.test.ts`, which caught a deliberate 14px re-break.

⚠️ **THE PROBE HAD TO SEED A PROFILE OR THE FIRST-RUN WELCOME COVERED EVERYTHING.** The geometry read
back correctly the whole time — the card was rendered *underneath* the overlay — so the numbers looked
fine and the screenshot was of the welcome screen. `rc_profile_v1` plus a reload, then `#welcomeback`;
`#welcomeGo` is the first-run one and starts the wizard.

### 5. A handle as well as a name

*"Each runner needs to have a unique inte-club user name. As well as their full name. This will prove any
duplication in the future if there are 1000's of users"*.

⚠️ **UNIQUENESS CANNOT BE PROVEN ON ONE PHONE, AND THE COPY SAYS SO RATHER THAN IMPLYING OTHERWISE.**
There is no server, so this device cannot know what anybody else has taken. What it can do is hold the
handle, hold it to a shape a server could still accept (`^[a-z0-9._]{3,20}$`), and say plainly that the
check comes later — the hint reads *"Nobody can check it against other runners until the club has a
server."* Claiming it was reserved would be the app asserting something it has no way to know, which is
the rule the check-in consent copy was rewritten twice for.
⚠️ **AN INVALID HANDLE IS REFUSED, NOT SILENTLY CORRECTED**, and not stored — stored, the profile would
show an @name that can never be registered.
⚠️ **AND IT IS NAMED IN `loadClubProf`**, or it is dropped on read: the whitelisting-reader fault that
file already caught once with `autoPost`, guarded since by deriving the field list from the writers.

### ⚠️⚠️ THE `/* … */` BLIND WINDOW BIT AGAIN, AND THIS TIME IT MADE A GUARD UNDERCOUNT

CLAUDE.md records an unanchored block-comment sweep deleting 10,382 characters because
`accept="image/*"` is an unbalanced comment opener mid-line. The camera-roll fallback added
`accept="image/*,video/*"`, so `nocomment()` in `community.test.ts` and `share-studio.test.ts` started
eating from there: a guard counting `clubEditorFor(` saw **2 of 3**, because one of the calls was inside
the swallowed window. Both strippers are anchored to the start of a line now (`^\s*\/\*`), which is the
remedy that file already prescribes — a real block comment always starts its own line here, and a
mid-line `/*` inside a string no longer opens one. Verified by checking a landmark from inside the old
window (`id="s_easypace"`) survives the strip.

### Traps this round paid for again

⚠️ **THE BACKTICK RULE FIRED THREE TIMES**, all in my own comments; the build failed outright each time.
⚠️ **AND THE REGEX-ESCAPING RULE FIRED ON TWO AT ONCE.** `split(/\n+/)` shipped as a real newline (an
invalid regex, caught by `node --check`) and `split(/\s+/)` shipped as `split(/s+/)` — matching the
letter s, which nothing would have caught. Sweep the EMITTED page: `grep -oE 'split\(/[^)]*\)'`.
⚠️ **TWO HAND-WRITTEN LIFT LISTS WENT STALE AND BOTH FAILED LOUDLY** — `club-trim`'s viewer harness
needed the ⋮ menu's three functions, and its fake overlay needed `querySelectorAll`. That is the
acceptable kind of stale.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1243 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both ratchets unchanged. Driven in a real
browser: tile `3 / 4`; the Logbook titled, private, its button gated on there being words; the branded
card 1080×1440 at ratio 0.75; an entry posted, flagged and landing in the third tab which appears only
when there is one; the viewer's zones measured at 0–138 / 138–430 under controls at z3, no Next, no
Delete, the ⋮ opening one action; the handle stored, hinted and shown as `@adam.p_80`; **zero console
errors**.

## DELETING A POST ASKS FIRST (owner, 2026-08-22)

*"when deleting any post there needs to be an alert that pops up that gives two options"* — then, asked
which two: *"1. delete 2. cancel"*. Suite 1244 → **1246**; 7 deliberate re-breaks, all 7 caught. Web,
so it reaches his phone on the next launch.

⚠️⚠️ **IT CANNOT USE `confirmSheet`, WHICH IS THE APP'S OWN CONFIRM.** That draws on `.sheet-ov` at
z-index **70**; the full-screen post/story viewer is `.club-view` at **96** and the camera roll is 97. So
the question would have opened BEHIND the very post it was asking about — which is the identical z-order
fault that made the Inte-Club share ask invisible an hour earlier, and the guard written for that one is
what stopped this repeating. `.club-ask` is its own overlay at **98**, and a test compares the numbers
rather than trusting the source order.

⚠️ **A CONFIRMATION IS RIGHT HERE WHERE IT IS WRONG FOR A RUN, AND THE DIFFERENCE IS RECOVERABILITY.**
CLAUDE.md records the debrief deliberately NOT asking before `deleteRun`: *"`deleteRun` already raises an
undo toast, and a dialog before a reversible action is a tap for nothing."* This is the opposite case —
`clubDelete` removes the row AND the blobs from IndexedDB, so the photograph or the video is gone. There
is nothing to undo, which is exactly when asking earns its tap. The copy says so (*"there is no way to
get it back"*) and a guard ties that sentence to `clubDelete` still calling `clubMediaDel`, so the claim
cannot outlive the behaviour it describes.

⚠️ **ONE DIALOG FOR BOTH DELETE PATHS** — the ⋮ in the viewer and the trash in the post feed. Two would
be two chances for one to lose its confirmation, which is the fix-one-builder-not-the-other trap this
project has paid for six times.
⚠️ **AND THE GUARD DERIVES THE CALLERS RATHER THAN LISTING THEM.** My first version named
`wireClubPost`, which does not exist — a hand-written pair went stale before it was ever green. It now
walks every top-level function, and any whose body calls `clubDelete` must reach `clubConfirmDelete`
first, whatever it is called, with a count so a third path cannot arrive unguarded.

⚠️ **CANCEL TAKES THE FOCUS, NOT DELETE.** On a dialog whose whole job is to slow a destructive tap down,
the safe option is the one a keyboard or switch-control user lands on. `role="alertdialog"`,
`aria-modal="true"`, and `overlayModal` inerts the panel behind it and restores focus on close.
⚠️ **A TAP ON THE BACKDROP CANCELS.** An alert with no way out but two buttons is a trap on a phone, and
the safe answer is the one a stray tap should give.
⚠️ **THE DESTRUCTIVE OPTION IS FILLED AND THE SAFE ONE IS NOT**, in `--rest` — this app's own colour for
a hard stop, used by the safety bands and the watch's End button — so the two never read as a pair of
equals.
⚠️ **`haptic("lift")`, NOT AN INVENTED `"warn"`.** `haptic()` knows `success`, `lift` and a default, and
an unknown kind silently falls through to the lightest tap **in a browser and to NOTHING AT ALL on the
phone** (⚠️ corrected 2026-08-25: `HapticService.swift`'s switch ends in `default: break`, and it also
knows a fourth kind, **`tick`** → `UISelectionFeedbackGenerator.selectionChanged()`, which is the detent
feel) — so a destructive confirmation would have
felt identical to a cancel.

**Driven end to end in a real browser, both paths:** the dialog opens at z98 over a viewer at z96 with
exactly `["Delete", "Cancel"]`, focus on Cancel, `alertdialog`/`aria-modal`; Cancel closes it and keeps
both the story and the viewer; Delete removes it and closes the viewer; the feed's trash asks the same
question and deletes on confirm; a backdrop tap cancels; **zero console errors**.

⚠️ **THE BACKTICK RULE FIRED THREE MORE TIMES IN THIS ONE FUNCTION'S COMMENTS**, and the third time was
the instructive one: it did not fail with a syntax error but with **`ReferenceError: ov is not defined`
at build time**, because the stray backticks closed the outer template literal and the runtime code
after them became live TypeScript. A build failure that names a variable from the runtime JS is this
trap wearing a disguise. Running total for the day: **seven**.
