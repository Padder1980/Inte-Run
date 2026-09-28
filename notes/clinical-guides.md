# Clinical guides — injury, fuelling, safety screening, Support tools

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> ⚠️ Clinical wording is reviewed by the owner's clinician. A change of MEANING must be flagged to the owner, never made silently.

## THE INJURY CHECK-IN BECAME A GUIDE (commissioned brief, 2026-08-10)

`Support › Private check-ins › Injury & symptoms` was a consent line and ten tick-boxes, which answered
"is this worth mentioning to somebody?" and nothing else. It is now a chronological guide to a NEW,
CLOSED lower-limb sprain, strain or bruise, after screening for the things that must not be
self-managed. **✅ THE PRE-PRICE WORDING WAS REVIEWED AND APPROVED** — the owner confirmed on 2026-08-10
that it had been through clinical review and was cleared to ship.
⚠️ **THE PRICE REWRITE LATER THE SAME DAY IS NEWER THAN THAT SIGN-OFF, AND HAS NOT ITSELF BEEN SIGNED
OFF.** It came from the updated brief's own "Clinical re-audit: 10 August 2026 — reconciled with current
NHS and British Red Cross PRICE/RICE guidance", so it is not an unsourced change — but that same brief
re-asserts in §1 that the page "requires a final review by a UK-registered sports physiotherapist or
sports-medicine clinician before release". Do not let the earlier ✅ be read as covering the PRICE copy.
Flagged to the owner rather than quietly inherited, because he explicitly asked for any change to the
clinical wording or thresholds to be flagged for review. ⚠️ **THE APPROVAL IS OF THE WORDING AS IT STANDS AND DOES
NOT TRAVEL WITH A REWRITE.** Change what a sentence claims — not how it is phrased — and it needs
re-reviewing. `test/soft-tissue-guide.test.ts` is the line between the two: a failure there is a change of
clinical meaning, and it is the signal to go back rather than to relax the assertion.

The product position, and every decision follows from it:
> Use PRICE for first aid. Then keep it gently moving, and rebuild load before speed.

