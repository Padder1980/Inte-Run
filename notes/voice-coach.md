# Voice coach and coach audio

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## Voice coaching (Kokoro-82M)

- **Catalogue (single source of truth):** `src/live/coach-prompts.ts` — typed prompts (id, text,
  trigger, priority, interrupt, repeat interval, session types). Four original coaches:
  The Guide (voice `bf_emma`), The Pacer (`bm_george`), The Motivator (`bf_isabella`),
  The Technician (`bm_lewis`).
- **Audio:** pre-generated mono MP3s in `docs/voices/<coach>/<promptId>.mp3` + `manifest.json`. The
  in-app controller is the `COACH` object in `web/app.ts` (single reused `<audio>`, priority queue,
  iOS unlock in the start-tap, on-demand caching of only the selected coach, graceful fallback to the
  device voice if a clip is missing).
- **ElevenLabs is the preferred generator** (owner subscribed 2026-07-27): `voice-dev/generate-elevenlabs.py`
  reads the same `prompts.json`, casts coaches from the account's voices into the committed
  `voice-dev/elevenlabs-voices.json`, and writes the same `web/voices/` + manifest. The API key lives
  ONLY in gitignored `voice-dev/elevenlabs-key.txt` (or `ELEVENLABS_API_KEY`) — it must never be
  committed or shipped; the app stays a static player of pre-generated MP3s. Kokoro remains the
  free fallback below.
### Pace cues and "your why" (shipped 2026-07-28)

Beyond the structural cues, the coach now reacts to **how the run is actually going** and to **why the
runner is out there at all**.

- **Pace cues** (`pace-behind` / `pace-ahead` / `pace-on`) and **`keep-going`** are per-coach lines in
  the same catalogue. `coachPaceTick()` in `web/app.ts` speaks only when a verdict has **held for 20s**
  and the last cue was **100s+ ago** — a coach who reacts to every wobble gets muted in week one.
  `pace-on` fires only after a correction, so it affirms rather than chatters.
- **The four "why" questions** (who inspires you / why you run / why this goal / what keeps you going)
  are asked in **plan setup section 6** and editable in **Support › Your why** — one markup builder
  (`whyRowsHtml`) and one wiring path (`wireWhyInputs`) behind both. Stored in `interun_why_v1`.
- `coachWhyTick()` fires **once per run**, at **70% through** (66% for hard sessions) and only when the
  session is **15 min+**. The coach frames the moment; the runner's **own words appear on screen**
  (`whyLiveHtml()`). Rarity is the design: a why that plays every run becomes wallpaper.
- **Per-coach wordings** live in `variants` on `PromptDef`, resolved by `promptTextFor(p, coach)`.
  Catalogue is now **57 prompts × 4 coaches = 228 clips**.

⚠️ **No prompt text may contain a digit.** Clips are pre-generated, so a number can never be spoken
correctly. `test/coach-variants.test.ts` asserts this across every coach.

### Directing a delivery (learned the hard way, 2026-08-03)

The owner supplied a screen recording of a real delivery and asked for a catchphrase to match it.
**Every attempt that processed recorded speech was rejected by his ear; every attempt that changed
what the MODEL was asked to perform was accepted.** That is the rule, not a preference of his:

⚠️ **NEVER time-stretch or splice speech to fake a delivery.** Six versions were produced by
WSOLA time-stretching and mid-phrase splicing, all measured to match the reference's timing to a
few hundredths of a second, and the verdict was *"too jerky and less flowy"*. Matching the numbers
is not matching the performance — the artefacts of stretching a vowel and cross-fading mid-phrase
are audible even when the envelope is right. Delete the DSP and re-ask the model.

⚠️ **`speed` in `voice_settings` re-renders the whole line and COSTS THE ACCENT.** At 0.75 the
Irish accent and the attitude went with it (*"its lost its irish accent and expression"*). It is
not a tempo control on a fixed performance; it is a different performance.

**What DOES work, in order of preference:**
1. `<break time="1.6s" />` in the text — a single continuous take with real pauses. Asked for a
   0.6s and a 1.6s break, the model performed 0.79s and 1.48s and put its own 0.16s hesitation in
   the same place the reference does. Nothing spliced, nothing stretched.
2. **Spelling and punctuation** — `Baaby!` genuinely drawls the word; `Baby?!` reads incredulous;
   `jooob` lengthens it. This is how to lengthen ONE word without touching the rest.
3. `eleven_v3` with direction tags (`[slowly]`, `[shouting]`) — more expressive, but it slows the
   WHOLE line, which was rejected as *"too slow"*.
4. Lower `stability` (~0.28) for a freer read of the same words.

⚠️ **If a splice is unavoidable, join in SILENCE and match the level.** The one acceptable edit is
grafting a replacement first/last word across a pause that already exists, with the level matched
to the word being replaced (different models render at different loudness, and a step in level
reads as a splice however clean the cut). Find the boundary as the **widest** silence — taking the
first gap grafted onto a 0.19s breath and silently collapsed the pause, so the "slowed" version
came out *shorter* than the original.

