# Inte-Club — profile, posts, grid, camera roll

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## COMMUNITY IS NOW INTE-CLUB, AND A RUNNER CAN POST TO IT (owner, 2026-08-22)

His words: *"i want to build the functionality whereby a runner can press the plus button at the top and
it allows them to add a post or a story etc … The post will allow them to add a video or a photo from
their own camera roll and the same if they click story … There also needs to be a little plus button on
the profile picture … that takes them straight into their camera roll on their phone to add a story. Once
they've selected an image or a video (video's capped at 15 seconds for stories) they need to be allowed
the functionality to make adjustments like seen in the attached video. **If we don't have that
functionality already then, please dont tell me it doesn't exist. I want you to start creating that
functionality becuase i know it is possible.** This section also needs to be changed from being called
community to 'Inte-Club'."* Suite 1132 → **1148**; 30 deliberate re-breaks, all 30 caught (four only
after a guard was restated — those four are the useful half, below).

⚠️ **IT IS ALL WEB, SO IT REACHES HIS PHONE ON THE NEXT LAUNCH.** No Swift changed. The camera roll needs
nothing native: a WKWebView hands a file input accepting images and video straight to the iOS sheet
(Photo Library / Take Photo / Browse), and the three purpose strings it wants were already added when the
share card's Take Photo crash was fixed.

**What exists now.** The + in the top bar opens **Create** (Post / Story); both go camera roll → editor →
posted. The little **+ on the avatar** and **Add** on the stories rail skip Create and go straight to the
roll for a story. The editor is full-screen media with pan and pinch, on-canvas text (typeface, colour,
size), a caption, and for a video a **trim**. A post lands in the grid under **Posted**; a story goes in
the ring and expires after 24 hours. **All / Videos** tabs split the grid. One full-screen player serves
both.

### ⚠️⚠️ TWO FUNCTIONS OF ONE NAME, AND EVERYTHING PASSED

`fmtClock(seconds)` was written for the trim label while the live run screen has had
`fmtClock(milliseconds)` — printing tenths — since long before. **Function declarations hoist, so the
later one won for the whole 30,000-line script**: every trim label rendered a fifteen-second window as
`0:00.0`, fifteen milliseconds. The build exited 0, `node --check` passed all three emitted blocks, and
**1132 tests passed**. Renamed to `clubClock`.
⚠️ **THERE IS NO WARNING FOR THIS ANYWHERE.** One template literal means no linting and no typechecking
of the runtime JS, and a duplicate top-level declaration is legal JavaScript — not even a strict-mode
error. `test/community.test.ts` now fails on **any** name declared twice at the top level of the app
block, scoped to no-leading-whitespace so a nested helper of the same name in two functions is still
fine. Watched failing against the collision before it was believed.

### The decisions, and the ones that would be undone by a tidy-up

⚠️ **THE BYTES GO IN IndexedDB AND THE ROW IN localStorage, MEDIA FIRST.** localStorage is where the
entire training history lives and one phone video is tens of megabytes — the route-map cache is in
IndexedDB for exactly this reason. Measured: a post's row is **312 bytes**. The blob is written FIRST: a
row pointing at a blob that failed to save is a permanently broken tile, where a blob with no row is
invisible and swept by the next open.

⚠️ **THE TRIM IS IN AND OUT POINTS, NEVER A RE-ENCODE.** Re-encoding in a web view means decoding every
frame to a canvas and recording it back — slow on a phone, lossy, and it drops the audio. The clip is
stored whole and cut at playback, so nothing is degraded and a future export can cut from the original.
Measured end to end: a 21.97s clip, the window slid to **6.90–21.90**, playhead seeking to 7.1s.
⚠️ **AND THE CAP IS A TRIM, NOT A REFUSAL.** Rejecting a long clip sends the runner back to Photos to cut
it. ⚠️ **The cap is the STORY's** — applying it to a post as well would be a rule he did not ask for.

⚠️ **THE TEXT IS TYPED ON THE PICTURE, NOT INTO `prompt()`.** A system dialog cannot show the runner the
typeface, colour or size they are choosing, and on iOS it is a modal the app does not control. The font
pills are **set in their own faces** — three labels in one typeface is not a choice you can see.
⚠️ **AND THE FONT AND COLOUR TOOLS LIVE IN THAT STATE, NOT THE RAIL.** The first cut had them in the
rail acting on the SELECTED word, so two of the three tools were inert whenever nothing was selected and
had to answer with a toast explaining themselves. The rail is now Aa plus a delete that only appears
when there is something to delete.
⚠️ **THE DIM IS .48 WITH NO BLUR.** At `rgba(4,16,13,.82)` and a 6px blur the picture measured
effectively black — so the runner was typing onto a dark rectangle, which is exactly what typing on the
media instead of in a dialog was meant to stop.

⚠️ **A TAP ON A WORD EDITS IT; A DRAG MOVES IT.** Told apart by whether the finger travelled more than
4px, so one gesture does not mean two things — a word meant to be nudged does not reopen the keyboard,
and a word meant to be fixed needs no second control.

⚠️ **THE FRAMING IS CLAMPED IN ONE PLACE.** `clubEdFit` derives the slack from the zoom
(`(1 - 1/k)/2`) and every gesture goes through it; the gesture handler carries no clamp of its own. Two
would be two answers, and the stored crop would not be the one the runner framed — the
two-disagreeing-transforms fault that stretched the debrief hero. Verified: at k=2.5 an offset of 9
clamps to 0.800.

⚠️ **THE + IS ON THE CLUB AND HIDDEN EVERYWHERE ELSE.** A create control in the top bar of every screen
only means something on one of them. Measured: `display: none` on Today, `flex` on the club.
⚠️ **AND THE AVATAR'S + IS A SIBLING OF THE RING, NOT A CHILD.** Nested, a tap on the badge bubbles to
the ring and opens the story viewer instead of the camera roll — a control that looks like one thing and
does another. Its hit area grows via `::after`, not its box, or it would cover the avatar it sits on.

⚠️ **A REAL UPLOADED STORY WINS OVER THE GENERATED RUN ONE.** The run story exists because there was
nothing else to put in the ring; once the runner has put something there themselves, showing them the
app's summary of their last run instead is the app talking over them.

⚠️ **A POST DOES NOT ADVANCE ITSELF AND A VIDEO STORY RUNS FOR ITS OWN TRIMMED LENGTH.** A picture that
closes while somebody is reading the caption has decided for them; and advancing off a twelve-second clip
after four and a half is cutting the runner off mid-sentence.

⚠️ **MEDIA IS LOADED AFTER THE RENDER, THROUGH ONE LOADER.** Reading a blob is asynchronous and this app
renders synchronously from many paths, so a builder that awaited the bytes would be an async render. A
missing blob shows a hatched cell, never nothing. One object URL per media, cached — a grid re-rendered
on every tab switch would otherwise mint one per tile per render and hold every video in memory.

⚠️ **THE ALL / VIDEOS TABS ONLY APPEAR ONCE SOMETHING IS POSTED, AND THAT IS WHY THEY EXIST NOW.**
Addendum 1 asked for them and it was declined at the time: the grid held RUNS, which carry no media, so
Videos was a tab that could never have a member. Now the split is real. ⚠️ **Under Videos the run tiles
go** — a run is not a video, and showing them there would be the app calling a route a film of itself.

⚠️ **POSTS COUNTS WHAT WAS POSTED, NOT HOW MANY TIMES THE RUNNER RAN.** Before there was anything to
post the run count was the only honest thing that number could be; now it would never match the grid
beneath it.

⚠️ **`.club-stage` IS THE THIRD SURFACE ALLOWED `touch-action: none`, AND THE VIEWER'S IS `pan-y`** so a
post can still be scrolled past. ⚠️ `.club-tx` carries no `touch-action` of its own: it is computed from
the element AND its ancestors, so a second declaration there is a second owner — and in the viewer it
would silently kill the scroll wherever a word happens to lie.

⚠️ **WHAT IS NOT BUILT IS NAMED, NOT OFFERED.** His reference's Create sheet carries Reel, Highlights and
Live. The sheet says they are next in one sentence; a row that opens nothing is the
looks-live-does-nothing class this project has shipped three times.

### Four guards that could not fail, and the two traps that produced them

