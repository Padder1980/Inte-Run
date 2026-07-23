# running-coach — evidence-based training engine

The portable "brain" of the running app: it turns a goal + current fitness into a periodized,
research-grounded training plan, and adapts that plan to missed sessions, injuries and effort
feedback. Pure TypeScript, no runtime dependencies, no platform assumptions — the same engine can sit
behind a native iOS/watchOS app, a React Native app, a web app, or a backend service.

> **Status:** first slice — the plan-generation engine and adaptive logic, fully unit-tested
> (**39 tests passing**). UI, watch/health/voice/music integration and persistence are later slices
> (see Roadmap).

## Run it

Requires **Node ≥ 22.6** (uses built-in TypeScript execution + the built-in test runner — nothing to
install).

```bash
node --test          # run the full test suite
node demo/generate.ts # print a plan for the example goal (HM sub-1:30, returning runner)
```

## Demo

`demo/generate.ts` drives the whole engine end-to-end for one example athlete — a returning runner
targeting a sub-1:30 half marathon — and prints the result to the terminal. Nothing to install; it
runs on Node's built-in TypeScript execution.

```bash
node demo/generate.ts
# or, via the package script:
npm run demo
```

It walks through four things in order:

1. **Week-by-week summary** — the full periodized block (base → build → peak → taper), showing each
   week's phase, deload flag, number of quality sessions, long-run duration and approximate distance.
2. **Week detail** — a couple of representative weeks expanded session-by-session, each with its RPE
   target and computed pace range (threshold, VO₂, easy, long run, plus strength/mobility).
3. **Adaptation** — feeds in "two missed sessions in a row" and shows the gentle re-entry adjustment
   (a hard session swapped for easy, volume trimmed, missed work deliberately *not* added back).
4. **Achievements** — detects personal bests from an example 10K run (fastest 1k/mile/5k/10k, longest
   run).

Abridged output:

```
━━ WEEK-BY-WEEK SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wk  Start        Phase   Deload  Quality  LongRun  ~Distance
 1  2027-04-19  base               1       46′    39.9 km
 ...
15  2027-07-26  peak               2       99′    57.3 km
19  2027-08-23  taper              1       77′    42.4 km
20  2027-08-30  taper              1       61′    39.8 km

━━ ADAPTATION — TWO MISSED SESSIONS IN A ROW ━━━━━━━━━━━━━━━━━
Triggered: true
  • Replaced "4 × 4′ hard / 3′ easy" with an easy run to ease back in after missed sessions.
Volume 50.0km → 41.0km  (missed work is NOT crammed back in)

━━ ACHIEVEMENTS — PBs FROM A 10K RUN ━━━━━━━━━━━━━━━━━━━━━━━━━
  🏅 fastest-5k: 20:00
  🏅 fastest-10k: 40:00
  🏅 longest-run: 10.0km
```

To try a different scenario, edit the goal/athlete inputs at the top of `demo/generate.ts` and re-run.

## Visual preview

For a look at the plan as a *product* rather than terminal text, `web/index.html` is a self-contained
page that renders a generated plan: the goal and feasibility verdict, a weekly-volume chart coloured by
training phase, and a click-through week-by-week breakdown with per-session pace and RPE targets.

```bash
node web/build.ts   # regenerate web/index.html from the engine, then open it in a browser
```

`web/build.ts` runs the engine for the example athlete and bakes the result into a single static HTML
file (no server, no dependencies). Edit the same goal/athlete inputs at the top of `web/build.ts` to
preview a different plan.

## What's inside

```
src/
  domain/      types.ts, units.ts            — vocabulary + time/pace/distance math
  science/     paces.ts                      — Riegel equivalents + training paces/zones
               intensity-distribution.ts     — pyramidal (default) / polarized targets + validator
               taper.ts                       — distance-specific taper
               training-load.ts               — session/weekly load proxy for adaptation
  plan/        feasibility.ts                 — is the goal realistic in the time available?
               periodization.ts               — weeks → base/build/peak/taper + deloads
               session-templates.ts           — the evidence-based session library
               generate-plan.ts               — goal + athlete → full plan
  adapt/       missed-sessions.ts             — two-misses-in-a-row → gentle re-entry
               injury.ts                      — injury report → pause / reduce / monitor
               rpe-feedback.ts                — RPE trend → ease / hold / progress
  progress/    achievements.ts                — PB detection (fastest 1k/mile/5k/10k/HM/M, longest run)
  index.ts                                   — public API
```

## Evidence grounding

