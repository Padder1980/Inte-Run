# WATCH.md — Apple Watch companion: scoping and decision document

**Status: not started. This is a decision document, not a plan of record.**

You said the watch is "crucial eventually". This file exists so that when we start, we start from a
real understanding of what's involved — and so any future Claude session (on either account) picks
up the same context. Nothing here is built yet.

---

## 1. The one fact that shapes everything

**A watchOS app cannot pair with a PWA.**

InteRun today is a web app — one self-contained page served by GitHub Pages, running in Safari or
as a Home Screen icon. A watchOS app is a native Swift binary distributed through the App Store.
There is no supported channel between the two: no shared storage, no WatchConnectivity to a website,
no background handoff. Apple Watch cannot run web apps at all.

So "add a watch companion" is not an increment on the current app. It means **starting a native
codebase**, and choosing how it gets a training plan.

## 2. The three real options

| | What it is | Plan comes from | Cost / effort | Verdict |
|---|---|---|---|---|
| **A. Standalone watchOS app** | A watch app with no iPhone app. Generates and stores the plan on the watch itself. | Ported engine running on-watch | Medium build, but a **painful setup UX** — entering a goal, race date and fitness on a watch screen is miserable | Not recommended as the first step |
| **B. Native iOS app + watch app** ⭐ | The real answer. An iOS app (which can reuse the engine) plus a watch app that syncs over WatchConnectivity. | iPhone app → watch | Largest build: two targets, App Store review, ~£79/yr | **Recommended destination** |
| **C. Watch app + web handoff** | Watch app that imports a plan exported from the PWA (QR code or a short pairing code). | PWA → export → watch | Avoids a full iOS app, but the import flow is clunky and fragile | Useful stopgap only |

**Recommendation: B**, reached in phases (see §6). It's more work up front, but A and C both spend
effort on workarounds that B deletes.

## 3. What actually ports — the good news

The training engine in `src/` is **5,200 lines of dependency-free TypeScript** (`"dependencies": {}`
— nothing but the standard library) with **1,380 lines of tests pinning its behaviour**. It is pure
logic: no DOM, no browser APIs, no I/O.

That makes it genuinely portable to Swift, and — more importantly — **verifiable**: the 122 existing
tests are an executable specification. Port a module, port its tests, compare outputs against the TS
implementation on the same inputs.

| Module | Lines | Ports to Swift? | Notes |
|---|---:|---|---|
| `plan/session-templates.ts` | 753 | Yes | Biggest single chunk; pure data + assembly |
| `plan/generate-plan.ts` | 596 | Yes | Core plan builder |
| `live/session-runtime.ts` | 356 | Yes | Drives a live session — exactly what the watch needs |
| `live/coach-prompts.ts` | 259 | Yes | Prompt catalogue; audio files already exist as MP3s |
| `science/*` (paces, MAS, critical speed, fitness) | ~600 | Yes | Straight maths |
| `safety/*` (escalation, RED-S, female health) | ~500 | Yes | Must port faithfully — this is the health-critical code |
| `readiness/`, `adapt/`, `athlete/`, `progress/` | ~800 | Yes | Pure logic |
| `view/plan-summary.ts` | 206 | Partly | Presentation shaping; the watch will want its own |

**Alternative to porting:** keep the engine in TypeScript and run it on-device via JavaScriptCore
(built into iOS/watchOS). Saves the port and keeps one source of truth, at the cost of a JS bridge
and slower cold start. Worth prototyping before committing to a full Swift rewrite — a plan is
generated once, not per frame, so the performance argument for native is weak.

## 4. What the watch should actually do

Ordered by value, not by ease:

1. **Run the session** — the real prize. Start today's session from the wrist, live pace/distance/
   lap, step-by-step prompts ("2 minutes at threshold"), and the coach voice through AirPods. On the
   watch this uses native GPS and heart rate, and **works with the phone left at home** — the thing
   a PWA fundamentally cannot do.
2. **Heart rate** — genuinely new data. The current app has no HR; the watch would unlock HR zones,
   drift, and much better readiness estimates.
3. **Today at a glance** — a complication showing today's session on the watch face.
4. **Auto-sync completed runs** back to the plan (ticking sessions off, feeding Performance).
5. **Readiness check-in** on the wrist in the morning.

Not worth building on the watch: plan setup, the Plan tab, Activities history, Support. Those belong
on a bigger screen.

## 5. Prerequisites and cost — the honest list

| Item | Detail |
|---|---|
| **Xcode** | Not installed on this Mac (Command Line Tools only — no `xcodebuild`, no watchOS simulators). Several GB from the App Store; needs your password. **This is the current blocker.** |
| **Apple Developer Program** | ~£79/year. Required to run on a real Apple Watch and to ship. The simulator works without it. |
| **A real Apple Watch** | Simulators cannot produce real GPS or heart rate. Final validation must be on hardware, outdoors. |
| **App Store review** | Days to weeks for the first submission. Health-adjacent apps get more scrutiny — the safety/escalation behaviour must be defensible. |
| **Two codebases** | The PWA and the native app would both exist. Decide early whether the web app stays the primary product or becomes a marketing/demo surface. |

## 6. Suggested phasing

Each phase is independently useful, so it can stop at any point without waste.

- **Phase 0 — decide.** Confirm option B, and whether the PWA remains the primary product.
- **Phase 1 — spike (needs Xcode).** A watchOS app that plays a *hard-coded* session: timer, steps,
  GPS distance, HR. Proves the hard part (live session on the wrist) before porting anything.
- **Phase 2 — engine on device.** Port (or JavaScriptCore-bridge) `session-runtime` + `paces` +
  the safety modules. Port their tests alongside; they must pass against the same fixtures.
- **Phase 3 — iOS app.** Setup/profile/plan on the phone, WatchConnectivity sync to the watch.
- **Phase 4 — polish.** Complication, auto-logging back to the plan, coach audio, readiness.

## 7. What can be done before Xcode exists

Nothing on the watch itself — but two things de-risk it:

- **Harden the engine's test suite** as the port specification. Anywhere the tests are thin, the
  Swift port has nothing to check itself against.
- **Prototype the JavaScriptCore bridge decision** by measuring how the engine behaves when run
  outside a browser (it already does — `node --test` runs it headless), which is a good proxy.

---

## Open questions for the owner

1. Does the **PWA stay the product**, with the watch as a companion — or does the native app become
   the product and the PWA the shop window?
2. Are you willing to run the **Apple Developer Program** (~£79/yr) and the App Store review cycle?
3. Is the first watch milestone **"run a session on my wrist"** (Phase 1), or would a plan-viewing
   complication land sooner and be worth more day to day?