⚠️ **A STRING EXISTING IS NOT SOMETHING READING IT — three of the four were this.** Neutering
`if (n.dataset.cfilled) return` leaves the assignment two lines below, so a guard matching
`dataset.cfilled` stayed green with the check dead; same for `cm-med-gone` (still in the `.catch`) and
`CLUBURL[key]` (still in the assignment). All three now assert the **guard position**, not the mention.
The fourth matched the first `if (txt)` — which guards the EDIT branch — so turning the ADD branch's
`else if (txt)` into a bare `else` escaped it; it now slices to the `push` and checks what guards *that*.

⚠️ **A COMPUTED ATTRIBUTE HAS NO LITERAL TO GREP.** `data-cnew="' + id + '"` means no literal
`data-cnew="post"` exists anywhere, so the first version of that guard failed on correct code. It asserts
the builder's call sites plus that the builder writes its first argument into the attribute — the same
answer the share studio's destination sweep needed when `studioDestTile` started computing its
`data-sst`.

⚠️ **THE COMMENT-QUOTES-WHAT-IT-FORBIDS TRAP FIRED FOR AN EIGHTH TIME.** The code's note explaining why
it is not a system dialog quotes the very call the guard forbids. `nocomment()` is the remedy this file
already keeps for it.

⚠️ **THE BACKTICK RULE FIRED, AND SO DID THE REGEX-ESCAPING RULE.** Two backticks in my own comments
(the build failed outright, which is the good outcome), and `/^video\//` shipped as `/^video\/\//`'s
opposite — the single backslash was swallowed by the template literal, so the file-type test matched
nothing. Write `\\/`, not `\/`. Running total for backticks in this run of work: **11**.

