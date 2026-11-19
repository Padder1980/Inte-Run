# Stages — the road to a long-term goal

> **APPROVED BY THE OWNER, 2026-11-18 — all five decisions in the last section, each recorded there.
> BUILT THE SAME DAY** (§8 steps 1–7; the build history and what is not yet placed are in `notes/plan-profile.md`). It is `PLAN.md` stage **B14**; when to build it (before or after sending to
> Apple) is his call, listed on the development plan page (`docs/plan/`). Record the build history in
> `notes/plan-profile.md`. ⚠️ Decisions 1 and 3 touch injury return: the wording goes to the clinical
> reviewer before release.

## 1. The problem, in his own plan

Returning from a long-term injury, he set a half marathon in May 2027 with a target of **1:35:00**
(4:30 per km). He chose **"Building the habit"** rather than "Regular runner" so the sessions would not
be too long or hard while he comes back, and answered **"Coming back to running? → After an injury"**.

The app built a ~21-week plan of **easy runs and long runs only — not one harder session** — with the
longest run topping out around 10–12 km. That cannot get anyone to 1:35.

**Why (measured 2026-11-18, real `applyProfile` over the real engine):**

- "Building the habit" puts the runner on the **beginner track** (`experienceFor`, web/app.ts).
- The beginner track *does* have harder work — one Hudson-style session a week (fartlek or hill reps,
  then goal-pace reps in the peak) since 2026-09-01 — **but `beginnerQualityFor` returns nothing when
  the runner is returning** (`if (ctx.returning) return null`, src/plan/generate-plan.ts ~:2257), and
  the hill sprints switch off too (~:2335). The `returning` flag is set once per plan from the comeback
  answer and applies to **every week of the block**. Nothing ties it to a phase or a week.
- So **habit + "after an injury" = zero quality sessions for the whole block.** The same plan without
  the comeback answer has 19. This was a deliberate ruling (Hudson beginner diet, 2026-09-01), recorded
  as **"the owner's to overturn"** (notes/plan-coaching-book.md) and guarded by
  `test/beginner-quality.test.ts` ("a returning beginner gets none").
- The beginner half's long run deliberately ends at **12 km** (generate-plan.ts ~:192–204).
- **Nothing ever moves a runner up a track.** The track comes only from the status card; silent
  promotion was ruled out on 2026-08-25. The weekly review's "add a day" offer refuses beginners and
  injured runners.
- **Two parts of the app disagree about him.** With a 5:30 easy pace typed, the feasibility check calls
  1:35 "comfortable" (predicts 1:32:55), while the plan can't get him there. The owner has ruled on this
  class of defect before: fix the plan, don't downgrade the verdict (notes/plan-coaching-book.md).
- **And for anyone whose race is far away**, the weeks before the structured block are left
  **un-planned**: the block is laid backwards from race day and capped (half 20 weeks, beginner half 28),
  and the time before it gets only a note — *"You have ~N weeks before the structured plan begins… use
  them to build easy-running consistency"* (generate-plan.ts ~:3428).

**The reassuring part:** the first few weeks of his current plan are exactly what a comeback *should*
start with. The gap only bites once the plan should be getting harder, around weeks 6–8.

## 2. The idea in one paragraph

A long-term goal becomes **a road made of stages**. Each stage is a short block (usually 4–6 weeks) with
one clear job. The race block itself is laid back from race day exactly as it is today; the time before
it is filled with the **foundation stages this runner needs**, chosen from where they are now. At the end
of every stage there is a **checkpoint**: the app shows what it saw (sessions done, how the body felt,
a test run where the stage has one) and **proposes** the next step. The runner chooses — move up, stay a
little longer, or ease back — and a "not yet" is remembered, never nagged. The app never changes the
plan on its own (the standing "always with the runner" rule).

## 3. The ladder

