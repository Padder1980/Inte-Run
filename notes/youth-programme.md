# The 12–17 programme — safety step, ceilings, youth strength, Strava age rules

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> ⚠️ Read YOUTH.md before touching a number. The thresholds are clinical and not yet professionally reviewed.

## ✅ D3a — THE SAFETY QUESTION COMES BEFORE THE PLAN (2026-09-21)

The wizard now opens on one health question. Six symptoms that must not be trained through, screened
by the engine, with the answer deciding whether a plan gets built at all. Suite 1700 → **1712**;
`test/wizard-safety.test.ts` holds 12 guards and **17 deliberate re-breaks were all caught**.

⚠️⚠️ **`FLAGS_PHYS` WAS DEFINED AND RENDERED NOWHERE — a computed-and-discarded constant, and the
eighth in this file.** CLAUDE.md already recorded that removing the wellbeing tick-boxes "removed the
only tickable route to a crisis escalation"; measured, `grep FLAGS_PHYS web/app.ts` returned **one
line, its own definition**. So the app had a good screener, a good engine and no way for a new runner
to reach either before being handed a training plan. D3a makes the constant live again.

### ⚠️⚠️ THE STEP KEEPS NOTHING, AND THAT IS WHAT MAKES `checkinConsent()` TRUE HERE

That sentence — *"nothing is kept — leave this screen and they are gone"* — is one this file records
being the work **twice over**, and `test/silent-defects.test.ts` **discovers** every builder that
calls `checks(` and demands `checkinConsent()` in the same body. So the wording is not optional and
the wording has to be true.

The ticks live in the DOM and nowhere else: they are not `s_`-prefixed, so `captureSetupFields` cannot
sweep them into the draft; nothing writes them to `draft`, to `localStorage` or to `state`; and a step
change re-renders the list empty. **Measured in a real browser after answering "pinpoint bone pain"
and advancing: the draft holds no trace, no `localStorage` key mentions it, and Back re-renders the
step with nothing ticked and the panel hidden.** The guard derives the state writes and asserts the
only one is `wizErr`.
⚠️ **THE COST IS DELIBERATE AND IS THE RIGHT TRADE:** a runner who goes Back has to answer again. The
alternative is a consent line that understates what is kept, on the one screen a worried runner reads
most carefully. **Do not "improve" this by remembering the answers across a Back.**

### ⚠️⚠️ `professional` IS STRUCTURALLY UNREACHABLE FROM THIS STEP, SO THE BRANCH IS NOT NAMED AFTER IT

Measured through the real engine, every key of `FLAGS_PHYS`: **chest pain, fainting, severe
breathlessness and the neurological group are `emergency`; pinpoint bone pain and rapidly worsening
pain are `urgent`.** Nothing here can produce `professional` — that comes from `FLAGS_WELL`, which is
D3c's. A branch written `urgency === "urgent" || urgency === "professional"` would therefore name an
outcome this step cannot reach, and any guard exercising it through the wizard would be **vacuous**.

The three outcomes are **emergency / flagged-but-not / nothing**, which is correct today and stays
correct the day FLAGS_WELL joins the step.
- **Emergency** → the engine's panel, plus *"Get help first. We are not going to build a training plan
  on top of this."* **No continue button at all.** The way on is to change the answer, which is the
  honest escape from a mis-tap and the only one that does not brick onboarding.
- **Flagged** → the panel plus an explicit **"I understand, continue"**, which is the only way past.
- **Nothing** → Next advances.

⚠️ **NOTHING IS REMEMBERED BETWEEN A REFUSAL AND THE ACKNOWLEDGEMENT, which is why there is no
acknowledgement flag to clear and no way for a stale one to wave a later answer through.** Next is
idempotent here: it re-paints and refuses.

### The three traps the implementation had to route around

⚠️ **THE CHECKBOX GROUP IS NOT NAMED `rf`.** `wire()` binds every `[data-chk="rf"]` to `runRf`, which
reads `$("rfRes")` **unguarded** — dead code on its own route (this file records it) and a TypeError
on this screen. `WIZ_SAFETY_CHK` is one constant read by the builder, the wiring and `chkValues`, and
the guard derives every bound name from the page so a future collision fails.

⚠️ **`screenRedFlags` READS `FLAGS[flag]` UNGUARDED AND THROWS ON AN ID IT DOES NOT KNOW** — measured,
`screenRedFlags(["none"])` is a TypeError — and this runs from an `onchange`, where a throw leaves the
panel dead for the rest of the step. `wizSafetyPicks` filters to keys of `FLAGS_PHYS`, **derived from
the map rather than a list**. ⚠️ And the filter's own throw is made unreachable by a guard rather than
by a try/catch: every key of `FLAGS_PHYS` is driven through the real engine, so a seventh symptom the
engine has never heard of fails there instead. **A fail-open catch on a safety gate would have waved
somebody through; a fail-closed one would have bricked onboarding. Neither was needed.**

⚠️⚠️ **THE STALE ERROR IS REMOVED FROM THE DOM, NOT CLEARED BY A RENDER — because a render would wipe
the ticks, which are the only copy of the answer.** `wizStepError`'s "tell us either way" only fires
when NOTHING is ticked, so the render it causes has no answer to lose; but once something IS ticked,
that line has to come out by hand or it sits under a panel that has already answered it.

### ⚠️⚠️ A DEFECT ONLY RENDERING THE SCREEN COULD SHOW: NEXT LOOKED LIVE AND DID NOTHING