⚠️ **TWO INVENTED CSS TOKENS, CAUGHT BY THE TOKEN GUARD.** `--on-accent` (the real one is
`--accent-ink`) and `--r-sm2` (the ladder is `--r-card` / `--r-ctl` / `--r-pill` / `--r-hero` — ⚠️ **and there is no `--r-sm` either, which an earlier version of this very sentence claimed**; the token guard caught it being used on 2026-08-23). An
undeclared custom property invalidates the whole declaration silently, which is what that guard exists
for and it earned its keep on its own feature.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1148 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`** with `CHROME_PATH` set, both design
ratchets unchanged (143 radii, 322 font sizes), `InteRun` **Release** for `generic/platform=iOS` building
with 0 errors. Driven end to end in the served build: pick → frame → type → post → tile → viewer, with
a real 22-second video trimmed and a story swept at 24 hours; `documentElement` and `body` horizontal
overflow **0**.

⚠️ **STILL TO COME, AND HIS OWN FRAMING OF IT:** *"This is going to be something that we build upon over
time whereby they can edit their own videos from within the app and post it straight to the club, whilst
also being able to export those videos for instagram or tiktok."* The trim being points rather than a
re-encode is what leaves that door open — the original is intact. Reels, highlights and live are named
on the Create sheet and not built.

### HIS SIX CHANGES TO INTE-CLUB (2026-08-22, later the same day)

The trim as a filmstrip, the + centred, premium profile actions, Instagram-style post opening, "Create a
post" with several pictures or a video, and an Edit profile page. Suite 1148 → **1159**; 34 deliberate
re-breaks, all caught (six only after a guard was restated — those six are the useful half).

⚠️ **BOTH OF HIS RECORDINGS WERE WATCHED FRAME BY FRAME, and one of them settled a design question that
guessing would have got wrong.** `avconvert --preset Preset960x540` then frames grabbed in a real browser.
⚠️ **`python3 -m http.server` SERVES NO BYTE RANGES, so a video cannot be SEEKED through it** — every
grab came back as frame 0 and read exactly like a broken decoder. Play the clip through at
`playbackRate 8` and capture on `requestAnimationFrame` instead.

### ⚠️⚠️ TAPPING A POST OPENS A SCREEN, NOT AN OVERLAY — AND ONLY THE RECORDING SAYS SO

What his recording shows is a titled screen ("Posts", the handle beneath, a back chevron) holding a
**scrollable list of his own posts, positioned at the one tapped**: header, media, carousel dots, the
caption, the date, and the next post below. Not a full-screen viewer. **A story plays at you and closes
itself; a post is read at your own pace and scrolled past.** Built as an overlay it would have to
reimplement scrolling, and every re-render would jump to the top.
⚠️ **NO LIKES AND NO COMMENTS.** The reference has both, this app has no server, and a heart here is a
control that looks live and does nothing — the class this project has shipped three times. What each post
carries instead is what works: share it, or delete it.
⚠️ **THE CAROUSEL IS A NATIVE SCROLL-SNAP RAIL.** This screen scrolls vertically, so a JS drag has to
decide on every move which axis the finger meant; the browser already arbitrates that correctly.
⚠️ **AND THE SCROLL GOES THROUGH `keepScroll` LIKE EVERY OTHER BRANCH.** `v.scrollTop = 0` here tripped
`silent-defects`'s own guard, correctly: right when the runner has NAVIGATED, wrong for any repaint of
the screen they are on — and deleting a post repaints this one. `state.clubPostId` is cleared once used,
so the first render after a tap positions the feed and every later one keeps where the runner is.

### THE TRIM IS A FILMSTRIP, AND THREE FAULTS SAT BEHIND ITS THUMBNAILS

His note: *"the 15 second selector needs to look like this so you can see where it starts and ends."* A
slider shows a POSITION; only two handles over the clip's own frames can show a SPAN.
⚠️ **BOTH HANDLES MOVE INDEPENDENTLY AND THE WINDOW MAY BE SHORTER THAN THE CAP.** Fifteen seconds is a
ceiling, not a length — six seconds of a finish line beats fifteen with nine of nothing.
⚠️⚠️ **NOTHING HELD THE THUMBNAIL VIDEO, AND NOT ONE FRAME EVER ARRIVED.** A detached media element
referenced only by its own listener is a cycle nothing outside points at, so Chrome may collect it before
the load completes. Measured: the function ran, `thumbs` became `[]`, and `loadeddata` never fired at all
— while the identical code awaited on the stack produced all eight frames. It is not the seeking, the
codec or the blob URL. The slide holds the element now, and releases it when the work is done.
⚠️⚠️ **THEN THE CLEANUP DESTROYED THE RESULT.** Clearing `src` raises abort, emptied and then **error** —
so `onerror` fired AFTER all eight frames had been adopted and reset them to empty. Measured: eight
`seeked` events, eight frames, an empty strip. The handlers come off before the source does, and a
genuine failure now only clears what was never filled.
⚠️ **EVERY SEEK IS BOUNDED.** Unbounded, one that never answers hangs the loop for the life of the editor
and the strip stays grey with nothing to say why.
⚠️ **THE HANDLES SIT INSIDE THE WINDOW.** Hung on its outer edges they are clipped by the strip's own
overflow the moment the window reaches either end — measured, the right-hand handle was cut in half at
0:24 of a 24-second clip, so the end of the selection was visible and ungrabbable.
⚠️ **AND THE MINIMUM SPAN SCALES WITH THE CLIP.** One second of a 24-second clip is ~29px of strip; of a
four-minute clip it is under 3px, so two 14px handles would sit on top of each other.

### CREATE A POST: SEVERAL PICTURES, OR A VIDEO

⚠️ **STEP ONE OF HIS REFERENCE CANNOT BE DRAWN BY US, AND THAT IS A PLATFORM BOUNDARY RATHER THAN A
SHORTCUT.** Its first screen is a grid of his own camera roll with numbered selection circles — a web page
cannot enumerate the photo library at all, and must not. What `<input multiple>` opens IS that screen,
drawn by iOS, with the same multi-select. So the app starts at his step two.
⚠️ **A CAROUSEL IS PHOTOGRAPHS ONLY, AND MIXING IS REFUSED RATHER THAN SILENTLY SPLIT.** His rule is a
carousel of pictures OR a video, so a selection holding both is two different posts and the app cannot
know which he meant. It keeps the kind he reached for first and says how many it set aside.
⚠️ **EVERY SLIDE OWNS ITS OWN FRAMING, TEXT AND TRIM.** One shared crop across a carousel is the fault the
share studio already records: switching pictures destroyed the framing just set, with nothing to undo it.
⚠️ **AND A SINGLE PICK IS A LIST OF ONE**, so there is one code path rather than a single-item case and a
carousel case that drift apart.
⚠️ **`media` IS ALWAYS A LIST NOW, AND `clubSlides` IS THE ONE PLACE THE OLD SHAPE IS UNDERSTOOD.** Posts
written hours earlier carry a single key with their crop, trim and texts on the row itself.
⚠️⚠️ **AND THE TILE BUILDER WAS NOT UPDATED, WHICH THE SERVED PAGE CAUGHT AND NO TEST DID.**
`esc(["a","b"])` is the string `"a,b"` — a key nothing holds — so every carousel tile drew the
missing-media hatch. The overlay player read `crop`, `trim` and `texts` off the row the same way. Six
readers, one fix: nothing reads the raw field.

### THE PROFILE: A CENTRED PLUS, TWO PREMIUM ACTIONS, AND AN EDIT PAGE

⚠️ **THE + WAS OFF-CENTRE BECAUSE OF INHERITED `padding: 1px 6px`, AND THAT WAS MEASURED RATHER THAN
GUESSED.** The app's global button rule left a 26px badge with a 10px content box holding a 14px glyph —
and grid resolves a centred item that OVERFLOWS its area to start-aligned: 8px of space on the left, 4px
on the right. Vertically it was symmetric, which is why it read as leaning rather than as plainly wrong.
`padding: 0` on any icon button whose glyph is its whole content.
⚠️ **THE TWO ACTIONS ARE ONE FILLED PAIR.** The generic outlined `.ui-btn` side by side under an avatar
reads as two form fields, which is what he called not premium enough.
⚠️⚠️ **AND `.ui-btn` HAD NO BASE RULE AT ALL — ALL SIX USES RENDERED AS BARE BROWSER BUTTONS**, measured
**180×22**, half this app's own 44px floor, wearing the platform's default chrome. The design system's real
vocabulary is `.ui-bar-btn`, `.ui-pill`, `.ui-row`, `.ui-note`, `.ui-tile`; there has never been a
`.ui-btn`. It is the invented-identifier trap in CSS class form and the third firing in two days, after
`--r-sm2` and `ui-pill-build`.

⚠️ **EDIT PROFILE IS THE CLUB'S OWN PAGE NOW.** It used to hand the runner the whole Profile & settings
screen — units, theme, connections — when what they tapped was a button under their own avatar.
⚠️ **THE PICTURE AND THE TRAINERS ARE NOT NEW FIELDS, AND THAT MATTERS MORE THAN IT SOUNDS.** The avatar is
`profile.avatar` with a cropper already round it; the trainers are the Shoe Rack's active pair, which knows
their real mileage and when they are due. Storing either again gives one fact two homes, and the two
disagree the first time somebody changes the other. **Only three things are genuinely new:** the bio, what
they are training for, and the PBs.
⚠️ **THE SHOP LINK LIVES ON THE SHOE**, because it is a fact about that pair — it travels with them when
they are retired and replaced.
⚠️ **A TYPED PB BEATS A COMPUTED BEST FOR THAT DISTANCE, AND THE TWO ARE LABELLED DIFFERENTLY.** A personal
best is a race result; the computed one is the quickest the app has recorded that runner covering about
that far, training runs included. Showing both for one distance would be two answers to one question.
⚠️ **A PB IS REFUSED IF IT IS NOT A TIME, NEVER PARSED INTO SECONDS AND PRINTED BACK.** A typo of 2104
silently becoming 35 minutes is a claim the runner never made.
⚠️ **A SHOP LINK IS ONLY EVER `http`/`https`, BUILT THROUGH `new URL`, WITH `rel="noopener noreferrer"`.**
It is the one place a runner's own text becomes something the phone will ACT on.
⚠️ **EVERY FIELD SAVES AS IT IS TYPED AND NOTHING RE-RENDERS ON INPUT.** A Save button has a state where
what is on screen is not what is stored — paid for twice already — and rebuilding a field under the finger
captures the caret.
⚠️ **`font: inherit` ON EVERY FIELD.** A textarea with no family falls back to the browser's monospace, so
the running bio rendered as code. Measured on the served page.
⚠️ **AND THE PB GRID IS ONE COLUMN.** Two columns each holding a label and a time field overflowed at
400px and clipped the second input at the screen edge — a field whose label you can see and cannot type
into. `minmax(0, 1fr)`, because a `1fr` track has `min-width: auto` by default.

### `commShareHtml` BECAME AN ORPHAN, AND WAS DELETED RATHER THAN LEFT

He asked for "Create a post" in place of "Share a run", which left that sheet and its wiring with no
caller at all — the computed-and-discarded trap this project has shipped four times. **Sharing a run is
not lost:** it is on the run's own page as *Share my run*, which is the only place a run can be picked to
share from. A guard now asserts both builders are gone from the build entirely.

### Six guards that could not fail, and what each was

1. ⚠️ **A BUILDER PROVES A SHAPE EXISTS; ONLY THE CALLER PROVES THE RUNNER SEES IT.** The filmstrip guard
   read `clubStripHtml` alone, so replacing the CALL to it with a range input escaped — the strip was
   still perfect and nothing rendered it.
2. ⚠️ **A SINGLE MATCH ANYWHERE IN A FUNCTION IS SATISFIED WHILE ONE BRANCH HAS LOST IT.** The back-button
   guard passed with the empty state's deleted — the branch a runner with no posts actually reaches.
   Indentation was not a usable anchor either: the per-post return inside the `.map` sits at the same
   depth and correctly has no back button.
3. ⚠️ **`[^}]*` STOPS AT THE FIRST BRACE**, and the object literal being saved contains one — so a field
   handler that DID call `render()` sailed past the no-re-render guard.
4. ⚠️ **A DELEGATED SELECTOR **OR** A `dataset` READ.** `data-cmed` and `data-cvid` are read as dataset
   properties, where the hyphenated name appears nowhere; and `[data-cpcount]` is only ever used with a
   value. Requiring a bare `[data-x]` reported live code as unwired.
5. ⚠️ **THE COMMENT-QUOTES-WHAT-IT-FORBIDS TRAP FIRED TWICE MORE — ninth and tenth.** The rename note
   quotes "Share a run"; the link note quotes `rel="noopener noreferrer"`. Deleting the real attribute
   left the guard perfectly happy.
6. ⚠️ **AND TWO STRONGER FORMULATIONS OF THE `ui-*` GUARD FLAGGED CORRECT CODE.** "It must have an
   unscoped rule" fails on `.ui-dot`, correctly defined only inside `.ui-pill`; "some rule must PAINT it"
   fails on `.ui-row-mid`, deliberately nothing but `min-width: 0; flex: 1`. What survives is "the name
   exists in the stylesheet" — which **cannot** catch the `.ui-btn` case itself, because a scoped
   override names it. **The tap-floor sweep is what caught that**, and saying so plainly is better than
   implying the guard is stronger than it is.

⚠️ **THE REGEX-ESCAPING RULE FIRED ON FOUR REGEXES AT ONCE** — `/^video\//`, the PB time pattern,
`/^https?:\/\//i` and `/^www\./` all shipped with their backslashes eaten, so the file-type test, the time
validator and the URL parser each matched nothing. Write `\\/`, not `\/`. **Sweep the emitted page, not
the source**, which is how these were found.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1159 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both design ratchets unchanged. Driven end to
end in the served build across light and dark: three photographs picked → framed separately → captioned →
posted as one carousel → tile → feed with 1/3 counter and dots; a 24-second clip trimmed by both handles
with eight real frames in the strip; the edit page storing bio, training-for, a shop URL on the shoe and
two PBs, refusing a non-time; `documentElement` and `body` horizontal overflow **0** on all three screens
in both themes, every control reached by a handler.

⚠️ **STILL NOT BUILT, AND NAMED RATHER THAN OFFERED:** reels, highlights and going live.

### HIS SEVEN CHANGES, AND THE ONE THAT NEEDED SWIFT (2026-08-22, third round)

The camera roll inside the app, the story's layout, the PB capsules, the trainer icon, Inte-Club on the
share card, the grid being chosen rather than automatic, and a map behind the route. Suite 1159 →
**1168**; 17 deliberate re-breaks, all caught (two after a guard was restated). ⚠️ **THE PICKER IS THE
ONLY NATIVE PART, so it is inert until an Xcode build — everything else reaches the phone over the air.**

### ⚠️⚠️ A PICKER AND A GRID ARE DIFFERENT THINGS, AND THAT IS WHY THIS NEEDED PhotoKit

*"when the user clicks the create a post, i want the users camera roll to open inside the app, not come
outside the app into the camera roll."* What shipped that morning was a file input, which hands the job to
iOS: **its** screen, **its** chrome, and the app learns nothing about the library. `PHPickerViewController`
is the same thing in Swift. What he is describing is what Instagram does — the app enumerates the library
itself and draws its own grid — and **nothing in the web layer can do that at all.**

