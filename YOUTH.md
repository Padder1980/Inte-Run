<!-- Research and specification for the 12-17 programme. Commissioned by the owner on 21 Sept 2026,
replacing PLAN.md's D3b ("an under-18 gate"). His instruction, verbatim: "I want there to be a fully
tailored programme for children between the ages of 12-18 ... in line with a detailed piece of research
that you undertake ... Don't just assume that you have the right answer at the first research run,
double check what you find ... This also applies to any weight training programme ... All of this needs
to be written into any privacy policy and answers for the app store."
NOTHING IN HERE IS BUILT YET. It is the spec, and it needs his sign-off before it is. -->

# The 12-17 programme: research, and the limits it implies

## 0. What the app does for a 13-year-old today

*(Written 2026-09-21, before Y1-Y4. Sections 5.6-5.9 record what changed.)*

`ageOpts` offers **12 to 90** plus "Prefer not to say", and every answer builds the same plan. The only
youth accommodation anywhere in the codebase is in `src/science/warmup.ts:506` - a 25% shorter warm-up
under 18. So today a 13-year-old can:

- pick **marathon** as a goal and be built a block whose long run reaches `LONG_FLOOR_KM` 24-28 km;
- be prescribed the strength gym's heavy work at **`loadPercent1RM` 80%+**, 3-6 reps off 3 minutes;
- be shown an **estimated 1RM** and a suggested load derived from it;
- connect **Strava**, whose own minimum age is 13 and which forbids heart-rate upload under 16.

Every one of those is outside what the governing bodies and position stands below permit.

## 1. How to read the sources

Graded, because they are not equal and the difference decides what we may encode:

| Grade | Meaning | Used for |
|---|---|---|
| **RULE** | A current governing body's competition rule | The hard ceiling |
| **RECOMMENDED** | The same body's own LTAD advice, used when it licenses events | What we actually build to |
| **POSITION STAND** | Peer-reviewed consensus from a professional body | Strength prescription |
| **OPINION** | Stated by its own authors to be opinion, not evidence | Context only, never a limit |

⚠️ **AND ONE SOURCE WAS DISCARDED. The widely-quoted "IAAF" table - under 12: 8 km, 12-15: 10 km,
15-16: half marathon, 16-18: marathon - traces to a 1987 viewpoint article in the IAAF's own *New
Studies in Athletics*, not to any current rule.** It is far more permissive than every current body,
and secondary sources quoting it do not even agree with each other about its weekly-volume multiplier
(one says twice the race distance, another three times). It circulates widely and it is folklore. **Do
not reinstate it**, and be suspicious of any youth distance table that permits a 15-year-old a half
marathon - that is its fingerprint.

## 2. Running distance - PRIMARY SOURCE, CROSS-CONFIRMED

Source: *Maximum Race Distances for Young Athletes*, scottishathletics, March 2026, citing **UK
Athletics Rules for Competition TR3 S4**. Extracted from the PDF by layout position, because the
tables come out of a plain text extraction in the wrong order and the first table is the one that
looks like a recommendation.

⚠️ **THE AGE GROUPS CHANGED ON 1 APRIL 2026** - U13/U15/U17/U20 became **U14/U16/U18/U20**. Anything
written before that date, including most of what a search returns, is describing different bands. A
search summary confidently gave me "U13: 5 km, U15: 6 km, 16: 10 km, 17: 15 km" and **every one of
those numbers is wrong**.

**Table 1 - the RULE (TR3 S4), maximum permitted, road:**

| Age on day | 12-13 | 14 | 15 | 16 | 17 | 18 | 19 | 20+ |
|---|---|---|---|---|---|---|---|---|
| Max permitted | 6 km | 8 km | 12 km | 16 km | 25 km | Marathon | 45 km | Unlimited |

**Table 2 - what the same body RECOMMENDS (road), and what it licenses events against:**

| Age on day | 12-13 | 14 | 15 | 16 | 17 | 18 | 19 | 20+ |
|---|---|---|---|---|---|---|---|---|
| Recommended | 6 km | 8 km | 8 km | 12-14 km | 12-14 km | 22 km | 22 km | Unlimited |

Cross country is shorter again (12-13: 4 km, 14-15: 5 km, 16-17: 8 km, 18-19: 10 km) and hill/trail
shorter still (U14 5 km, U16 6 km, U18 8 km, U20 10 km).