The gate refuses in place, so on an emergency the runner tapped a full-width green **Next** and the
screen did not visibly respond — this project's most-repeated defect class, freshly introduced by me
and invisible in the code. A refusal now scrolls the answer panel into view (**measured: `scrollTop`
0 → 90.5, panel top 656 → 566, and `docX` 0, so nothing moves sideways**), which is both a visible
response and the right one: the panel is usually below the fold when Next is tapped.
⚠️ **NEXT IS DELIBERATELY NOT DISABLED.** It is idempotent here, and a disabled primary on step 0 is
how a mis-tap would trap somebody who ticked the wrong box.

⚠️ **THE GATE IS ON THE WIZARD, WHICH IS THE ONLY FIRST-RUN ROUTE TO A PLAN — and the claim stops
there.** A runner who already has a plan edits it through the old setup form, which is not screened,
and **starting a run is not gated either**. The Road Map step's own wording was corrected to say so
rather than being ticked against a promise D3a does not keep.

### Two measurement faults, both mine, both in the test rather than the code

⚠️ **A LIFT THAT OMITS A CONSTANT MEASURES A STRICTLY EASIER PROGRAM.** Every lifted function reads
`WIZ_SAFETY_CHK` and I supplied it only to the fake `chkValues` — six guards threw `ReferenceError`.
Loudly, which is the acceptable kind; the fix is to **extract the real `const` line from the built
page** rather than retype the value, so the test and the page cannot disagree about the group's name.

⚠️⚠️ **AND THE FAKE DOM WAS WRONG, NOT THE CODE — FIX THE RULER.** My `document.querySelector(".wz-err")`
returned the node only `if (state.wizErr)`, and `wizSafetyPaint` nulls `state.wizErr` **before** it
queries — so the fake could never hand it back, and a guard failed against behaviour the browser had
already shown working. In the real DOM the node exists until something removes it.

### ⚠️ ONE EXISTING GUARD FAILED, AND IT WAS A POSITIONAL PROXY — RESTATED, NOT DELETED

`test/manage-plan.test.ts`'s *"Start a new plan opens the wizard, and only a runner who has a name
skips that step"* asserted `wizStepIds()[0] === "level"`. Its three real claims — the name step is
skipped for a personalised runner, present for a first run, and skipping only ever REMOVES — all
still passed; the broken line was a **proxy** for "the name step is skipped" that held only while
`level` happened to be first. **Sixteenth firing of guard-scoped-to-a-HOW in this file.** Restated as
`personalised === first-run minus exactly "you"`, which is stronger than the original because it pins
both the removal and that nothing else moved, and re-broken (making the skip also drop `level`) to
prove it still bites.
⚠️ **MY OWN RE-BREAK HARNESS COULD NOT HAVE FOUND IT** — it ran three files, and this is in a fourth.
The full `npm run verify` is what caught it, which is the whole argument for running the recipe rather
than the tests you were thinking about.

### ⚠️ THE ANSWER PANEL ANNOUNCES ITSELF, AND THAT PART IS UNVERIFIED

`#wizSafetyRes` carries `role="status"` with `aria-live="polite"` and `aria-atomic` spelled out. The
three Support screeners do not, and that is defensible for an opt-in page somebody navigated to on
purpose; this one is **mandatory for every new runner**, so a screen-reader user ticking "chest pain"
and hearing nothing at all is the defect rather than the inconsistency. ⚠️ **NOT TESTED WITH A REAL
SCREEN READER** — it cannot make anything worse, and it is stated as best-effort rather than as done.

### Verification

