<!-- The working plan for going past Runna. Written 20 Sept 2026 after researching Runna and interviewing the owner. The live copy this session edits is ~/.claude/plans/fizzy-herding-feigenbaum.md; this file is the committed record so either Claude account can read it. Update it when a stage lands: tick the stage, keep the rest. -->

# Inte-Run → better than Runna: status, audit, and the staged plan

**Planning mode: EXISTING APP / BULK IMPROVEMENT.**
Date: 20 September 2026. Repo at `813f63b`, tree clean, 1,533 tests passing, nothing changed since 9 September.

**Your next actions (nothing I can do moves these):**
1. One locked-phone run and one start-on-watch run, then read the `coach:`, `steps:` and web-layer lines in Support › Your data. That closes six waiting items.
2. An App Store Connect API key (App Manager role) saved to `~/.appstoreconnect/private_keys/` — that is what puts a build on testers' phones.
3. Garmin form: **sent** ✓. When the approval email lands, say so — Track C starts that day.

**Progress:** T1 ✅ done · A1 ✅ done (log survives a plan rebuild) · A2 ✅ done (17→62 exercises, one catalogue, equipment filter) · A3 ✅ done (five questions; sessions built to the time you have) · A4 ✅ done (swap any exercise for a like-for-like alternative; it sticks; found and fixed a real bug where swapping the same slot twice silently broke) · **next: A5** (session player — rest timers, supersets, tap-to-log, completion).