⚠️ **THE GENERATOR WILL SILENTLY DESTROY A HAND-CUT CLIP.** `HAND_AUTHORED` in
`generate-elevenlabs.py` names the clips whose delivery was settled by ear; they are skipped even
under `--force` (only `--force-hand` re-records them). The hash gate compares (text, voice,
version) and **cannot tell a directed take from a flat read**, so bumping `VERSION` or editing the
wording would revert five rounds of listening to a plain read with no error and no diff to notice.
Same computed-and-discarded trap as `CLASS` and `PLAN.notes`, applied to audio.

⚠️ **Keep the catalogue text equal to what the clip actually SAYS.** The final line dropped its
opening word, so the `sportsman` variant was edited to match. Leaving the old text there would mean
the protected clip and its prompt disagree, and the day the guard is lifted the runner hears
something different from what the catalogue promises.

⚠️ **A hand-edited MP3 leaves `manifest.json` STALE — and `coachSaySequence` schedules from
`clip.duration`.** Measured: `keep_going_2` read 2.70s in the manifest against 3.37s on disk. The
fix is to re-run the generator, which rebuilds the manifest from the files on disk (durations and
bytes both) without regenerating anything. ⚠️ **Run it with NO `--coach`** — the manifest rebuild
loops over the *filtered* coach list, so `--coach sportsman` writes a manifest containing only that
coach and silently strips the other 1160 clips.

⚠️ **Two ElevenLabs features that would have replaced this whole exercise are blocked by API-key
permissions**: `speech_to_speech` (feed in the reference recording, get that exact delivery back in
the target voice) and `speech_to_text` (transcribe with word timings, instead of guessing which of
three "baby"s the owner meant and sending him two files to choose from). Both return
`401 missing_permissions`. Enabling them on the key is a tick-box in his ElevenLabs account and is
worth asking for before attempting to match a supplied performance again.

### Personal voice packs (a coach saying a real person's name)

Pre-generated audio cannot contain an arbitrary name, so this is a **two-tier** design:

- The **shared catalogue stays name-free** and ships publicly — it works for everyone.
- A **personal pack** is generated for ONE name from `PERSONAL_PROMPT_TEMPLATES` (`{name}` slots) with
  `voice-dev/generate-elevenlabs.py --personal "Alfie"`, into `web/voices-personal/<slug>/`, mirrored
  to `docs/voices-personal/` by the build. **Both paths are gitignored** — a person's name and their
  audio must never reach the public repo or GitHub Pages. The owner's pack ("Alfie", 20 clips) is
  baked into his own build only.
- At runtime `coachLoadPersonal()` fetches `voices-personal/<slug>/manifest.json`; a **404 is the
  normal case**, not an error. `coachPersonalPrompts()` only offers a personal line when its clip
  actually exists, so a name-bearing line can never fall through to the robot voice mid-run.
- ⚠️ Every personal trigger must also exist in the shared catalogue — the test asserts it — otherwise
  a runner without a pack gets silence instead of the name-free fallback.
- **The watch needs no pack at all**: it synthesises speech live, so it can say any name. The phone
  sends `whyName` in the watch payload and `WorkoutVoice.frame()` puts it in the sentence.

- **Generation is dev-only and never ships.** Tools live in `voice-dev/` (the Python venv and the
  Kokoro ONNX model are gitignored — regenerate them if absent). Regenerate audio with:
  `node voice-dev/dump-catalogue.ts && voice-dev/venv/bin/python voice-dev/generate.py`.
  Requires `espeak-ng` (system) — Kokoro weights come from GitHub (huggingface.co is blocked in the
  sandbox). Countdowns are stitched from separate number beats so 3-2-1 lasts exactly 3 seconds.

## FOUR FAULTS FROM ONE REAL SESSION (owner, 2026-08-16) — THREE WERE TWO CAUSES

He ran a custom 1 km from his phone and reported four things. **Two of them were the same defect, a
third is almost certainly a consequence of it, and the fourth was unrelated.** All the fixes are
web-only, so they reach a phone over the air on the next launch — no rebuild.

### ⚠️ A DISTANCE ASK WAS CONVERTED TO A STOPWATCH AT BUILD TIME