Build exit 0 (read directly, not through a pipe — the backtick rule's own lesson), `docs/voices/`
clean, `node --check` OK on all three emitted blocks, **17 of 17 re-breaks caught with the tree
restored byte-identical**, and every path driven end to end in a real browser on the served `docs/`:
the step first with six boxes plus "None of these", the banner and the consent line; nothing ticked →
error, no advance; chest pain → live emergency panel with no way on, Next refuses; bone pain → urgent
panel, referral line, Next refuses, the explicit button advances; "None of these" → advances; the two
tick groups mutually exclusive both ways; and **0 horizontal overflow on the document, body and
`#view` at 375×812 and 320×568 at `--tscale` 1.0 and 1.3**, with the acknowledgement clearing the
sticky footer at every size and its hit area bisecting to **44.49px** against the 44px floor.

**Still to come in this track:** D3b the under-18 gate (**explicitly the owner's call**), D3c the
wellbeing tick-boxes, then D1 the privacy policy and D2 testers.

## THE 12-17 PROGRAMME (owner, 2026-09-21) — RESEARCH + Y1. READ `YOUTH.md` BEFORE TOUCHING A NUMBER.

He replaced PLAN.md's under-18 gate with *"a fully tailored programme for children between the ages of
12-18 ... in line with a detailed piece of research that you undertake ... **Don't just assume that you
have the right answer at the first research run, double check what you find**"*. The research, every
source graded, and the full spec are in **`YOUTH.md`** at the repo root. This chapter is only what a
cold session must not undo. Suite 1712 → **1724**; 9 re-breaks, all 9 caught.

⚠️⚠️ **THE DOUBLE-CHECK OVERTURNED THREE THINGS, AND WITHOUT IT THE WRONG APP GETS BUILT.**
1. **A search summary gave confident numbers and every one was wrong.** UKA's age groups **changed on
   1 April 2026** — U13/U15/U17/U20 became **U14/U16/U18/U20** — so anything written before that
   describes different bands with different values. Assume any youth-distance figure you did not read
   out of a 2026-or-later primary source is stale.
2. ⚠️ **THE TABLE THAT CIRCULATES EVERYWHERE IS FOLKLORE, AND THE OWNER SUPPLIED IT.** 10K at 12, a
   half marathon at 15, a marathon at 17 — it traces to a **1987 viewpoint article** in the IAAF's own
   *New Studies in Athletics*, not to any rule, and secondary sources quoting it disagree about its own
   weekly multiplier (two versus three). **Its fingerprint is a 15-year-old racing a half.** Every row
   of it exceeds UKA's hard rule, so it would have had the app coach a 17-year-old for sixteen weeks
   toward a race they are not permitted to enter. Put that to him and he moved to the rule.
3. **pypdf returns that source PDF's tables in the wrong order**, so the maximum PERMITTED table reads
   as though it were the RECOMMENDED one. Re-extract by layout position (`visitor_text`) to tell them
   apart, or you will encode the permissive table as the conservative one.
✅ **Cross-confirmed where it mattered:** England Athletics' published cross-country distances match
the UKA table exactly — a different home-country governing body, same framework.

### The owner's rulings, which are decisions and not defaults

⚠️ **UKA'S RULE, NOT ITS RECOMMENDATION.** The same document recommends 8 km at 15 and 12–14 km at
16–17, which would withhold the half marathon until 18. He chose the rule. **Do not quietly move to
the recommendation** (it reverses his decision) **and do not move past the rule** (it coaches a minor
toward a race they cannot enter). `test/youth-limits.test.ts` pins both directions as inequalities.
⚠️ **18 IS AN ADULT** — his ruling, and it agrees with UK majority, UKA's rule (a marathon is permitted
at 18) and every World Marathon Major. So the programme is **12–17 inclusive**.
⚠️ **HIS FREQUENCY COLUMN WAS ADOPTED UNCHANGED** (3 runs/week to 14, 5 from 15) because it was the one
column never in dispute and it is well supported.

### Y1 — what shipped, and the three things not to unpick

⚠️⚠️ **THE AGE QUESTION MOVED; IT WAS NOT ADDED.** It sat on the wizard's `details` step, **three steps
after `goal`**, so the picker could not filter on an answer nobody had given. It is on `level` now —
the only step present in BOTH wizard paths that precedes `goal` — and it was **removed from `details`
in the same change**. Two copies is not merely untidy: `captureSetupFields` sweeps every `[id^="s_"]`,
so whichever rendered last would silently win.

⚠️ **GATED TWICE, OR THE STAGE IS COSMETIC.** `goalCardInner` decides what is OFFERED; `draftFromForm`
filters again on save, because the value that reaches the engine can come from a stored profile, a
restored backup, or "Prefer not to say" later becoming a real age. Offering one thing and saving
another is the days question's own shipped defect.

⚠️⚠️ **`goalsForAge` IS DELIBERATELY NOT WRAPPED IN try/catch, AND MY OWN GUARD IS WHAT FOUND THAT.**
The first version returned the **unfiltered** list on any failure — so a broken engine reference would
have quietly offered a 13-year-old a marathon. **A safety gate that fails open is worse than one that
fails loudly**, and this one cannot throw anyway: `youthGoalsFrom` is a pure filter and an unknown key
yields NaN and is dropped. Every other engine call in the app is unguarded for the same reason.
⚠️ It was found because the test's own lift **serialised** the engine helper with `.toString()`, which
drops the constants it closes over — so the harness measured the catch instead of the filter. **Pass a
real import into `new Function` as a parameter; never serialise a function that closes over anything.**

⚠️ **ADULTS ARE BYTE-IDENTICAL, AND IT IS PROVED RATHER THAN ASSERTED.** The raw goal is tested against
the **age ceiling alone**, never against `goalCfg.dists` — folding in the status list would make a
"new" runner carrying a stored marathon start saving 5k. Nothing in the engine imports
`src/domain/youth.ts`, so `generatePlan` cannot have moved, and both audits came back identical.

⚠️ **THE MODULE OWNS THE CEILING AND NOTHING ELSE.** `youthGoalsFrom(offered, age)` takes the caller's
own list and intersects it, and the distances come from `RACE_DISTANCES_M`. A second list of goal keys
would drift from `GOAL_BY_STATUS`, a second table of metres from `units.ts` — the fifth copy of a limit
this repo already paid for in `running-days.ts`, except that this one is a competition rule.

⚠️ **"PREFER NOT TO SAY" IS AN OPEN HOLE.** Absent age means adult, so a 13-year-old who declines gets
the adult app — the one outcome all of this prevents. The proportionate fix (and what the Children's
Code calls age assurance proportionate to risk) is one more question: if they will not give an age, ask
whether they are 18 or over, and treat a refusal as under 18. **Not built. Do it with Y2.**

### Still to come, and one of them is not a training change at all

Y2 single-session and weekly ceilings on the built plan (needs `Athlete.age` in the engine; clamp as a
**post-condition** the way `enforceLongRunIsLongest` does — **do not fork the generator**) · Y3 weight
training by age · Y4 Strava and heart-rate gates · Y5 Children's Code · Y6 App Store answers.

⚠️⚠️ **THE STRENGTH ANSWER IS THE OPPOSITE OF THE OBVIOUS ONE AND Y3 MUST NOT GET IT WRONG.** There is
**no minimum age** for resistance training and **the growth-plate fear is a myth** — the AAP, the 2014
International Consensus (adapted from the UKSCA statement) and two decades of review all say so. So
banning it would be wrong. What every position stand conditions its permission on is **qualified
supervision**, which an app cannot provide: NSCA, verbatim, *"if qualified supervision ... are not
available, youth should not perform resistance exercise"*, and heavy loading above 85% 1RM is permitted
to youth only *"on the proviso these programmes are supervised by qualified professionals"*. **The
limit is on us, not on them.** And NSCA forbids unsupervised 1RM testing for under-18s outright, so
A6's estimated-1RM display is withheld under 18 — not because the estimate is unsafe but because
putting a one-rep-max in front of a 14-year-old invites them to go and test it.

⚠️ **SERVING UNDER-18s TRIGGERS THE ICO's CHILDREN'S CODE IN FULL** — fifteen standards, high privacy by
default, no nudging, and a **Data Protection Impact Assessment** that does not exist. The app is
unusually well placed (no accounts, no analytics, no ads, data on the phone), but the DPIA and
child-readable privacy wording are real work, and the App Store age rating changes with it.

⚠️ **AND ONE FINDING CAME FROM OUR OWN CODE RATHER THAN A PAPER: `web/app.ts:8801` WRITES
`<gpxtpx:hr>` INTO EVERY GPX.** Strava's minimum age is 13 and **under-16s may not upload heart-rate
data at all**, so a 14-year-old connecting Strava today uploads data Strava's own rules forbid. Y4.

⚠️ **THE THRESHOLDS ARE CLINICAL AND HAVE NOT BEEN REVIEWED BY A PROFESSIONAL.** `YOUTH.md`'s own
sources ask for it, and this project's standing rule is that clinical wording and thresholds are
flagged for the owner rather than inherited. Flagged on the Road Map; not signed off.

### Y2 — THE CEILINGS REACH THE PLAN ITSELF (2026-09-22). `YOUTH.md` §5.7 HAS THE MEASUREMENTS.

⚠️⚠️ **CORRECTION 2026-09-23 (Y4): NONE OF THIS REACHED A REAL PLAN UNTIL Y4.** The app never put
`age` on the Athlete it hands the plan builder, so every lever below was computed and discarded for
anybody using the app; the engine's tests set `Athlete.age` by hand and could not see it. See the Y4
chapter, which wired it and measured the difference.

Suite 1724 → **1731**; 13 re-breaks, 9 caught and the other four recorded at the line as unreachable.
Four levers, all folded into decisions the engine already makes — `longCapMin` and
`beginnerLongPeakMin`, a shrink-only weekly pass, `runningDaysFor`, `qualitySessionsThisWeek` and
`allowRacePaceWork`. **No fork of the generator**, per the spec's own architecture note.

⚠️ **ADULTS ARE UNTOUCHED AND IT IS PROVED TWICE.** Every lever is a `Math.min` against a ceiling that
is `Infinity` for an adult, or a branch gated on a null — so `Athlete.age` absent changes nothing, and
absent is every profile ever stored. Both engine audits came back **byte-identical**, and a guard
compares every DERIVED field of an adult plan built with and without an age. ⚠️ **That guard's first
version compared the whole Plan and failed**: a Plan echoes its input `athlete`, so one built with
`age: 34` differs there by construction and the comparison proved only that the field was passed.

⚠️⚠️ **FOUR THINGS WERE MEASURED WRONG FIRST, AND EVERY ONE WOULD HAVE SHIPPED A WORSE PLAN.**
1. **A CEILING IS NOT A TARGET.** Returning the weekly limit from `targetPeakWeeklyKm` made it worse:
   that fit aims AT its target in BOTH directions, so a 17-year-old who had stated no mileage was
   scaled **UP** from a natural 48.5 km peak to 54.8. Weeks over the limit went **18 → 42**. The
   ceiling has its own shrink-only pass now, and the `Math.min(1, …)` that states the rule is recorded
   as unfalsifiable rather than claimed as guarded.
2. **THE WRONG RULER.** `fittedPeakKm` measures `plannedDistanceMeters`, which excludes warm-ups
   because this engine treats preparation as not-load — the owner's own reframing. Right for a
   coaching model, **wrong for a safety ceiling**: weeks of 38.7 km of actual running reported as
   inside a 32 km cap. `youthPeakWeekKm` measures total outing distance, and counts every week.
3. **A FLOOR EQUAL TO A CEILING PINS THE LONG RUN.** Capping `LONG_FLOOR_KM` at the youth ceiling left
   the two identical at 15 for a 10k (both 12 km), so the long run could not move by a metre and the
   week could not shrink. The adult event floor does **not apply** to a youth plan at all.
4. **SHORTENING THE QUALITY SESSIONS IS THE WRONG LEVER; HAVING FEWER IS THE RIGHT ONE.** A tighter
   work budget moved the total by **0.6 km across 81 plans**, because a quality session's WORK is
   already small — the warm-up, recoveries and cool-down are what make it long. One key day a week
   took a 16-year-old's worst week **36.4 → 32.0 km**, and agrees with the evidence (68% injury
   incidence in adolescent runners, overwhelmingly overuse).

