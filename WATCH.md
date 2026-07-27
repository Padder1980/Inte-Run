# WATCH.md — Apple Watch companion: scoping and decision document

**Status: Phase 1 is BUILT and runs. See `ios/InteRunWatch/`.**

The watch app exists: it receives today's session from the phone over WatchConnectivity and runs a
live workout on the wrist — timer, GPS distance, live pace and heart rate from an `HKWorkoutSession`.
Verified on a paired simulator (screenshots and numbers in `ios/README.md`). What is *not* yet done
is the engine port, step-by-step prompts, coach audio, and sending the finished run back to the plan.

**Decisions taken 2026-07-27 (with the owner):**
- **Option B confirmed** — native iOS app + watch app. The iOS app exists now (see `ios/` and the
  native-app section of `CLAUDE.md`); it is a **hybrid** shell running the existing web UI.
- **iPhone first, watch second.** The phone app is the thing the watch pairs with.
- **The owner has a real Apple Watch**, so GPS and heart rate can be validated on hardware.
- Xcode **27.0 beta** is installed and the **watchOS 27 simulator runtime is already available**
  (it shipped bundled; iOS had to be downloaded separately). The old blocker below is cleared.

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

**Alternative to porting — ruled out for the watch (verified 2026-07-27).** The idea was to keep the
engine in TypeScript and run it on-device via JavaScriptCore. Checking the installed SDKs directly:

```
Platforms/iPhoneOS.platform/…/System/Library/Frameworks/JavaScriptCore.framework   ✅ present
Platforms/WatchOS.platform/…/System/Library/Frameworks/JavaScriptCore.framework    ❌ absent
```

**JavaScriptCore does not exist on watchOS.** So the bridge is available on iPhone but impossible on
the watch — the watch needs real Swift. The saving grace is that it needs only what it uses
(`session-runtime` + `paces`, roughly 950 lines), not all 5,200, and the 143 existing tests are the
executable spec that proves the port is faithful.

On iPhone the question is moot anyway: the hybrid shell runs the engine inside the web view.

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
| **Xcode** | ✅ Done — 27.0 **beta** at `/Applications/Xcode-beta.app`, watchOS 27 simulators present. Note a beta Xcode **cannot submit to App Store Connect**; release Xcode is needed to ship. |
| **Apple Developer Program** | ✅ Joined (2026-07-27). |
| **A real Apple Watch** | ✅ The owner has one. Simulators cannot produce real GPS or heart rate, so final validation happens on it, outdoors. |
| **App Store review** | Days to weeks for the first submission. Health-adjacent apps get more scrutiny — the safety/escalation behaviour must be defensible. |
| **Two codebases** | The PWA and the native app would both exist. Decide early whether the web app stays the primary product or becomes a marketing/demo surface. |

## 6. Suggested phasing

Each phase is independently useful, so it can stop at any point without waste.

- ~~**Phase 0 — decide.**~~ ✅ Done 2026-07-27: option B, hybrid iOS shell, iPhone first. The PWA
  stays live on GitHub Pages and remains the design surface.
- ~~**Phase 1 — spike.**~~ ✅ **DONE.** A watchOS app that plays a *hard-coded* session: timer, steps,
  GPS distance, HR. Proves the hard part (live session on the wrist) before porting anything.
- **Phase 2 — engine on device. ← NEXT.** Port (or JavaScriptCore-bridge) `session-runtime` + `paces` +
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

1. ~~Does the PWA stay the product?~~ ✅ The PWA stays live and remains the design surface; the
   native app wraps it. Still open longer term: which one is marketed as *the* product.
2. ~~Apple Developer Program?~~ ✅ Joined.
3. **Still open:** is the first watch milestone *"run a session on my wrist"* (Phase 1), or would a
   plan-viewing complication land sooner and be worth more day to day?