| Stage | Who starts here | Its one job | Typical length | A typical week | Checkpoint to move on |
|---|---|---|---|---|---|
| **0 · Walk-run** | Can't yet run 20 minutes | Get to 20–30 minutes non-stop | 4–8 wks | Today's run-walk track | 25–30 min continuous, twice |
| **1 · Rebuild** | Building the habit, **or** back from injury/time off | Make running normal again; no fast running | 4–6 wks | 3–4 easy runs, long run growing to 40–50 min, strength twice | Most sessions done, no pain flagged, a 40-min run that felt easy |
| **2 · Base** | Passed Rebuild, or a regular runner far from race day | More running, a longer long run, a first taste of speed | 4–8 wks | Easy volume, long run to 60–75 min, strides and hill sprints, one gentle fartlek | Long run comfortable; a short **test run** sets real paces |
| **3 · Race block** | Passed Base, or a regular runner | Today's structured block: build → peak → taper | Hudson's lengths: 5K 12 · 10K 14 · half 16 · marathon 20 | As today (main track; thinned at first for a returner) | Race day → today's after-race handover |

The engine already builds every one of these shapes. What it cannot do today is **link them**, **move a
runner between them**, or **put anything in the weeks before the race block**.

## 4. How the road is laid out

1. **Place** the runner on the ladder from what they have told us (status card, comeback answer,
   longest recent run) and, later, from what they have actually run.
2. **Budget the time backwards from race day.** The race block takes its length first. The foundation
   stages fill the time before it, in order, from the runner's starting stage.
3. **Not enough time?** Say so plainly when the plan is made, with choices: a later race, a shorter one,
   a revised target, or a shorter foundation with an honest warning. Never squeeze silently.
4. **More time than needed?** Extra Base weeks instead of "un-planned".
5. **A checkpoint not passed** pushes the road back. If that eats into the race block, the app says what
   that means for the target and offers the same choices as (3).

## 5. Checkpoints — the heart of it

- **When:** the last week of each stage, as a card on Today (the same pattern as the B5 comeback,
  B6 get-back-on-track and B9 after-race cards).
- **What it looks at (observed only — never invented):** sessions done against planned; wellbeing and
  pain check-ins; the stage's key run (for example 40 minutes continuous); thumbs up/down on runs
  (B10); a test run where the stage has one.
- **What it says:** *Ready*, *Nearly* or *Not yet*, with the reasons in plain words.
- **What the runner can do:** **Move up** (with a preview of exactly what changes — `profileImpact`
  already does this) · **One more week here** · **Ease back**. A "not yet" is remembered and offered
  again at the next checkpoint, never daily.
- **The target gets honest here too:** after each checkpoint the race time is re-predicted from real
  running and shown as *on track* or *behind*. A revised target is only ever offered as a choice.

## 6. What this would mean for his plan (an example, not a prescription)

Half marathon mid-May 2027, target 1:35, starting late November:

| Weeks | Stage | What changes for him |
|---|---|---|
| 1–4 | **Rebuild** | What his plan already gives him: easy running, the long run growing gently, strength. |
| ~4 | *Checkpoint 1* | "11 of 12 runs done, no pain flagged, your 40-minute run felt easy — ready for Base?" |
| 5–8 | **Base** | Long run towards 60–75 min, strides and hill sprints, one gentle fartlek a week. A short test run in week 8. |
| ~8 | *Checkpoint 2* | The test run re-predicts his half time; the app says honestly how 1:35 looks. |
| 9–24 | **Race block** | 16 weeks on the main track: threshold and half-marathon-pace work, long runs towards 95–110 min with goal-pace sections, then the taper. |

## 7. What already exists and gets reused

- **Plan queue / Up next** (`interun_queue_v1`, B9) — stores a plan's answers, not a built plan, so
  each stage can be built on the day it starts. `adoptProf` is the one start path for a stored plan.
- **After-race handover** (`interun_handover_v1`) — the card pattern for "what next?".
- **B5 comeback** (`interun_reentry_v1`) and **B6 get back on track** (`interun_realign_v1`) — offers
  with remembered answers, applied as dated changes.
- **B7 B-race** (`profile.bRace`) — a stepping-stone race can be a checkpoint test.
- **Weekly review's add-a-day offer** — the pattern for "offer a step up after ~85% completion, and
  remember a decline" (56 days today).