Encoded from the supplied research brief (*"The latest evidence on improving long-distance running
performance"*) and its cited work: the training-intensity-distribution meta-analyses
(PubMed 40878015 and the 2026 Bayesian network meta-analysis), the HIIT review (PubMed 37163550),
the heavy-strength meta-analysis (PubMed 29182410), and the taper/flexibility reviews
(PubMed 38904772). Key rules, with where they live:

| Principle (from the evidence) | Where |
| --- | --- |
| Pyramidal intensity distribution is the default; polarized optional; no dogmatic 80/20 | `science/intensity-distribution.ts` |
| Pyramidal is the right structure when **returning** from a lay-off | `chooseModel()` |
| One quality session/week to start; alternate threshold/VO₂ when returning; two once building | `generate-plan.ts` |
| Threshold formats (3×8′, 4×6′, 20–30′, cruise miles), RPE 6–7 | `session-templates.ts` |
| VO₂ formats (5×3′, 4×4′, 6×800m, 10×1′), ~12–20′ hard, RPE 8–9 | `session-templates.ts` |
| Long run develops durability: easy → extend → steady finish → race-specific while tired | `session-templates.ts`, `generate-plan.ts` |
| Heavy strength (~80%+ 1RM, 3–6 reps) 2×/week → 1× maintenance near the race | `session-templates.ts`, `generate-plan.ts` |
| Flexibility = dynamic warmups + strides; static stretching is selective, not for economy | `session-templates.ts` (warmups), plan notes |
| Taper: cut volume ~41–60%, keep intensity; 5–10K 5–8d · HM 7–14d · M 14–21d | `science/taper.ts` |
| Return-from-injury conservatism (cardio recovers before connective tissue) | `feasibility.ts`, `periodization.ts` |

Pace math uses Riegel's non-proprietary `T2 = T1·(D2/D1)^1.06`; training paces are computed from the
athlete's own predicted race paces and cross-checked against the brief's RPE anchors. **No proprietary
pace tables or third-party plan content are reproduced.**

## Requirement → status

| Your requirement | Now (engine) | Later (integration) |
| --- | --- | --- |
| Goal → generated plan | ✅ `generatePlan` + `assessFeasibility` | plan-editing UI |
| Grounded in current research | ✅ `science/*` with citations | — |
| Flexibility (mobility) built in | ✅ dynamic warmups + mobility sessions | — |
| Optional strength & conditioning | ✅ toggle + heavy-strength scheduling | — |
| Miss two in a row → auto-adjust | ✅ `applyMissedSessionAdjustment` | notifications/UI |
| Injury → pause/adjust intensity | ✅ `assessInjury` + `applyInjuryAdjustment` | injury-report UI |
| RPE rating at session end | ✅ types + `evaluateRpe` | session-end UI |
| Achievements (fastest 5k/mile/10k…) | ✅ `detectAchievements` | achievements UI |
| Manual session add | ✅ `Session.source = "manual"` supported | add-session UI |
| Apple Watch / Garmin sync, Apple Health, BLE HR | types/seams only | native modules |
| Voice cues + celebrity-style voices | design note ↓ | TTS + licensed voice personas |
| Music control (watch/phone) | design note ↓ | native media controls |

## Design notes for the native half

- **Watch / health / HR seams.** `Activity` (with `splits`) and `SessionOutcome` are the ingestion
  shapes the native layer fills from HealthKit / Garmin / a BLE chest strap. The engine never touches
  a device — it consumes these plain records, so any platform can feed it.
- **Voice personas (incl. "celebrity-style").** Plan a swappable `VoicePersona` (personality, UK
  region/accent, phrase bank for start/stop/current-pace/average-pace/motivation, TTS voice id).
  Ship original and licensable voices. **Impersonating real, named celebrities requires their
  licensing/consent** — it's a commercial track, not something to fake — so the architecture keeps
  personas pluggable and treats real-name voices as licensed content added later.
- **Music control.** A thin platform adapter over the OS media session (iOS `MPRemoteCommandCenter`
  / Android media controls); the engine has no audio concerns.

## Roadmap (proposed next slices)

1. Thin web/PWA demo rendering a generated plan (see the brain end-to-end in a browser).
2. Live-session state machine (start/pause/stop, pace/HR cues) as a logic layer.
3. Native shell decision (RN/Expo vs native) + watch/Health/BLE/voice/music integration.
4. Persistence/backend + auth; wire the adaptive loops to real activity data.

## Licensing

Original work. Not affiliated with, and not derived from, any commercial running app. Screenshots
provided during development were used only as loose UX reference, never copied.
