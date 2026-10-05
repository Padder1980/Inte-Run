# Briefings and insights — B10 (rule-based, offline) and the ground B11 builds on

> Part of Inte-Run's project notes. Started 2026-10-05 with stage B10. The rules that apply to every task stay in
> `CLAUDE.md`; this file keeps the history, measurements and traps for one area. **Add new findings for this area at
> the END of this file**, dated, in the same style.

## ✅ B10 — BRIEFINGS AND INSIGHTS FROM FACT PACKS, RULE-BASED, FREE AND OFFLINE (built 2026-10-05)

PLAN.md B10: "`briefingFacts(sess, iso)` from existing sources only … `briefingText(facts)` templates like
`debriefParagraphs`; card in the session sheet for sessions ≤ tomorrow. `insightFacts(run)` … thumbs `run.react` saved
via `saveRuns()`; insight renders after the reaction. Cache `interun_brief_v1`, pruned in `seedDone`. Guards: every
number in the text is in the fact pack; no second derivation; no plan-changing call reachable from the card;
medical-claim sweep." Runna's reference: Workout Briefings (focus, last-workout insight, weather, nutrition, context)
and Workout Insights (post-run, unlocked by thumbs up/down, not for strength).

**What the runner gets:**
- **Your briefing** on a run's sheet, today or tomorrow only (`briefingCardHtml`, after the chips and above the heat
  note — the heat note must stay directly above the steps it explains). Not for strength, mobility, rest or
  cross-training (`PRIMARY_TYPES`). In order: when, what it is and its length, and what it is for (`WHY_SHORT`); the
  work — "The main set: 10 × 1′ at 4:48–5:02/km, with 1′ easy jog between", or for a steady run "Keep it at
  6:02–6:25/km, RPE 3–4"; the week ("It is week 4 of 13, an easier week"); last time ("Last time, on 28 Sep, your
  debrief said: Quicker than the brief. You rated it 5 out of 10, against a planned 3–4. This time, hold back to the
  target from the start."); the warm-up and fuelling ("Before you go: …"); today's heat ("It could reach 30°C before
  you run, about 3.1% harder at these paces: the heat note below can adjust them") with Open-Meteo's credit; and this
  morning's readiness through the engine the Ready? sheet reads. A runner whose readiness says rest hears that and
  nothing else — a warm-up and a fuelling line under "rest today" would contradict the sheet they just answered.
- **Your insight** on a logged run's page, between Plan and View next run (`rdReactHtml`): "How did that run feel?"
  Good / Tough (`run.react`, saved by `setRunReact` → `saveRuns()`, from the run's page only, up or down only), and only
  then the insight: an opener for the answer and the verdict, the debrief's own first paragraph, the effort against
  the plan, the week's runs and distance, and — for a run from today or yesterday — what is next. Something hurt →
  one line pointing at the debrief, which already puts it first.

**The fact packs are the design (and B11's ground).** `briefingFacts` / `insightFacts` hold display-ready values — the
chips' own numbers handed in by `sessionSheetHtml` (`{ durMin: dur, dist, wuMin, rpe }`; the warm-up chip's minutes
are worked out once, `wuMin`), the sheet's own plain rows and targets (`structureRows(main, true)`, `stepTargetText`,
the same text stored with every logged run), `mainSetSteps` and `longestStep` (one definition each, now read by the
stages, `mainSubtitle` and the briefing), `sessionFuelling` (factored out of `fuelHtml`, so the fuelling plan is asked
of the engine once), `weekByNo`, `heatOffer` (today only — the forecast is today's), `RC.assessReadiness` (only for a
check-in answered within 12 hours: `state.subj` ships with defaults, and they are not answers), `lastRunOfType` (the
latest of the type BY DATE before the session — `state.logged` is newest-first by insertion), and that run's own
`runVerdict(runAnalysis(run))`. The insight takes the SAME `a` and `v` the page above it is drawn from, handed in, and
the confidence is `runAnalysis`'s own. `briefingText` / `insightText` are templates over the pack: no lookups, no
arithmetic. So B11's AI can be held to exactly these numbers.

**The cache, `interun_brief_v1`:** `{ "b|<sid>|<date>" | "i|<run id>": { sig, paras, src: "rule", at } }`, keyed on the
pack itself (`BRIEF_TEXT_V` + its JSON), so one sheet never reads differently between two openings, and a new forecast
or answer writes afresh. ⚠️ Bump `BRIEF_TEXT_V` whenever the wording changes, or runners keep the old words until the
facts move. Pruned in `seedDone` by date (a briefing once its day has gone) and by run (an insight once its run leaves
the 50-run store) — never by the plan.

**Found while building it and fixed:**
- The weather licence (`test/app-store.test.ts`): every function that prints a temperature must carry Open-Meteo's
  credit. `briefingFacts` formats one, so the card shows `wxCreditHtml()` whenever the briefing quotes the forecast,
  and `briefingFacts` is recorded in that test's exemptions with the reason.
- First drafts said "7 km moderate run, 44 minutes, 7 km" (the distance only where the title lacks it now), called a
  steady run's only block "the main set", and stacked the thumbs one above the other at 375 px (question on its own
  line; the two buttons share the row, 44 px tall).

**Found, not changed:** the Ready? sheet prints "From your watch: Slept 7.5 h, Resting HR normal" from a hard-coded demo
`watch` constant, and those values reach `RC.assessReadiness` — which the sheet, Alfie and now the briefing read. Raised
as its own task; the briefing only ever shows the engine's advice the sheet already shows.

**Guards (`test/briefings.test.ts`, 9):** every number a briefing prints is in its pack (every runnable session of six
weeks × last-run states × heat × readiness, both days) and the same for insights (nine kinds of run × three dates ×
both answers); the text functions call nothing but string joins; the packs read the named sources and `fuellingFor` is
asked once; nothing reachable from the card, its text, the cache or the thumbs' handler can change the plan (a derived
walk over the app's call graph, render and wire as boundaries, the plan-changers derived from what they call and
whether they write `profile.`); a medical-claim sweep over the templates and what they write; today/tomorrow and
runnable only; readiness fresh and today's only; rest means rest; the credit; "last time" by date; the thumbs, the
cache and the prune. The new insight functions sit inside the Logbook debrief region, so `test/run-debrief.test.ts`'s
"no verdict diagnoses anything" sweep covers them too. **26 of 26 re-breaks caught**, PLAN.md's own ("the briefing
invents a number") among them. Driven in the browser at 375×812, light and dark.