(It is on the page, in a band under the hero. It replaced *"Protect it briefly. Keep it gently moving.
Rebuild load before you rebuild speed."* when PRICE became the named opening framework.)

⚠️ **THE `redflags` ID, ROUTE, HEART ICON AND HUB POSITION ARE UNCHANGED — an explicit constraint.** The
brief asked for a replacement, not a new destination: a second card splits one question across two
places, each of which then looks like the whole answer. The card dropped `interactive: true` (which
renders a "CHECK-IN" chip) because the form is gone.

⚠️ **`kw` ON A HUB CARD IS SEARCH-ONLY, and it is what makes the page findable.** `supportSearch` indexes
a card on title + description, and the agreed description contains none of the words a hurt runner types
— "twisted ankle", "pulled muscle", "ice". Putting them in the visible description turns a calm card into
a keyword list, so they live in an invisible field. A card added without one is effectively unsearchable.

### The clinical rules, which are the whole feature

⚠️ **PRICE IS THE OPENING FRAMEWORK — AND THIS REVERSES THE RULE THIS FILE CARRIED FOR ONE DAY.** The
first version of the page BANNED the acronym and `test/soft-tissue-guide.test.ts` forbade RICE, PRICE,
POLICE and PEACE & LOVE outright, on the reasoning that an acronym reads as a protocol with uniform
evidence behind it. **That was wrong on the guidance, and the owner corrected it on 2026-08-10:** *"ignore
any earlier instruction saying not to use RICE or PRICE. Current NHS guidance recommends PRICE for the
first two to three days, so PRICE must be clearly presented as the opening first-aid framework."* NHS
"Sprains and strains" (reviewed April 2024) recommends PRICE, Cambridge University Hospitals publishes
PRICE instructions, and the British Red Cross still teaches RICE. An acronym a runner has already met is a
memory aid, not a claim.

⚠️ **WHAT THE BAN WAS PROTECTING SURVIVES INTACT, AND THAT IS THE POINT OF HOW IT WAS REPLACED.** The
assertion was not deleted, it was inverted and made specific — `stiPrice()` must name and explain every
letter; **R must say "Not complete immobility"** in the block AND be corrected again in the
what-not-to-do list; and the block must state that **none of ice, compression or elevation has been shown
to speed up tissue repair**, inside the block rather than further down the page, because naming a
framework the NHS recommends is the moment the page is most likely to be read as blanket endorsement.
Deleting the assertion would have been the lazy fix for a failing test.
⚠️ "Relative rest" is still used and still **defined in the same breath**, because a runner meeting the
phrase cold reads it as "rest".

⚠️ **EVERY ICE NUMBER IS A CLINICAL THRESHOLD, NOT ROUNDED-OFF COPY.** Wrapped, **10–15 minutes** per
application, **never longer than 20**, **at least two hours** between, and only while it helps pain or
swelling. Guarded individually, and the cap and the gap must appear where a runner acts on them (the PRICE
block and the first-24-hours stage) rather than only in the safety note.

⚠️ **AND GENTLE MOVEMENT IS NOT GATED ON 72 HOURS — the most likely misreading of a PRICE-led page.**
Naming a "first two to three days" framework invites somebody to hold still until it is over, and the
guidance says the opposite: protect briefly, then move within comfort. The first-24-hours stage says *"You
do not have to wait 72 hours to start moving"* in as many words, and from 24–72 hours ice, compression and
elevation become explicitly optional while **movement is the important progression**. Both guarded.

⚠️ **A "Why this advice?" DRAWER EXISTS TO SAY WHERE THE EVIDENCE IS WEAK**, not to look authoritative. It
names the disagreement out loud: UK first-aid guidance recommends PRICE, and the recent human evidence for
the ice/compression/elevation part of it is weak or indirect. A drawer that only listed sources would lend
borrowed authority to exactly the claims the copy deliberately hedges.

⚠️ **ICE IS OFFERED, AND IT IS A COMFORT MEASURE RATHER THAN A TREATMENT — both halves ship together.**
The guide states plainly that cooling **"has not been shown to speed healing"**; heat and massage are "not
a proven cure". Consumer advice is far more confident about this than the trials justify, so
`test/soft-tissue-guide.test.ts` sweeps for any healing-speed claim and requires a negation within 70
characters of it.

⚠️ **NO DOSE, NO BRAND, NO PRESCRIPTION-STRENGTH DRUG.** Paracetamol and topical anti-inflammatories are
named (following NHS advice) and only ever beside the caveat that they **do not make the injury safe to
run on** and **do not speed up tissue repair**, plus who must ask a pharmacist first: under 16, pregnant,
on blood thinners, past stomach ulcer, kidney or heart disease, or asthma that anti-inflammatories set
off. That list is the part a runner is least likely to know and most likely to be harmed by.

⚠️ **RETURN TO RUNNING IS GATED ON FUNCTION, NEVER ON A DATE.** "Do not run because seven or fourteen
days have passed"; two weeks is "a review point, not automatic clearance". Six gates: walking and stairs
without a limp, swelling not returning after a normal day, range close to the other side, controlled
strength without sharp pain, ten gentle two-footed hops, and **the same or better the next morning** —
which is the honest gate, and the one "pain-free" alone always misses.

⚠️ **THE STOP SCREEN IS ALWAYS VISIBLE, NOT COLLAPSIBLE, AND NEVER LINKS OUT.** Hiding danger signs
behind a tap is how somebody with a cold, blue foot reads a recovery timeline instead. The wireframe
offered a "Check my symptoms ›" button and it was deliberately not built — the brief forbids sending a
worried runner to a second symptom screen.

⚠️ **THE ENGINE TRIAGES; IT NEVER DIAGNOSES.** Eight acute-limb flags were added to
`src/safety/escalation.ts` — three emergency (visible deformity or a crack, a cold/blue/numb limb,
severe constant pain with tense swelling) and five urgent (cannot bear weight for four steps, rapid
swelling or bruising, a pop with loss of push-off, a hot swollen one-sided calf, an open wound or fever).
No flag or guidance string may name a fracture, rupture, clot, compartment syndrome or injury grade, and
`test/acute-limb-flags.test.ts` sweeps both the output AND the source for those words.

⚠️ **ONE ESCALATING PAIR, BECAUSE IT IS THE PAIRING THAT KILLS PEOPLE.** A newly swollen warm calf is
same-day on its own; the same calf **plus chest pain, severe breathlessness or collapse** is now.
`ESCALATING_PAIRS` is applied **before** the sort and before the overall urgency, so the headline
reflects it. ⚠️ Assert it on the CALF ROW, not on the overall urgency — chest pain is an emergency by
itself, so `urgency === "emergency"` for the pair passes whether the rule fires or not. Pinned that way
it was a test that could not fail.

⚠️ **THREE PLACES CONTRADICTED THIS, NOT TWO.** The brief found two "usually fine to run through"
strings; a third said "soreness that eases as you warm up is usually fine" — the same claim in other
words, and all three contradicted `src/adapt/injury.ts`, which treats pain while running as a stop
signal. All three now carry one agreed sentence and a test asserts the count is exactly **3**.

### ⚠️ A CATEGORY COLOUR USED AS TEXT IS TEXT, AND NOTHING WAS CHECKING IT

`test/contrast.test.ts` swept the four **ink** tokens on the three neutral grounds — where body copy
lives — so it never looked at this page's pattern: a small uppercase label in `--rest` or `--ease` on a
panel tinted 8% with that same colour. Measured, both in **LIGHT** mode:

| label | measured | fixed to |
|---|---|---|
| **URGENT** band title (`--ease`) | **2.41:1** | 4.86:1 |
| **EMERGENCY** band title (`--rest`) | **4.31:1** | 5.61:1 |

Dark mode passed both — the same trap the accent fix already taught that file, because the design brief
reviewed dark screenshots. The fix is `color-mix(in srgb, var(--X) N%, var(--ink))`, which darkens in
light and lightens in dark from one declaration. These are the two **safety** labels, i.e. the first
thing a frightened runner reads.

⚠️ **MEASURE CONTRAST FROM RENDERED PIXELS, NEVER FROM `getComputedStyle`.** Chromium leaves
`color-mix()` unresolved and reports tinted backgrounds as `oklab(0.9569 …)`; parsing that as rgb
reported a **1.25:1** on a pairing that is really 14.56:1, which would have sent me chasing a defect that
did not exist while the real ones sat in the same table. Paint a probe div and read the screenshot.

### Still open on this route — read before the injury update

⚠️ **REMOVING THE WELLBEING TICK-BOXES REMOVED THE ONLY TICKABLE ROUTE TO A CRISIS ESCALATION.**
`FLAGS_WELL` (self-harm, eating-disorder concern, mental-health concern, menstrual disruption) is still
DEFINED and still reachable through Ask Alfie's text screener, and a test keeps it resolving — but it now
requires typing rather than ticking. That is a reduction in disclosure routes and it is the owner's
decision, not a tidy-up.

⚠️ **THE EIGHT NEW ACUTE-LIMB FLAGS ARE UNREACHABLE FROM THE UI.** They are defined, tested and
exercised by the engine, and nothing renders them — `FLAGS_PHYS`/`FLAGS_WELL` are no longer rendered
either, and no phrase matcher was added to `alfieRedFlags` for the new ids. This is the documented
computed-and-discarded trap (`CLASS`, `MASTERS`, `PLAN.notes`), caught by an adversarial pre-push review
rather than by a test, because a test that only calls the engine cannot see that nothing calls it.

⚠️ **TWO PLACES STILL PROMISE "A PROPER SYMPTOM CHECKER"** at this route, and both `Check a symptom ›`
buttons now land on a leg-injury guide: Alfie's injury answer, and the `perf-a` button on the Performance
and Support screens. Reword or repoint them with the injury update.

⚠️ **`runRf()` AND ITS `[data-chk="rf"]` BINDING ARE NOW DEAD CODE**, and `runRf` reads `$("rfRes")`
unguarded. Left deliberately rather than deleted on my own initiative. It does not trip the
`$("id")-must-resolve` guard because `renderResult("rfRes", …)` passes the id as a plain string.

## THE FUELLING CHECK-IN BECAME A GUIDE (commissioned brief, 2026-08-10)

`Support › Private check-ins › Fuelling & energy` was a consent line and eight tick-boxes. It is now a
food-first guide to fuelling, fluids and recovery, with the under-fuelling checklist as one collapsed
section inside it. Same `reds` id, route, orange drop and hub position; `interactive: false` drops the
"CHECK-IN" chip. **✅ CLINICALLY REVIEWED AND APPROVED — the owner confirmed on 2026-08-10 that the
nutritional wording has been through review and is cleared to ship**, with the same standing condition as
the injury guide: the approval covers the wording as it stands, and a change of meaning needs re-reviewing.
`kw` on the hub card is search-only, exactly as on the injury card.

> Eat enough every day. Add fuel as the work gets longer or harder. Practise race day before race day.

⚠️ **IT IS NOT A CALORIE TRACKER, A DIET PLAN OR A PERFECT PLATE, and it must never become one.** This
page shares a route with a low-energy-availability screen, so a number a runner could eat down to is not
a feature here, it is a hazard. Nothing is stored, nothing is weighed, nothing is scored. The brief's
optional sweat-rate tool ships as a **written method, not a form** — five weight fields one section above
a RED-S screen is not a trade worth making, and the page says the app keeps none of it.

### §16 reconciled FOUR claims that were WRONG, not just old

The app already had fuelling copy in four other places and it disagreed with the evidence. All were
corrected together, because a runner meets whichever one they open first.

1. ⚠️ **"Include sodium rather than plain water" NAMED THE WRONG DANGER, and it is the one sentence in
   this area that could genuinely harm somebody.** Hyponatraemia is driven by drinking **beyond your
   losses**, and a sports drink can be over-consumed exactly as water can — so contrasting sodium *with*
   water implies the sodium is the protection. It is not. Volume is the risk. Every mention now carries
   "does not make excess fluid safe" in the same breath, and `test/fuelling-guide.test.ts` sweeps **five
   scopes** requiring the caveat beside every occurrence of the word.
2. ⚠️ **The single-sugar story for gel stomach-ache was a one-cause explanation**, so a runner who
   switched to mixed sugars and still felt sick had nothing left to change. Absorption above ~60 g/h is
   the true part; the symptoms are multifactorial.
3. ⚠️ **The 70–90 g/h marathon rehearsal floor is gone; it is the public 60–90 band.** Lifting the bottom
   made an **unpractised** rate the default on every qualifying long run, three lines above the same
   card's "start at the bottom and build". The rehearsal changes the **products and timings** now, not the
   numbers. `120 g/h` is never prescribed and a sweep of 1,800 session shapes asserts it — it comes from
   one crossover trial in **eight elite men** which found the worst peak nausea of the three rates tested.
4. ⚠️ **"Taking gels adds nothing" was an absolute the evidence does not support**, and **every gel count
   now says "check the label; products vary"** — `GEL_GRAMS` is 22 against real products of 20–30 g, so
   somebody counting four gels for a 90 g hour is a third short on the day it matters most.

⚠️ **THE COPY NAMES 75 MINUTES BECAUSE `NO_FUEL_BELOW_MIN` IS 75.** The brief's ladder was 60–90 /
90–150, which is the better consumer synthesis in the abstract and disagrees with this app: measured on
one real half-marathon plan, **six long runs land in the 75–89 minute window** and every one renders a
card reading "Fuel this one: 30–60 g of carbs an hour" — so the ladder said "optional" for a run the
session card prescribes for, and the session card is the surface a runner meets first. The rungs are the
engine's boundaries, and a test derives the ladder's threshold and asserts it equals the constant.
Lowering the constant to 60 was considered and rejected: it would *prescribe* to a 65-minute run.

⚠️ **FOUR OF THE TWELVE `RedSIndicator` VALUES HAD NO CHECKBOX** — preoccupation with food, libido, poor
recovery, gut discomfort — so `screenRedS` was **structurally unable to see them**. A runner could tick
everything on screen and still not describe what was happening to them. A test compares the rendered
options against the union and fails on drift.

⚠️ **AND GIVING FOOD PREOCCUPATION A CHECKBOX CREATED A SAFETY DEFECT THAT HAD TO BE FIXED WITH IT.** It
was not in the engine's `STRONG` set, so a runner whose only disclosure was distress about food, exercise
or weight scored 1, came back `risk: "low"` with an **empty refer list**, and was told nothing here points
to a problem — while the app's own `escalation.ts` grades the same disclosure `professional` and refers to
a GP, a dietitian and a psychologist. **The same sentence cannot mean "see three professionals" on one
screen and "nothing to worry about" on another.** It is STRONG now and refers to gp + dietitian +
psychologist. Found by an adversarial pre-push review, not by a test.

⚠️ **"RISK: HIGH" IS GONE AS A HEADLINE** — a verdict the app is not entitled to give, and the first thing
the eye lands on. The band carries the engine's own message; a **low result says it cannot rule
under-fuelling out** and names what would change the answer. ⚠️ Guard the INVARIANT ("the band carries
`r.message`"), not the absence of one spelling: pinned as `!/"Risk: " \+/`, both `'Risk: ' + r.risk` and
`"Risk level: " + r.risk` slipped past. `estimateEnergyAvailability()` stays in the engine and **out of
the UI**: three imprecise inputs divided into each other produce false precision, the 2023 IOC consensus
says the thresholds are not diagnostic cut-offs, and a number on screen becomes a number to eat down to.

⚠️ **THE RESULT MUST NOT RENDER BEFORE ANYTHING IS TICKED.** The element exists from first render inside
the collapsed section, so `if ($("redsRes")) runReds()` printed "nothing here strongly points to
under-fuelling" to somebody who had answered nothing.

⚠️ **THE CONSENT GUARD STOPPED BEING A LIST OF VIEW NAMES.** The checklist moved into `fgEnergyCheck`
(consent belongs beside the question, not at the top of a long page), so `silent-defects` now **discovers**
every builder that renders inputs and requires consent in the same function. A hand-written list goes
stale the first time somebody adds a screener, and the failure mode is silence.

⚠️ **A FIFTH AND SIXTH SITE WERE MISSED BY THE FIRST PASS and found by review.** `docs/roadmap/index.html`
— the owner's own installed page — still stated both reversed claims, and `src/environment/weather.ts`
told every runner on a hot quality session to "hydrate beforehand with electrolytes", which the guide
rules out twice over (arrive normally hydrated; no salt "just in case"). The sodium sweep could not see it
because it enumerates fixed scopes and matches `/sodium/`, and that line says "electrolytes".

### Traps this work paid for again

⚠️ **The backtick rule fired once more** — `` `screenRedS` `` in a runtime-JS comment. The build failed
outright, which is the good outcome.

⚠️ **A GUARD MUST STRIP COMMENTS FROM ITS SCOPE, AND BOTH DIRECTIONS BITE.** The familiar half: comments
here quote the phrases they forbid, so the sodium guard reported the engine's own
warning-about-the-old-wording *as* the old wording. The half that matters more is the **reverse** — the
guide's file header restates the product message, so a test asserting the page says "eat enough every day"
could be satisfied by a comment while the markup said nothing.

⚠️ **A CHARACTER WINDOW IS NOT A CARD, AND THIS FIRED THREE TIMES IN ONE FEATURE.** "Every rate is paired
with practice" passed with the practice clause deliberately deleted, because the card *below* said
"practise" within the window; the ladder-threshold check reached into the next rung and reported the
ladder prescribing at 60; and the injury file's gate sweep searched the whole guide, where a decoy
"controlled strength" in the timeline kept it green with the real gate deleted. Scope to the thing the
runner opens.

⚠️ **A `/* … */` SWEEP OVER THE APP SCRIPT HAS A 10 KB BLIND WINDOW.** `accept="image/*"` in the profile
setup markup is an unbalanced comment opener mid-line, so the regex opened there and closed at the next
real terminator, deleting **10,382 characters of live code** — and a guard with a ten-kilobyte blind spot
reports clean for anything hiding in it. Anchor block comments to the start of a line, and assert a
**landmark from inside the old window** (`id="s_easypace"`) rather than a total-length threshold: this file
is 276 KB of legitimate comments, so any ceiling loose enough to pass is far too loose to catch the bite.

⚠️ **`fnSrc()` in `silent-defects.test.ts` CANNOT BE USED FOR A SWEEP over every function name** — its
window assertion is correct and deliberate, but several functions are followed by tens of thousands of
characters before the next top-level `function`. `fnBody()` is the non-asserting variant for scans.

⚠️ **THE SWEEP THAT FINDS A CLASS OF DEFECT MUST BE DERIVED, NOT LISTED.** Hand-written lists of flag ids,
screener names and colour declarations each passed while missing a real case; and a `includes()` check on
a declaration used **twice** let one of the pair revert to the raw token undetected. Count, or derive.

⚠️ **Nine deliberate regressions were watched failing before any guard was believed, and three did not
fail on the first attempt** — the window above, a 120 g/h break that tripped a different test first, and a
`git checkout` during the re-break that silently discarded the injury work's flags. Re-break, then check
the suite is green again before trusting the next measurement.

⚠️ **Native `<details name="…">` gives an accordion with no JS and no animation.** Measured: 25 cards
force-opened, 9 stay open — one per group, which is intended. The anchor jump moves **focus** as well as
pixels (`.focus({ preventScroll: true })` on a `tabindex="-1"` heading) or a keyboard user reads nothing,
and Reduce Motion turns the animation off but keeps the jump.

⚠️ **`web/voices/` IS STALE ON THIS MAC — 4 coaches against `docs/voices/`'s 10** (measured 2026-08-10).
So the documented clobber is not hypothetical here: every `node web/app.ts` overwrites the committed audio,
and `git checkout -- docs/voices/` after each build is mandatory, not cautionary.

## SUPPORT › TOOLS, AND THREE NEW PAGES (2026-08-15)

`HUB_TOOLS` is a third hub group beside `HUB_CHECKINS` and `HUB_LEARN`, holding **Training zones**,
**Pace calculator** and **Measurements**. See the corrected note above about ungrouped cards before
adding a fourth.

**Training zones** exists because ⚠️ **`profile.maxHr` was READ IN SIX PLACES AND WRITTEN IN NONE.**
`maxHrEstimate()` has always preferred a measured ceiling over Tanaka's `208 − 0.7 × age`, and the
zones panel on every run told the runner to "add your measured max heart rate in your profile" — a
field that existed nowhere. The owner was offered `220 − age` (his ask) and kept Tanaka.
- ⚠️ **`maxHr` is deliberately NOT in `DEFAULT_PROFILE`** — the `weeklyVolumeKm` lesson. A default in
  every stored profile is an answer nobody gave, and this one governs the wrist's zone colours and
  the coach's 92% safety cue.
- ⚠️ **Saving calls `syncWatch()`**, or the two halves of one product judge the same heartbeat
  differently — the split `maxHrEstimate()` was written to end.
- ⚠️ **Out of range is REFUSED, not clamped.** A typo of 1740 silently becoming 230 is a ceiling the
  runner never chose. Clearing the field deletes the key rather than storing 0.
- The page says WHICH of the two it is showing: a zone table with no provenance reads as a
  measurement when for almost everybody it is arithmetic on a date of birth.

**Pace calculator** — distance, time and pace, any two giving the third, in km or miles.
⚠️ **A PACE TARGET IS FLOORED, NEVER ROUNDED, AND THAT IS CORRECTNESS, NOT FORMATTING.** A half
marathon in 1:45 needs 298.6 s/km; rounded to 4:59 and held exactly it finishes in **1:45:08**, so the
calculator would hand back a pace that misses the time it was asked for. Over a marathon the same
half-second is 21 seconds. ⚠️ The miles option does **not** reopen the units decision — nothing here is
stored, read by the engine or shown elsewhere, and a test asserts it cannot touch `localStorage` or
the profile.

**Measurements** — °C/°F only, stored as `interun_units_v1` following the `interun_theme_v1`
precedent rather than the profile.
⚠️ **EVERYTHING STAYS CELSIUS INTERNALLY.** The forecast is fetched in Celsius, every threshold in
`weather.ts` is Celsius (18/23/28/33), and the warm-up shortens itself above 24 °C. `fmtTemp`
converts at the moment of display and nowhere else; a test runs the engine under both settings and
asserts identical severity, penalty and advice.
⚠️ **`fmtTemp` ROUNDS ONCE, AFTER CONVERTING.** Rounding the Celsius first shows 54 °F for 12.4 °C and
55 °F for 12.5 °C — a whole degree invented by the order of operations.
⚠️ **This fixed the documented duplicate temperature too, and they were one fault.** The sheet read
`12° · Mild · 12°C, wind 14 km/h` because the engine's `summary` bakes the temperature AND its unit
into prose. `assessConditions` now also returns **`tempWord`** (unit-free) and the app composes its
own line. `summary` is kept and documented as **deliberately unrendered** — do not "tidy" the app back
onto it.
⚠️ **DISTANCE IS STILL METRIC, and the page carries NO explanation of why** (owner, 2026-08-15). The
first version printed two paragraphs justifying the scope on a screen somebody opened to press one
button. The constraint is real — ~105 render sites, ~150 stored `distKm` references and two 1000 m
split algorithms — and it belongs here, not there.

## Fuelling, on the session (added 2026-08-02, from elite-coach feedback)

"Carbohydrate per hour, roughly how often that is a gel, and practising it in training." The app had
a flat 30–60 g/h in one Support article and one assistant answer, and **never mentioned it when the
runner was about to run for two hours** — the coach's actual complaint. `src/science/fuelling.ts`
computes the dose from THIS session and `fuelHtml` renders it in the session sheet.

⚠️ **THIS IS THE ONE AREA WITH NO BACKING FROM THE COMMISSIONED EVIDENCE REPORT.** That report scopes
itself to training prescription — **zero** occurrences of carbohydrate, fuel, gel, glycogen or
hydration in its prose (verified, not assumed). The numbers come from ordinary sports-nutrition
consensus plus the elite coach's 70–90 g/h for the marathon. Never describe this module as
report-backed; that distinction is the difference between a claim we can defend and one we cannot.

Tiers: **< 75 min** none (with a line saying so — silence is not the same as "no"); **75–150 min**
30–60 g/h; **≥ 150 min** 60–90 g/h; **≥ 150 min + goal-race-pace work + half/marathon** is the
rehearsal, and a marathon one takes the coach's **70–90 g/h**.

⚠️ **The upper tier and the mixed-sugar note are ONE decision.** The gut tops out near 60 g/h on
glucose alone; past it needs glucose *and* fructose. Printing "90 g/h" without "mixed" tells the
runner to make themselves ill, so the tier never ships without the explanation.

⚠️ **A rehearsal has to be long enough to be one.** Gating on race-pace work alone called a
113-minute progressive a dress rehearsal and jumped it from 30–60 straight to 70–90 g/h. It must
already be in the long tier.

⚠️ **"Gels' worth", never "gels".** At 90 g/h a three-hour run is eleven gels — nobody takes eleven
gels, and the number reads as absurd and gets dismissed. The copy says drink and chews count towards
it and that most people split it.

⚠️ **THE FRAMING IS ALWAYS "EAT ENOUGH", NEVER "EAT LESS", and a test enforces it.** This module sits
beside a RED-S screen whose guidance is "under-eating is not the answer here — if anything you
likely need more fuel". `test/fuelling.test.ts` fails on calorie, weight, deficit, burn-off or
lose-weight language anywhere in the generated copy. No exceptions, whatever the request.

The race-pace detection in `fuelHtml` is the same **content** test `buildWeek` uses for key days
(a 10+ minute step at RPE 4+), never the session title.

Not done: the watch shows no fuelling text — it would need new payload keys, and the phone is where
you read a plan. Say so rather than half-doing it.

## ✅ D3c — THE WELLBEING CHECK-IN, UK CRISIS LINES, AND ALFIE LEARNS THE EIGHT LIMB SIGNS (owner, 2026-09-28)

The stage PLAN.md calls D3c and the Road Map calls `pc-wellbeing`. Suite 1813 → **1823**;
`test/wellbeing-checkin.test.ts` holds 10 guards and **26 deliberate re-breaks were all caught**, each on a
copy restored byte-identical. ⚠️ **ALL NEW WORDING HERE AWAITS THE CLINICAL REVIEW** — the card, the lead,
the crisis block, the Safety page sentence, and every phrase Alfie now matches. The engine's own guidance
strings are unchanged.

### The owner's rulings, one question at a time

1. **Show UK crisis numbers** when self-harm or struggling mentally is ticked (the check-in) or typed
   (Ask Alfie), never as a default on every screen (`CRISIS_FLAGS`).
2. **Teach Ask Alfie the eight acute-limb signs** the injury guide lists as text.

### ⚠️⚠️ WHAT IT FOUND

1. ⚠️⚠️ **THE APP NAMED NO CRISIS LINE ANYWHERE.** The engine's guidance for self-harm says "please contact
   an urgent crisis line" and `PROFESSIONAL_LABEL` says "an urgent crisis-support line" — and nothing gave a
   number. APPSTORE.md's age-rating answer even said Alfie answers "with crisis contacts". `CRISIS_LINES`:
   Samaritans 116 123, Shout (text SHOUT to 85258), Childline 0800 1111 (under 19), NHS 111 (mental health
   option), and 999 if a life is at risk — **every one read on the service's own page on 28 Sept 2026**
   (the NHS's "Where to get urgent help for mental health", Samaritans' contact page, Shout's get-help
   page; Childline's own site refused the fetch, so its number and age come from the NHS page). The test
   pins them as typed values ON PURPOSE, with that provenance: they are outside facts.
2. ⚠️⚠️ **A PHONE NUMBER LINK WOULD HAVE DONE NOTHING IN THE iPHONE APP.** `WebHost` opens a tapped link
   only when `canOpenURL` agrees, which it never does for a scheme missing from `LSApplicationQueriesSchemes`
   — `tel` was not there (nor `mailto`, found at D1). Added, with a capability flag in the same build,
   `window.__interunLinkSchemes = "tel,sms,mailto"`; the page reads it through `appCanOpen(scheme)` and
   renders a number as a link only where a tap can dial. **The number is always printed as text.** D1's
   email links use the same rule now (`mailLink`). ⚠️ Both need an Xcode build to become tappable in the app.
3. ⚠️⚠️ **THE CHECK-IN RESULT HEADLINE WAS UNREADABLE IN DARK MODE — THE EMERGENCY ONE AT 2.93:1.**
   `.result .rb` is white on the plain urgency colour. Measured from rendered pixels (canvas-resolved, since
   Chromium reports `color-mix` unresolved): light 2.75–5.11:1, dark 2.29–3.13:1 — so it had failed on the
   fuelling and women's health results all along. One declaration fixes both themes:
   `color-mix(in srgb, var(--rbc) 65%, #000)` → **light 5.81–9.33:1, dark 5.02–6.47:1**. The guard computes
   it from the page's own theme values and the mix, both themes, every urgency colour.
4. **Ask Alfie pointed at "Support → When to stop and seek help", a page that has never existed.** It now
   names the page that fits what was typed, read off the engine's own categories: psychological or hormonal
   → Support → Wellbeing; musculoskeletal → Injury & symptoms; anything else → Safety, privacy & human help.
5. **The two "symptom checker" promises** (Alfie's limits panel and the Safety page's "Check a symptom ›",
   both landing on the leg-injury guide) are now two doors each named for where it goes.

### What shipped

- **Support › Private check-ins › Wellbeing** (`wellbeingView`, second in `HUB_CHECKINS`, with the Check-in
  badge): the emergency route, `checkinConsent()`, the four `FLAGS_WELL` tick-boxes in group `WB_CHK = "wb"`
  (⚠️ never `rf`: `wire()` binds that name to the dead `runRf`), and `runWb()` → `screenRedFlags` →
  `renderResult`, which now takes an `under` argument so the crisis lines sit straight beneath the headline.
  ⚠️ `runWb` filters to `FLAGS_WELL`'s own keys, because `screenRedFlags` throws on an unknown id and this
  runs from an `onchange` (re-broken: the throw is a TypeError). Nothing is kept or sent; the guard checks
  the function writes nowhere.
- **Eight new `ALFIE_FLAGS` entries**, one per acute-limb flag, each phrased as what the runner OBSERVES.
  ⚠️ **THE NEGATIVE LIST IS THE OTHER HALF OF THE GUARD**: ten ordinary questions ("My last interval was
  excruciating", "Is it ok to run with a fever?", "My toes get cold on winter runs", "My knee clicks when I
  squat", "I can't walk properly after my long run" …) must stay unflagged. That is why excruciating,
  agonising, a bare fever, cold toes and "can't walk" are NOT phrases — an emergency answer to a harmless
  question teaches runners to stop asking. Re-broken by putting "fever" and "excruciating" back.
- ⚠️ **NO APOSTROPHES OR QUOTE MARKS IN COMMENTS INSIDE `ALFIE_FLAGS`.** The tests lift it with a
  quote-aware extractor, and one unpaired `'` in a comment ran it past the end of the array — six unrelated
  Alfie tests failed with "Identifier ALFIE_THINKING has already been declared". Said inside the array now.
- `test/silent-defects.test.ts`'s emergency-route guard now DERIVES the check-in pages from `HUB_CHECKINS`
  and `supportDetail` (it listed three by name, so a fourth would have been exempt without anybody deciding).
- The privacy policy's list of check-ins that keep nothing names Wellbeing; APPSTORE.md's "Mature or
  Suggestive Themes" answer names the check-in and the crisis lines.
- ⚠️ **The crisis block was first written in raw px sizes (14, 13.5, 12.5, 16) and `npm run verify` failed on
  `design-system.test.ts`'s off-ladder ratchet** — the quick loop had not run that file. Sizes are
  `var(--t-*)` now (body 15, card 17, meta 13); run the design-system test after any CSS you add.

### Still open

- **The clinical review of all of the above** — and particularly the limb phrases, which trade missed
  warnings against false alarms in a way only a clinician should settle.
- **An Xcode build** for `tel`/`mailto` and the capability flag.
- Childline's own page refused an automated fetch; its number was confirmed on the NHS page instead.
- `runRf()` and its `[data-chk="rf"]` binding are still dead code, left as they were.
