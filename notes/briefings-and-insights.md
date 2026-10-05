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

## ✅ B11 — EXPAND WITH ALFIE: THE SAME FACTS, WRITTEN UP BY THE AI THROUGH THE SERVER, GATED (built 2026-10-05)

PLAN.md B11: "reuse `POST /` with `mode:"briefing"|"insight"` + `context` = facts (branch before the "no question"
400); `MODE_EXTRA[mode]`: only the numbers given, ≤80 words, no diagnosis, no plan changes. New KV buckets `rl:brief:`
with `GLOBAL_BRIEF_DAILY` (~40) and `PER_DEVICE_BRIEF_DAILY` (~3) checked before the model; `GET /` reports them. App:
"Expand with Alfie" tap, once per session id; reply passes a no-new-numbers filter … and a medical-term sweep, else the
rule text stays; cached `src:"ai"`. When `BRAIN` moves to Claude, briefings use Haiku. Re-break: remove the number
filter."

**The server (`alfie-proxy/src/worker.ts`):** `expand()` — its own branch BEFORE the question check; the facts in a
system turn; `EXPAND_SYSTEM` + `MODE_EXTRA[mode]` (80 words, only the facts' numbers written as they appear, no
diagnosis, never a plan change); 413 for a pack over `EXPAND_MAX_CONTEXT`; its own budget `overBriefLimit` —
`rl:brief:d:<hash>:<day>` 3 a day a phone and `rl:brief:all:<day>` 40 a day for everyone — checked before the model,
so expansions never spend a runner's questions (tested); `EXPAND_MODEL` = Claude Haiku when `BRAIN` is "claude"; `GET /`
lists `expand` and `expandDaily` (limits and today's count). ⚠️ **The server is now RUN in the tests** (its fetch
handler, with Cloudflare's AI and the KV store stood in) — it loads fine under node from the repo root.

**The app:**
- **Asked, never assumed:** `alfieExpandProbe()` does one `GET /` a launch, from `wire()` — never while a screen is
  being drawn (it began in the button's own render path, and the heat harness, which lifts everything the session
  sheet reaches, followed it through `render` into the whole app) — and only for a runner with Ask Alfie online on.
  A deploy whose `GET /` lists no `expand` is never offered: deploy skew fails closed, B1's Strava handshake again.
- **The button** (`expandBtnHtml`, on the briefing card and the insight): only with online answers on (`alfieOnline`:
  a yes, and 13 or over — checked at render AND inside the sender, `alfieExpand`), a server that lists the mode, and
  not asked before for this card; never on a run where something hurt, never on a rest-day briefing. Its small print:
  "Sends these facts to Ask Alfie online — never your name, where you are, or your health answers."
- **What is sent:** `{ mode, context, device }` and nothing else — the pack on screen through `expandFactsFor`, which
  drops `ready` (the morning check-in) and `pain`. No question, no history.
- **The checks, before a word is shown (`expandReplyOk`):** every number token in the reply must be one in the sent
  pack's JSON; no word from `EXPAND_MEDICAL`; at most `EXPAND_MAX_WORDS` (110 — the server asks for 80). A reply that
  passes replaces the text (`src: "ai"`, labelled "Written up by Alfie from your numbers"); one that fails leaves the
  rule text, with a toast. Either way the card is not offered again (`tried`, kept even when the pack later moves —
  once per briefing or run). A full day's allowance (429) or no signal is not an answer: the offer stays.

**⚠️ Found under it and fixed — B10's cache stored the morning check-in.** The DPIA (Step 6) and APPSTORE.md (2.3)
promise check-in answers are kept nowhere and sent nowhere; B10 cached the briefing text with "This morning you rated
yourself 2 out of 5" and the engine's advice in `interun_brief_v1`. Now the cache — and anything Alfie is sent — is
written from the pack WITHOUT `ready`, and the readiness line (`briefingReadyLine`) is added on screen at render. A
runner who should rest still reads only that (never cached).

**The pages (`test/privacy-copy.test.ts` holds them to the code):** `PRIVACY_FLOWS`' alfie line; the privacy policy's
Ask Alfie section (what an expansion sends, "Never sent with it: your morning check-in and whether anything hurt", the
reply checked number by number, `<span data-cap="alfie-expand">3</span>` a day — tested against
`PER_DEVICE_BRIEF_DAILY`) and its "what we keep" (expansion counts too); the simple version; `LEGAL_UPDATED` and all
three pages' dates to 5 October 2026; `APPSTORE.md`'s Fitness and Device ID rows; `DPIA.md`'s alfie row. The
counter-lifetime test now expects five counters. **The owner should read the policy change** — it is a new thing that
leaves the phone, though only on a tap, only with online answers on, and only once the server is deployed.

**Owner action:** deploy the Worker (`npx wrangler login` in his terminal, then deploy from `alfie-proxy/`). Until then
the button never appears.

**Tests:** `test/briefing-ai.test.ts` (7: the server's branch and prompt, its budget and report — run, not read; the
number filter; what is and is not sent and stored; when the button is offered; the tap, a refused reply, a full day,
the sender's own gate; the pages and the wiring). `test/alfie-proxy.test.ts` restated per spending path;
`test/briefings.test.ts` allows `briefingReadyLine`. **29 of 29 re-breaks caught**, PLAN.md's own ("remove the number
filter") among them. Driven in the browser with the network stood in (light and dark, 375×812): the sent body was
`{ mode, context, device }` with no readiness or pain in the context, and the reply replaced the text with its label.