`PhotoLibraryService.swift` + `PhotoBridge.swift`, and the design decisions worth keeping:
- ⚠️ **THE BYTES DO NOT COME BACK THROUGH `evaluateJavaScript`.** Base64 is a third bigger than the data
  and has to be built, escaped, parsed and decoded; for a thirty-megabyte video that is a stall the runner
  watches. The handler answers with small JSON and the pixels stream over **`interun://app/__photo/…`** —
  the app's OWN scheme, on a path prefix, because `localStorage` is keyed to that origin and a second
  scheme would put photographs outside everything else with two handlers to keep in step.
- ⚠️ **CHECKED BEFORE `resolve()`**, which would look for a file of that name in the bundle and 404.
- ⚠️ **`no-store`, BECAUSE AN IDENTIFIER OUTLIVES AN EDIT.** Crop a picture in Photos and the same
  identifier names different pixels; a cached copy shows the version before the change.
- ⚠️ **THE FETCH RESULT IS HELD, NOT THE ASSETS.** A `PHFetchResult` is lazy — materialising a ten-year
  roll into an array on the first call is a stall on open for a grid nobody has scrolled.
- ⚠️ **PERMISSION IS ASKED FOR WHEN THE PICKER OPENS, NEVER AT LAUNCH.** A prompt with no context, and
  from the app's side a refusal is permanent.
- ⚠️ **LIMITED ACCESS IS A FIRST-CLASS ANSWER, NOT A REFUSAL.** Somebody who shared a chosen handful is
  curating; the grid offers the system sheet to widen it rather than looking empty. ⚠️ That sheet's
  selector is ObjC-only on this SDK and is called through the runtime — and if it is absent the reply
  still comes back, because a request that never answers is a grid that spins for the rest of the run.
- ⚠️ **THE DEGRADED PASS IS IGNORED.** PhotoKit answers twice for an iCloud asset and the first is a blur;
  replying to it would put a smeared thumbnail in the grid permanently, because the page caches it.
- ⚠️ **THE NUMBER ON A CELL IS THE ORDER, NOT A TICK.** A carousel has a first picture and a tick cannot
  say which.
- ⚠️ **AND THE FILE INPUT IS KEPT AS THE FALLBACK, NOT DELETED.** An over-the-air page reaches phones whose
  Swift predates `PhotoBridge`; there the flag is absent and the sheet is what works. Gated on
  `window.__interunPhotoLibrary` — a capability flag, never a handler-exists test, which is how this
  project nearly shipped a silent coach.

### ⚠️⚠️ THE STORY'S ROUTE WAS STRETCHED BY A HARDCODED viewBox, AND THE MARKERS WERE THE TELL

Two faults in his screenshot. The progress bars and the avatar ran **through the 10:46**, because the
overlay is `position: fixed` at inset 0 — the whole screen, clock included; `env(safe-area-inset-top)` is
the only thing that knows where that line is.
And the route was pulled into a thin tall smear. The cause was not the CSS: **`routeMapSvg`'s
no-projection branch discarded `vbW`/`vbH` and always emitted a 320×200 viewBox**, and with
`preserveAspectRatio="none"` every caller whose box was a different shape got the route stretched to fit.
The story was pulled **2.76× vertically** — and it still LOOKED like a route.
⚠️ **THE GIVEAWAY WAS THE START AND FINISH MARKERS RENDERING AS TALL OVALS.** A stretched route is
plausible; a stretched circle is not. Measured after: marker width/height **1.000**.
⚠️ **EVERY EXISTING CALLER PASSED 320, 200 OR NOTHING**, so honouring the arguments is byte-identical for
all of them — the default keeps the old numbers for the one caller that passes none.
⚠️ **AND THE PADDING AND THE MARKER RADIUS HAD TO SCALE WITH THE BOX.** A flat 20 is 10% of a 200-tall
drawing and 3% of a 620-tall one; 5.5 units is a clear circle at 320 wide and a speck at 1080.
⚠️ **REVERTING IT ESCAPED THE FIRST GUARD, which only checked that the CALLER passed the right size.** A
builder proves a shape exists; only executing it proves the shape is used. The guard runs the real
function now and reads the viewBox back.
⚠️ **AND THE ASPECT IS WRITTEN FROM THE SAME TWO CONSTANTS THE DRAWING USES** (`STORY_ART_W/H`), inline on
the element rather than in the stylesheet — a number in the CSS and the same number in the call is two
owners of one measurement.

### THE GRID IS WHAT HE POSTS, NOT WHAT THE APP RECORDS

*"I want the user to decide what to post on their grid, not for it to be automatically added (unless they
say so in the settings)."* **This reverses what shipped that morning, and he is right:** the grid was every
run the app had ever recorded, put there by the app — a training log wearing a profile's clothes, and the
Logbook already is the log.
- ⚠️ **OFF BY DEFAULT.** He asked for the decision to be his; a default that posts for him is the app
  deciding.
- ⚠️ **AND NOTHING IS DELETED BY TURNING IT OFF.** A run already on the grid stays; the switch governs
  what happens next.
- ⚠️ **THE STYLE PICKER APPEARS ONLY WHEN THE SWITCH IS ON**, because his instruction pairs the two — and
  a control over nothing is the looks-live-does-nothing class this project has shipped three times.
- ⚠️ **THE SAME THREE CHOICES ON BOTH PATHS**, so the automatic and the manual route cannot produce
  different-looking grids.
- ⚠️ **ONE CALL SITE, BESIDE THE STRAVA ONE**, because that is the one place the phone and the wrist both
  arrive — a hook on one and not the other is this project's most-repeated trap.
- ⚠️ **THE PICTURE IS RENDERED AT POST TIME.** What he approved is what stays there; deriving it per render
  would let a later change to the style, the map provider or the route privacy repaint a published post.
- ⚠️ **AND IT FALLS BACK TO THE NUMBERS WITH NO ROUTE**, whatever style was asked for — a treadmill run has
  none by design and an empty square is worse than the facts of the run.
- ⚠️ **THE BAKED STAMP IS AT THE TOP, AND THAT WAS FOUND BY LOOKING.** In the lower corner it sat directly
  under the grid cell's own caption strip — two labels stacked, the distance half hidden behind the app's
  own gradient. The caption is chrome; the stamp belongs to the picture.

⚠️ **`commTileHtml`, `commMonths` AND `commFillMaps` WENT WITH IT, plus their CSS and constants.** A builder
nothing reaches is the computed-and-discarded trap this file records five times.

### ⚠️ THE MAP BEHIND THE ROUTE — AND THE OLD REASONING WAS HALF WRONG

*"there is no map sitting behind the route line....this needs fixing"*. The guard that refused it said a
basemap behind fifteen tiles would be "roughly 120 billed tiles every time you opened the tab" — the first
half is true and **the second half is false, because of the cache this app already built**: `routeMapFor`
keys on the route and keeps the composite in IndexedDB. It costs ~120 tiles once, ever. Measured on a real
route: the map tile carries **89 distinct colours against the line-only tile's 27**.
⚠️ **AND IT GOES THROUGH `routeMapFor`, NEVER `loadRouteMap`** — the census guard is now 5, and it exists
because a second caller of the fetcher re-fetches billed tiles on every view.

### INTE-CLUB ON THE SHARE CARD, AND THE SENTENCE THAT WENT STALE

⚠️ **IT IS THE ONE TILE THAT NEEDS NOTHING NATIVE AND CANNOT FAIL** — the card goes into a store this app
owns, so there is no bridge, no scheme, no permission and no share sheet. It posts **the card that is on
screen**, not a second rendering: `prepareShareCard` already holds the exact bytes the other tiles hand
out.
⚠️ **ANSWERED BEFORE THE CAPABILITY TEST**, or a build with the native bridge tries to hand the card to
another app for a destination that is inside this one.
⚠️⚠️ **AND ITS ACCESSIBLE NAME SAID "opens your phone's share sheet", WHICH IS THE MAP-ATTRIBUTION FAULT
AGAIN.** One sentence was appended to every tile and was true for as long as every tile ended there.
Adding one that does not made it false; **nothing about the sentence changed.** A derived fact goes stale
the moment a new case arrives, and the tile that lies is the one a screen-reader user relies on most.
⚠️ **THE ONE-DISPATCH GUARD WAS RESTATED RATHER THAN DELETED**: exactly one id may have a branch, it must
be `inteclub`, and every other id still shares the two routes.