**Resuming after a `/clear`?** Read this file and `CLAUDE.md` (its "Write down…" chapters record what each finished stage actually did, in detail this file doesn't repeat), `git pull`, then start the stage named in Progress above using the model below. Do not re-plan or re-research — the plan is done; the job now is executing stages one at a time.

### Which model for which stage
Rule: **Opus** where a mistake would be silent — engine guardrails, data migrations, the commit points this repo has broken six times before, credentials, native Swift. **Sonnet** where the spec is concrete and mechanical — content, UI built from an existing pattern, tooling, checklists.

| Stage | Model | Stage | Model | Stage | Model |
|---|---|---|---|---|---|
| T1 verify ✅ | Opus | A9 watch (native) | Opus | B7 B-race | Opus |
| T2–T6 tooling | Sonnet | D3a/b/c safety/youth/wellbeing | Opus | B8 preference dials | Opus |
| A1 data foundation ✅ | Opus | D1 privacy policy | Opus | B9 plan queue | Sonnet |
| A2 exercise library ✅ | Sonnet | D2 testers · D4 submit | Sonnet | B10 fact packs | Sonnet |
| A3 preferences + builder ✅ | Opus | S Strava club row | Sonnet | B11 AI via Worker | Opus |
| A4 swap ✅ | Sonnet | B1 manual/link/PRs | Opus | B12 yoga/pilates | Sonnet |
| **A5 session player** | **Opus** | B2 skip · B3 time of day | Sonnet | C1/C2 Garmin | Opus |
| A6 e1RM/progression | Sonnet | B4 move ±1 week | Opus | C3 hardware test | (you) |
| A7 standalone programmes | Opus | B5 return speed · B6 realignment | Opus | | |
| A8 Strava WeightTraining | Sonnet | | | | |

Non-race modes and the accounts/sync/network/Android round are each a **separate planning round** — do not start them from inside a stage; flag it and stop.

---

## Part 1 — Where we are

### Done and on your phone (highlights of the last fortnight)
- Days question offers only days the plan can use, and says why. Profile row and Alfie corrected.
- Strength toggle "nothing changes" lie fixed. Progress card fixed (it had shipped broken).
- Watch "deaf wrist" bug fixed twice (the first fix shipped a worse bug — both mine). Installed.
- The Hudson coaching-book work: hill sprints as a weekly staple, shorter blocks, beginner quality, tier-3 recovery weeks, "make a week easier", the app offering an easier week.

### In progress (built, waiting on a real-world check)
| What | Waiting on |
|---|---|
| Watch: start-on-watch after an unfinished run | **You** running with it |
| Watch batch (ends at distance, companion controls, clock clash, four rows, countdown, cadence, route thinning, per-point times) | Same run — all native, installed 8 Sept, none verified on a wrist |
| Coach speaking with the phone locked | A locked-phone run; read the `coach:` line after |
| Lock-screen distance keeps moving | A locked-phone run; read `steps:` and `settled` after |
| Share picture (`pc-share`) | 5 checklist items that need a real iPhone |
| Distance-set runs: the **long run** is still timed | 6 ladder guards must be made gate-agnostic first (~half a day, engine) |
| **Garmin** | Approval email (form sent) |

### Not started
| Area | Roadmap ids | One line |
|---|---|---|
| Launch hygiene | `p2-legal`, `p2-test`, `p2-submit`, `p2-launch` | No privacy policy or terms in the repo. Build 434 on TestFlight, **no testers**; project is already at build 495. |
| Safety questions before the plan | `pc-safety`, `pc-youth`, `pc-wellbeing` | Red-flag questions, an under-18 gate, a home for the wellbeing tick-boxes |
| Watch face complication | `p3-face` | Today's session on the watch face |
| Garmin build | `p5-server`, `p5-in`, `p5-out` | Starts on approval |
| Running-partner matching | `p6-*` | Needs accounts + server — separate planning round |
| Money / rhythm / identity | `p7-*`, `p1-*` | Not decided |

### Open decisions that are yours (unchanged)
Hill sprints for run-walk beginners · re-test as 5 × 1 km at goal pace · "how long can you be out on a weekday?" question · "longest run last month" field · masters advice (needs your clinical reviewer).

### Known and not fixed
"Ease off" adds 19% training time · move-a-session has no undo · `LaunchRequest.companionOnly` can strand the wrist · goal projection credits days the plan ignores.

---

## Part 2 — What Runna actually has (researched 20 Sept 2026)

Sources: runna.com; 70 articles in "App Features, Subscriptions & FAQs"; 186 in "Strength & Mobility"; Training Hub (46), Injury (20), Nutrition (24), Triathlon (7), Races (17); Runna press (29 Jul 2026); Strava/Runna FAQs; Wareable, 9to5mac, the5krunner, Running Genie, runwithrachel, Runner Beans. URLs at the end.

Legend: ✅ have · 🟡 partial · ❌ missing · ⭐ Inte-Run ahead.

### A. Plans
| Runna | Inte-Run |
|---|---|
| Race plans 5k / 10k / half / marathon / **50 km** | ✅ 5k–marathon · ❌ 50 km |
| Distance plans, custom 5–50 km | ✅ |
| Run Faster / **Run to Maintain** / **Run Further** / **Train Your Way** (mileage-only, no race) | ❌ |
| New to Running, Return to Running, Path to parkrun | ✅ run-walk + habit tracks · ❌ parkrun-specific |
| **Post-Race Recovery** (auto), Post-Injury, Postpartum | ❌ |
| Hyrox / Functional Fitness; Triathlon (running only) | ❌ |
| Capped 26 weeks, min 6 (3 for maintain) | ✅ ours 14–24 (Hudson), 28 beginners |
| Current / **Upcoming** / **Draft** / Completed / Incomplete; queue a year ahead | 🟡 history + new plan · ❌ drafts, queue |
| Free tier; $19.99/mo, $119.99/yr; Strava bundle $149.99/yr; gifts | ❌ no payments |

### B. Inputs and adaptation
| Runna | Inte-Run |
|---|---|
| Ability, mileage, **longest run**, recent times, days, goal | ✅ except longest run |
| **Training Preferences**: volume Progressive/Steady/Gradual; difficulty Challenging/Balanced/Comfortable; max long/easy/hard lengths; hard runs/week | ❌ |
| Pace Insights (5 statuses; suggest only) | ⭐ flags engine + weekly review |
| Mileage Insights (4 cards → mileage, long run, runs/week) | 🟡 add-a-day, ease-week offers |
| Plan Realignment (>3 missed / a week / a month; irreversible) | 🟡 ease-week, pause · ❌ the tiered prompt |
| Not Feeling 100% (4 levels, 3–14 days, **return speed** Slowly/Balanced/Quickly) | ✅ levels + windows · ❌ return speed |
| Holidays; Pause; change race date | ✅ |
| Adapt for Heat (launched 29 Jul 2026) | ✅ had it first, incl. race day |
| **B-race** (shorter than A, in plan, not within 7–10 days of A) | ❌ |
| Skip vs rearrange; drag **±1 week**; one run/day; **Add Time**; calendar-app sync; watch re-sync | ✅ same-week drag, .ics · ❌ ±1 week, time, per-session skip |

### C. Workouts, recording, insight
| Runna | Inte-Run |
|---|---|
| Easy, intervals, tempo, hill reps, long, time trial, race, parkrun | ⭐ 62+ formats, evidence-cited |
| Instant Workouts (runs only; Premium) | ✅ build-your-own |
| **Workout Briefings** — AI, day before: focus, last-workout insight, weather, nutrition, context | 🟡 preview has why/heat/warm-up/fuel · ❌ AI, last-workout carry-over |
| **Workout Insights** — AI post-run, unlocked by thumbs up/down; not for strength | 🟡 honest rule-based debrief · ❌ AI narrative |
| Audio cues: TTS voices, pace alerts, laps, halfway, nutrition reminders | ⭐ 9 recorded coaches, name packs |
| Phone tracking; treadmill; treadmill on watch | ✅ phone + treadmill · ❌ treadmill on watch |
| **Follow a Route** on Apple Watch (Strava public route / GPX; off-track alert; offline maps) | ❌ |
| Log / **Link activity to session** / **Manually add** | ✅ log · ❌ link · ❌ manual |
| Personal Records: 5K/10K/half/marathon + 5 mi/10 mi, auto + manual | 🟡 typed PBs + best effort · ❌ auto PR system |
| **Runna Score** (Premium) · **Runna Levels** (points, Bronze→Champion, badges, partner offers) | ❌ score · 🟡 achievements engine, no points |
| Human coaches via chat | ❌ humans · ✅ Alfie |

### D. Strength, mobility, cross-training — the battleground
| Runna | Inte-Run |
|---|---|
| Up to **4 sessions/week** in the calendar | 🟡 auto 1–2/week |
| **30/45/60 min**; **Beginner/Intermediate/Advanced**; **Running Focus / All-Round** | ❌ |
| Equipment: bands, barbell, box, bench, dumbbells, kettlebells, pull-up bar, Swiss ball, bodyweight | ❌ |
| ~175 exercises (133 strength, 25 mobility, 17 drills, 11 plyo) with animation + tips | ❌ **17** (and a second copy of the catalogue in the Learn hub) |
| **Log reps + weight; "Weight Lifted" over time** | 🟡 kg/reps boxes + "Best kg" card, but the log is index-keyed, undated, **lost on plan rebuild** |
| ❌ custom workouts · ❌ swap · ❌ watch · ❌ rest timer · ❌ 1RM · ❌ progression | ❌ same |
| Strength → Strava activity | ❌ (Worker hardcodes every upload as "Run") |
| Phased programming | ⭐ technique → heavy → maintenance, %1RM, plyo dose |
| Yoga / Pilates / Stretch & Stability (weekly unlock, no equipment) | ❌ (post-run stretch routine only) |
| Cycling/swimming etc. loggable only | ❌ |

### E. Devices
Runna: Garmin, Apple Watch, COROS, Suunto, Fitbit, Amazfit; **two weeks pushed every Monday**, runs back automatically, runs only; Apple Watch standalone with screen templates, auto-pause, double-tap lap, routes/maps; Strava sign-in + auto-upload + media. Inte-Run: Apple Watch standalone (no routes), Strava upload, Apple Health write; ❌ Garmin (approval pending), ❌ others, ❌ Android (PWA runs there without watch/background GPS).

### F. Community — Runna closed theirs on 7 September
Community tab "will no longer be accessible" after 7 September; "the Team Runna Club on Strava is the place where community connection will continue". Strava has owned Runna since April 2025; the apps stay separate. **Inte-Club already does more in-app than Runna does today**; what we lack is the network.

### G–H. Content, account, business
Runna: 46 training articles, 20 injury guides, 24 nutrition, race-day FAQs for 12 majors, podcast, gear; sign-up/login (email or Strava), age requirements, deletion, subscriptions, refunds, T&Cs, iOS + Android, 4.9★/76k. Inte-Run: fewer, deeper guides (clinically reviewed); none of the account/business layer.

### Where Inte-Run is already ahead
Recorded coach voices · evidence-cited engine with measured guardrails · honest debrief · heat incl. race day · strength programming science · share studio · Inte-Club editor · Shoe Rack · privacy · "make a week easier" and tier-3 recovery weeks.

### Where reviewers say Runna is weak
No heart-rate-based training; one style of training; Apple Watch sync needing both apps open; only two weeks visible unless annual; basic layout.

---

## Part 3 — The plan

### What we are building (ELI5)
A running coach that already beats Runna on coaching, plus a **real strength gym** inside it (programmes, set-by-set logging, rest timers, records, suggested weights — the things Runna cannot do), plus the handful of running-plan conveniences Runna has and we don't, plus Garmin, plus the paperwork an App Store launch needs. Accounts, a shared network and Android are a **separate plan** afterwards.

### What I think the real problem is
"Everything Runna has" is two jobs in one sentence. **Coaching-layer parity** is finite: each gap below is half a day to two days. **Platform parity** (accounts, sync, Android, payments, moderation) is a company. The strength differentiator lives entirely in the first job. Build it there, ship it over the air, and keep the second job as its own decision.

### Existing state (what the stages build on)
- Engine `src/`: `StrengthExercise` (`src/domain/types.ts:164-192`) — no id, no rest, no weight, no hold; 17-exercise `EX` catalogue and phased `strengthSession()` (`src/plan/session-templates.ts:1866-2030`); placement `addStrength()` (`generate-plan.ts:2489-2517`), beginner count rule (`:1929-1938`); `mobilitySession()` has no exercise list.
- Web `web/app.ts`: `exerciseBlock()` (`:10966`) with kg/reps inputs; store `interun_slog` keyed `sessId|exIdx|setIdx`, no date, orphaned on rebuild (`:10954-10961`, `strengthHistory()` `:13738`); "Best kg" card `viewStrengthHistory()` (`:13762`); a **second** exercise catalogue `STRENGTH_LIB` (`:19281`); `startSession()` is GPS-only (`:24591`); stretch player `STRETCH` (`:10820-10947`) and Shoe Rack (`:6253-6400`) are the patterns to copy; `extraSession()` (`:11661`) is the seam for programme sessions; strength never reaches `interun_hist_v1`.
- Watch: strength excluded by `PRIMARY_TYPES` (`:7349`) and an **unguarded** Swift mirror `isRunnable` (`ios/InteRunWatch/SessionStore.swift:99`).
- Server: one Worker, 7 routes, one KV, per-install device keys, `BRAIN = "cloudflare"` (`alfie-proxy/src/worker.ts:53`), Strava `sport_type: "Run"` hardcoded (`strava.ts:272,292`), no cron, no user identity.
- Adaptation: adjustment store `interun_adjust_v1` applied in `adoptPlan`; overrides `interun_dayov_v1` pruned by `seedDone`; weekly review with one-question-a-week; `returnToRunningPlan`, `assessInjury`, `applyInjuryAdjustment` still have zero callers.
- Copy that is already false or fragile: `dataView` `:20716` ("nothing is uploaded anywhere, because Inte-Run has no server" — Alfie and Strava exist), `connectView` `:20017`, stale comments in `PrivacyInfo.xcprivacy` and the entitlements; `alfie-proxy/README.md` names the wrong model.

### Important decisions made (interview rounds 1–2)
| Decision | Choice | Why |
|---|---|---|
| Strength depth | **Full gym**: parity + programmes, rest timers, supersets, 1RM, progression; watch strength as a later native stage | It is the differentiator; Runna is weakest exactly here |
| Accounts / server | **After strength + launch hygiene, own planning round** | COMPLEX by your rules; nothing built now is thrown away |
| Order | **Strength first, then launch hygiene**, parity gaps interleaved | You see the differentiator on your phone soonest |
| Community | **Strava club now; Inte-Club kept for the accounts round** | Runna closed theirs; parity is zero code |
| Parity gaps | All four groups incl. non-race modes | Non-race modes flagged COMPLEX → own planning round (below) |
| AI coach | **Both** briefing + insight, grounded in our own numbers, free brain first, gated | Cheapest visible parity; must never contradict the screen |
| Yoga / Pilates | Later stage in this plan, animated poses, no video | Content-heavy; no licensing |
| Devices / platform | Garmin form sent; **iOS only for v1** | Android is a platform, not a feature |

### Pushback / improvements
1. **Fix the strength log before building on it.** It loses data on every plan rebuild. Foundation stage first.
2. **Extend our strength spine, don't copy Runna's.** Phases/%1RM/plyo dose stay; equipment, sessions/week, duration, level, swap go on top; then programmes, timers, 1RM, progression go past them.
3. **Keep strength out of `interun_hist_v1`** (every reader counts a row as a run) — give it its own completion store and show it in the Logbook from there.
4. **One exercise catalogue.** Delete the Learn hub's duplicate; the hub reads the engine's.
5. **Don't chase Runna's community.** Strava club (zero code) + Inte-Club preserved.
6. **AI text must be a view over facts the screen already shows**, with a no-new-numbers filter, and capped — the free brain covers ~70 answers a day for everyone.
7. **Training Preferences dials must each demonstrably change the plan** (your own days-question ruling), and be hidden where they can't.
8. **Non-race modes are COMPLEX** — every reader of "race" in the app must tolerate no race. Own planning round, after B-race/dials/queue land.
9. **One verify command before anything else.** Six documented harness faults came from steps quoted from memory.
10. **Launch hygiene is cheap and blocking** — and three in-app privacy sentences are already false.

### Gaps identified → fix
| Gap | Fix (stage) |
|---|---|
| Strength log orphaned on rebuild | A1 |
| 17 exercises + duplicate catalogue | A2 |
| No equipment/duration/level/sessions-per-week | A3 |
| No swap | A4 |
| No rest timer / supersets / guided player / completion | A5 |
| No 1RM / progression / records | A6 |
| No standalone programmes | A7 |
| Strength never reaches Strava | A8 |
| No watch strength | A9 (native) |
| No yoga/pilates | B12 |
| No manual/link activity, no PR system | B1 (+ PRs in B1) |
| No skip / time / ±1 week / return speed / realignment | B2–B6 |
| No B-race, no preference dials, no drafts/queue/post-race | B7–B9 |
| No AI briefing/insight | B10–B11 |
| No non-race modes | separate planning round |
| No privacy policy/terms; false privacy copy; no testers; no safety gate | D1–D4 |
| No Garmin | C1–C3 |
| Weak tooling (no verify, ad-hoc harnesses, doc drift) | T1–T6 |
| Accounts / sync / Android | separate planning round |

---

## Part 4 — Stages

Every stage: **A** objective · **B** ELI5 · **C** work · **D** verification · **E** risk/rollback. Every stage ends with `npm run verify` (T1) green, the CLAUDE.md "Write down…" entry, and a new dated `BATCHES` key in `docs/roadmap/index.html` when a step is genuinely done. Web + engine ship over the air; native stages (A9, C3 hardware) need Xcode-beta and an unlocked phone.

**Recommended sequence:** T1 → A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → D3a/b/c → D1 → D2 → S → B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10 → B11 → D4 → A9 → B12, with T2–T6 interleaved and C1–C3 slotted in the day Garmin approval lands. Two separate planning rounds after: non-race modes; accounts/network/Android.

### Track T — Tooling

**T1 · One-command verify**
- A. `npm run verify` runs the whole documented recipe so no step is ever quoted from memory.
- B. One command, one summary line. If it's green, the app is safe to push.
- C. `tools/verify.mjs`: build and read the exit code; `git status --short docs/voices/` must be empty (fail with the restore hint, never auto-restore); `node --check` every emitted `<script>` block (count derived); `tsc --noEmit` allowing only the one pinned pre-existing error; `node --test` under UTC, `Pacific/Kiritimati`, `Pacific/Pago_Pago` with `CHROME_PATH`, parsing both `ℹ fail N` and `# fail N`, requiring 0 fails and equal pass counts; run `tools/audit-*.mjs`; write `.verify-ok` (HEAD tree hash + counts); print one summary line.
- D. Break each step deliberately (a voices diff, a stray backtick, a failing test) — each caught and named.
- E. Pure tooling; no app change.

**T2 · Re-break harness** — `tools/rebreak.mjs`: JSON list of {file, find, replace, tests}; abort unless the anchor occurs exactly once; copy aside (never `git checkout`); rebuild if `web/app.ts`; parse both fail formats; report CAUGHT / ESCAPED / UNPARSABLE (unparsable ≠ success); restore and check sha256-identical. Node, not zsh.
**T3 · Store-key registry test** — derive every storage key literal in the built page; each `interun_*` or `rc_profile_v1`; `_vN` suffix except a pinned legacy list; each either in `BACKUP_NEVER` (credentials) or under `BACKUP_PREFIXES`; IndexedDB names listed. Catches a credential leaking into backups.
**T4 · Doc-drift guards** — `alfie-proxy/README.md` model/token cap equal the constants; every `BATCHES` id exists as a `data-id`, batch keys unique; a short `MILESTONE.md` checklist embedded in every Opus prompt.
**T5 · Pre-push hook (with your consent)** — refuse push without a matching `.verify-ok`; refuse commit messages quoting counts that differ from it; refuse `docs/voices/` changes unless `ALLOW_VOICES=1`; refuse `.p8`, `strava-secret.txt`, `mapbox-token.txt`, new `tmp-*`. Follow-up: untrack the `tmp-*` probe files already in the public repo.
**T6 · Worker typecheck + tests** — `alfie-proxy/tsconfig.json`, `npm run typecheck:worker` inside verify; pure modules unit-tested with node's runner. Required before C1.

### Track A — Strength

**Data model (read once).**
- Exercise **id** = stable slug (today's `EX` key: `squat`, `rdl`, …), added as `StrengthExercise.id`, set by `mkEx`. Never renamed or reused.
- **Set log** `interun_slog_v2` = `{ rows: [{ d, s, x, i, w, r, h, rpe?, at, m? }], bests: { [exId]: { w, e1rm, d } }, meta }` — `d` = date (plan ids recur across rebuilds), `s` session id, `x` exercise id, `i` set index, `w` kg, `r` reps, `h` hold seconds, `m:1` = migrated. Newest first, soft cap 12,000 rows. `bests` updated on write so pruning can't lower an all-time best (Shoe Rack rationale).
- **Completion** `interun_strengthlog_v1` = `[{ i, d, s, sec, sets, volKg, src: "plan"|"programme"|"adhoc", strava? }]` — one row per finished session, **not** in `interun_hist_v1`.
- **Per-exercise history** is derived (`slogFor(exId)`), never stored.
- **Programme** `interun_prog_v1` — `{ id, name, startIso, weeks, sessionsPerWeek, minutes, level, goal, equipment[], template[], moved, status }`; loads never stored ("suggested load" is a view over the log).
- **Preferences** live on the profile and reach the engine as `Athlete.strength?: { sessionsPerWeek, minutes, level, goal, equipment[] }` — the runner's answer, never clamped.
- `interun_slog` is never deleted; a one-shot idempotent migration stamps `d` from the planned date and `m:1`.

**A1 · Strength data foundation**
- A. Stable exercise ids and a dated, id-keyed, rebuild-proof set log.
- B. Nothing new on screen. Every set you log is now filed under the exercise and the day, so rebuilding your plan no longer throws the history away. Old entries carried across once.
- C. `types.ts:164-192` add `id`, `restSeconds?`, `holdSec?`, `equipment?`, `superset?`; `mkEx` (`session-templates.ts:1895`) sets `id = key`. `web/app.ts`: declare `SLOG_KEY`/`SLIFT_KEY` beside the other store keys at `:6253` (documented TDZ trap); `loadSlog2/slogWrite/slogFor/slogForSession` with caps and try/catch; `migrateSlog()` once from `adoptPlan` (`:7120`) guarded by `meta.migratedAt`; `exerciseBlock(sessId, iso, e)` inputs carry `data-x/data-i/data-d`, the `oninput` at `:11326` writes v2; `strengthHistory()` reads v2 by `x`.
- D. New `test/strength-log.test.ts` driven via the emitted block: every `EX` key equals its `id`; 16 legacy ids pinned; migration yields rows with `d`, `x`, `m:1` and is idempotent; a row survives a rebuild with a different long-run day; new keys appear in `backupKeys()`; key declared before `adoptPlan`. Re-break: drop `id` from `mkEx`; make migration re-run; move the key below `adoptPlan`.
- E. Migration dates rows by planned date, flagged `m:1`. Rollback: delete the v2 key; the archive is untouched.

**A2 · Exercise library — one definition, 60+ exercises, designed to reach 150+**
- A. Move the catalogue into the engine, grow it across Runna's equipment list, make the Learn hub read the same definition.
- B. A browsable library with equipment filters; every exercise has muscles, a cue and a demo (animation where drawn, schematic figure otherwise). No second copy of any cue.
- C. New `src/strength/library.ts`: `EXERCISES: Record<id, ExerciseDef>` (name, primary, secondary, pattern, equipment[], minLevel, unilateral?, hold?, cue, anim?), `EQUIPMENT` (Runna's nine), `PATTERNS`, `alternativesFor(id, equipment)`. Seed from `EX`; `session-templates.ts` imports it. Export via `web/entry.ts:44`. Delete `STRENGTH_LIB` (`web/app.ts:19281`); `strengthView()` (`:19326`) groups `RC.EXERCISES` by pattern with equipment chips. Add `POSES` for new patterns (pull, carry, rotate).
- D. Ids unique and slug-shaped; every `pattern` in `POSES` (unknown patterns silently draw a squat); every `anim` exists or is listed pre-wired; every equipment tag ∈ `EQUIPMENT`; copy sweep forbids "prevent(s) injury"/"guarantee"; no literal cue in `app.ts` outside the engine dump. Re-break: pattern "typo"; duplicate id; a cue back in `app.ts`.
- E. Bundle size from inlined WebPs — stills only for new items; animation optional by design.

**A3 · Strength preferences, engine builder, placement (Runna parity)**
- A. Ask Runna's questions; the engine builds and places sessions from them.
- B. You pick 0–4 sessions a week, 30/45/60 min, level, Running Focus or All-Round, and your equipment. The plan builds sessions you can actually do, the right length, on sensible days.
- C. Profile `strengthPrefs`; Setup rhythm section (`:21974`, `SETUP_TOPICS.rhythm :22040`) — sessions/week 0–4 replaces Yes/No, `includeStrength` derived for old readers; `applyProfile` (`:6521`) passes `strength: prefs` unclamped. New `src/domain/strength-days.ts` `strengthSessionsFor(athlete, week)` — one definition: requested count in base/build (≤4), `min(req,2)` peak, `min(req,1)` deload, taper 1 then 0; legacy path keeps today's 2/1/1/0 and the beginner rule. `strengthSession(phase, maintenance, {competitive, prefs, slot})`: exercise count derived from minutes (`sets × (40 s work + rest)`), so duration is computed not typed; equipment filter via `alternativesFor`; level sets sets/reps/rest (`REST_BY_INTENT`: 3–6 → 150 s, 6–8 → 120 s, 8–12 → 90 s, holds 45 s, plyo 90 s); All-Round adds push/pull; plyo only build/peak non-maintenance on ≤2 sessions/week with `PLYO_DOSE` split so weekly contacts stay in band; supersets at 45/60 min intermediate+. Placement in `addStrength`: free days in `EASY_REL` order, then easy-run days; never the long-run day; heavy lower-body never the eve of the long run or the first quality day; `applyRaceDay` clearing extended to 4 sessions.
- D. `test/strength-prefs.test.ts` sweeps prefs × phases × 7 long-run days × 4 distances: count = `strengthSessionsFor`; minutes ±5; no unowned equipment; contacts in band (`handoff-ports.test.ts:196` stays green); heavy legs never eve of long run; ≤1/day; **prefs absent ⇒ byte-identical plan**; `profileImpact` "Strength & mobility sessions" row changes with sessions/week. Re-break: clamp in `applyProfile`; drop the eve rule; hardcode minutes.
- E. Existing runners' plans must not move: asserted. Rollback: remove the questions.

**A4 · Swap an exercise**
- A. Replace any exercise with a like-for-like alternative that persists.
- B. "Swap" offers alternatives with the same movement and muscle that fit your equipment. The swap sticks; the log follows the exercise you actually did.
- C. `SWAP_KEY = "interun_swap_v1"` `{ sessionId|fromId: toId }`; `withSwaps(sess)` applied in the sheet (`:11273`), history, player and watch payload; slot keeps sets/reps/load/rest. Rule: same pattern + primary (fallback same pattern), owned equipment, ranked by secondary overlap. Prune stale swaps in `seedDone` like `dayOverride`.
- D. Candidates share pattern+primary; prescription preserved; stale swap pruned; every consumer of `sess.exercises` calls `withSwaps` (derived by grep). Re-break: different-pattern candidate; skip `withSwaps` in one consumer.
- E. Rollback deletes the key.

**A5 · Session player — rest timers, supersets, tap-to-log, completion**
- A. Strength gets a Start button, a guided player, and a recorded finish.
- B. Tap Start on a strength day: exercises run in order (supersets alternate), each set logged with one tap using last time's numbers prefilled, a rest countdown buzzes at ten seconds and zero, holds count down. Finishing ticks the day and shows under Activities → Strength.
- C. `startBtn` (`:11290`) strength branch → `openStrengthPlayer(sess, iso)`; **never** `startSession` (GPS). Player state modelled on `STRETCH`: rest uses an absolute end timestamp (iOS throttles intervals); `haptic("tick"/"lift"/"success")`; `strengthStop()` in `closeSheet` (`:11345`). Finish writes one completion row, sets `state.done`, and `seedDone` re-derives today's completion from the store. Strength tab lists sessions above exercise cards.
- D. Superset ordering; timer reads `Date.now()` end; `closeSheet` calls `strengthStop`; strength Start never reaches `RC.LiveSession`; finish idempotent; done-state derived at boot; the no-duplicate-function sweep stays green. Browser: log 3 sets, background 20 s, countdown still right; kill the sheet mid-rest, no second timer.
- E. Rollback: hide the Start branch.

**A6 · Progress — e1RM, suggested load, records**
- A. Turn the log into coaching.
- B. Each exercise shows best weight, estimated 1RM (labelled "estimated"), weight lifted per week and a trend. The kg box suggests the next load and says why. A new best gets a toast.
- C. `src/strength/progression.ts`: `epley1RM(w, r) = w × (1 + r/30)` for 1–10 reps (none for holds/bodyweight); `suggestLoad()` double progression — all sets at top of range → `+LOAD_STEP` (2.5 kg; 5 kg for barbell squat/hinge ≥ 40 kg), any set below range → −5%, else hold; last RPE ≥ 9 → hold; no history → `loadPercent1RM × best e1RM` or blank. `src/strength/records.ts` `detectStrengthRecords()` — heaviest set, best e1RM, most volume; strictly greater. Suggestion is a **placeholder**, never a value. Export via `entry.ts`; feed achievements.
- D. Epley values; each rule direction; a suggestion never appears in a written row (guard reads `value`, not `placeholder`); records strictly greater; "estimated" copy sweep. Re-break: flip a rule; write placeholder into the row.
- E. Beginners: no history ⇒ blank guidance.

**A7 · Standalone programmes + plan integration**
- A. Multi-week strength programmes that coexist with the running plan under explicit rules.
- B. Create a 4–12-week programme from the same questions. Its sessions appear on Today and the calendar on days that don't fight the running (never the day before your long run), and the plan's own strength steps aside so you're never asked to lift twice.
- C. `src/strength/programme.ts`: blocks — weeks 1–2 technique (2–3 × 8–12, 70%), 3–5 loading (3 × 6–8, 75–80%), 6+ heavy (3–4 × 3–6, 80%+), deload every 4th week (−1 set, −10%); A/B(/C) rotation. Sessions materialised as `EXTRA` entries (`:11474`) with ids `p<pid>-w<k>-s<j>`; `extraSession` (`:11661`) builds them so Today, calendar, reminders and `watchPayloadForToday` work unchanged. `placeProgramme()` in `adoptPlan` for future unmoved sessions: never long-run day, race day or eve; heavy lower never eve of long run or first quality day; ≤1 strength/day. `Athlete.strengthProgramme?: { active: true }` → `strengthSessionsFor` returns 0 with a plan note.
- D. Placement legality across 7 long-run days × 4 distances × 7 race weekdays; block progression monotonic with deload dips; plan strength 0 + note when active; `extraSession` output carries ids. Re-break: remove the eve rule; drop the note.
- E. Re-placement of unmoved future sessions only. Note `loadExtra` prunes past extras — history comes from the completion store.

**A8 · Strava — strength as "Weight Training"**
- A. Finished strength sessions reach Strava with the right activity type.
- B. Appears on Strava as Weight Training with duration and a sets/volume line, using the same connection and auto-send switch as runs.
- C. Worker `strava.ts:272,292`: `SPORT_TYPES = ["Run","WeightTraining"]`, read `sportType`, default Run, reject unknown; `/strava/status` reports `sportTypes`. Client `strengthStravaPayload()` (manual kind, `trainer:1`, distance 0) sent **only** when status lists WeightTraining — an old Worker would post a Run.
- D. Worker tests; payload shape; handshake gate re-broken (strength send refused against a status without WeightTraining).
- E. Deploy skew mitigated by the handshake. Wrangler deploy is your manual step.

**A9 · Apple Watch strength (native, Xcode-beta)**
- A. Log sets and run rest haptics from the wrist.
- B. A strength day on the watch shows the list; tap a set to log it (reps/weight prefilled), the wrist buzzes when rest ends, sets land in the phone's log.
- C. `watchSessionPayload` (`:8395`) adds `exercises`; WatchBridge key list (`WatchBridge.swift:652`) includes it. Swift `PlannedSession.exercises?`, `isStrength` → `StrengthView` replacing the refusal text (`SessionDetailView.swift:64-72`, `TodayView.swift:425`); `HKWorkoutSession` `.traditionalStrengthTraining/.indoor`; haptics via `WKInterfaceDevice`; sets return as `strengthLog` → `window.__interunStrengthLog`, idempotent like `__interunWatchRun`.
- D. Swift source guards (`watch-start-refusal.test.ts` style): payload key in the bridge list; strength never opens a `.running` config; ingest idempotent; **add the missing guard that `isRunnable` mirrors `PRIMARY_TYPES`**. Hardware: log a set, see the row on the phone.
- E. Needs an unlocked phone; ships independently of A1–A8.

### Track D — Launch hygiene (after A8)

**D3a · Safety before the plan** (`pc-safety`) — new wizard step `safety` first in both branches of `wizStepIds()` (`:22720`): `checks(FLAGS_PHYS)` + "None of these", `checkinConsent()` (the consent guard demands it), `EMERGENCY_BANNER()`. On Next: `RC.screenRedFlags`; emergency → "Get help first", plan not built; urgent/professional → guidance + explicit "I understand, continue"; else proceed. Tests: `safety` precedes `goal`; `wizardFinish` unreachable while blocked; onboarding tests green in three timezones.
**D3b · Under-18 gate** (`pc-youth`) — **your call; recommendation: adults only, said plainly.** `applyProfile` returns a `blocked: "under18"` result for age 12–17 (never a throw — `recompute()` runs at boot) and `adoptPlan` renders a kind notice pointing to a coach or junior parkrun; "Prefer not to say" stays allowed; nothing deleted. Tests: age 15 → blocked, 18 → plan; both forms show the notice.
**D3c · Wellbeing tick-boxes** (`pc-wellbeing`) — new `HUB_CHECKINS` card `wellbeing` with `checks(FLAGS_WELL)` + consent + banner, `runWb()` → `screenRedFlags` → `renderResult`; fix the two stale "proper symptom checker" sentences and point `alfieSafetyAnswer` (`:9720`) at it. Not inside `redflagsView` (guard forbids inputs there).

**D1 · Privacy policy + terms**
- A. Two static pages, truthful to the data map, linked from Support and the App Store, with a guard that stops in-app copy drifting.
- B. Write down exactly where each piece of data goes, once, and make the app check it never tells a different story.
- C. `docs/privacy/index.html`, `docs/terms/index.html` (hand-written; add to the rsync excludes in `ios/make-project.py:46`). URL `https://padder1980.github.io/Inte-Run/privacy/`. Sections and the facts each states: controller (you, UK); no accounts/analytics/crash SDK; on-phone data list; Ask Alfie (question, plan summary, last eight messages, opaque per-install id → your Cloudflare Worker → **Cloudflare Workers AI**, nothing stored, red flags handled on the phone); Strava (device key, tokens on the Worker hashed, add-only, disconnect revokes); weather + place names (Open-Meteo, Nominatim), map tiles (Mapbox, your token); Apple Health writes; calendar export; OTA page fetch from GitHub Pages; backup file contents (incl. Alfie chat and journals, never the Strava key or Mapbox token); retention/rights (export = access, erasure = disconnect Strava + delete app); children (adults only from D3b); dated Garmin placeholder. Terms: not medical advice (reuse `NOT_A_DIAGNOSIS`), stop-and-seek-help, no warranty, UK law. **Rewrite the false sentences** at `dataView :20716`, `connectView :20017`, voice packs `:19603`, and the stale `PrivacyInfo.xcprivacy` / entitlements comments; fix `alfie-proxy/README.md`'s model name. Support card `legal` in `HUB_TOOLS`, opens Safari.
- D. `test/privacy-copy.test.ts`: every `https://` host in the built page + the Worker's outbound hosts appears in the policy and vice versa; processor named matches `BRAIN`; every "no server / nothing uploaded" sentence registered as function + exact text so a rewrite is deliberate. Re-break both directions.
- E. **You must have the text legally reviewed** before external TestFlight. Rollback: pages are additive.

**D2 · TestFlight testers** — you: API key (App Manager) to `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8` + `issuer_id.txt`; internal group "Internal Testers" with emails. Opus: TESTFLIGHT.md step 2 (regenerate, archive, export, upload — `docs/voices/` clean), then `node tools/testflight-distribute.mjs <build> "Internal Testers"`. Tester brief under `docs/testflight/`: what works, Garmin pending, how to report (screenshot + the Support › Your data lines). Internal ≤100 needs no review; external needs Beta App Review + the D1 URL. Verify: script exits 0 naming the build; a tester's Your data quotes the build stamp.

**D4 · Submit checklist** — one page: done (`ITSAppUsesNonExemptEncryption=false`, usage strings, `PrivacyInfo.xcprivacy`, background modes, `ExportOptions.plist`); not done (privacy URL from D1; App Privacy label derived from the data map; screenshots iPhone 6.9"/6.5" + Watch via the `tools/story-shots.mjs` pattern; age rating adults-only; review notes on Health, background location, Watch, Live Activities, optional Strava, Alfie being AI; support URL; category). Verify: a dry-run "Submit for Review" reaches the confirmation with no red fields. Expect one rejection.

### Track S — Strava club (zero code + one row)
You create the club and give me the URL. App: `CLUB_URL` constant; a row in `viewCommunity()`'s empty feed state and a `HUB_LEARN` card, both `window.open(_blank)`. Copy pinned by test: "Join the Inte-Run club on Strava — the club lives on Strava, not in this app." Guard rejects "feed", "followers", "members" in that row.

### Track B — Running-layer parity + AI coach

Standing rules: every plan mutation uses the existing commit pattern (snapshot → mutate → `recompute()` → `computeToday(); seedDone(); restoreTicks(); saveProfileStore()` → `toastUndo`), never assign `PLAN` by hand; new Manage-plan rows are found by the reachability walk in `test/manage-plan.test.ts`; every stage ends in a choice.

**B1 · Manually add a run, link a run to a planned session, automatic Personal Records**
- A. One manual-entry path through `saveRuns()`, a link to the session it fulfilled, and PRs derived from history.
- B. Ran on a gym treadmill or another watch? Add it (distance, time, date, type, notes) and say "this was my planned session". Nothing is invented — no route, no splits, no heart rate. PRs at 5K/10K/half/marathon/5 mi/10 mi appear in Performance.
- C. Sheet from the Logbook "+" and the session sheet ("I did this elsewhere"); reuse `fmtDigitsToTime`/`bindTimeInput` and native selects. Record = `liveRunRecord` subset with `manual:true`, `id:"man-"+ms`, `route/splits/steps: null`; `pband/rband/anchor` only when linked (as `ingestWatchRun` does, `:8764-8804`); `state.logged.unshift` → `saveRuns()` → the three hooks (`shoeCreditRun`, `stravaMaybeAutoSend`, `clubMaybeAutoPost`). `syncHist` row gains `x: "manual"|"indoor"|"sim"` (absent = outdoor measured). Link store `interun_link_v1 { runId: { sid, wk, iso } }`; `seedDone` marks linked sessions done and prunes. PRs: derive from `interun_hist_v1` rows without `x`, plus manual PB entries; render in Performance; feed achievements; **`x` rows are excluded** from PRs.
- D. Driven: manual run → hist row with `x:"manual"`; link → `pband` present, `state.done` true after rebuild; `runVerdict` never judges pace on it; flags engine ignores it unless linked; PR excludes manual/indoor. Re-break: bypass `saveRuns` with a direct `setItem`.
- E. A fourth save path forgetting a hook — guard asserts the three hooks. Rollback: remove the sheet.

**B2 · Skip a single session** — row `{ kind:"skip", from, to, mode:"skip", sid }` in `interun_adjust_v1`; `adjDrops` gains `if (a.mode==="skip") return s.id===a.sid` **after** the race guard (`:6760-6766`); listed under Planned breaks with Cancel; a skipped session leaves RAW so it does not count as a miss (toast says so). Re-break: move the branch above the race guard.
**B3 · Time of day** — `interun_time_v1 { sid: "HH:MM" }`, pruned in `seedDone`; `buildSessionsIcs` (`:9500-9515`) emits timed `DTSTART/DTEND` + `TRIGGER:-PT30M` for timed sessions, all-day otherwise; `buildReminderSchedule` (`:8246-8298`) replaces slot "a" for that day with time − 30 min; native `<input type="time">` in the session sheet. Verify by parsing the `.ics` and the schedule item.
**B4 · Move a session ±1 week** — override gains `wk: ±1`; `applyCrossWeekMoves()` in `adoptPlan` after `applyAdjustments` moves the RAW session, sets `dayOfWeek`, re-derives both weeks with `RC.weekVolumeMeters` and re-projects with `RC.weekView`; refuse a target day holding a PRIMARY run, refuse `HARD_BEFORE_RACE` types on race eve (export the set — one definition), refuse into/out of race week; `seedDone` prunes stale. **Highest-risk B stage** (collision belt). Re-break: skip the re-projection and watch PLAN/RAW disagree.
**B5 · Return-speed choice** — when an `ease` window ends, write `interun_reentry_v1`; Today shows one card (weekly review suppressed) with Slowly / Balanced / Quickly mapped to existing mechanisms via `pauseTierFor(days)` (Balanced = one `recovery` row via `applyEaseWeek`; Slowly = two eased weeks or the pause rebuild tier), each quoting the km it produces. Re-break: remove the review suppression → two questions render.
**B6 · Missed-sessions realignment prompt** — from `easeWeekEvidence`: ≥3 trailing misses, or ≥7 / ≥28 days since the last `state.hist` row (the repo's own `PAUSE_TIERS` / `returnToRunningPlan` lines). Options by tier — ≥3: carry on / rearrange (uses B4); ≥7 days: extend (shift `raceDate`) / rebuild to original date; ≥28: start fresh (`startWizard`). Each quotes date/km like `pausePlanHtml`. Store `interun_realign_v1`, re-asks only when the tier rises; replaces the review card while showing. Re-break: fire from `state.done` → the "never from state.done" guard fails. Ship without "rearrange" if B4 slips.
**B7 · B-race**
- A. A secondary race inside the plan reshapes its fortnight through the engine.
- B. Add a 10K six weeks before your half: the week before gets lighter, race week keeps one sharpener and puts the race on the day, the week after starts with rest and an easy jog. The A-race and its taper are untouched.
- C. `profile.bRace = { distance, dateIso }` (→ `PLAN_PROF_FIELDS`, `DEFAULT_PROFILE`, journals); passed as `GenerateOptions.secondaryRace`. Engine: export `secondaryRaceWindow()` (shorter than A; week ≥ 2; ≤ last non-taper week — yields Runna's 7–10-day exclusion); `applySecondaryRace()` in `buildFull` after `applyRaceDay`: week before → `easeWeek(week, "race")` (new `EaseReason`) unless `isDeload`; race week → one `taperSession`, easy/long scaled by the B-distance race-week multiplier, `raceDay()` on the day, eve rule with `shakeoutSession`; week after → rest then a 25-min recovery jog; mark `PlannedWeek.secondaryRace`. `adjDrops` never removes `race`. Manage-plan row "Add a race" with window-bounded pickers and a `profileImpact` preview; listed under Planned breaks with Cancel.
- D. Window rules; A-race week byte-identical; taper cut ≥ 0.30; no adjacent hard days. Extend `tools/audit-progression.mjs` with a B-race axis that skips transitions into/out of `secondaryRace` weeks; sweep before/after. Re-break: place the B-race in the taper.
- E. Option absent → generator unchanged.
**B8 · Training preference dials**
- A. Three dials that each move one named constant, offered only where the plan can honour them.
- B. "How fast should mileage grow, how many hard days, how long may the long run get." Each shows its effect before you save; hidden where it would change nothing.
- C. Volume: `PEAK_VOLUME_MULTIPLIER` per plan — Progressive 1.25 (default, byte-identical), Gradual ~1.15, Steady ~1.05, `EASY_START_FRAC` following by derivation (`generate-plan.ts:438`); offered only when `volKm` is stated (else hidden and said why). Difficulty: Comfortable = `qualitySessionsThisWeek` → `min(byPhase,1)` outside peak; Balanced = today; Challenging = base gets 2 after the foundation block for ≥5 days and `vScale ≥ 0.9`, protected by the existing `intensityProfile/noWorse` post-condition and a note when it falls back. Longest run: `Athlete.longRunMaxMinutes` clamps `peakLong` in `buildAll` (never below `longFloorMin`); export `longRunRangeFor()` so the picker offers reachable values. Fields → `PLAN_PROF_FIELDS`, `SETUP_TOPICS.rhythm`, wizard; hidden for beginner tracks.
- D. Audit extended with the three axes before/after; `test/session-library.test.ts` intensity sweep gains them; defaults byte-identical across the grid; each non-default value changes ≥1 week; taper ≥ 0.30 and week-one ≤ 1.10 hold. Re-break: set Steady to 0.9.
- E. Values are proposals; the sweep picks them. Fields absent → defaults.
**B9 · Plan queue, drafts, post-race handover** — `interun_queue_v1 [{ id, name, status:"draft"|"upcoming", prof, createdIso }]` (intent, separate from the journal's record of blocks that ran); wizard "Save for later"; adoption factors `reusePlan` into `adoptProf(prof, newDate)`; handover card on Today when `raceDate < today` and no later plan: start the next plan / recovery week / keep this one, with dates; re-anchor `recentTimeS` from the logged race **as an offer**. "Your plans" screen: current / upcoming / drafts / completed / incomplete. Re-break: adopt by assigning `PLAN`.
**B10 · Briefing + insight fact packs with rule-based text (free, offline)** — `briefingFacts(sess, iso)` from existing sources only (`sessionStages`, description, `warmupCardFor`, `heatOffer`, `RC.fuellingFor`, phase/week, last run of the same type via `runVerdict` + RPE, readiness); `briefingText(facts)` templates like `debriefParagraphs`; card in the session sheet for sessions ≤ tomorrow. `insightFacts(run)` from `runAnalysis`, `runVerdict`, `debriefParagraphs`, `runEvidenceConfidence`, RPE, `alfieNextSession`, `logTotals`; thumbs `run.react` saved via `saveRuns()`; insight renders after the reaction. Cache `interun_brief_v1`, pruned in `seedDone`. Guards: every number in the text is in the fact pack; no second derivation; no plan-changing call reachable from the card; medical-claim sweep.
**B11 · AI expansion through the Worker, gated** — reuse `POST /` with `mode:"briefing"|"insight"` + `context` = facts (branch before the "no question" 400); `MODE_EXTRA[mode]`: only the numbers given, ≤80 words, no diagnosis, no plan changes. New KV buckets `rl:brief:` with `GLOBAL_BRIEF_DAILY` (~40) and `PER_DEVICE_BRIEF_DAILY` (~3) checked before the model; `GET /` reports them. App: "Expand with Alfie" tap, once per session id; reply passes a **no-new-numbers filter** (every number must occur in the serialised facts) and a medical-term sweep, else the rule text stays; cached `src:"ai"`. When `BRAIN` moves to Claude, briefings use Haiku. Re-break: remove the number filter.
**B12 · Yoga / Pilates / Stretch & Stability (later)** — `src/science/mobility-sessions.ts`: `Pose {id, name, seconds, bothSides, breaths?, area, cue, pattern}`, `composeSession(type, minutes, level)` from a pool, unlock `level = min(max, weeksOnPlan+1)` derived from `CURRENT_WEEK` (never stored); `profile.mobility {type, days, minutes}` → `GenerateOptions.mobility` → `buildWeek` emits `mobility` sessions on those days (non-PRIMARY; no watch); player generalised from `STRETCH`; `exerciseBlock` hold mode; new `POSES` silhouettes. ~30 poses minimum for three types × 10/20/30 min — **authoring is the bulk**; ship one type first. Extend `test/stretches.test.ts` copy bans; holds sum equals the advertised total; placement never lands two runs on a day.

### Track C — Garmin (the day approval lands)

**C1 · Server** — `alfie-proxy/src/garmin.ts` (routes) + `garmin-map.ts` (pure mapping, unit-tested) mirroring `strava.ts`: expected OAuth 2.0 + PKCE, single-use nonce, tokens at `gtok:<sha256("interun-garmin:"+deviceKey)>` via one `subjectHash()` commented for future re-keying to a user id, reverse index `guser:<garminUserId>` (webhooks arrive by Garmin user). Mapping: warmup→WARMUP, rep/steady→INTERVAL, recovery→RECOVERY, cooldown→COOLDOWN; duration→TIME, distance→DISTANCE; pace band → speed m/s; RPE-only steps open-target; rep+recovery with shared `repeatCount` fold into one repeat group (6 × 1 km = 2 steps × 6); names truncated to 15 chars; refuse >50 steps; strength never pushed. Phone POSTs a **plan snapshot** (next 28 days) to `/garmin/plan`; Worker pushes 14 days now and a cron `0 6 * * 1` (new `[triggers]` in `wrangler.toml`) re-pushes; `gpush:` maps session id → Garmin workout id so rebuilt sessions replace, not duplicate; stale snapshots (>21 days) skipped and reported. Webhook: 200 fast, verify, fetch detail in `waitUntil`, store `ginbox:` (30-day TTL); `/garmin/inbox` + `/garmin/ack`. Add the Garmin section to D1. **Confirm on approval:** OAuth version/scopes, workout JSON schema and real caps, schedule/delete endpoints, push vs ping and its auth, sample formats, rate limits, production review, key lifetime.
**C2 · Phone** — replace the "Planned" row (`:20007`) with a Garmin row (`stravaDevMode()` gate pattern), `garminSheetHtml()` copied from `stravaSheetHtml`, key `interun_garmin_v1` in `BACKUP_NEVER`, `garminResume()` beside `stravaResume()` (`:36987`); snapshot upload from inside `syncWatch()` (`:9431`, the existing "plan changed, tell the device" point); inbox ingest calls **`ingestWatchRun(run, "garmin")`** (add a source parameter — one commit point); dedupe by `garmin:<id>` and a cross-source match (same day, start within 10 min or duration+distance within 5%) attaching the id to an existing run; pushed workout id → session title ticks the plan; Strava auto-send off for Garmin-sourced runs. Copy: "Garmin cannot play your coach's voice; strength stays in the app."
**C3 · Hardware test** — you connect your Garmin; 14 days appear with readable names; run one interval session; sync; the run appears in Inte-Run **once** (also once with the Apple Watch recording too); splits, HR, plan tick correct; Strava shows one activity.

### Separate planning rounds (COMPLEX by your rules — not costed here)
1. **Non-race modes + recovery block** — `generateMaintenancePlan(athlete, {weeks, targetKm, mode})` reusing `buildWeek` with an all-base schedule, no taper, no `applyRaceDay`, synthetic 10K for pace derivation; recovery mode 1–2 weeks at ~50% peak. The complexity is the **app**: every reader of `PLAN.goal.race`, `profile.raceDate`, feasibility, `alfieRaceFacts`, chart race flag, `.ics`, journal `goal`, wizard goal step must tolerate no race. Inventory first. Start after B7–B9.
2. **Accounts, sign-in (Sign in with Apple), cloud sync, real Inte-Club network, moderation, Android, payments.**

---

## Tweak-round rules during implementation
- **Quick tweak** (small, low risk, no architecture/dependency change) → do it inside the current stage.
- **Large tweak** (real work, behaviour understood, architecture unchanged) → its own tweak round, no new planning.
- **Complex tweak** (architecture, data model, permissions, watch/server relationships, major dependency, several approaches, regression risk) → a planning round, then an implementation round.

## Opus per-stage prompt (use verbatim, fill the <…>)
```
You are implementing ONE stage of the Inte-Run plan: <STAGE ID + TITLE>.
Repo: /Users/adampalmer/Developer/InteRun. Read CLAUDE.md sections 1–4 and DESIGN.md first; git pull.
Objective: <A>. In one sentence for a non-programmer: <B>.
Do exactly: <C bullets>. Do not do anything from other stages; do not restate the plan.
Non-negotiables:
- No backticks anywhere in runtime JS, including comments. Escape regex backslashes as \\d.
- After every build read the exit code; then `git status --short docs/voices/` must be clean.
- Never `git checkout` to undo a re-break; copy the file aside and copy it back.
- Slice functions by brace-matching (fnOf), never by character windows.
- Guards are derived from the source and driven by re-breaking; watch each new test fail first.
- Run `npm run verify` (or the documented recipe if T1 is not in yet) and quote its summary line.
- Update CLAUDE.md ("Write down …" entry) and docs/roadmap/index.html (new dated BATCHES key,
  never edit an old one) in the owner's plain English, only if this stage ticks a step.
- Ask before anything irreversible: deploys, secrets, hooks, deletions, pushes, App Store actions.
Style: concise, plain English, ELI5 where a term is unavoidable, no essays, no unexplained jargon.
Verification to perform: <D bullets>.
Finish with exactly three short sections: (1) What changed — files and behaviour;
(2) What was tested — commands, counts from the run, re-breaks caught/escaped;
(3) What remains unresolved — including anything you assumed and could not confirm.
```

## Verification (end-to-end, for the whole programme)
- Every stage: `npm run verify` green (build 0, voices clean, 3 blocks `node --check`, tsc = 1 pinned error, tests 0 fail × 3 timezones, audits unchanged or better), re-breaks all caught, and the served page driven in a real browser for UI stages.
- Strength track acceptance: log sets → rebuild the plan with a different long-run day → history intact; a 4-session/60-min/Advanced/barbell profile builds sessions using only owned equipment, never on the eve of the long run; player rest timer correct after 20 s backgrounded; e1RM and suggestion match hand arithmetic; a programme's sessions appear on Today and never on race eve; a finished session shows under Activities → Strength and on Strava as Weight Training.
- Parity acceptance: manual run excluded from PRs; skip/time/±1-week each verified through the `.ics`, the reminder schedule and PLAN/RAW agreement; B-race week before eased, A-race untouched, audit clean; dials change the plan where offered and are hidden where they can't; briefing text contains no number absent from its fact pack.
- Launch acceptance: policy hosts == page hosts (both directions); the three false sentences gone; safety step blocks an emergency answer; under-18 sees the notice; testers see the build.
- Hardware (your part): locked-phone run, watch-start run, Garmin interval run — each read back from Support › Your data.

## Sources
- https://www.runna.com/ · https://www.runna.com/press/runna-announces-new-updates
- https://support.runna.com/en/collections/3431949-app-features-subscriptions-faqs · /3518513-strength-mobility · /3431932-training-hub · /3431943-injury-management · /3431925-nutrition · /3954841-triathlon-training · /11011949-races-events · /16740555-app-features
- https://support.runna.com/en/articles/15624879-adding-strength-training-to-your-runna-plan · /15623522-adding-yoga-pilates-and-stretch-stability-to-your-runna-plan · /16595772-in-app-community · /7895279-what-is-my-runna-score · /12730010-everything-you-need-to-know-about-runna-levels · /14656203-what-are-pace-insights-and-how-do-they-work · /10494265-what-are-workout-insights · /13169751-what-are-workout-briefings · /11794078-what-are-mileage-insights · /10026375-how-to-use-the-plan-realignment-feature · /10393191-how-to-use-training-preferences · /10116460-how-to-use-instant-workouts · /13531498-how-to-use-not-feeling-100 · /15012850-how-and-when-to-skip-a-run-managing-missed-sessions-in-your-training-plan · /11027305-how-to-follow-a-route-on-runna-apple-watch · /6306200-using-your-apple-watch-with-runna-and-getting-the-most-out-of-it · /14302433-using-your-smart-watch-with-runna · /6169639-using-your-garmin-watch-with-runna · /15231838-how-does-runna-build-your-training-plan-around-your-current-fitness · /15443877-how-to-create-a-training-plan-in-runna · /15586762-managing-your-current-upcoming-and-draft-plans · /10137793-how-to-use-your-training-calendar · /7895208-how-do-personal-records-work-in-the-runna-app · /14666681-how-to-log-link-or-manually-add-an-activity · /15899152-how-can-i-incorporate-cross-training-in-runna · /8159780-setting-up-and-managing-your-audio-cues · /10856802-how-to-add-and-manage-your-b-race · /15690947-understand-your-runna-workouts · /15647483-how-does-runna-adapt-my-workouts-for-heat-and-humidity · /6206280-how-can-i-adjust-my-plan-to-add-extra-runs-parkrun-and-club-runs · /11626438-strava-runna-subscription-guide · /11093973-strava-runna-acquisition-faqs
- https://press.strava.com/articles/strava-to-acquire-runna-a-leading-running-training-app · https://therunninggenie.com/blog/is-runna-still-worth-it-after-strava-acquisition · https://www.runningwestwardho.co.uk/post/runna-app-updates-2026-smarter-training-plans-adaptive-coaching-new-features-explained · https://www.wareable.com/running/runna-adapt-for-heat-post-race-recovery-update · https://9to5mac.com/2026/07/29/runna-now-automatically-adapts-training-paces-based-on-heat-and-humidity/ · https://runwithrachel.co.uk/runna-app-review/ · https://therunnerbeans.com/runna-coaching-app-review/