⚠️ **RACE WEEK IS EXEMPT FROM THE SESSION CEILING AND THAT IS NOT A LOOPHOLE.** UKA's limit is on the
RACE distance, which Y1 gates at the goal — a 12-year-old may race 6 km and is offered only a 5k. Race
day's SESSION is the race plus a warm-up, so measuring it against the same number condemns a plan for
the warm-up around a race the rule expressly permits.

⚠️ **THE BEGINNER TRACK KEEPS ITS OWN SHORT TIMED RACE-PACE REPS, AND THE FIRST GUARD WAS WRONG TO
FORBID THEM.** What the research withholds under 15 is an adult goal-pace rehearsal — the main track's
`8 × 1 km at goal race pace`, measured at 8.6 km against a 6 km ceiling. The beginner track's
`6 × 1′ at race pace` is short, **timed rather than distance-gated**, and inside the ceiling; that is
exactly the shape the sources call for, and this repo reasoned its way there once already.

⚠️ **TWO RESIDUALS SURVIVE AND THEY ARE STRUCTURAL. Do not loosen a bound to remove them.** A
13-year-old on the main track draws a 6.6 km threshold session against a 6 km ceiling — the library's
smallest format is that big once framed, so the fix is a shorter format. A 15-year-old at five days
peaks near 27 km against 24 — the easy runs are already at the engine's 20-minute minimum, so the week
cannot shrink without going below that floor or dropping a day, and the day count is the owner's own.
⚠️ **And the weekly number is the weakest in `YOUTH.md`** (secondary-sourced, provenance flagged), so a
residual there is more tolerable than one on the session ceiling, which is UKA's own rule.