### ⚠️ A READER THAT WHITELISTS ITS FIELDS DROPS THE NEXT ONE, SILENTLY

`loadClubProf` returned `bio`, `trainingFor` and `pbs` alone, so `autoPost` was written correctly, stored
correctly, and **thrown away by the very next read**: measured on the served page, the store held
`{"autoPost":true}` while `clubAuto()` answered false and the switch stayed off. The guard derives the
writable fields **from the writers** — a hand-written list goes stale the first time somebody adds a
setting, which is exactly the failure being guarded.
⚠️ **AND IT HAD TO KNOW BOTH WRITE SHAPES.** Two fields go through the edit page's own `put()` helper and
three through `saveClubProf` directly; a sweep that knew only one found three of five and reported itself
as broken. ⚠️ Scoped to `wireClubEdit`, because `put({ k: … })` elsewhere in the app matched too.
⚠️ **AND IT CHECKS THE SUCCESS RETURN, NOT THE WHOLE FUNCTION** — the catch fallback names every field, so
scanning the body was satisfied by the fallback alone. Watched escaping.

### The small ones

⚠️ **THE PB CAPSULE'S SIZE IS TIED TO THE LABEL BESIDE IT, NOT PICKED BY EYE:** *"they need to be the same
size as the word TIMES"*, so both read `--t-label` and the guard compares the two rules rather than pinning
a number. White ground, teal edge, teal text.
⚠️ **THE TRAINERS ROW WEARS A TRAINER.** `ICON.rEasy` is a running figure and was standing in for the shoe
on the club profile and the live start screen — a picture of a person where the sentence is about footwear.
⚠️ **`.cm-avplus` NEEDED `padding: 0`, AND THAT WAS MEASURED.** The app's global button rule left a 26px
badge with a 10px content box holding a 14px glyph, and grid resolves a centred item that OVERFLOWS its
area to start-aligned: 8px on the left, 4px on the right.

### ⚠️ THE COMMENT TRAP FIRED FOR AN ELEVENTH TIME — AND THIS TIME IN SWIFT

`PhotoLibraryService`'s header explains why `PHPickerViewController` is NOT used, so a guard forbidding
that name found it three times in the very comment defending the design. `noswift()` is the stripper for
it, matching `nocomment()`'s job on the page.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1168 pass / 0 fail**, both
design ratchets unchanged, `InteRun` **Release** for `generic/platform=iOS` building with 0 errors. Driven
end to end in the served build: the switch revealing its picker and remembering the style, a run posted as
a map tile with a real basemap behind it, the story's route holding its exact aspect with round markers,
and the five share destinations with Inte-Club among them.

### THE INTE-RUN MARK ON THE SHARE TILE, AND A PB IS PICKED RATHER THAN TYPED (2026-08-22, fourth round)

Two faults he found on the phone. Suite 1168 → **1171**; 8 deliberate re-breaks, all caught.

⚠️ **THE CLUB TILE WEARS BRAND_MARK'S OWN GEOMETRY, SCALED.** It was a generic two-figure community glyph;
his instruction is that the Inte-Run logo belongs there. The dot at (82,37) r11 in the mark's 120 box
becomes (16.4,7.4) r2.2 in the row's 24 one, and the second slash keeps the **.62** it carries on the
splash — so a change to the logo shows up as a mismatch in the guard rather than as two versions of the
mark in one app.
⚠️ **IN currentColor, NOT THE BRAND GRADIENT.** A gradient-filled app icon dropped into a row of line
drawings reads as somebody else's logo pasted in, which is the same reason the other four tiles are this
app's own strokes rather than Instagram's and WhatsApp's real marks.
⚠️ **AND THE GLYPH GUARD HAD TO ACCEPT A FILL.** It required `stroke="currentColor"` on every mark, which
rejected this one while it was doing exactly the right thing — the logo is a shape, not a line drawing.
The invariant is that a mark carries no colour of its own; the hex sweep is what enforces that.

### ⚠️⚠️ THE PB FIELD WAS AN INVENTED MECHANISM, AND THAT IS THE WHOLE LESSON

*"when you're trying to add PB to your profile, it doesn't type as time….maybe it's best if it's scroll
wheel options for hours: minutes: seconds"* — and his screenshot shows **1751** sitting in the box marked
red. The field was a bare text input that accepted anything and then rejected it, **while this app has had
a digits-to-time input since the setup form's own 5 km question**: `fmtDigitsToTime` / `bindTimeInput`
turn 1751 into 17:51 as you type, and have done for months. Writing a new field rather than using the one
that exists is the same class as inventing a CSS class or a design token — there was already an answer.

⚠️ **AND HIS SUGGESTION IS BETTER THAN EITHER.** A PB is a number the runner already knows, so the only
thing typing can add is a way to get it wrong. Three wheels cannot hold an invalid time: there is no error
state to design, no hint to write, nothing to reject, and `.bad` is gone from the row entirely.

⚠️ **THEY ARE NATIVE `<select>` ELEMENTS, WHICH IS WHAT MAKES THEM WHEELS.** iOS presents a select as its
own scrolling picker. A hand-rolled wheel is a scroll container pretending to be one, with its own
momentum, its own snapping and none of the accessibility a real control has for free.

⚠️ **ALL THREE AT ZERO MEANS NOT SET, AND THAT IS WHY IT IS NOT A JOIN.** Without it every distance the
runner has not filled in reads "0:00" on their profile as a claimed record — four fabricated PBs on the
one screen somebody might show to another person. And the hours are dropped when zero, so a 5 km reads
21:04 rather than 0:21:04.

⚠️ **ANYTHING TYPED BEFORE THE WHEELS EXISTED STILL LOADS.** `clubPbParse` accepts both `mm:ss` and
`h:mm:ss`; a reader that understood only the new form would silently blank somebody's PB. Verified on the
served page: a stored "21:04" fills 0/21/04 and "1:38:20" fills 1/38/20.

⚠️ **THE ROW IS REPAINTED, NOT THE SCREEN.** A full render would rebuild the wheel the finger is on and
close the picker mid-spin; the only thing that changed is the value beside it.

⚠️ **THE VALUE IS SHOWN AS WELL AS THE WHEELS**, because three two-digit boxes do not read as a time at a
glance — and it is exactly what the profile will show, which is the thing being decided.

### ⚠️ AND A THIRD STALE SENTENCE UNDER THE SAME NEW CASE

The note under the destinations read *"Every one of these opens your phone's own share sheet"* — true until
a tile arrived that opens nothing at all. **Nothing about the sentence changed; the world under it did.**
That is the third time in this feature: the tile's own accessible name, then this, after the map
attribution crediting a provider that had served nothing. ⚠️ **BOTH BRANCHES CARRY THE CORRECTION** — the
note has a native-build form and a web form, and naming the club in one leaves the other lying on exactly
the builds that are hardest to check.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1171 pass / 0 fail**, both
design ratchets unchanged. Driven on the served build: the wheels loading older typed values, hours
appearing only when non-zero, zeroing clearing rather than claiming 0:00, and the five destinations with
the Inte-Run mark on the club one.

### FOUR MORE FROM THE PHONE (2026-08-22, fifth round)

Suite 1171 → **1174**; 10 deliberate re-breaks, all caught. All four are web, so all four reach the phone
on the next launch.

### ⚠️⚠️ THE CAMERA ROLL WAS BUNCHED UP, AND IT IS THE aspect-ratio CIRCULARITY

Measured and reproduced: every cell computed **149×149 correctly** while the grid's own row tracks came out
**89.5px**, so the cells overflowed their rows and overlapped — thumbnails squashed into thin strips with
the selection circles running into each other, which is exactly his screenshot.
**The cause is a loop.** An auto row sizes to its items' content, and an item whose height comes from
`aspect-ratio` has no content contribution to give — the image inside is 100% of a height that does not
exist yet. **Percentage padding resolves against the item's WIDTH**, which the `1fr` track has already
settled, so there is nothing circular to resolve and the row is simply told how tall it is.
⚠️ `padding: 100% 0 0` with `height: 0`, and **the image becomes absolute**, because the cell's content box
is then zero-height by construction. The marks need a `z-index` rather than document order, since the
image now comes first.
⚠️ **`aspect-ratio` IS NOT A DROP-IN FOR THE PADDING TRICK INSIDE AN AUTO GRID ROW**, and that is the
transferable part. It works everywhere the box's height is not also what sizes the track.