- **`profileImpact`** — previews what a change does before it is saved, including hard sessions.
- **Feasibility** (`assessFeasibility`) and **auto pace calibration** — the honest-target half.
- **`returnToRunningPlan`** (src/adapt/load-guardrails.ts:86) — staged comeback guidance that ends
  "then reintroduce one quality session". **Nothing in the app calls it yet**; it is the natural
  content and exit rule for the Rebuild stage (needs clinical review).

## 8. What would be built, in order (each step verifiable on its own)

1. **Engine: stages in one plan.** `GenerateOptions.road = { stages: [{ kind, weeks }] }`. The race block
   is still laid back from race day; foundation stages fill the weeks before it instead of leaving them
   un-planned. Each week carries `stage`. The **track and the `returning` flag become per stage** — so
   a returner gets no quality in Rebuild and the gentle beginner quality in Base, and the race block is
   built on the track the runner has reached. Volume carries smoothly across each boundary. Tests: no
   quality in Rebuild; quality returns in Base; the race block matches today's main track for the same
   weeks; past stages never change when a later checkpoint is passed.
2. **The road is stored data** on the profile (`profile.road`: stages, the current one, each checkpoint's
   date and the runner's answer), so the weeks already run keep the stage they were run in.
3. **Checkpoint evaluation** — a pure function over the evidence, returning Ready / Nearly / Not yet with
   reasons (a fact pack, like B10's briefings).
4. **The checkpoint card on Today** with the three choices, the preview, and the remembered answer.
5. **The road on the Plan screen** (a simple timeline of stages, the current one highlighted) and in the
   plan wizard before saving: *"Here's your road: 4 weeks Rebuild → 4 weeks Base → 16 weeks race block."*
6. **The honest target per checkpoint**, so the plan and the feasibility verdict always agree.
7. **Road Map, notes, and the clinical wording** for the Rebuild stage and its checkpoint.

**Later, separately:** goals without a race ("get back to 10K fitness", "run three times a week") —
that is PLAN.md's separate planning round for non-race modes; this proposal stays inside a race goal.

## 9. Decisions that are the owner's

1. **The returning-beginner rule.** Today: a returning beginner gets no harder sessions for the whole
   plan. Proposed: **none in the Rebuild stage; they return once the runner passes its checkpoint.**
   *Recommended: yes.* It changes a recorded ruling and touches injury return, so it goes to the
   clinical reviewer too. **→ Owner, 2026-11-18: yes** — build it this way; the wording still goes to the
   clinical reviewer before release.
2. **Moving up only through a checkpoint the runner accepts.** Keeps "no silent promotion" intact.
   *Recommended: yes.* **→ Owner, 2026-11-18: yes.**
3. **What a checkpoint asks for.** Proposed defaults: at least 80% of the stage's last two weeks done;
   no pain flagged in those two weeks; the stage's key run done. *Recommended: yes, with the pain rule
   checked by the clinical reviewer.* **→ Owner, 2026-11-18: yes** — Ready (all three), Nearly (one
   missing: a week more), Not yet (pain flagged: ease back, with the injury guidance); the runner still
   chooses (decision 2).
4. **When time runs short**, the app proposes (later race / revised target / shorter foundation) and
   never shortens the race block on its own. *Recommended: yes.* **→ Owner, 2026-11-18: "all options
   available"** — every choice is offered to the runner, none withheld: keep the race and adjust the target,
   keep the target and pick a later race, or carry on with the shorter race block (with an honest note on
   the risk). The app explains; it never picks one by itself.
5. **Scope:** race goals first; non-race goals in their own planning round later. *Recommended: yes.*
   **→ Owner, 2026-11-18: yes** — no-race goals stay on the list as their own project, not dropped.

## 10. Blocks for every long-term goal — APPROVED BY THE OWNER, 2026-11-18 ("yes to all five, build it")

**His ask, the evening Stages was built** (word for word): *"I want the block approach to be for all plans that the
user chooses if it's a long term goal (not just for returning from injury)..... I need you to research and recommend
the maximum length a block should be for any running plan before its recommended that the runner would then move up.
I can't imagine that anything longer than 4-6 weeks would be necessary for the 'Just getting started' and 'building
the habit plans' (check this with research). If this is the case then I need the app to recommend blocks and
progression to the next stage. It might be that at the end of the block, the last session is a timed 5km/park run or
a 2k time trial if the user hasn't identified a race. This would then give the app a new baseline to plan the next
block from (does that make sense?)"*

### What the research says (a research pass over 42 sources, 2026-11-18; the key ones listed)

- **4–6 weeks as a review point holds at every level from "Building the habit" up.** Daniels: most of a routine's
  benefit comes "in a matter of four to six weeks"; he updates training paces every 3–6 weeks. Hudson: a recovery
  week every 3rd–4th week for trained runners (notes/plan-coaching-book.md). Issurin's block periodisation uses 2–4-week
  blocks (trained athletes only). Kiely 2018 (Sports Med 48:753): there are no proven rules for cycle length — he
  recommends "starting points, checkpoints, and endpoints" adjusted to the person, which is exactly a road of stages.
- **No study sets a maximum** after which a block stops working: aerobic gains start within 3 weeks (Murias 2010) and
  untrained adults kept improving for ~6 months on one routine (Scharhag-Rosenberger 2009). So 6 weeks is a limit on
  how long to go WITHOUT A CHECKPOINT, not a limit on adaptation. Tissues lag fitness (bone remodels over ~3 months,
  stress fractures show 3–4 weeks after a load error — Warden 2021), so each move up should be a small step.
- ⚠️ **"Just getting started" needs TWO blocks, not one.** NHS Couch to 5K: the first 20-minute non-stop run is week 5,
  three 30-minute runs week 9, and repeating a week is "totally okay". The Dutch Start to Run programme is 6 weeks
  (Kluitenberg 2015, 10.9% injured). An 8-week plan injured no more than a 13-week one (Buist 2008: 20.3% vs 20.8%).
  So: ~5 weeks to 20 minutes non-stop, then ~4 weeks to 30 — each block inside his 4–6, with "repeat" a normal answer.
- ⚠️ **Coming back from injury moves on symptoms, not the calendar.** Stanford FASTR's bone-stress protocol: pain →
  a rest day and repeat the last pain-free session; again → 3 days off; again → drop back two levels and see a
  clinician. A full return usually takes 2–6 months (Hoenig 2023).
- ⚠️ **The race block itself is longer** (Hudson 12–20 weeks); 4–6 weeks applies to the checkpoints INSIDE it.
- **The 10% weekly rule did not protect novices** (Buist 2008), and the weekly-percentage evidence is weak. The
  strongest recent signal is per run: a run more than 10% longer than your longest in the last 30 days raised injury
  risk 52–128% (Frandsen 2025, BJSM 59:1203) — which matters for choosing an end-of-block test.

### The end-of-block test — his idea, made safe level by level

Yes, it makes sense: a test at the end of each block gives the next block real paces (the app already re-baselines
from a 2 km trial, and already offers one every 28 days — `RETEST_DUE_DAYS`). But not the same test for everyone:

| Level | End-of-block test | Why |
|---|---|---|
| Just getting started | **No time trial.** The block's target run, non-stop at chatting pace (20, then 30 minutes), and no pain the next day. | Cooper Institute: running tests are for the already active; hard unaccustomed effort carries the highest short-term risk in the least active (AHA/ACSM 2007). |
| Building the habit | A **strong-but-controlled 2 km** (Galloway's "Magic Mile" style, not all-out), or a **parkrun once the longest run is about 4.5 km**. | A 5 km for someone whose longest run is 3 km is the >10% single-run jump (Frandsen 2025). |
| Regular / Competitive | **parkrun or a 5 km time trial** (or a race) every 4–6 weeks, or the 2 km trial. | 5 km varies ~2% test to test (Laursen 2007); parkrun has been used as the test in trials; serious events ~0.26 per 100,000 runs (Pedlar 2021). |
| Back from injury | **No time trial until running is back to normal**; symptom checks instead. | Stanford FASTR. |

### The recommendation

1. **Every long-term goal is a road of blocks.** A block is **4 weeks** as standard, **6 at most** before a
   checkpoint, at every level; the runner can always repeat one.
2. **Who starts where:** Just getting started → **Walk-run 1** (~5 weeks, to 20 minutes non-stop) → **Walk-run 2**
   (~4 weeks, to 30) → Rebuild/Base; Building the habit or coming back → Rebuild → Base (built); a regular or
   competitive runner far from race day → **Base blocks built from the mileage they state** → the race block.
3. **Inside the race block, a checkpoint every 4 weeks** that re-baselines paces from the test; "one more week" there
   eats into the block, with decision 4's choices.
4. **No race set: rolling 4-week blocks**, each ending in the level's test, the next block planned from it. ⚠️ This
   brings forward decision 5's "no-race goals later, as their own project".
5. **Injury returns progress on symptoms**: the per-run pain rule above, on top of the checkpoint (clinical review).

### Decisions that are the owner's (asked and answered, 2026-11-18)

1. A block is 4 weeks, 6 at most before a checkpoint, for every level. *Recommended: yes.*
   **→ Owner, 2026-11-18: "yes to all five, build it".**
2. "Just getting started" gets two walk-run blocks (~5 + ~4 weeks) before Rebuild. *Recommended: yes.*
   **→ Owner, 2026-11-18: "yes to all five, build it".**
3. Regular and competitive runners get roads too (Base blocks from their stated mileage), and race blocks get a
   checkpoint every 4 weeks. *Recommended: yes.*
   **→ Owner, 2026-11-18: "yes to all five, build it".**
   *Asked while building it — what "One more week" means at a checkpoint inside the race block, where race day cannot move:
   A, next week repeats the last full week and the weeks after are re-spaced over one week less (each later step a little
   bigger, never past the 10% limit); or B, no "One more week" there — the only choices are "Carry on" and "Ease back" (a
   lighter week), and if the runner is behind, the checkpoint offers a later race or a new target. He was told that after an
   "Ease back" the next full week is two steps up from the last full one. Recommended: A.*
   **→ Owner, 2026-11-19: "B: No "One more week" there".** Built that way: inside the race block the checkpoint offers
   carrying on or easing back, and nothing that repeats a week.
4. No-race goals now, as rolling test-ended blocks (overturns decision 5's "later"). *Recommended: yes, built after 3.*
   **→ Owner, 2026-11-18: "yes to all five, build it".**
5. The end-of-block test by level, as in the table — including **no maximal test for beginners or injury returners**,
   which changes the Base checkpoint built today (a 2 km test run) to "strong but controlled" for a returner.
   *Recommended: yes, with the clinical reviewer.*
   **→ Owner, 2026-11-18: "yes to all five, build it".** The injury-return wording still goes to the clinical reviewer
   before release.

**Build note:** each of 2–4 is its own stage for a fresh session (CLAUDE.md: one stage per session). Nothing changes
an existing plan by itself: like Stages, a road reaches a runner's plan only through the wizard (decision 2).

**Build status (2026-11-18).** ✅ Piece 1 — decisions 1 and 5 on the existing road: Base in blocks of 4 weeks (6 at most),
the end-of-block test by level (`blockTestsFor`), no maximal test for "Just getting started" or anyone back from injury
(the weekly review's 2 km retest too), a parkrun only once the longest run of 30 days is about 4.5 km. ✅ Piece 2 —
decision 2: Walk-run 1 (to 20 minutes non-stop) and Walk-run 2 (to 30) before Rebuild for a run-walk runner. ✅ Piece 3 —
decision 3 (built 2026-11-19): regular and competitive runners' roads (Rebuild when coming back, Base built from the mileage
they state, a race-only road where none is needed) and a checkpoint every 4 weeks in the race block, never in the taper, with
the level's test; it holds nobody, and an answer there moves no week. "One more week" inside the race block: the owner chose
none (decision 3 above, 2026-11-19) — there the checkpoint offers carrying on or easing back. ☐ Piece 4 — decision 4 (no-race goals). Build history and the hand-over for 3 and 4: `notes/plan-profile.md`.