⚠️ **FOUR RE-BREAKS ESCAPED AND ONLY ONE WAS A WEAK GUARD — the fixture was too kind.** The walk-back
guard could not reach its own branch, because that branch needs a STATED weekly mileage and the sweep
passed none; the sweep now runs every case with and without one (rate identical: 6 and 6). The other
three are unreachable by construction and are recorded at the line: the beginner long-run cap never
binds (measured 5.0 km at every age 12–15), the `Math.min(1, …)` cannot fire, and the build-phase
race-pace arm sits behind two independent gates.
⚠️ **AND THE WALK-BACK TAUGHT THE USEFUL FACT:** its bisection assigns to `weeks` and **never to
`scale`**, so after it runs the two disagree — keeping youth out of it is what keeps them in step, and
that is a better reason than "belt and braces".

## ✅ Y3 — LIFTING FOR 12-17s: A REP RANGE, NEVER A PERCENTAGE (owner, 2026-09-22)

⚠️⚠️ **CORRECTION 2026-09-23 (Y4): ON THE RUNNING PLAN THIS REACHED NOBODY UNTIL Y4** — the app never
handed the age to the plan builder (standalone programmes did get it, via `progPrefs`). And "Prefer not
to say" was stored as 0 and read as a 12-year-old by `isYouth()`. Both fixed in Y4.

The third stage of the youth programme he commissioned. *"This also applies to any weight training
programme. Based on the users age, this should restrict the types of plan that the user has access to
and you again need to thoroughly research what is suitable."* The research, the position stands and the
specification are in **`YOUTH.md` sections 4, 5.3 and 5.8**; read that before changing a number here.
Suite 1731 → **1751**; `test/youth-strength.test.ts` holds 19 guards and **23 deliberate re-breaks**.

⚠️⚠️ **STRENGTH IS OFFERED, NOT WITHHELD, AND THAT IS THE SOURCES' OWN POSITION.** Both the NSCA's
position stand and the 2014 International Consensus state there is **no minimum age**, and both say the
growth-plate fear is a myth. What changes is HOW it is prescribed — so an age gate here would have been
worse-evidenced than the tailored programme the owner asked for.

⚠️⚠️ **BUT EVERY PERMISSION IN BOTH SOURCES IS CONDITIONAL ON SUPERVISION, AND AN APP CANNOT
SUPERVISE.** *"If qualified supervision, age-appropriate exercise equipment, and a safe training
environment are not available, youth should not perform resistance exercise."* The heavy band (>85%
1RM) is permitted to youth *"on the proviso these programmes are supervised by qualified
professionals"*. **That is a limit on us, not on them**, which is what `YOUTH_STRENGTH_NOTE` says on
every youth session: this is good for you, it works best with somebody watching, and the app is not
that.

**What a 13-year-old is prescribed now, measured through the real builders:**

| | adult, build phase | 12-17 |
|---|---|---|
| main lifts | 3 × `3–6 (heavy)` **at 80%+ 1RM** | 2 × `8–12`, **no percentage at all** |
| rest between sets | 150 s | 120 s |
| pogo hops | 3 × 10 = 30 contacts | 3 × 6 = **18** |
| sessions a week, asked 4 | 4 | **3** |
| title | "Strength (heavy)" | "Strength & power" |

### ⚠️⚠️ THERE IS NO LOAD FIELD, AND ITS ABSENCE IS THE PRESCRIPTION

`YOUTH.md` §5.3 originally specified *"loadPercent1RM capped at the intermediate band (≤80%)"*. **That
was the weaker reading and it was rejected in the build.** A percentage is a share of a one-rep max, so
prescribing "70%" to a 14-year-old instructs them to go and find theirs — and *"unsupervised and
improper 1RM testing… should not be performed by children or adolescents under any circumstances"* is
the one thing both sources forbid outright. Capping the fraction keeps the instruction and quibbles
about the number. The NSCA says what to do instead in as many words: *"if 1RM tests are not
performed… establish the repetition range and then by trial and error determine the maximum load"*.
⚠️ **So `intentFor` returns no `load` for a youth**, `buildStrength` writes `loadPercent1RM` only when
the intent carries one, and nothing anywhere can be set to restore it.
⚠️ **AND `YOUTH_LOAD_TEXT` NEVER GOES IN `loadPercent1RM`.** That field is DATA — A6 parses a
percentage out of it to seed a suggested weight — so prose there is how a suggestion becomes NaN. The
reps-in-reserve wording is for the programme card's display column and nothing else.

### ⚠️⚠️ THREE BUILDERS WRITE THIS COPY AND THE FIRST CUT FOLDED THE WORDS ON ONE OF THEM

The legacy no-preferences path, the preference-driven `builtStrengthSession` and a programme's
`programmeSession` each write their own title and description. **Measured through the real builders: a
13-year-old on the preferences path was handed a session titled "Strength (heavy)" described as "Heavy
but controlled (~80%+ 1RM), low reps" over exercises prescribing 8–12 with no load anywhere** — which
reinstates by sentence exactly what removing the field took out of the data. `YOUTH_STRENGTH_TITLE`,
`YOUTH_STRENGTH_LEAD` and `YOUTH_STRENGTH_NOTE` are constants for that reason, and every guard sweeps
all three paths and asserts it saw all three. **Found by running a probe, not by reading the diff.**

### ⚠️⚠️ A STANDALONE PROGRAMME NEVER CALLS `intentFor`, SO IT IS THE PATH A YOUTH REACHES HEAVY THROUGH