### SHARING A CARD TO INTE-CLUB ASKS, AND THEN OPENS THE EDITOR

*"it needs to give me the option of sharing to story or grid…..and being able to edit (write a comment on
the grid post or type over a story)"*. It used to post to the grid silently, which decided both for him.
⚠️ **THE CARD GOES INTO THE EDITOR AS THE PICTURE**, so everything already there applies to it: pan and
zoom, words typed on it, the caption step, and the same post shape as anything from the camera roll. A
second composer for one kind of picture would be a second of everything.
⚠️ **THE STUDIO CLOSES FIRST.** Both are full-screen overlays and the studio is the later one in the stack.
⚠️ **AND THE CAPTION STARTS AS THE RUN'S OWN LINE** rather than empty — it is what the card already says.

⚠️⚠️ **THE CARD IS FITTED, NEVER CROPPED, AND ONE RULE SERVES ALL FIVE SURFACES.** The editor covers by
default, which is right for a photograph — raw material the runner is framing — and wrong for a card the
app itself composed: measured, it cut **"Inte-Run" and the distance off both edges**. The editor, the
caption strip, the grid tile, the post feed and the full-screen player all read one flag through one
selector list, so none of them can crop what another shows whole.
⚠️ **AND THE FLAG IS PASSED IN, NOT PATCHED ON AFTERWARDS.** Set on the returned editor it landed AFTER the
first paint, so nothing had it and the stage cropped the card anyway — measured, `object-fit` read
"cover". `openClubEditor(kind, files, opts)` takes `card`, `caption` and `runId`; a caller that has to fix
something up after the fact is a caller that can forget to.

⚠️⚠️ **THE DESTINATION IS THE ASPECT DECISION.** A 9:16 story card in a square grid cell is mostly white
bars — measured — and a 4:5 feed card in a story is letterboxed the other way. Choosing story or grid IS
choosing the shape, so the card is rendered at the shape it is going to rather than at whatever chip
happened to be selected. ⚠️ **And what he had selected is put back on both paths**, because a failed render
leaves the studio open and it must not have silently changed shape underneath him.

### THE FEED PANE IS THE EMPTY STATE AND NOTHING ELSE

*"it shouldn't look like that, it will be empty until there are other users posting"*. The design puts a
stories rail on the feed, and with nobody to follow it held only the runner's own story beside an Add
button — a row of two things above a message saying there is nothing to show.
⚠️ **NOTHING IS LOST BY REMOVING IT:** the avatar on the other pane already opens his story and its +
badge already adds one, so both routes survive on the screen that is about him.
⚠️ **AND IT ALSO RENDERED WRONGLY, which is worth recording rather than fixing invisibly.**
`.cm-rail-ring img` set a `font-size` and a `colour` and **never sized or clipped the image**, so the
avatar came out at its natural size spilling across the screen — his fourth screenshot. The rule was
written for the initials span and the `img` selector was bolted onto it without giving it dimensions.
⚠️ **Its CSS went with it**, because an orphaned rule is what the next screen copies — and one of these
rules WAS the defect.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1174 pass / 0 fail**, both
design ratchets unchanged. Driven on the served build: 30 roll cells measuring 149×149 with zero
overlapping pairs, the club tile asking story-or-grid then opening the editor with the card fitted and the
caption prefilled, a 1080×1350 card for the grid with "story" put back afterwards, and the feed pane
holding one child.

## THE COMMUNITY TAB, BUILT TO THE COMMISSIONED DESIGN (2026-08-22)

`design_handoff_community_tab` plus `ADDENDUM-1.md`: two panes on a horizontal slider — the runner's own
profile and runs, and a feed of the runners they follow — a story viewer, three sheets, a plan-journals
rail and a fourth sheet. Suite 1122 → **1132**.

⚠️⚠️ **EVERY PERSON IN THE DESIGN'S DEMO DATA IS FICTIONAL AND NOT ONE OF THEM SHIPPED.** The prototype
carries Cormac Byrne, Niamh Doyle, 1,204 followers, 312 following, four posts with likes and comments,
and five people in each of the follower sheets. There is no backend behind any of it — no accounts, no
other runners, nothing to follow. Rendering those names to a tester would be fabricated data on a screen
that looks like a social network, which is the one thing this codebase refuses everywhere else.
⚠️ **SO WHAT SHIPPED IS THE DESIGN WITH REAL DATA AND THE DESIGN'S OWN EMPTY STATES, WHICH IS NOT A
NARROWING.** The handoff lists them as required work in as many words — "no posts yet in the grid", "an
empty feed for a runner following nobody", "an empty comment list", "no stories in the rail (the ring row
collapses)" — because "the prototype only shows the ideal state, and the system requires all of them".
`test/community.test.ts` sweeps the build for all twelve names, seven handles and the counts.

**What is real:** posts = runs in the uncapped history; the meta line is the goal, the week and the block
length off `PLAN`; the chips are best recorded efforts at 5 km / 10 km / half / marathon; the week total is
`logTotals`; the grid is every recorded run by month with that month's real count and distance; a tile
opens that run; the story is the runner's own last run with `debriefParagraphs` as its middle slide; Share
a run lists real logged sessions and Continues into the share studio that already exists.

⚠️ **"BEST", NOT "PB", AND THE WORD IS THE HONEST HALF.** The design's chip reads "PB · 5 km 21:04". A
personal best is a race result; this is the quickest the app has recorded them covering about that far,
training runs included. Tolerance is 3% — a 5.4 km run is not a 5 km time.
⚠️ **NO HANDLE AND NO LOCATION.** The design's meta line carries "@aoife.runs · Cork"; this app stores
neither, and inventing an @name from a first name or a city from GPS is the app asserting something the
runner never told it.