*"it completed the session far too early (before 1km)"* — and then, crucially, *"I was walking not
running"*, which is what identified it. `buildCustomSession` turned "1 km" into however long a
kilometre ought to take at the runner's planned pace (`wanted = bodyM / 1000 * secPerKm + fixedSec`)
and set a DURATION. The live runtime's gate is `isDistanceGated(step)` = `distanceMeters != null &&
durationSeconds == null`, so a step carrying both ends on the clock. Walking at 8:52/km against a
5:14 budget, the app declared the session complete at **0.59 km**.

⚠️ **THE PLAN'S OWN SESSIONS WERE NEVER AFFECTED** — measured on a real plan, **0 of 487 steps carry
both fields** (62 distance-only, 425 duration-only). The fault is confined to the custom builder,
which is the one place a step was assembled by hand rather than by the session library.

⚠️ **`test/session-builder-distance.test.ts` HAD TWELVE TESTS AND ELEVEN OF THEM PASSED WITH THE BUG
LIVE** (watched, by reverting the fix). Every one measured the session's SHAPE — its length, its
title, its monotonicity, its training distance — and not one asked the question the runner asks: does
it stop where I told it to. The new guard asserts on **the condition the runtime tests**, not on the
presence of a distance, because the old code set `distanceMeters` on nothing here and a future
version setting both would read as fixed while behaving exactly as before.

⚠️ **AND THE FIX BROKE THE FILE'S OWN MEASURING INSTRUMENT, WHICH IS NOT THE SAME AS BREAKING THE
CODE.** `secs()` summed `durationSeconds`, so the moment a body step became distance-gated it read a
20-minute run as **0.0′** and three tests failed. The helper now derives exactly as the app's
`stepSecs` does — a clock if there is one, otherwise distance over target pace. Changing an assertion
to make a fix pass is the trap; changing a ruler that can no longer see the thing it measures is not,
and the difference is whether every assertion keeps its full force. They do: re-broken, only the new
one fails.

### ⚠️ ONE `<audio>` ELEMENT, FOUR WRITERS, AND NOTHING TOLD THEM APART

*"the voice coach was competing with the computer voice"* and *"the selected voice coach kept missing
words out of it's sentences"* are **one defect**. `speakPaceNumbers` waited a **fixed 2600ms** before
stitching the pace numbers onto the same shared element — while the function's own comment claimed,
and had always claimed, that it *"waits for the clip to finish rather than talking over it"*.

⚠️ **MEASURED AGAINST THE SHIPPED AUDIO: SEVEN OF THE NINE PACE CLIPS FOR THE DEFAULT COACH ARE
LONGER THAN 2600ms**, and **all six corrections** are — `pace_ahead_2` 5.28s, `pace_behind_1` 4.92s,
`pace_behind_2` 4.78s, `pace_ahead_3` 4.40s, `pace_ahead_1` 4.16s, `pace_behind_3` 3.03s. So every
pace correction, every time, was cut off mid-word. There is no constant that is both long enough for
the longest clip and short enough to feel like a follow-on; the schedule has to come from the clip.

⚠️ **AND THE CUT ITSELF PRODUCED THE SECOND VOICE.** Reassigning `src` mid-playback raises `error` on
the load being abandoned — and `coachFail` is a PERMANENT `addEventListener` on that element. It read
`COACH.current`, still holding the pace prompt, and read **the entire line out loud in the device
voice** over the fragments. `coachOnEnded` is permanent in the same way and nulled `COACH.current` at
every fragment boundary, starting whatever was queued on top of a half-spoken sentence.

The fix is a token, `COACH.seq`, held by a stitched sentence while it owns the element, plus
`COACH.pendingNums`, a readout that waits for the coach's own line to genuinely end (`coachOnEnded` →
`coachFlushNumbers`). The remaining timer is a **ceiling derived from the clip actually playing**, not
a constant, for the case where `ended` never arrives.
- ⚠️ **`coachStop` must clear all three** or a readout pending when a run is paused or finished
  arrives seconds later over silence, describing a run that has stopped.
- ⚠️ **`coachPlay` releases the token**, so a genuinely new cue takes the element instead of fighting
  it — safe only because `coachPaceTick` fires the cue FIRST and registers the numbers after.
- ⚠️ **The fragment bank was NOT the problem** and was checked before anything was changed: the guide
  has `min_2`–`min_20` and a complete `num_0`–`num_59`. The missing words were the truncation.

⚠️ **`test/coach-audio-sequencing.test.ts` DRIVES THE REAL FUNCTIONS AGAINST THE REAL MANIFEST** with
a fake element on a virtual clock that records every clip stopped before its own end. Asserting on
the source would only pin the shape of today's fix. **Seven of its eight guards fail against the
build he ran that morning**; the eighth is the clip-length measurement, which is a fact about the
audio and correctly true either way.
⚠️ Its overlap check asks *"was there audio still to come when the device voice started"*, not *"did
the speech start before the clip ended"* — **the overlap is simultaneous**, both beginning in the same
tick, so the obvious phrasing measures nothing and reports clean.

### ⚠️ THE MUSIC: I PREDICTED THE WRONG CAUSE, AND THE OWNER CORRECTED IT IN FIVE WORDS

*"Everytime the coach spoke it was knocking my music off and I needed to go back into the music app
and press play again"*. I attributed this to the spurious device voice — the reasoning being that iOS
backs `speechSynthesis` with `AVSpeechSynthesizer`, which takes the session and does not hand it back,
and that the robot was firing on exactly the cadence he described. He answered: **"it wasn't the robot
voice knocking the music off it was the real coach voice."** That single fact rules the whole theory
out, because the recorded clips play through a completely different mechanism.

⚠️ **THE CAUSE IS THAT WEBKIT OWNS THE AUDIO SESSION FOR THE PAGE'S `<audio>` ELEMENT, AND SETS IT
BADLY.** `CoachAudioService.configureSession()` sets `.playback` with `.duckOthers,
.interruptSpokenAudioAndMixWithOthers` at launch (verified: called from `init`) — and `.duckOthers`
implicitly sets `.mixWithOthers`, so the app's own configuration **ducks** music and is correct. But
WebKit manages the shared `AVAudioSession` for media elements it owns, and for a playing `<audio>` it
sets plain `.playback` with **no options at all**. That clears the duck/mix, which makes a cue an
exclusive session that INTERRUPTS other audio — and WebKit never deactivates, so nothing ever tells
the music app it may resume. Hence: stops dead, every cue, and has to be restarted by hand.

**The fix is that Swift plays the coach in the FOREGROUND too, not only when backgrounded.**
`coachAudioEl()` returns a **shim with the same surface as an `<audio>` element** when
`window.webkit.messageHandlers.interunCoachAudio` exists, so every decision — the priority queue, the
stitched pace sentence, the tail trim, the pause checks — stays in the page and there is still exactly
one copy of it. Swift plays one clip per call and reports the end back through
`window.__interunCoachClipEnded`.
- ⚠️ **ONE FILE PER CALL, DELIBERATELY.** Moving the sequencing into Swift would be a second copy of
  it, which is the fix-one-builder-not-the-other trap this file has been bitten by three times.
- ⚠️ **THE DEACTIVATE IS DEBOUNCED BY 700ms**, so the five fragments of a pace sentence duck the
  runner's music once rather than five times. `.notifyOthersOnDeactivation` is the flag that actually
  brings it back up.
- ⚠️ **THE SILENT UNLOCK CLIP MUST NOT BE HANDED OVER.** It is a `data:` URI; Swift would look for it
  in the bundle, fail, and report a failure — which lands in `coachFail` and speaks the current prompt
  in the device voice. An unlock step would have produced a robot voice at every start tap.
- ⚠️ **A REPLY THAT NEVER ARRIVES WOULD WEDGE THE COACH FOR THE WHOLE RUN.** Swift answers via
  `evaluateJavaScript`, which this file already records doing nothing against a suspended content
  process and reporting no error for it. One lost reply leaves `COACH.current` set forever and every
  later cue is discarded as an interruption of a line that finished minutes ago. A 15-second watchdog
  releases it — a ceiling, not a schedule, unlike the 2600ms constant above.
- ⚠️ **IT DEGRADES RATHER THAN DISAPPEARING.** No handler (a browser, the PWA, any build whose Swift
  predates this) uses the real element exactly as before, and a failure reported from Swift falls
  through to the ordinary error path.

⚠️ **THIS ONE IS NATIVE, SO IT DOES NOT TRAVEL OVER THE AIR.** Everything else in this section is in
`docs/index.html` and reaches a phone on the next launch; this needs a rebuild.

### ⚠️⚠️ AND THAT ASYMMETRY NEARLY SHIPPED A SILENT COACH — THE OTA TRAP HAS A SECOND HALF

`CLAUDE.md` has said since the OTA work that a page needing a new native bridge "degrades gracefully
(it guards `window.webkit.messageHandlers.*`)". **That is only true when the HANDLER is new.** Here it
was not: `interunCoachAudio` has been registered since the locked-phone work, so the guard passed on
every existing build — which then falls through `default: break` on an action it has never heard of
and **silently discards it**. The page would have handed over every clip, none would have played,
no reply would have come back, and the coach would have said nothing for an entire run. The page half
was **already pushed to `main`** when this was spotted, so it was minutes from reaching the owner's
own phone, which is running the previous build.

**The gate is a CAPABILITY FLAG** — `window.__interunCoachNativePlay`, injected by `WebHost` at
document start — and `coachNativeAudioBridge()` requires it. An old build sets nothing, gets `null`,
and uses its `<audio>` element exactly as before.
⚠️ **Bump the flag when the CONTRACT changes; never widen it back to a handler-exists check.**
⚠️ **The general rule, which is what this cost:** an OTA page may only ask the native side for
something new behind a flag the native side itself sets. A message-handler name is not a version.

⚠️ **`dSessOpts` NOW RECORDS WHO OWNED THE SESSION WHEN THE CLIP STARTED**, printed in
Support › Your data as `session duck+mix` or `session none`. **`none` is somebody else holding it;
`duck+mix` is this app.** It exists because a wrong diagnosis was argued confidently once already
today, and a stopped music track looks identical whatever took the session.

### ⚠️ THE NATIVE HARDENING WAS ALL ON THE OTHER PATH

Worth knowing before diagnosing the next audio report: every fix in the 2026-08-08 coach-audio work
landed on `CoachAudioService`, which is gated `guard UIApplication.shared.applicationState ==
.background`. **On a screen-on phone run none of it runs at all** — every cue comes from the page's
shared `<audio>` element, which has no session management, four unsynchronised writers, and (until
this change) a permanent `error` handler wired straight to the device voice. Two audio systems, and
the one that had been audited was not the one he was hearing.

### ⚠️ A MAPPING GUARDED WHERE IT IS DECLARED IS NOT GUARDED (2026-08-20)

Ruling 7's "one session-to-effort-colour mapping" was asserted at `SESSION_EFFORT`, the table. Three of
twenty-five re-breaks escaped with that single root cause, and the third was **the owner's own defect
restored**: `effortOf` and `runEffort` could be reverted to the intensity-keyed branching that painted a
tempo rust, and the whole suite stayed green. **A table nobody is forced to read is a suggestion.**
The guard now asserts BEHAVIOUR at the two readers — for every member of the SessionType union, both
must return exactly what `sessionEffort` returns — plus that neither carries a second opinion
(`intensity`, `targetRpe`, a hard-list) to fall back on. All three breaks caught.
⚠️ **The general rule: guard the READERS, not the declaration.** A derived collection proves the table is
complete; only a behavioural check proves anything consults it.

### ⚠️ THE UTC/LOCAL DATE TRAP FIRED A THIRD TIME, AND TRAVEL IS WHAT EXPOSED IT (2026-08-21)

`test/heat-custom.test.ts` built its dates from LOCAL getters (`getFullYear/getMonth/getDate`) while the
app's `todayIso()` is `new Date().toISOString().slice(0, 10)` — UTC, deliberately. East of Greenwich
after midnight UTC the two differ, so the test seeded a plan starting on the LOCAL date and then asked
the app for the UTC one: every session lookup missed and **six BLOCKER guards were red** on a machine
whose only unusual property was its timezone. ⚠️ **THE MAC WAS ON EEST BECAUSE THE OWNER WAS IN RHODES**
— the first firing of this trap caused by somebody travelling, and it would have reproduced for any user
or CI runner at UTC+3 or further east. Fixed by using `toISOString().slice(0, 10)`, and now proven across
six timezones including both sides of the date line (UTC, Athens, Los Angeles, Kiritimati UTC+14,
Pago Pago UTC-11, Kolkata UTC+5:30).
⚠️ **RUN A DATE-SENSITIVE TEST UNDER `TZ=Pacific/Kiritimati` AND `TZ=Pacific/Pago_Pago` BEFORE BELIEVING
IT.** Those two are 25 hours apart, so anything that depends on which day it is fails in one of them.

### ⚠️ A CLAIM THAT DEPENDS ON THE TRACE IS NOT A CLAIM (2026-08-21)

The locked-screen fix's report said the wrong-direction pace cues were "gone". Re-measured on a
realistic-noise trace with no Doppler they are **halved, not eliminated**. The distance numbers
(+85.1% → −0.4%) reproduce on every trace; the cue count does not, because it depends on how noisy the
replayed fixes are. State which of the two a figure is before quoting it.

## HALFWAY, AND THREE MOMENTS THAT HAD NEVER FIRED (owner, 2026-08-16)

Asked for after reading a generated inventory of every line the coach can say
(`voice-dev` → `~/Desktop/InteRun-coach-lines.md`, regenerate with `node /tmp/gen-cue-doc.mjs`).

### ⚠️ THREE MOMENTS HAD LINES, HAD AUDIO FOR ALL NINE COACHES, AND NOTHING PLAYED THEM

`threshold-hold`, `interval-work` and `strength-start` — six prompts, 54 recorded clips, dead since
the catalogue was written. **Nothing failed and nothing was missing**; no code path ever passed those
strings to `coachTrigger`. Found by asking, for every trigger in the union type, whether its name
appears anywhere in `web/app.ts`, `session-runtime.ts` or `WorkoutManager.swift` — worth re-running
after adding any trigger, because the catalogue compiles perfectly either way.
⚠️ **`fragment` and `countdown` answer that sweep with a false negative** — they are played by clip
id, not by trigger — so read the result, do not automate on it.

⚠️ **`strength-start` COULD NOT FIRE BY CONSTRUCTION.** A strength session is one `steady` step at
RPE 6–7 with no pace and no distance, which is indistinguishable from a tempo run *by kind*, and
`coachStepTrigger` branched on kind before it ever asked what kind of SESSION it was in. So a set of
squats got "settle into your tempo". The session type is now checked first, and a test pins the
ordering — checking the kind first is the whole bug, so "it contains the string" is not enough.

### THE SESSION'S HALFWAY IS MEASURED IN THE SESSION'S OWN CURRENCY

*"based on distance if its a session measured by distance or time if its a session driven by
minutes"*. It was always the clock (`snap.elapsedSeconds >= target * 0.5`), so the runner who dialled
a kilometre and walked it was told they were halfway a long way short of 500 m — the same class of
error as that run ending on a stopwatch, from the same reported session.

⚠️ **A SESSION HAS NO GATE; ITS STEPS DO, AND THEY DISAGREE. THE LONGEST STEP DECIDES.** Both obvious
rules are wrong, and each is wrong on a real session:
- *"all steps distance-gated"* → a 6 km run **with a strides block** is not all-distance, and that is
  precisely the case this exists for.
- *"any step distance-gated"* → an interval session's 6 × 1 km makes it a distance session, but its
  warm-up and cool-down carry no distance at all, so halfway lands in the wrong place.

The longest step is what the session IS — the piece a runner would name if asked what they were
doing, and the piece the title was written from.
⚠️ **THE LENGTH GATE STAYS ON THE CLOCK** (`target > 120`). "Is this long enough to have a halfway
worth announcing" is a question about time; converting it to a distance needs a pace, which is the
thing that varies. Only *what is measured* changed.
⚠️ **No distance total → fall back to the clock**, never guess.

### HALFWAY THROUGH THIS SECTION — AND IT TURNED ON TWO OF THE THREE BY ITSELF

⚠️ **`threshold-hold` AND `interval-work` ALREADY WERE THIS CUE.** "Mid-block hold" and "mid-rep
hold-on" are the same moment for hard work, written months ago. So `coachSectionHalfwayTrigger`
routes a `rep` to `interval-work`, a `steady` block in threshold/race-specific to `threshold-hold`,
and everything else to the new `section-halfway`. Adding a generic line *alongside* them would have
been two lines competing for one moment; instead the generic one covers only what they do not.

⚠️ **`snap.stepProgress` IS ALREADY MEASURED IN THE STEP'S OWN GATE** (distance for a distance-bound
step, the clock for a timed one — see `session-runtime.ts`), so this needed no unit logic of its own
and cannot disagree with the progress bar the runner is looking at. Feature 1 needed new logic
because a *session* has no gate; feature 2 did not because a *step* does.

Every guard below is a place it would otherwise be noise, and all are tested:
- ⚠️ **`st.total > 1`.** A one-section session's midpoint IS the session midpoint — the same sentence
  twice, seconds apart, on a plain easy run.
- ⚠️ **Keyed on `index + ":" + repeatIndex`.** Keyed on index alone, a set of six long reps announces
  the first and is silent through the other five: they share a step index.
- ⚠️ **Long enough to have a middle:** ≥ 240 s or ≥ 800 m, judged in the step's own gate. Without it
  a set of short reps turns the coach into a metronome.
- ⚠️ **Never within 45 s of the session halfway.** On a two-section run the midpoints can be seconds
  apart, and "you're halfway through" then "halfway through this section" is the coach contradicting
  itself about what it is counting.
- ⚠️ **Reset in `coachResetSession`,** or run two of an app session starts believing section one is
  already done.

### ⚠️ REGENERATING AUDIO ON THIS MAC — THE DOCUMENTED CLOBBER WAS REAL AND IS NOW RESOLVED

`web/voices/` held **244 clips across 4 coaches** against `docs/voices/`'s **1305 across 9**, exactly
as this file warned. The safe order, and it matters:
1. **`rsync -a --delete docs/voices/ web/voices/` FIRST.** `docs/` is the committed truth; the build
   mirrors web → docs, so generating against a stale local copy and building destroys the rest.
   Doing this also brings the manifest's hashes across, which is what makes step 3 cheap.
2. `node voice-dev/dump-catalogue.ts`
3. `python3 voice-dev/generate-elevenlabs.py` — **with NO `--coach`**, or the manifest rebuild loops
   over the filtered list and strips every other coach. The hash gate then generated **exactly the 18
   new clips (856 characters)** and left the two `HAND_AUTHORED` ones alone.
4. `node web/app.ts` — and **do NOT `git checkout -- docs/voices/` this time.** That restore is right
   after an accidental clobber and wrong after a deliberate regeneration.
5. Verify: `git status --short docs/voices/` should show **only the new files plus the manifest**.

⚠️ **`voice-dev/venv-el` WAS A SYMLINK TO ITSELF** ("too many levels of symbolic links"). Recreated.
⚠️ **The manifest rebuild needs `soundfile`**, which is not stdlib — and the script imports it *after*
generating, so a missing dependency spends the API credit, writes the clips, and then dies before
writing the manifest. Install it first; a second run is otherwise needed and pays twice.

### ⚠️ TWO FULL-WIDTH BUTTONS PUT SIDE BY SIDE ARE NOT A PAIR

*"those button look clunky and are different sizes"* (owner, 2026-08-16, of the heat card). They were.
`.primary` and `.bk-btn2` were both written for a **full-width stacked** button, so each carries its
own `margin-top` (**16px against 9px** — that alone stops the tops lining up inside a flex row), its
own padding, its own radius, and **only one of them has a border**. `.heat-acts > button { flex: 1 }`
made them the same width and disguised nothing else.

`.act-pair` + `.ap-yes` / `.ap-no` is one box with two fills, used by both heat rows.
⚠️ **THE BORDER IS THE ONE THAT BITES.** A 1px border on one of two side-by-side buttons makes it 2px
taller for free, and padding cannot compensate without the two drifting apart the next time either is
touched. Both declare `border: 1px solid transparent`; only the colour differs.
⚠️ **`.ap-yes`/`.ap-no` MAY SET COLOUR AND NOTHING ELSE** — the guard fails on padding, min-height,
radius, font-size or margin in either, because that is the mechanism by which a pair comes apart.
⚠️ **It also reached the 44px tap target**, which neither original did in this row.
⚠️ **`.heat-acts` was DELETED, not left unused** — an orphaned rule is what the next person copies.
Measured after: both buttons **170 × 44, tops aligned**, in light and dark. Five deliberate re-breaks
were each watched failing the guard.

⚠️ **THE PORT SQUATTER FIRED, EXACTLY AS THIS FILE WARNS.** A leftover `http.server` from an earlier
session held the port, the new one exited into a log, and the first check read the OLD build — the
giveaway was `act-pair` appearing **0 times** in a page that demonstrably contained it. `lsof` first,
then `curl | grep` for a symbol you just added, before believing anything on screen.
⚠️ **AND A `data-theme` WRAPPER DIV DOES NOT SWITCH THE THEME.** The blocks are `:root[data-theme=…]`,
so a side-by-side "light vs dark" harness renders two identical LIGHT panels and looks like proof.
Set `document.documentElement.dataset.theme` and screenshot twice.

## OPEN BUGS (confirmed on real hardware, 2026-07-29)

### 1. Coach audio when the phone is locked or pocketed — FIXED 2026-08-08, unproven on hardware

⚠️ **THE NATIVE FIX EXISTED SINCE 2026-08-07 AND WAS INERT.** `CoachAudioService` was written, wired
and shipped — and `coachPushWatchCueMap()` posted a map containing **ZERO files, across all 13
triggers**, measured. `coachScheduledPrompt` read `LIVE.session.type`, and **`LIVE` is null at both
call sites by construction**: the watch-initiated one is a live-tick handler for a run the phone is
not recording, and the phone-initiated one sets `LIVE = null` two lines later because the WATCH is
the recorder. The read threw, a `try/catch` swallowed it, every trigger returned null. So
`playWatchCue` could never return true, `WatchBridge` always fell through to `evaluateJavaScript`
against a suspended page, and the coach went silent the moment the phone went in a pocket — which is
the owner's report *"the voice coaches only said the start but then nothing after"*, against the fix
written for it. **A feature can be fully wired, fully tested and completely dead.**

**Seven defects, found by audit and each verified before fixing:**
1. **The empty cue map** (above). `coachScheduledPrompt(trigger, idx, type)` now takes the type; both
   call sites pass one (the wrist's own live tick carries `type`, and `startOnWatch` has the session).
2. ⚠️ **`{action:"clear"}` wiped the WRIST cue map as well as the phone schedule** — and `stopLive()`
   posts it, and every bottom-nav button calls `stopLive()` whenever a run is not live. **Tapping
   Today during a watch run silenced its coach for the rest of the run.** Split into `clearSchedule`.
3. ⚠️ **A DISTANCE-gated step froze the schedule's clock.** `coachNativeSchedule` summed
   `st.durationSeconds`; a "6 × 1 km cruise", a hill rep and an 80 m stride carry none, so every later
   cue was scheduled that much too early. Measured: **19 of 267 sessions**, worst "6 × 1 km cruise /
   60″ jog" — schedule believed 30 minutes against an actual 62, so the whole workout's cues arrived
   in its first half. Uses `stepSecs` now, the same helper the session builder uses.
4. ⚠️ **`AVAudioPlayer.play()`'s Bool was discarded, and the page was told the line had been spoken
   BEFORE it was known to have sounded.** A refused play was indistinguishable from success: cue
   burnt, no repeat on unlock, and on a wrist run the page fallback skipped. Now honoured — but
   ⚠️ **`played.insert` stays BEFORE the play**, deliberately: deferring it re-selects a permanently
   failing cue every second forever and blocks every later one. Only `report()` is conditional.
5. ⚠️ **`applicationState != .active` was the wrong gate.** `.inactive` covers the app being ON SCREEN
   with the page's timers alive — Control Centre open, a banner, the instant after unlocking — so both
   players fired and the runner heard the line twice, overlapping, from two audio sessions. Now
   `== .background`; a locked screen reaches it in a fraction of a second.
6. ⚠️ **THE SESSION WAS ACTIVATED AT LAUNCH WITH `.duckOthers` AND NEVER DEACTIVATED.** Ducking lasts
   as long as the session is ACTIVE, not as long as a clip plays — so the runner's music sat at
   reduced volume from launch until force-quit, and since `init()` runs on background wakes it could
   start with the app never appearing on screen. **This is the exact failure `CoachAudioService`'s own
   header refuses to introduce via a silent keep-alive track, arrived at by a different route.**
   The session now belongs to `CoachAudioService` alone: configured at init, activated per clip,
   deactivated on `audioPlayerDidFinishPlaying` with `.notifyOthersOnDeactivation`.
   ⚠️ `.interruptSpokenAudioAndMixWithOthers` replaces `.mixWithOthers` — a podcast PAUSES for the cue
   instead of being talked over at duck volume, which is not intelligible and reads as a quiet coach.
7. ⚠️ **Nothing anywhere observed `AVAudioSession.interruptionNotification`.** A call, Siri or an alarm
   deactivates the session; AVAudioPlayer re-activates implicitly on the next `play()`, so it is not
   the permanent death it looks like — but every cue whose moment falls inside the window is consumed
   by the scheduler and never heard, and nothing recorded that it happened. Now observed and counted,
   along with `mediaServicesWereResetNotification`.

⚠️ **THE BELT AND BRACES, AND THE MOST IMPORTANT PART: `speakOnPhone` NOW GETS AN ACK.** It returned
true on *send*, and every caller reads that as "the phone has this, stay quiet" — so when the phone
was reachable but played nothing, **both devices were silent, each believing the other had it.** The
phone now replies `played: true/false` (true only when a clip actually sounded; **optimistic only when
the app is in the FOREGROUND**, because `evaluateJavaScript` against a suspended content process does
nothing and returns no error), and `WorkoutVoice.fallback(for:text:)` speaks it on the wrist when the
answer is no. A synthesised line a second late is a poor coach; a whole run with none is not one.
⚠️ The fallback deliberately says nothing for `countdown` (the beats have passed) or for encouragement
triggers — a robot is worse than silence for those.

⚠️ **TWO PLAY PATHS WERE COLLAPSED INTO ONE.** `play(_ cue:)` was a near-identical copy of `playFile`,
and every hardening above landed in `playFile` first — so all of it would have missed the SCHEDULED
cues, which are the entire locked-phone feature. Third firing of the fix-one-builder-not-the-other trap.

⚠️ **`Support › Your data` now carries a `coach:` line** (`CoachAudioService.lastStatus` →
`window.__interunCoachAudio` → `coachDiagLine()`): scheduled / played / stale / missing / failed /
wrist hits / interrupts / map size / last event. **A silent coach looks identical whatever the cause**
— empty map, suspended page, refused session, missing clip — and until this existed there was no way
to tell them apart from a runner's report. Same precedent as `__kbDiag` and `LIVE.gpsDiag`.

✅ **THE TREADMILL IS A DECIDED NON-GOAL, NOT AN UNFIXED BUG (owner, 2026-08-08):** *"I don't think
the treadmill needs the voice coach (if i change my mind we can introduce it)"*. An indoor run has no
GPS by design, and the location stream is what keeps the app process alive between cues — a one-second
`Timer` does not tick in a suspended app. Making it work means running GPS on a session with no use for
a position, purely as a keep-alive: battery and the blue location indicator for nothing. He was asked
and declined.
⚠️ **So `startIndoor()` no longer posts a native schedule at all.** It used to, and the schedule was
accepted, stored and silently discarded — and a schedule that is silently discarded is
indistinguishable from one that works, which is precisely how the wrist cue map went a whole release
posting zero clips. The coach still speaks on a treadmill **while the screen is on**; what is not built
is surviving the screen locking.
⚠️ **`gpsFallback()` also lands in `startIndoor()`** when an OUTDOOR run fails to acquire GPS, so that
run inherits the same limit — and nothing can be done about it there either, because the keep-alive
would be the very signal that just failed. Worth knowing before it is reported as a separate bug.

⚠️ **NONE OF THE COACH FIX IS PROVEN ON HARDWARE** — it needs a real run with the phone locked, and the
`coach:` line in Support › Your data is what will settle it. ⚠️ **The Road Map step `p2-audio` is
therefore NOT ticked yet**, deliberately: the map's rule is that only verifiable work is ticked, and a
wrongly-ticked step destroys its value.

### 1b. The original diagnosis, kept because it is still correct

⚠️ **`CLAUDE.md` used to claim going native fixed this. It did not.** The audio *plumbing* is right:
`InteRunApp.init()` sets an `AVAudioSession` of `.playback`/`.spokenAudio` and activates it, and
`audio` **is** in `UIBackgroundModes` in `ios/InteRun-Info.plist`. Verified both.

**The real cause is the trigger, not the output.** Coach cues are fired from
`setInterval(liveTick, 200)` → `coachTick(snap)` inside the WKWebView, and **all** coach audio is an
`<audio>` element on the page — `grep AVAudioPlayer ios/InteRun/` returns nothing. When the screen
locks, iOS suspends/throttles the web content process, the interval stops firing, and nothing ever
asks for the next cue. An audio session only keeps *already-playing* audio alive; it cannot keep JS
running. (This is the same suspension the `GeolocationShim` already works around by buffering and
replaying fixes — that shim is direct evidence the web process does get suspended mid-run.)

**Do not "fix" it with a silent looping keep-alive track without thinking about ducking.** The session
is configured `.duckOthers`, so a permanently-playing silent track risks holding the runner's music
ducked for the entire run — a worse bug than the one being fixed.

**The proper fix** is a native audio path: hand the cue queue (or the whole schedule) to Swift and let
`AVAudioPlayer` play `docs/voices/<coach>/<id>.mp3` while backgrounded, so iOS treats it as a media
app. Only testable by actually running with the phone locked.

### 2. Watch screens are hard to read mid-run — redesign brief captured

Not a defect, a legibility problem. See **`WATCH-REDESIGN.md`** for the full brief, transcribed from
reference screenshots that no longer exist. Read that file rather than re-deriving it.

---