A7 works in BLOCKS — technique, loading, heavy — and injects its own `StrengthIntent`, so the age test
that lives in `intentFor` is simply not consulted. An eight-week programme's third block prescribes
3–6 reps at 85%+. `buildStrength` therefore folds an **injected** intent to the band as well, and
⚠️ **the age rides on `ProgrammePrefs`** rather than on each function's arguments: `buildProgrammeSession`,
`programmeWeekFor` and `programmeWeeksFor` all take those prefs, and three separate parameters is three
chances for one caller to pass it and another to forget.

⚠️⚠️ **AND THE PROGRAMME'S OWN DESCRIPTION READ THE BLOCK TABLE RATHER THAN THE SESSION.** `plan` came
back as the raw `programmeWeek(...)`, so the card said *"3 sets of 3–6 (heavy) at 80%+, 2.5 minutes
between sets"* over a youth session containing none of it. `deliveredWeek` now corrects all four —
sets, reps, load and rest — from what was built, and `programmeWeekFor` reads it rather than deriving
a second answer.
⚠️ **THE MAIN LIFT IS FOUND BY SET COUNT, NOT BY CARRYING A LOAD.** `find(e => e.loadPercent1RM)`
answers undefined for a youth session by construction, so the old test went blind for exactly the
runner this matters most for. The spine's main lifts take `mainSets` and everything else one fewer, so
the maximum IS the figure — and it is the same number the old test returned for every adult.
⚠️ **`buildStrength` NOW REPORTS THE REST INTENT IT USED**, rather than leaving a reverse lookup: the
seconds are not a key (light and plyo are both 90), and for a youth the intent is not the one the
caller asked for.

⚠️ **THAT IS THE ONLY ADULT-VISIBLE CHANGE IN Y3 AND IT IS A FIX. Measured against a HEAD worktree: 0
of 72 generated PLANS changed, and 40 of 144 adult programme descriptions were overstating their own
set count** — a card reading "3 sets" over a session containing two. A7's own note records fixing
exactly this for the week CARD and it was left on the session description.

### The rest of the decisions, each from a table rather than a taste

⚠️ **THE NUMBERS DO NOT VARY BY AGE WITHIN 12-17, AND THAT IS THE SOURCES' OWN SHAPE.** The NSCA's
tables are keyed on TRAINING EXPERIENCE, not on birthday — a 12-year-old who has lifted for two years
and a 17-year-old who has never touched a bar get the same prescription. So the strength row is
constant down the age column while the running limits are not, and the app's own `level` question is
what moves it.