✅ **CROSS-CONFIRMED INDEPENDENTLY.** England Athletics publishes its own recommended cross-country
distances for 2026/27: **U14 3000-4000 m, U16 5000 m, U18 8000 m, U20 10,000 m** - an exact match to
the table above, from a different home-country governing body. Two bodies agreeing on the same
framework is what makes the road column trustworthy too.

**Corroboration from medical and club bodies, all more conservative than the folklore table:**
- **RRCA**: 12-14 → 5K; 15-18 → 10K and potentially half marathons.
- **American Academy of Pediatrics**: healthy children may compete up to about **5K**; longer
  endurance races require **individual medical clearance**.
- **Nationwide Children's**: under 14 should run **only three times per week**.
- Major marathons (**London, and the World Marathon Majors**) require **18+**.

## 3. Running volume - WEAKER EVIDENCE, AND IT MUST BE SAID SO

Source: *Youth running consensus statement: minimising risk of injury and illness in youth runners*
(Krabak et al., **Br J Sports Med 2021;55:305-318**).

⚠️ **ITS OWN AUTHORS SAY THE DISTANCE NUMBERS ARE OPINION.** Verbatim from the summaries: "there are
no studies to support specific distances or training recommendations for youth runners to prevent
injury or guide normal growth", and current distance recommendations "are opinion based". The
statement is evidence-based for 13-18 and explicitly **opinion** for 12 and under. Anything we build
on it must be described to the runner as a cautious convention, never as a proven safe limit.

What it does give us:
- **Weekly volume no more than twice the maximum recommended single-session distance.**
  ⚠️ **PROVENANCE FLAG: I could not obtain the primary text of this rule** - BJSM is paywalled and the
  PDF hosts refused. It is attested by two independent secondary summaries; a third source quoting the
  discarded 1987 table says *three* times instead. Treat as a sensible convention with an honest
  caveat, not as a quoted rule, and prefer it precisely because it is the conservative of the two.
- 5K as the sensible competitive distance from age 12.

**Why conservatism is justified here regardless:** in competitive adolescent distance runners the
measured injury incidence is **68% (95% CI 60-77)**, at 6.3 per 1,000 participation hours, and it is
overwhelmingly overuse - knee 22%, foot/toes 16%, lower leg 16%. Injured runners ran more miles per
week than uninjured ones (14.6 vs 12.0 at middle school, 15 vs 12.1 at high school). **Girls are more
likely to be injured than boys and lose more time to it.** Tendonitis, apophysitis and stress
fractures are the characteristic youth injuries, and they are load-accumulation injuries.

## 4. Strength - POSITION STANDS, AND THEY PERMIT MORE THAN EXPECTED

Sources: **NSCA Youth Resistance Training: Updated Position Statement** (*J Strength Cond Res* 2009,
extracted in full) and **Position statement on youth resistance training: the 2014 International
Consensus** (Lloyd, Faigenbaum et al., *Br J Sports Med* 2014;48:498-505 - adapted from the **UKSCA**
position statement, so this is the UK-relevant one).

⚠️ **THE GROWTH-PLATE FEAR IS A MYTH AND OUR COPY MUST NOT REPEAT IT.** Properly supervised,
well-designed resistance training has never been shown to damage growth plates, reduce adult height or
harm cardiovascular development. Growth-plate injuries come from acute trauma - a fall, a collision, a
bad landing. That is the settled view of the AAP, the 2014 consensus and two decades of review.

⚠️ **THERE IS NO MINIMUM AGE.** "Although there is no minimum age requirement for participation in a
youth resistance-training program, all participants should have the emotional maturity to accept and
follow direction". Prescription should follow **training age, motor competency and technical
proficiency**, not birthday. **So refusing a 12-year-old strength work would be wrong**, and the
owner's instruction to build a tailored programme rather than a ban is the better-evidenced position.

⚠️⚠️ **BUT EVERY PERMISSION IS CONDITIONAL ON SUPERVISION, AND AN APP CANNOT SUPERVISE. THIS IS THE
CLAUSE THE WHOLE STRENGTH DESIGN TURNS ON.**
- NSCA: "**If qualified supervision, age-appropriate exercise equipment, and a safe training
  environment are not available, youth should not perform resistance exercise** due to the increased
  risk of injury."
- 2014 consensus: youth may be introduced to "lower repetition ranges (<=6) and higher external loads
  (>85% 1RM) ... **on the proviso these programmes are supervised by qualified professionals**".
- NSCA on testing: "**unsupervised and improper 1RM testing ... should not be performed by children or
  adolescents under any circumstances due to the real risk of injury.**"