⚠️ **A TILE IS THE ROUTE DRAWN AS GEOMETRY, NEVER A BASEMAP.** The design's tiles are photographs and a run
here has none — it has the shape of where it went. `routeMapSvg` with no projection fits a route to its own
box, so a tile costs no map tiles: the same call, for the same reason, the share card records ("NO TILES …
a shared card costs no billed tiles"). **Fifteen tiles of basemap on first open is roughly 120 billed
tiles.** Guarded by name against `routeMapFor`, `loadRouteMap`, `liveMapFor` and `buildOverviewMap`.

⚠️ **PLAN JOURNALS EXIST BECAUSE THE APP KEPT NO RECORD OF A FINISHED BLOCK.** `adoptPlan` assigns `PLAN`
outright, so a new goal replaced the old block with no trace — the addendum's five rings could only ever
have been the demo's five. `journalSync()` now records the block a runner is in and stamps the day it was
replaced, so the rail is honest today (one ring, which the addendum names as the first-block state) and
accumulates from here.
- ⚠️ **INSIDE `adoptPlan`, NOT AT ITS CALLERS**, for the reason that function's own note gives about the
  open-coded assignment; and inside a `try`, like the two syncs beside it — losing a journal row must
  never cost somebody their plan.
- ⚠️ **THE SIGNATURE IS WHAT STOPS A ROW PER BOOT.** `recompute()` re-adopts the same plan every launch.
- ⚠️ **AND THE AVERAGE IS THE MEAN OF THE RATINGS ACTUALLY GIVEN.** RPE lives on the capped full records
  and is optional; "—" when nothing was rated, rather than a mean over runs nobody rated.

⚠️⚠️ **`journalSync` RAN AT BOOT AND THREW EVERY TIME, SILENTLY, BECAUSE ITS `const` KEY WAS DECLARED FIVE
THOUSAND LINES LATER.** `recompute()` is called at module top level, so `adoptPlan` reached `journalSync`,
`loadJournals` read `JOURNAL_KEY` in its temporal dead zone, and the `try/catch` swallowed the
ReferenceError. Measured: nothing was ever written on any launch while calling it by hand worked
perfectly. The same trap `SHARE_LADDER` hit reading `SHARE_EVEN_SPREAD_S`. `JOURNAL_KEY` is declared with
the other store keys now.

⚠️⚠️ **THE TWO DESIGN SYSTEMS USE THE SAME SIX TYPE SIZES UNDER SWAPPED NAMES, AND EVERY SIZE IN THE NEW
CSS WAS WRONG BEFORE IT WAS SPOTTED.**

| px | design system | this app |
|---|---|---|
| 32 | `--t-display` | `--t-display` |
| 24 | `--t-title` | `--t-hero` |
| 20 | `--t-card` | `--t-section` |
| 17 | `--t-section` | `--t-card` |

Copied by name, a heading specified at 17px renders at 20 and a stat value specified at 20 renders at 17 —
every heading and number one rung out, in opposite directions, with nothing failing. The undeclared-token
guard caught only `--t-title`, the one name this app lacks entirely; the other two resolve happily to the
wrong size. **Translate design tokens by VALUE, never by name.**

⚠️ **`--mark`, `--mark-deep` AND `--signal-*` WERE USED BY THE DESIGN AND DECLARED NOWHERE IN THE APP.**
Added to `:root` ONLY, and that is deliberate: this file's four-places warning is about tokens whose value
differs by theme, and these do not — the design system declares them once for the same reason. Four copies
of one constant is how they come to disagree.
⚠️ **AND THE SHARE CARD'S NEON BAN HAD TO BE NARROWED FROM "the whole build" TO THE RENDERER.** `#3dffb0`
is `--signal-2`, which both the design system and the handoff permit on dark media and forbid in UI
chrome — a full-screen story over a dark route is dark media. What the guard protects is unchanged: the
card must not paint itself in a neon of its own, so the sweep is `closure("drawShareCard")` plus a check
that no signal token reaches `SHARE_INK` by name. Both halves re-broken.

⚠️ **THE ALL / VIDEOS TABS ARE DELIBERATELY NOT BUILT.** `liveRunRecord` carries no media field of any
kind — no photo, no video, no upload path — so a Videos tab would be permanently empty for every runner
and "All" would be the grid already on screen. Two tabs where one is always empty is worse than no tabs,
and it is the looks-live-is-inert class this project has shipped three times. About twenty lines the day a
run can carry media.

⚠️ **`uiSessionRow` HAS NO `attrs` OPTION AND THE SHARE ROWS WERE WRITTEN WITH ONE.** It would have been
dropped in silence and every row in that sheet would have looked live and done nothing. Its own comment
says to use the app's delegated handler; `o.id` becomes `data-uirow`, which is that route.
⚠️ **AND `ui-pill-build` IS NOT A CLASS THIS APP HAS.** The addendum names Pill tones `build` / `done`;
the app's pill takes a colour as `--pc`, so the invented class would have rendered an unstyled span.

⚠️ **THE STORY TIMER IS STARTED IN THE OPEN HANDLER AND CLEARED ON EVERY EXIT** — which is addendum 1's
correction to the README, and it was already built that way. The progress bar is a 4.5s keyframe rather
than a 100ms tick, so it needs no re-render per tick and Reduce Motion turns it off globally while the
auto-advance still works, exactly as the handoff requires.

**8 deliberate re-breaks, all caught, two only after the guard was restated.** The effort guard asked
whether `sessionEffort(t.type)` was *mentioned*, which a conditional around it satisfies — watched
escaping with `(t.type === "threshold") ? "hard" : sessionEffort(t.type)`, which IS the defect. And the
mark-gradient guard said "story ring only" before the addendum reused that ring for a live block; the
invariant is the MEANING (live or unseen), so it now also requires a finished block's ring to be the flat
hairline.
⚠️ **AND THE RE-BREAK HARNESS CONTAMINATED ITS OWN BASELINE AGAIN.** A keep copy taken during the run held
a break, so restoring "the good file" restored a broken one and two guards failed on a tree that looked
clean. Same lesson the sticker phase recorded: **take ONE pristine copy at the start**, never per break.
And it restores the source without rebuilding, so `web/app.html` was stale for a run — these tests read
the built page.

### THE PROFILE IDENTITY, REGROUPED (owner, 2026-08-22, sixth round)

*"Redesign this section so that it fits nicely, it looks cluttered"* — with a screenshot of the block
under his avatar — and *"if you need to put a maximum character count on some of the typing fields to
make this fit nicer then that's ok"*. Suite 1246 → **1253**; 18 deliberate re-breaks, all 18 caught.
Web-only, so it reaches his phone on the next launch.

⚠️ **THE COUNT WAS THE CLUTTER: SEVEN LEFT-ALIGNED ROWS, ALL THE SAME WEIGHT, ALL STARTING AT THE SAME
x.** The name, the handle, the bio, the plan, the shoes, the week and the times each had a row of its
own, so nothing was subordinate to anything and the eye had no way in. Four tiers now: **name + handle**
on one line, the **bio**, **one meta line**, and **Times** over one row of capsules. Measured on the
served page at 430×932, the block went **153 → 130px with a fact added to it**, and 152px with the
week's distance as well — and the four blocks are legible as four things rather than seven.

⚠️ **`commMetaLine` IS THE ONE LINE, AND ITS THREE FACTS WERE THREE DIFFERENT SHAPES.** A bold label and
text, a shoe row using `space-between` for two short items (so it left a gap the width of the card), and
a lone grey capsule. They are all small facts about right now, so they read as one wrapping line.
⚠️ **THE SHOE KEEPS ITS LINK AND ITS OWN MILEAGE**, and the two distances stay apart — the shoe's total
belongs beside the shoe, the week's belongs to the week. Side by side in the old layout they were two
unlabelled kilometre figures a row apart, which is its own confusion.

⚠️⚠️ **NO SEPARATOR GLYPH AT ALL, AND BOTH OTHER ANSWERS WERE BUILT AND MEASURED ON THE SERVED PAGE.**
A dot as its own span is a flex item, so a wrap **stranded it at the end of the first line**
("…week 1 of 36 ·"); moved to a `::before` on the following item, the wrap **carried it down and it LED
the second line** like a bullet list. **A separator and a wrapping row do not mix.** Spacing alone
cannot strand, and at this size and colour the items read as separate without a glyph — `gap: 3px 14px`.
Both rejected forms are forbidden by name, because the next reader will reach for one of them.

⚠️ **THE TIMES SCROLL SIDEWAYS RATHER THAN WRAPPING.** Four PBs wrapped to two lines and left the
fourth on its own; a fifth distance would be worse. The label sits **above** rather than beside, because
beside it was taking width from the row that could not fit.
⚠️ **AND THE SCROLLER IS THE ONLY THING THAT MAY SCROLL SIDEWAYS** — the page body never does, this
app's oldest layout rule — so the overflow is on that one container and nothing above it.
⚠️ **ITS NEGATIVE MARGIN MUST EQUAL ITS PADDING** (`--s3` both), or a chip stops short of the screen
edge and the partial chip reads as *clipped* rather than as *continuing*. Guarded by comparing the two
tokens, not by pinning either.

⚠️ **THE CAPS ARE READ BY THE FIELD *AND* BY THE SAVE *AND* BY THE READ.** `CLUB_BIO_MAX` 140,
`CLUB_FOR_MAX` 44. A `maxlength` alone is advisory — it is a DOM attribute, so a value restored from the
store or pasted by a future path is not filtered by it — and the read trims what is already stored, or
text saved before the caps existed still overflows the row. Two hand-written numbers is how the field
and the store come to disagree about the length of one sentence.
⚠️ **`clubTrainingFor` SHORTENS THE PLAN'S OWN SENTENCE AND NEVER THE RUNNER'S.** `commProfile` builds
*"half marathon block, week 1 of 36"* for the header it was written for — 45 characters before the shoes
have had any, which wrapped the row this redesign exists to tidy. *"Half marathon · wk 1/36"* says the
same in 22. An unrecognised sentence is passed through rather than dropped; if the runner typed it, it
is what they meant. Guarded by **execution** (the shortening is a regex and a capitalisation, neither
visible in the source text) with `loadClubProf` and `commProfile` stubbed.

**Contrast, from rendered pixels** (dpr 2, both themes, ink measured as the extreme inside each
element's own box): name 14.76 / 17.92, handle 6.30 / 9.33, bio 14.76 / 17.92, meta label 14.76 / 17.92,
meta item 6.30 / 9.33, **TIMES 4.56 / 6.50**, PB chip 4.83 / 9.18. Nothing under 4.5.
⚠️ **THE PERCENTILE FORM READ THAT LABEL AT 1.61:1 AND IT WAS THE INSTRUMENT, NOT THE CODE** — five
uppercase glyphs are **2.0% of their own box**, so a 2nd-percentile "ink" lands in the anti-aliased ramp.
This file already records the same trap reading a note at 3.87 where its token delivers 4.56. **Report
the ink coverage beside the ratio**, so a sparse box is visible as sparse.

### ⚠️ THREE FAULTS THE NEW GUARDS FOUND, AND ALL THREE WERE INVISIBLE ON SCREEN

1. ⚠️⚠️ **`commMetaLine` SHIPPED DECLARED *INSIDE* `viewCommunity`.** A function declaration hoists
   within its enclosing scope, so nothing failed — but it was rebuilt on every render, no other screen
   could reach it, and `fn("viewCommunity")` **swallowed it**, which is how it was found: an unrelated
   guard sliced the view and matched text from a function that had no business being in there. **A
   helper declared inside its only caller is a helper the next caller cannot use.** Lifted to the top
   level and guarded — `viewCommunity` may declare no named function at all.
2. ⚠️ **A SECOND `.cm-meta` RULE, LEFT FROM THE DESIGN BEFORE THIS ONE** (`font-size` + `--ink-faint`,
   two hundred lines above). Both declared the same two properties, so the line's colour was decided by
   which came last in the stylesheet — the two-owners-of-one-measurement fault this project has paid for
   in the watch's page inset, the story's aspect and the share card's hairline. **A duplicate cannot be
   seen on screen** (the later one simply wins), so it needs a count rather than an eye: every identity
   class is now asserted to be declared exactly once. The `.cm-tr` rules that drew the old shoe row were
   deleted with it — an orphaned rule is what the next screen copies.
3. ⚠️ **TWO EXISTING GUARDS WERE SCOPED TO A LAYOUT RATHER THAN TO A FACT, and both failed on correct
   code.** *"the trainers row wears a trainer"* required `cm-tr">' + ICON.shoe`; *"a shop link is only
   ever a plain web address"* required `rel="noopener noreferrer"` inside `fn("viewCommunity")`. Both
   invariants are still live, so both were **restated, not deleted** — the shoe guard asks
   `commMetaLine`, and the link guard now **derives** its scope by finding every function that renders
   `clubShopHref`'s result into an `href` and asserting there is exactly one. A guard tied to the markup
   it happened to sit in expires the first time the markup is regrouped.

⚠️ **AND ONE GUARD OF MY OWN COULD NOT *PASS*, WHICH IS THE INVERSE FAULT AND JUST AS USELESS.** The
nesting check ran `/\bfunction \w+\(/` over `fn("viewCommunity")` — a slice that **begins** with
`function viewCommunity(`, so it always matched itself. The signature is cut off before the body is
scanned. Look for both directions when a new guard's first run surprises you.

⚠️ **TWO OF MY OWN COMMENTS WENT STALE INSIDE ONE CHANGE** — the CSS header said "THREE TIERS" of a
four-tier block, and `commMetaLine`'s doc still promised "dot-separated prose" after the dots were
measured out. Nothing about either sentence changed; the design under it did. Fourth and fifth firing
of that in this feature, after the map attribution, the destinations note and the tile's accessible name.

### ⚠️⚠️ THE SCREEN SLID SIDEWAYS, AND `overflow-y: auto` ALONE IS WHAT DID IT (owner, 2026-08-23)

*"I dont want the screen to slide sideways. it should remain like instagram does with the elements at the
top being rearranged in an aesthetically, premium designed way"* — with a screenshot of the whole pane
shifted left, the avatar, the name and "Plan journals" all clipped off the edge. Then, an hour later:
*"the trainer information needs to be underneath the distance covered this week on its own line."*
Suite 1253 → **1256**; 15 deliberate re-breaks, all 15 caught.

⚠️ **HIS SCREENSHOT WAS THE PREVIOUS BUILD, SO THIS WAS PRE-EXISTING RATHER THAN THE REGROUP'S FAULT** —
it shows the old `space-between` shoe row and the wrapping capsules. Proved from `git show HEAD~1`, not
assumed, because the two builds look similar enough to blame the wrong one.

⚠️⚠️ **A BOX WITH `overflow-y: auto` AND NOTHING SAID ABOUT X GETS `overflow-x: auto`.** The spec turns
`visible` into `auto` when the other axis is not visible, so `.cm-pane` had been a horizontal scroller
nobody asked for since it was written — and anything sticking out of it could be dragged. Measured:
**20px of overflow, and `scrollLeft = 200` landed at 20.** `overflow-x: clip` computes to `hidden`
alongside a scrolling y-axis, and neither can be dragged by a finger; a descendant with its own
`overflow-x: auto` (the journals rail) still scrolls itself.

⚠️ **BUT THE CLIP IS THE GUARANTEE, NOT THE FIX — AND ON ITS OWN IT TURNS AN OVERFLOW INTO MISSING
CONTENT.** Two things were bleeding out of the pane and both had to stop:
- **`.cj-sec` bled by `--gutter` (20px), and that is the one he swiped.** A full-bleed child only works
  when its PARENT carries the gutter; `.cm-pane` carries none — the 16px inset comes from `#view`, two
  boxes further out — so the section stuck 20px past the pane on both sides. Every other section rule in
  this app spans the content width; this one was the odd one out and it cost the layout.
- **The times row I had just built bled 12px** for exactly the same reason, which is the inset-equals-
  padding rule from the day before applied against the wrong box. **The rule was right and the box was
  wrong**, which is worth knowing: an inset that matches *a* padding still overflows if the padding
  belongs to an ancestor rather than to the scroller.

⚠️⚠️ **AND THE CLIP THEN EXPOSED A SECOND, OLDER OVERFLOW: THE STATS ROW, WHICH IT WOULD HAVE CUT.**
Measured at 320px with the largest text setting, the three stat columns needed **49px more than the row
beside an 82px avatar could give**. Before the clip that was the other half of the slide; after it, it
would have silently shaved "FOLLOWING" off. FOLLOWING is one word and cannot be hyphenated, so the stats
take a line of their own — which is what Instagram does on a narrow screen. `.cm-head { flex-wrap: wrap }`
plus `.cm-stats { min-width: max-content }`, so it happens exactly when the words stop fitting and never
otherwise. ⚠️ **`min-width: 0` was the opposite of what was wanted and it is what shipped** — it let the
box shrink under its own words, so the labels collided and then spilled.
⚠️ **A cost, stated rather than buried: at 320px the stats now wrap at NORMAL text size too**, because
their natural width genuinely exceeds what is left beside the avatar. On that screen they were already
colliding, so this is a repair rather than a regression — but the layout on the smallest phone did move.

### THE TIMES ARE TWO EVEN COLUMNS, AND THE GUARD FROM THE DAY BEFORE IS NOW INVERTED

⚠️ **THIS FILE DEMANDED A SIDEWAYS SCROLLER FOR ONE DAY.** `test/community.test.ts` carried *"the times
are one scrolling row, inset to the screen edge"* — which is the thing he rejected. **Inverted rather
than deleted**, the way the PRICE/RICE reversal was: what the old guard protected (the fourth capsule
must not be orphaned on a line of its own) is still true and is still asserted.

⚠️ **EXACTLY FOUR DISTANCES EXIST (5 km, 10 km, half, marathon), SO TWO COLUMNS CAN NEVER ORPHAN ONE** —
four items are two full rows. That is why two, and not an `auto-fit` grid (3 + 1 on a narrow screen) and
not a scroller, which hides half the runner's own times behind a gesture nobody is told about.
⚠️ **`flex: 1 1 46%` PUTS TWO ON A ROW AND `min-width: max-content` IS WHAT MAKES IT DEGRADE INSTEAD OF
OVERFLOWING.** At 320px with the largest text two no longer fit, so the long capsules take a full row
each — measured 3 rows, **0 overflow** — rather than being pushed out of the pane.
⚠️ **HIS EARLIER CAPSULE RULING SURVIVES UNTOUCHED AND IS ASSERTED BESIDE THE NEW LAYOUT** — *"they need
to be the same size as the word TIMES"*, white ground, teal edge, teal text. Only the layout changed.

⚠️ **THE TRAINERS TAKE A ROW OF THEIR OWN, LAST, AND BOTH HALVES ARE ONE DECISION.** `.cm-mi-shoe` is
`flex: 0 0 100%`, so it cannot share a line wherever the facts above it happen to wrap to, and the push
order in `commMetaLine` puts it after the week. Either half alone puts the shoes back beside something.
A second `.cm-meta` container below would have been two rules owning one line's spacing.

**Measured after, at 430×932 and 320×568, at text scale 1.0 and 1.3, both themes:** pane overflow **0**,
nothing sticking out of the pane at any of them, `scrollLeft` **0**, page overflow **0**, capsules in 2
even rows (3 at the narrowest extreme, by design), zero console errors.
