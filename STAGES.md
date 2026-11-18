# Stages — the road to a long-term goal

> **APPROVED BY THE OWNER, 2026-11-18 — all five decisions in the last section, each recorded there.
> Nothing here is built yet.** It is `PLAN.md` stage **B14**; when to build it (before or after sending to
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