So heavy work is not forbidden to youth - it is forbidden to *unsupervised* youth, which is what an app
has. That is a limit on us, not on them, and the copy should say so in those terms.

**NSCA Table 2 - progression for strength in youth:**

| | Novice | Intermediate | Advanced |
|---|---|---|---|
| Intensity | 50-70% 1RM | 60-80% 1RM | 70-85% 1RM |
| Volume | 1-2 sets x 10-15 reps | 2-3 sets x 8-12 reps | >=3 sets x 6-10 reps |
| Rest | 1 min | 1-2 min | 2-3 min |
| Frequency | 2-3 d/wk | 2-3 d/wk | 3-4 d/wk |

**NSCA Table 3 - progression for POWER in youth** (a separate table, and citing Table 2 for power
work would have been wrong - the loads are lower and the reps far fewer):

| | Novice | Intermediate | Advanced |
|---|---|---|---|
| Intensity | 30-60% 1RM (velocity) | 30-60% velocity / 60-70% strength | 30-60% velocity / 70-80% strength |
| Volume | 1-2 sets x 3-6 reps | 2-3 sets x 3-6 reps | >=3 sets x 1-6 reps |
| Rest | 1 min | 1-2 min | 2-3 min |
| Frequency | 2 d/wk | 2-3 d/wk | 2-3 d/wk |

**NSCA Table 1 - general guidelines:** qualified instruction and supervision; 5-10 min dynamic warm-up;
begin light and focus on technique; **1-3 sets of 6-15 reps** for strength; **1-3 sets of 3-6 reps** for
power; increase resistance gradually **5-10%**; **2-3 times per week on non-consecutive days**; keep a
log. Power/plyometric sets stay under 6-8 reps "to maintain movement speed". Youth recover faster than
adults, so **1 minute between sets suffices** for a novice where an adult needs 2-3.

## 5. What this means the app must do

⚠️ **PROPOSED, NOT BUILT, AND NOT YET SIGNED OFF.**

### 5.1 Goals offered - OWNER'S RULING, 21 Sept 2026

⚠⚠ **HE CHOSE UKA'S RULE OVER UKA'S RECOMMENDATION, AND OVER HIS OWN FIRST TABLE. BOTH HALVES OF
THAT MATTER.**

He first supplied a table allowing 10K at 12, a half marathon at 15 and a marathon at 17, with a
frequency column. Put to him that **every distance row exceeds UKA's own competition rule** - so the
app would coach a 17-year-old for sixteen weeks toward a race they are not permitted to enter - he
moved to the rule. **His frequency column was adopted unchanged**, because it is well supported
(Nationwide Children's "only three times per week" under 14; measured practice 4.1 sessions at 13-14
and 5.1 at 17-18) and it is the one column that was never in dispute.

⚠️ **HIS FIRST TABLE WAS THE DISCARDED 1987 SET IN MILES** - 10K / half / marathon is its
signature. It circulates on most youth-running pages. Expect to meet it again; section 1 says why it
is not a source.

| Age | Rule ceiling (road) | Goals offered | Max runs/week |
|---|---|---|---|
| 12 | 6 km | 5k | 3 |
| 13 | 6 km | 5k | 3 |
| 14 | 8 km | 5k | 3 |
| 15 | 12 km | 5k, 10k | 5 |
| 16 | 16 km | 5k, 10k | 5 |
| 17 | 25 km | 5k, 10k, **half** | 5 |
| 18+ | - | everything (adult app) | adult |

**18 is an adult** - his ruling, and it agrees with UK majority, UKA's rule (marathon permitted at 18)
and every World Marathon Major's entry age. So the youth programme is **12-17 inclusive**.

⚠️ **A HALF MARATHON IS 21.1 km AND THE RULE ALLOWS 25 km AT 17, SO IT FITS - JUST.** It does
not fit at 16 (16 km) and a marathon fits at no age under 18. The recommendation would have said 10k
until 18; we are one band more permissive than that, by his decision, and still inside the rule.

### 5.2 Training limits
- **Single session** never exceeds the age's rule ceiling: 6 / 6 / 8 / 12 / 16 / 25 km.
- **Weekly volume** capped at twice the single-session ceiling, with the section 3 provenance caveat.
- **Frequency** capped at his column: 3 runs a week to 14, 5 from 15.
- `LONG_FLOOR_KM` and `LONG_CAP_KM` must not apply - they are adult event endpoints.
- ⚠️ **MEASURE THE PLANS THE GATES ACTUALLY PRODUCE.** The caps interact with the volume fit,
  the long-run ladder and the frequency cap in ways nobody can predict by reading. Sweep the reachable
  age x goal x days grid and check every built plan against all three ceilings, the way this repo
  audits everything else. A cap that is never reached is as much a finding as one that binds.