⚠️ **THE SET CAP IS APPLIED AFTER THE CLOCK, NOT BEFORE IT.** Measured: a 17-year-old at advanced level
and sixty minutes starts at three sets (2 + the level's +1) and `buildStrength`'s growth loop takes it
to four, past the NSCA's 1–3. Capping the starting figure would have left that untouched; the guard
names that exact fixture and asserts an adult still reaches four, or it would be testing nothing.

⚠️ **THE SESSIONS-A-WEEK CAP IS A WRAPPER, NOT AN EIGHTH CONDITION.** `strengthSessionsFor` has seven
returns and a youth must not reach four through any of them; the preferences path is the one that binds
(`STRENGTH_MAX_PER_WEEK` is 4). ⚠️ **A programme returns 0 there by design and carries its own figure**,
so the cap is applied a second time in `progPrefs`, where that figure is read.

⚠️ **PLYOMETRIC SETS ARE SHORTENED, NOT DROPPED.** The NSCA's power table is 1–3 sets of **3–6 reps**
*"to maintain quality of movement"*; trimming sets instead would keep the tired reps and remove the
fresh ones. ⚠️ **AND THE LABEL AND THE COUNT ARE CAPPED TOGETHER** — `pogoEach` is what the ground-contact
total is computed from and `pogoReps` is what the runner reads, so capping one gives a session that says
"10" and counts 6.
⚠️ **THE ENGINE HAS TWO DOSE TABLES AND `youthPlyoDose` IS NOT A THIRD.** `PLYO_DOSE` on the legacy path
and the pair inside `plyoFor` both call it; the guard compares the two paths' OUTPUT rather than reading
the source.
⚠️ **AND THE PHASE FACT IS STILL COMPUTED, because `heavy` answers two questions** — what the lifts are
prescribed in, and whether the session carries jumps at all — and only the first is age-sensitive.
Folding a youth session by setting `heavy = false` would have taken the plyometrics away with the heavy
reps, which is backwards.

⚠️ **THE ESTIMATED 1RM IS WITHHELD AND THE TREND ARROW IS NOT.** The estimate is safe to COMPUTE — Epley
over submaximal sets, nobody lifts anything maximal to produce it — so the direction of travel still
shows on the history card and a new-best toast still names the achievement. What goes is the FIGURE.
⚠️ **The toast is reworded rather than swallowed**: a runner under 18 who has just set a best has done
something real, and dropping it would take that away to avoid printing a number.

⚠️ **A YOUTH PROGRAMME STILL PROGRESSES, BY LOAD RATHER THAN BY REP BAND.** With every block folded to
8–12, *"Heavy and low-rep — the work the evidence is about"* sat over week 9 describing a progression
that was not happening. `YOUTH_FOCUS` says the one that is — the NSCA's own *"increase resistance
gradually 5–10%"*. A deload keeps its own sentence at every age, because "ease off" is true always and
is the one thing on that card that must not be reworded into something that sounds like more work.

⚠️ **`isYouth()` IN THE APP ASKS THE ENGINE RATHER THAN COMPARING A NUMBER**, so the page and the plan
cannot disagree about who is a child. `isYouthAge` is unbounded below on purpose; a bare age-under-18
test would answer FALSE for a stored 0 or NaN, which is the one direction that must never be wrong.

### ⚠️⚠️ SEVEN OF TWENTY-THREE RE-BREAKS ESCAPED THE FIRST TIME, AND THAT IS THE USEFUL HALF

Every one was a guard weakness rather than an equivalence, and five were plain coverage holes in
places the end-to-end sweeps could not see. Re-run after: **23 of 23 caught.**

1. ⚠️⚠️ **A GUARD THAT SCALES WITH THE CONSTANT IT GUARDS IS NOT ONE.** The plyometric sweep asserted
   `reps <= lim.maxPlyoReps` — reading the very constant a re-break loosens — so taking it from 6 to 12
   passed, and the adult dose (10 and 12 reps a set) came straight through to a 12-year-old. There is
   now an absolute `EVIDENCED_MAX_PLYO_REPS = 6` beside it, written as a literal on purpose because it
   is a fact about the NSCA's power table rather than about our configuration. **This repo has recorded
   the identical trap once before** (`worst <= QUALITY_WORK_CAP_SEC` passing with the cap raised to 200
   minutes).
2. ⚠️⚠️ **REMOVING `age` FROM THE GENERATOR'S OWN CALL CHANGED NOTHING**, because every guard drove the
   three builders directly. The whole feature could have been unwired from the plan with the suite
   green — the computed-and-discarded trap, and this file's eighth recording of it. A guard now builds
   real plans for a 13-year-old and reads the strength sessions out of them.
3. ⚠️ **BELT AND BRACES HID THE BRACE BEING TESTED.** Deleting `intentFor`'s age branch changed nothing
   end to end, because `buildStrength` folds the result again for the injected case. `intentFor` is
   exported, so it has to be honest on its own; it is driven directly now.
4. ⚠️ **NOTHING ASSERTED THE BLOCK FOCUS**, so a youth week 9 could go back to "Heavy and low-rep" over
   a session prescribing 8–12. Guarded, including that the three sentences stay distinct — a youth
   programme still progresses and a flattened focus would say it does not.
5. ⚠️ **THE HISTORY CARD WAS A SECOND SURFACE PRINTING THE SAME NUMBER** and only the toast was
   covered. Asserted on the GATE around the push, not on `isYouth` being mentioned in the function.
6-7. ⚠️⚠️ **`progPrefs` WAS DRIVEN BY NO TEST AT ALL**, and it is both halves of the only path a 12-17
   runner does the most lifting through: it hands a programme its age, and it caps the sessions a week
   (the engine's own cap cannot — `strengthSessionsFor` returns 0 for a programme by design). Lifted
   from the built page and driven with the real `RC.youthLimitsFor`.

### Traps this stage paid for again

⚠️ **THE BACKTICK RULE FIRED — but my own pre-build sweep caught it before the build did**, for the
second time in this project. Two backticks in a doc comment I added to `web/app.ts`.
`git diff web/app.ts | grep '^+' | grep '\`'` before building is the whole check.

⚠️ **A STALE HAND-WRITTEN LIFT LIST FAILED LOUDLY — the acceptable kind.**
`test/strength-progress.test.ts` lifts `strNewRecordMessage` and did not know about `isYouth`
(`ReferenceError`). Fixed by lifting the REAL `isYouth` and handing it the REAL `RC.isYouthAge`: a stub
answering false would have measured a strictly easier program, with the withholding untested and
removable without an assertion moving.

⚠️ **AND TWO OF MY OWN GUARDS' REGEXES FAILED ON CORRECT CODE, BOTH THE SAME SHAPE.** A character
class excluding a delimiter cannot cross a call that contains one: `if \(([^)]*)\)` stops at the `)`
of `isYouth()`, and `(\d+) sets of ([^,]+), ` captured `"8–12 at 70%"` because the load clause carries
no comma before it. Collection-too-narrow, in the guard rather than the code, twice in one file.
⚠️ **AND THE SECOND ONE WAS MADE STRONGER WHILE IT WAS BEING FIXED:** `(\w+) sets of ([^,]+), ` captured
`"8–12 at 70%"`, because the load clause carries no comma before it. Fixed — and made stronger while it
was being fixed: it now asserts the card's LOAD matches the session's too, which is the half a 12-17
runner is protected by.

**Still to come in this track:** Y4 Strava and heart-rate gates (no Strava at 12; Strava's own rule is
no HR upload under 16), Y5 the Children's Code (a DPIA and child-readable privacy wording), Y6 the App
Store answers. Then D3c, a home for the wellbeing tick-boxes.

⚠️ **AND THE THRESHOLDS IN THIS CHAPTER ARE STILL THE OWNER'S TO HAVE REVIEWED.** The distance and
frequency numbers are UK Athletics' own rule; the resistance numbers are two position stands. Neither
has been read by a clinician for this app, and `YOUTH.md` section 7 lists what is honestly uncertain.

## ✅ Y4 — STRAVA'S OWN AGE RULES, AND THE TWO THINGS FOUND UNDER THEM (2026-09-23)

The owner's instruction: *"Start Y4: Strava and heart rate for under-16s."* Suite 1751 → **1760**;
`test/youth-strava.test.ts` holds 9 guards and **20 deliberate re-breaks were all caught**.

⚠️⚠️ **STARTING Y4 FOUND THAT Y2 AND Y3 HAD NEVER REACHED A REAL PLAN.** `applyProfile` builds the
`ath` object it hands `RC.buildPlanSummary` and `RC.generatePlan`, and it never carried an age — so
every youth lever in the engine (`youthLimitsFor(athlete.age)`) answered null for everybody using the
app. The engine's tests set `Athlete.age` by hand, which is why a green suite could not see it: the
computed-and-discarded trap, and the first time it has hidden a child-safety feature. Measured, a
13-year-old on four and five days, before → after the hand-off:

| | no age handed over (shipped until Y4) | age handed over |
|---|---|---|
| longest session | **11.0–14.2 km** | 7.6 km |
| runs in a week | **4–5** | 3 |
| weeks with two hard days | **1–5** | 0 |
| lifts at a % of a one-rep max | **51** | 0 |

⚠️ **ONLY WHEN THEY ANSWERED**, through the engine's one definition (`RC.ageAnswer`), and an adult age
changes nothing — every lever is gated on `youthLimitsFor`, null from 18. Verified in the served app
with the real `applyProfile`: a 46-year-old, no age and "Prefer not to say" all build the identical
adult plan (4 runs, 12.4 km, 72 %1RM lifts); a 13-year-old builds 3 runs, 7.6 km, 0.
⚠️ **`test/youth-strava.test.ts` RUNS `applyProfile` WITH A SPY ENGINE** that records what it is handed,
then feeds that into the real `generatePlan`. A guard on the engine alone is exactly what let this ship.

⚠️⚠️ **AND "PREFER NOT TO SAY" WAS A 12-YEAR-OLD.** `draftFromForm` saved a blank age through
`Number(...) || 0`, and `isYouthAge` tested only type, finiteness and < 18, so 0 passed and
`youthLimitsFor(0)` was the 12 row. The goal picker had its own copy of the test demanding > 0, which
is why the goal screen looked right and nobody saw it. Y3 made it live (`isYouth()`, `progPrefs`), and
it was fixed the same day. `ageAnswer` is now the one definition: non-positive, non-finite and
non-numeric mean no answer; a numeric string counts (a restored backup must not turn a 13-year-old
into an adult); a real number below 12 is still a child. The form stores no key for a blank answer,
and a 0 already on a phone reads as no answer through the same function.

### What Strava itself says, verified on its own pages rather than a search summary

- Help Centre, *"Can I use Strava if I'm under the age of 16?"*: **"Strava allows accounts starting at
  age 13"** and **"athletes under 16 cannot upload heart rate data or receive heart rate analysis"**.
- Terms of Service, effective 1 January 2026: **"at least 13 years old, or such higher age as may be
  required in your jurisdiction"** — 13 in the UK.

Both quotes live beside `STRAVA_MIN_AGE` / `STRAVA_HEART_RATE_MIN_AGE`, and a guard fails if a number
moves without its quote. YOUTH.md's "no messaging or Instant Workouts under 18" are Strava's own
features; this app uses neither.

### What shipped

- **Under 13: no Strava at all.** Connect is never drawn, `stravaConnect` refuses as a belt, both
  uploads refuse, and the run page, the strength "done" screen and the finish-screen sync row are
  absent. A runner who connected before giving an age under 13 keeps **Disconnect**, which tells Strava
  as well as us.
- **13–15: Strava without heart rate.** `runStravaPayload` asks the gate *inside* the builder, so no
  caller can forget; the GPX then carries no `gpxtpx` namespace or reading, and the route still goes.
  The sheet and the Apps & devices row say so in a sentence.
- **16 and over, and no answer: unchanged.** Absent means allowed, exactly as it means adult everywhere
  else — Strava checks a date of birth at its own sign-up, and refusing here would take Strava from
  every adult who skipped the question.

⚠️ **`stravaActive()` IS WHAT EVERY SEND AND SEND CONTROL ASKS; `stravaConnected()` IS NOW ONLY THE
FACT ABOUT THE TOKEN.** They differ for exactly one runner (connected, then aged under 13), who must
still reach Disconnect. A derived guard finds every function that calls the upload endpoint, requires
exactly the two there are, and requires each to ask `stravaActive()` first — a third upload path fails
until somebody decides about it.
⚠️ **FOUR EXISTING GUARDS WERE RESTATED, NOT DELETED** (`strava-connect` ×3, `live-screens` ×1): each
pinned the literal `stravaConnected()`; each now pins `stravaActive()` **and** that `stravaActive` still
requires a connection, because either half alone would weaken the old promise. Eight harness lifts
went stale loudly (ReferenceError / `RC.ageAnswer is not a function`) and were given the REAL rule —
except the GPX-shape tests, which state they are about an adult and point here for the gate.

### Still open, measured, and not fixed here

- ⚠️ **A 13-year-old's hard sessions come to 6.4–7.6 km** (tempo and interval formats, of which only
  2.5–3.7 km is the work) against a 6 km race limit. It is the Y2 residual, now measurable because the
  age arrives; the fix is a shorter format, and whether a race limit should bound a training session's
  warm-up and cool-down at all is itself a judgement.
- **Runs already sent to Strava with heart rate cannot be recalled** — the app holds `activity:write`
  only, which cannot delete.
- **"Prefer not to say" still means adult**, so a 12-year-old who declines gets the adult app. The fix
  CLAUDE.md already names (ask "are you 18 or over?", treat a refusal as under 18) is still not built.

⚠️ **ALL WEB, SO IT REACHES PHONES OVER THE AIR.** No Swift changed.

**Verified:** `verify OK · build 0 · voices clean · 3 blocks · tsc 1 pinned · tests 1760/0 ×3 tz · audits ok
· 5m47s`, on the fourth full attempt. The three before it failed only the share-export gate's
`Runtime.evaluate timed out` on a bogged-down Mac (diagnosed in the share-export chapter), and
`tools/verify.mjs` gained an optional `VERIFY_CONCURRENCY` for it. Driven in the served app with the real
`applyProfile` and the real Strava sheet and Apps & devices row at ages 12, 14, 16 and none; no console
errors.