⚠⚠ **"PREFER NOT TO SAY" IS A HOLE AND NEEDS CLOSING IN THE SAME CHANGE.** Age is optional
today and absent means adult. Once a youth programme exists, a 13-year-old picking "Prefer not to say"
gets the adult app - which is the one outcome all of this is built to prevent. The proportionate fix
(and what the Children's Code calls age assurance proportionate to risk) is one extra question: if
they will not give an age, ask whether they are 18 or over. Declining to answer *that* is treated as
under 18.

### 5.3 Strength
- **Offered, not withheld** - there is no minimum age and the benefits are real.
- Prescribed by **rep range and technique, never by %1RM**: 6-15 reps strength, 3-6 power, 1-3 sets,
  2-3 sessions a week on non-consecutive days, progression 5-10%.
- ~~**`loadPercent1RM` capped at the intermediate band (<=80%)**~~ - **SUPERSEDED IN THE BUILD; SEE
  5.8.** A percentage is a share of a one-rep max, so naming one instructs a 14-year-old to go and find
  theirs, which is what both stands forbid outright. Capping the fraction keeps the instruction and
  quibbles about the number. **A youth session carries no `loadPercent1RM` at all.**
- **No 1RM test is ever prompted**, and the estimated-1RM display is withheld under 18 - not because
  the estimate is unsafe (it is derived from submaximal sets) but because putting a one-rep-max number
  in front of a 14-year-old invites them to go and test it, which the NSCA forbids outright.
- **Plyometric contacts reduced** and kept to short, quality sets.
- A **supervision line** that says plainly what the position stands say: this is safe and good for you
  with a coach or an adult who knows the lifts watching, and the app is not that.

### 5.4 Things that are not training at all
- **Strava**: minimum age **13**, so never offered at 12; **no heart-rate upload under 16**; no
  messaging or Instant Workouts under 18.
  ⚠️ **AND WE DO UPLOAD HEART RATE - VERIFIED IN OUR OWN CODE, NOT ASSUMED.** `web/app.ts:8801`
  writes `<gpxtpx:hr>` into every GPX that has readings. So a 14-year-old connecting Strava today
  would upload heart-rate data Strava's own rules say that athlete cannot have. Strip it under 16.
- **RED-S / fuelling**: the existing screen matters *more* for adolescents, and the existing rule - no
  number anybody could eat down to - is even more important. Low-normal BMI is a stated stress-fracture
  risk factor in this population.
- **Ask Alfie** sends a question, a plan summary and recent messages off the device. See section 6.

## 5.5 The architecture this implies - gates, not a second engine

⚠️ **DO NOT FORK THE PLAN GENERATOR.** The engine is 10,800 lines with ~1,700 tests behind it and a
documented history of silent breakage; a parallel youth generator would be a second thing to keep
correct and the divergence would be invisible. The safe shape is the one this repo already uses for
`enforceLongRunIsLongest` - build with the tested engine, then **assert and clamp**:

1. **Restrict the inputs.** `runningDayChoices` already refuses to offer days the plan cannot use;
   the same pattern refuses goals and day-counts the age cannot have. A question whose answer is
   thrown away is worse than no question - this repo's own ruling.
2. **Clamp the outputs as a post-condition** over the built weeks: no single session over the age
   ceiling, no week over twice it. Measured and asserted, not assumed.
3. **Cap the strength prescription** at source in the builder, by rep range rather than %1RM.
4. **Say what is happening and why**, on the screen, in the runner's own terms.

⚠️ **AND THE EXISTING ADULT PLAN MUST COME OUT BYTE-IDENTICAL.** Every gate is gated on an age that
is present and under 18. "Prefer not to say" and every adult age must produce exactly the plan they
produce today, proved by hashing built plans across the profile grid before and after - the same
proof A3 used for `Athlete.strength` being absent.

⚠️ **THE 12-18 vs 12-17 BOUNDARY IS A QUESTION FOR THE OWNER.** He wrote "between the ages of 12-18".
This spec draws the line at **12-17 inclusive**, with 18 getting the adult app, because 18 is majority
in UK law, UKA's own rule permits a marathon at 18, and every World Marathon Major requires 18. If he
meant 18 inclusive, the only change is that an 18-year-old keeps the 22 km recommended ceiling and
loses the marathon goal - one row in the table.

## 5.6 Y2 measured first, and the two obvious levers DO NOT suffice

⚠️ **MEASURED BEFORE DESIGNING ANYTHING**, through the real generator, against the ceilings in 5.1:

| age · goal · track | longest run | weekly | run days |
|---|---|---|---|
| 13 · 5k · beginner | 6.8 km vs **6** ❌ | 12.0 vs **12** ❌ | 3 ✓ |
| 13 · 5k · recreational | 10.0 km vs **6** ❌ | 24.1 vs **12** ❌ | 3 ✓ |
| 15 · 10k · beginner | 11.8 vs 12 ✓ | 20.2 vs 24 ✓ | 4 ✓ |
| 15 · 10k · recreational | 12.0 vs 12 ✓ | 37.1 vs **24** ❌ | 5 ✓ |
| 17 · half · recreational | 22.3 vs 25 ✓ | 48.5 vs 50 ✓ | 5 ✓ |
| 17 · half · competitive | 22.3 vs 25 ✓ | 47.4 vs 50 ✓ | 5 ✓ |

**The caps bind hard at 13-15 and not at all at 17.** Worth knowing: the 17 half fits with 2.7 km and
1.5 km to spare, so the owner's choice of the RULE over the RECOMMENDATION is precisely what makes a
half-marathon plan buildable at 17 at all -- on the recommendation's 12-14 km it would be 8 km over.

⚠⚠ **THE ENGINE HAS TWO LEVERS THAT LOOK LIKE THE ANSWER AND NEITHER IS SUFFICIENT. Check this
before reaching for them.**
1. **`longCapMin = minutesFor(LONG_CAP_KM[...])`** is the exact mirror of what the session cap needs --
   a distance ceiling converted to minutes at the runner's own easy pace -- and folding the youth
   ceiling in there is one line. **This one does work**, and it is the right home for the session cap.
2. **`targetPeakWeeklyKm` + the vScale fit is NOT the answer for the weekly cap, for two separate
   reasons, and both are fatal.** The fit is gated `if (targetPeakKm && !beginner)`, so it **never runs
   for a beginner** -- which is exactly the track the 13-year-old rows above are on. And when it does
   run, a down-scale that breaches the easy floor is **bisected back toward 1**, which would walk a
   youth plan straight back over a ceiling that is a safety limit rather than a preference.

**So Y2 needs a post-condition clamp that cannot be walked back**, applied after the vScale fit AND
after `enforceLongRunIsLongest`, in the shape that function already establishes: rebuild the week
through the SAME `buildOne` closure with an override, never a second assembly path.

⚠️ **AND THE CLAMP MUST SHORTEN IN MINUTES, NOT SCALE A DISTANCE FIELD.** `assemble` derives
`estimatedDistanceMeters` from the steps, so writing a smaller distance onto a session leaves its steps
-- and its duration, and what the runner is actually asked to run -- untouched. That is the
computed-and-discarded trap with a safety limit attached.

⚠️ **THE DAY CAP IS THE EASY ONE AND BELONGS IN `runningDaysFor`**, which is already the single
answer to "what will the plan schedule as runs". Five other reads of the raw `daysPerWeek` are separate
rules and must stay raw -- `test/running-days.test.ts` pins that and will catch a clamp put in the
wrong place.

## 5.7 Y2 as built, and what it measures at

✅ **DONE 2026-09-22.** Four levers, all folded into decisions the engine already makes, none of them
a fork of the generator. Every one is a `Math.min` against a ceiling that is Infinity for an adult, or
a branch gated on a null -- so an absent age changes nothing, which is what makes it safe to ship to
every profile ever stored. **Proved, not asserted: both engine audits are byte-identical before and
after, and a test compares every derived field of an adult plan built with and without an age.**

| lever | what it does |
|---|---|
| `longCapMin`, `beginnerLongPeakMin` | the long run may not exceed what that age may race |
| `longFloorMin` | the adult event floor does **not** apply -- see below |
| the ceiling pass | a shrink-only volume fit against the weekly limit, run after the adult one |
| `runningDaysFor` | the owner's day column |
| `qualitySessionsThisWeek` | one key day a week |
| `allowRacePaceWork` | no goal-pace rehearsal under 15 on the main track |

⚠⚠ **FOUR THINGS WERE MEASURED WRONG FIRST, AND EACH WOULD HAVE SHIPPED A WORSE PLAN.**
1. **A ceiling is not a target.** Returning the weekly limit from `targetPeakWeeklyKm` made things
   worse, not better: that fit aims AT its target in both directions, so a 17-year-old who had stated
   no mileage was scaled UP from a natural 48.5 km peak to 54.8 km. Weeks over the limit went 18 to 42.
   The ceiling now has its own shrink-only pass.
2. **The wrong ruler.** `fittedPeakKm` measures `plannedDistanceMeters`, which excludes warm-ups
   because this engine treats preparation as not-load. Right for a coaching model, wrong for a safety
   ceiling -- weeks that were 38.7 km of actual running reported as inside a 32 km cap. The youth pass
   measures total outing distance.
3. **A floor equal to a ceiling pins the long run.** Capping `LONG_FLOOR_KM` at the youth ceiling
   left a floor EQUAL to it at 15 for a 10k (both 12 km), so the long run could not move and the week
   could not shrink. The adult event floor does not apply to a youth plan at all.
4. **Shortening the quality sessions is the wrong lever; having fewer is the right one.** A tighter
   work budget moved the total by 0.6 km across 81 plans, because a quality session's WORK is already
   small -- the warm-up, recoveries and cool-down are what make it long. One key day a week took a
   16-year-old's worst week from 36.4 km to 32.0.

**Measured over 162 reachable plans (age x goal x track x 3/5/7 days asked x with and without a stated
mileage), race week excluded because UKA's limit is on the race distance and Y1 gates that at the goal:**

| | |
|---|---|
| running days over the cap | **0** |
| long run over the ceiling | **0** |
| any session over the ceiling | 12 (7.4%), worst **+9.3%** |
| any week over the ceiling | 31 (19%), worst **+13.6%** |
| 16- and 17-year-olds | **fully inside both ceilings** |

⚠⚠ **THE TWO RESIDUALS ARE STRUCTURAL AND ARE NOT TUNING PROBLEMS. Do not "fix" them by
loosening a bound.**
- **A 13-year-old on the MAIN track draws a threshold session of 6.6 km against a 6 km ceiling.** The
  library's smallest threshold format is still that big once its warm-up and cool-down are counted.
  The fix is a shorter format in the library, not a cap.
- **A 15-year-old at five running days peaks near 27 km against 24.** The easy runs are already at the
  engine's 20-minute minimum, so the week cannot shrink further without going below that floor or
  dropping a day -- and the day count is the owner's own column. Lowering the floor for youth is a
  real option and is not taken here.
- ⚠️ **And the weekly number is the weakest in this file** (section 3's provenance flag), so a
  residual there is more tolerable than one on the session ceiling, which is UKA's own rule.

⚠️ **THREE DEFENSIVE LINES ARE UNREACHABLE TODAY AND ARE RECORDED AT THE LINE** so nobody
verifies one by deleting it: the beginner long-run cap (the beginner endpoints are already under every
ceiling -- measured 5.0 km at every age 12-15), the `Math.min(1, ...)` in the ceiling pass (the break
above guarantees the ratio is below 1), and the build-phase race-pace arm (two independent gates stop
it). Each was re-broken and watched NOT failing, which is why the code says so rather than claiming a
guard it does not have.

## 5.8 Y3 as built, and the three builders it had to reach

**What a 13-year-old is prescribed now, measured through the real builders** (the adult column is
unchanged and was hashed against HEAD to prove it):

| | adult, build phase | 12-17 |
|---|---|---|
| main lifts | 3 x `3-6 (heavy)` **at 80%+ 1RM** | 2 x `8-12`, **no percentage at all** |
| rest between sets | 150 s (heavy) | 120 s (moderate) |
| pogo hops | 3 x 10 = 30 contacts | 3 x 6 = **18** |
| box jumps | 3 x 5 = 15 contacts | 3 x 5 = 15 |
| sessions a week, asked 4 | 4 | **3** |
| title | "Strength (heavy)" | "Strength & power" |
| supervision line | absent | **on every session, all three paths** |

⚠️⚠️ **THREE BUILDERS CAN PRODUCE A STRENGTH SESSION AND THE FIRST CUT FOLDED THE DATA ON ALL THREE AND
THE WORDS ON ONE.** The legacy no-preferences path, the preference-driven `builtStrengthSession` and a
standalone programme's `programmeSession` each write their own title and description. Measured: a
13-year-old on the preferences path was handed a session titled **"Strength (heavy)"** described as
**"Heavy but controlled (~80%+ 1RM), low reps"** over exercises prescribing 8-12 with no load anywhere
- which reinstates by sentence exactly what removing `loadPercent1RM` took out of the data.
`YOUTH_STRENGTH_TITLE`, `YOUTH_STRENGTH_LEAD` and `YOUTH_STRENGTH_NOTE` are constants for that reason,
and the guard sweeps all three paths rather than the one that is easiest to reach. **Found by running
a probe over the real builders, not by reading the diff.**

⚠️⚠️ **A STANDALONE PROGRAMME IS THE PATH THAT NEVER CALLS `intentFor`, SO IT IS THE ONE A YOUTH COULD
HAVE REACHED A HEAVY BLOCK THROUGH.** A7 works in BLOCKS - technique, loading, heavy - and injects its
own `StrengthIntent`, so the age test that lives in `intentFor` is simply not consulted. An eight-week
programme's third block prescribes 3-6 reps at 85%+. `buildStrength` therefore folds an INJECTED intent
to the band as well, and `ProgrammePrefs` carries the age so the session, the week card and the
overview all get it from one place.

⚠️ **AND THE PROGRAMME'S OWN DESCRIPTION READ THE BLOCK TABLE RATHER THAN THE SESSION.** `plan` came
back as the raw `programmeWeek(...)`, so the card said "3 sets of 3-6 (heavy) at 80%+" over a youth
session containing none of it. `deliveredWeek` corrects all four figures - sets, reps, load and rest -
from what was built. ⚠️ **The main lift is found by SET COUNT, not by carrying a load**, because a
youth session has no percentage anywhere and `find(e => e.loadPercent1RM)` answers undefined for
exactly the runner this matters most for.

⚠️ **THAT IS THE ONLY ADULT-VISIBLE CHANGE IN Y3, AND IT IS A FIX: 40 OF 144 ADULT PROGRAMME
DESCRIPTIONS WERE OVERSTATING THEIR OWN SET COUNT** (a card reading "3 sets" over a session containing
two, measured at HEAD across three levels x four lengths x six weeks x two slots). **0 of 72 generated
PLANS changed.** A7's own note had already recorded this defect for the week CARD and fixed it there;
the session description was left on the table.

⚠️ **NO LOAD FIELD EXISTS, AND ITS ABSENCE IS THE PRESCRIPTION.** Capping the percentage at the
intermediate band (which is what section 5.3 above proposed) was considered and rejected: a percentage
is a share of a one-rep max, so naming one instructs a 14-year-old to go and find theirs, which is what
both position stands forbid outright. The NSCA says what to do instead in as many words - "if 1RM tests
are not performed... establish the repetition range and then by trial and error determine the maximum
load". `YOUTH_LOAD_TEXT` is that, in words a 13-year-old can act on.

⚠️ **THE ESTIMATED 1RM IS WITHHELD AND THE TREND ARROW IS NOT.** The estimate is safe to compute - it
is Epley over submaximal sets - so the direction of travel still shows on the history card and a
new-best toast still names the achievement. What goes is the FIGURE, because a one-rep max on screen is
an invitation to test it.

⚠️ **A YOUTH PROGRAMME STILL PROGRESSES, BY LOAD RATHER THAN BY REP BAND, AND THE BLOCK FOCUS SENTENCES
HAD TO SAY SO.** With every block folded to 8-12, "Heavy and low-rep - the work the evidence is about"
sat over week 9 describing a progression that was not happening. `YOUTH_FOCUS` replaces the three
sentences with the progression that IS happening - the NSCA's own "increase resistance gradually
5-10%". A deload keeps its own sentence at every age.

⚠️ **THE PLYOMETRIC CAP HAS ONE DEFINITION AND THE ENGINE HAS TWO DOSE TABLES.** `PLYO_DOSE` on the
legacy path and the pair inside `plyoFor` carry the same numbers in two places (pre-existing).
`youthPlyoDose` is called by both rather than becoming a third, and the guard compares the two paths'
output rather than reading the source. ⚠️ **Sets are shortened, not dropped**: the NSCA's power table is
1-3 sets of 3-6 reps "to maintain quality of movement", so trimming sets would keep the tired reps and
remove the fresh ones.

⚠️ **THE SESSIONS-A-WEEK CAP IS A WRAPPER, NOT AN EIGHTH CONDITION.** `strengthSessionsFor` has seven
returns; a youth must not reach four through any of them, and the preferences path is the one that
binds (`STRENGTH_MAX_PER_WEEK` is 4). ⚠️ **A programme returns 0 there by design and carries its own
figure**, so the cap is applied again in `progPrefs` where that figure is read.

## 5.9 Y4 as built - Strava's rules, and the age answer under them (2026-09-23)

- **Strava, verified on its own pages:** "Strava allows accounts starting at age 13"; "athletes under 16
  cannot upload heart rate data or receive heart rate analysis" (Help Centre); "at least 13 years old, or
  such higher age as may be required in your jurisdiction" (Terms, effective 1 January 2026).
- **Under 13, no Strava at all; 13-15, runs go without heart rate; 16+ and no answer, unchanged.**
- **Found under it, and more serious:** the app never handed the runner's age to the plan builder, so Y2
  and Y3 were built and tested and reached no real plan. Measured for a 13-year-old: longest session
  11.0-14.2 km, 4-5 runs a week and 51 lifts at a %1RM before; 7.6 km, 3 runs and none after.
- **And "Prefer not to say" was stored as 0 and read as a 12-year-old.** `ageAnswer` is now the one
  definition of an age answer.
- **Residual:** a 13-year-old's hard sessions are 6.4-7.6 km including warm-up and cool-down, against the
  6 km race limit.

## 6. The legal consequence of saying yes - and it is real

⚠️⚠️ **DELIBERATELY SERVING 12-17s MAKES THE APP "LIKELY TO BE ACCESSED BY CHILDREN", SO THE ICO's
AGE APPROPRIATE DESIGN CODE (the Children's Code) APPLIES IN FULL.** Fifteen standards, the best
interests of the child as the primary consideration, **high privacy by default**, data minimisation,
**no nudge techniques**, and a **Data Protection Impact Assessment**. It is not itself law; it is how
the ICO says UK GDPR applies to children, and failing it makes compliance hard to demonstrate.

**The good news is that this app is unusually well placed by architecture**: no accounts, no analytics,
no crash SDK, no advertising, no profiling, and the training data never leaves the phone. Most of the
fifteen standards are satisfied by things already true.

**The work it does create:**
1. A **DPIA** - required, and currently does not exist.
2. **Privacy information a 12-year-old can read** - the Code requires age-appropriate presentation, so
   the D1 policy needs a child-facing version, not just a plain-English adult one.
3. **Ask Alfie** is the one place a child's free text leaves the device. The consent copy must say so
   at a reading age a child has, and the red-flag screener already runs on the phone first.
4. **App Store**: an age rating that no longer says adults-only, and an App Privacy label that matches.
5. **Terms**: under-18s cannot form a binding contract; the terms need a parent/guardian clause.

## 7. What is honestly uncertain

- The **weekly = 2x single session** rule (section 3) is secondary-sourced. Flagged at the constant.
- Every youth **distance** number in existence is opinion by its own authors' admission. We are
  choosing the most conservative current governing-body set, which is the defensible choice, but it is
  a choice and the app should not present it as proven.
- **Chronological age is a poor proxy for maturity** - the 2014 consensus says prescribe on training
  age and competency instead. A 12-year-old past peak height velocity and a 15-year-old before it are
  not comparable. We only have a birthday, so we are using the blunt instrument and should say so.
- Nothing here addresses **para or adaptive** youth athletes.

## 8. Sources

- UK Athletics Rules for Competition TR3 S4, via scottishathletics, *Maximum Race Distances for Young
  Athletes*, March 2026.
- England Athletics, recommended cross-country distances 2026/27.
- Krabak et al., *Youth running consensus statement*, Br J Sports Med 2021;55:305-318 (PMID 33122252).
- Faigenbaum et al., *Youth Resistance Training: Updated Position Statement Paper from the NSCA*,
  J Strength Cond Res 2009 (full text extracted).
- Lloyd, Faigenbaum et al., *Position statement on youth resistance training: the 2014 International
  Consensus*, Br J Sports Med 2014;48:498-505 (PMID 24055781), adapted from the UKSCA statement.
- *Injuries and Training Practices in Competitive Adolescent Distance Runners*, Front Sports Act Living
  2021 (PMC8264289).
- Road Runners Club of America, FUNdamentals of Youth Running. American Academy of Pediatrics.
  Nationwide Children's Hospital sports medicine guidance.
- ICO, *Age appropriate design: a code of practice for online services*.
- Strava Terms of Service (effective 1 January 2026) and Help Centre article "Can I use Strava if I'm
  under the age of 16?" (minimum age 13; under-16 heart-rate restriction) - both re-read 2026-09-23.
