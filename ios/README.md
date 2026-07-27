# ios/ — the native iPhone app

The App Store build of InteRun. A native shell that runs the existing web app, so there is still
**one UI to design and maintain** (`web/app.ts`), while the shell adds the things a PWA can never do.

> Read `../CLAUDE.md` first. This directory does not replace the PWA — GitHub Pages keeps serving it.

## How it fits together

```
web/app.ts ──node web/app.ts──▶ docs/ ──"Embed web app" build phase──▶ InteRun.app/web/
                                  │                                          │
                          GitHub Pages (PWA)                    interun://app/index.html
```

`docs/` is the single source of truth. Nothing is copied into git — the build phase rsyncs it into
the bundle every build, minus `roadmap/`, `walkthrough.html` and `coverage.html`, which never ship.

**Always rebuild the web app before building in Xcode:**

```bash
node web/app.ts
```

## Why a custom URL scheme, not file://

The page is served from `interun://app/…` by `BundleSchemeHandler`, not loaded as a `file://` URL.

- WKWebView **blocks `fetch()` on file URLs**, and the app fetches `voices/manifest.json` to find
  out which coach clips exist. A custom scheme gives the page a real origin, so `fetch` works.
- `localStorage` — which is the app's entire database — is keyed by origin and persists properly.
- The handler implements **HTTP range requests**, without which `<audio>` refuses to play the
  coach MP3s.

⚠️ **The origin string is load-bearing.** `localStorage` is keyed to `interun://app`. Changing the
scheme or host in a later version would orphan every existing user's profile, plan and run history.
Fix it once; never touch it.

The service worker registration in `app.ts` is already gated on `location.protocol` being http(s),
so it silently skips under this scheme. Nothing to change — the bundle is already offline.

## Layout

| Path | What |
|---|---|
| `InteRun/InteRunApp.swift` | `@main`. Configures the audio session for background playback. |
| `InteRun/WebHost.swift` | The `WKWebView`, full-bleed. Sends off-site links to Safari. |
| `InteRun/BundleSchemeHandler.swift` | Serves the bundled `web/` over `interun://app`, with ranges. |
| `InteRun/Assets.xcassets` | App icon (rendered from `BRAND_MARK`), accent + launch colours. |
| `InteRun-Info.plist` | Permissions, background modes, launch screen. |
| `make-project.py` | Generates `InteRun.xcodeproj`. See below. |

`InteRun/` is a **synchronized folder group**, so new Swift files added there are picked up with no
project edit.

## Regenerating the Xcode project

`InteRun.xcodeproj/project.pbxproj` is generated so the build-phase shell script can be written as
ordinary shell and escaped correctly:

```bash
python3 ios/make-project.py
```

This **overwrites** the project file. If you have changed build settings in Xcode's UI, mirror them
into `make-project.py` first, or you will lose them.

## Setup, once

1. Accept the Xcode licence — needed once per installed Xcode, and until it is done every
   `xcrun`-shimmed tool (including `git`) fails with a licence error:
   ```bash
   sudo xcodebuild -license accept
   ```
2. Install the iOS simulator runtime (8 GB; the install step needs root, which is why an
   unprivileged `xcodebuild -downloadPlatform iOS` exits 0 having done nothing):
   ```bash
   sudo xcodebuild -downloadPlatform iOS
   ```
3. Open `ios/InteRun.xcodeproj`, select the **InteRun** target → **Signing & Capabilities**, and set
   your team. The bundle ID is `com.interun.app` — change it if you want a different one, and
   register the same value in App Store Connect.

## Building

```bash
xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun -sdk iphonesimulator -configuration Debug build
```

## Smoke test

The hybrid shell rests on four things that are invisible from the outside — a broken one shows up as
an app that merely *looks* fine. `SelfCheck.swift` proves them headlessly:

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  xcrun simctl launch <udid> com.interun.app -InteRunSelfCheck YES
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  xcrun simctl spawn <udid> log show --last 20s --style compact \
  --predicate 'subsystem == "com.interun.app"' | grep -o 'RESULT.*'
```

Last run (iPhone 17 Pro, iOS 27.0) — all green:

```json
{ "origin": "interun://app", "localStorageWrites": true, "priorValue": "1785139778002",
  "fetchStatus": 200, "coaches": ["guide","pacer","motivator","technician"], "clipCount": 168,
  "range": { "status": 206, "contentRange": "bytes 0-99/25248", "bytes": 100, "ok": true },
  "audio": { "ok": true, "duration": 3.14 }, "engineLoaded": true, "appBooted": true }
```

`priorValue` is the persistence proof: it is written on one launch and read on the **next**, which is
the only honest way to show `localStorage` survives to disk under the custom scheme. A value read
back within the same session proves nothing.

## Simulator notes

- The iOS **27** runtime only works with **Xcode 27 beta**. Release Xcode 26.6 reports
  *"Found no destinations"* against it — fine, because submission archives for a device and needs
  no simulator runtime at all. Use the beta for simulator work, release for shipping.
- Boot, install, launch:
  ```bash
  xcrun simctl boot <udid> && xcrun simctl install <udid> path/to/InteRun.app && xcrun simctl launch <udid> com.interun.app
  ```

## Moving a runner's data in from the PWA

Safari's storage for `padder1980.github.io` and this app's storage for `interun://app` are separate
origins in separate sandboxes. **Nothing crosses automatically, and no native code can reach in and
take it** — the runner has to carry a file across. That path is now built, and it lives in the web
layer (`dataView()` in `web/app.ts`), so the same screen serves both sides:

1. In the browser: **Support › Your data › Export a backup** → the iOS share sheet → AirDrop/Files.
2. In the app: **Support › Your data › Restore from a backup** → pick the file → confirm.

Verified in the app: `navigator.share` with files works in WKWebView (`canShareFiles: true`), so
export uses the native share sheet; `<input type="file">` opens the document picker, so restore is
reachable; and a full export → wipe → restore cycle inside the web view came back byte-identical.

`Downloads.swift` handles the `<a download>` fallback (and the calendar `.ics`, which silently did
nothing before): the file becomes a real `WKDownload` and is handed to the share sheet.

Restoring **replaces** rather than merges — merging two histories would create duplicate runs nobody
could untangle. The confirm sheet shows both sides and offers to export the current device first.

## Background GPS

`LocationService.swift` + `GeolocationShim.swift` keep a run tracking with the phone locked or
pocketed — the headline reason to be native at all, since WKWebView's own `navigator.geolocation`
stops the instant the app leaves the foreground.

Rather than change the web UI, the shim **replaces `navigator.geolocation`** with one backed by
`CLLocationManager`, injected at document start. `web/app.ts` keeps calling the ordinary Web API and
behaves identically in a browser — the shim only installs itself when the native handler exists.

Beyond survival, the native manager gives `activityType = .fitness` and `bestForNavigation`
accuracy. `allowsBackgroundLocationUpdates` is claimed **only while a watch is active**, and
`pausesLocationUpdatesAutomatically` is off (iOS otherwise decides a runner has stopped and quietly
pauses for good).

**Fixes are buffered and replayed in order.** iOS may suspend the web content process even while the
app keeps running on the location background mode. Distance is accumulated incrementally from
consecutive fixes, so replaying a backlog yields the same total as receiving them live.

Verified on the simulator with a moving location (`simctl location start`), backgrounding the app
behind Settings mid-run: **35 fixes over 36 s with a maximum gap of 3 s**, across a 16 s window
where InteRun was not frontmost. Had background tracking failed there would be a 16 s hole.

```bash
xcrun simctl privacy <udid> grant location com.interun.app
xcrun simctl location <udid> start --speed=3.3 --interval=1 53.3811,-1.4701 53.4200,-1.4701
```

## Session reminders

`NotificationService.swift` makes reminders real. Two things were wrong before: a web timer dies with
the tab, **and WKWebView has no `Notification` API at all**, so in the app the whole feature was inert
— the sheet simply declared itself unsupported.

Now the page hands over a *schedule* — every upcoming session day at each configured time, with the
session title, duration/distance and a motivational quote — and `UNUserNotificationCenter` fires them
whether or not InteRun is running.

- **iOS keeps at most 64 pending local notifications** and silently drops the rest, so the list is
  capped at 60 and re-synced (debounced) on launch, on any reminder change, and after any plan
  rebuild via `recompute()`.
- The schedule is **replaced wholesale**, not diffed: a stale reminder for a session that no longer
  exists is worse than a missing one.
- `willPresent` returns `.banner` so a reminder still shows when the app is open.
- ⚠️ **`UNCalendarNotificationTrigger` matches to the minute.** A time inside the current minute has
  a start already in the past and never fires — this cost a confusing "delivered: 0" during testing.
  The builder only schedules future minute boundaries.
- The sheet copy adapts: on the web it still says a web app can only notify while open, in the app it
  says the phone holds them. Telling app users their reminders are unreliable would be a lie.

Verified end to end on the simulator: permission granted, 60 built with unique ids, **60 actually
pending with the OS**, next fire at the correct local time, and a scheduled notification **delivered**
(confirmed via `getDeliveredNotifications`, not just registered).

## The Apple Watch app (`ios/InteRunWatch/`)

A **single-target watchOS app** (`WKApplication`), embedded in the iOS app under `Watch/` and
generated by `make-project.py` alongside the phone target.

| File | What |
|---|---|
| `SessionStore.swift` | Receives today's session from the phone; caches it so the wrist is useful offline. |
| `WorkoutManager.swift` | `HKWorkoutSession` + `HKLiveWorkoutBuilder` + GPS. The live run. |
| `TodayView.swift` | Today's session and one Start button. |
| `WorkoutView.swift` | The four live pages, plus the finish summary. |
| `PaceBandView.swift` | Live pace against the plan's prescribed band. |
| `EffortView.swift` | The 1–10 RPE ask, on the crown. |
| `RouteMapView.swift` | The shape of the run, drawn from the GPS trace. |

The phone extracts **only today's session** and relays it over `updateApplicationContext`
(latest-value-wins, delivered even when the watch app is not running). It comes from the web layer —
`watchPayloadForToday()` in `web/app.ts` — so the page still owns what the watch is told. An absent
`session` means a rest day, which the watch shows differently from "not synced yet".

### The live run: four pages

Laid out the way a runner's thumb already knows from Apple's Workout app —
**Controls ← Metrics → Session → Music** — landing on Metrics, because that is the page you glance
at and the controls being one swipe away is what stops a stray touch ending your run.

- **Controls** — End, Pause/Resume, **Lock screen** (Water Lock, so rain and a sleeve cannot tap
  anything), and Skip step.
- **Metrics** — elapsed; how much of the current step is left; the **pace band**; heart rate;
  current *and* average pace; a progress bar and total distance.
- **Session** — the step you are in with its target and progress, and what comes next.
- **Music** — the system's own `NowPlayingView`, so it controls whatever is actually playing
  (Spotify, a podcast, Music), not only something InteRun owns.

The finish screen shows the session title, the **route drawn from the GPS trace**, distance, time,
average pace and average heart rate — then asks for effort.

Two drawing notes, both learned by looking at it on a watch:
- `ProgressView`'s `.tint` colours the whole track on watchOS, so a 1%-complete run rendered as a
  finished one. The session progress bar is drawn explicitly instead.
- `RouteMapView` corrects longitude by `cos(latitude)`. Without it every route comes out stretched
  sideways. No map tiles: they need a network the watch may not have, and what you recognise at the
  end of a run is the shape of your own route.

Deliberately **not** on the watch: plan setup, history, Support. Those want a bigger screen.

### Traps this cost

- ⚠️ **`allowsBackgroundLocationUpdates` must never be set on watchOS.** CoreLocation asserts and
  kills the app — even with `location` in `WKBackgroundModes`, which I verified does not help. The
  running `HKWorkoutSession` is what keeps the app and its GPS alive on the wrist; the property is
  an iOS concept. This crashed the app twice before the cause was clear.
- ⚠️ **Never pass `-sdk` to `xcodebuild` for this project.** It overrides `SDKROOT` for *every*
  target, so the watch app gets built against the iOS SDK and `actool` fails with an unhelpful
  "app icon set … did not have any applicable content". Use `-destination` instead.
- watchOS needs the **classic multi-size icon set**, not iOS's single 1024. Generated from the same
  `BRAND_MARK` vector.

### Building and running it

```bash
node web/app.ts && DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
  xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=27.0' build
```

Then install both halves onto a **paired** simulator set (`xcrun simctl list pairs`); the embedded
watch app is already built for `watchsimulator`:

```bash
xcrun simctl install <phone-udid> InteRun.app && xcrun simctl install <watch-udid> InteRun.app/Watch/InteRunWatch.app
```

Verified on Apple Watch Series 11 (46mm), watchOS 27, paired with iPhone 17 Pro Max: the session
handover arrives on the wrist, and a workout shows a running timer, accumulating GPS distance, live
heart rate from HealthKit, and a pace of **5:03/km** against a simulated 3.3 m/s — which is exactly
right (1000 ÷ 3.3 = 303 s).

## Closing the loop: a wrist run becomes a logged run

A run finished on the watch is sent home and logged **exactly as a phone-tracked run would be** —
same shape, same stamps — so the adaptive engine cannot tell the difference and the plan learns from
it either way.

```
watch  →  sendMessage (instant, when the phone is to hand)   →  WatchBridge  →  queue on disk
       →  transferUserInfo (durable, survives a closed app)  ↗                      ↓
                                                        page says "ready" → __interunWatchRun()
                                                                                     ↓
                                     logged with pband / rband / anchor → the flags engine
```

Two send paths on purpose: `sendMessage` lands instantly when the phone is nearby, `transferUserInfo`
is the backstop queued by the OS for when it is not. The phone de-duplicates on the run id, so a
double delivery is a no-op, and runs stay queued on disk until the page **confirms** it took them —
a run that fails to land is never silently dropped.

⚠️ **`PLAN.weeks` carries no steps or pace bands** — it is a display summary. The prescription lives
in `RAW.weeks` (`rawSessionsForIso()`). Reading the wrong one is silent: you get a session with no
targets, a watch with nothing to coach against, and flags with no evidence.

Verified in the browser end to end: two wrist runs rated 6 against an intended band of 2–3 raised
both signals and produced real coaching — *"Your last 2 sessions came in about 26s/km faster than
their target pace. You rated your last 2 sessions about 3 points harder than they were meant to
feel."* — with the engine correctly diagnosing overcooked easy days rather than proposing new paces.

## Known gaps

These are real, deliberate, and not yet done:

- ⚠️ **The watch→phone hop is unverified on real hardware.** Both ends are provably correct in the
  simulator — the watch reports `transferring=1, companion=1, reachable=1`, and the phone bridge
  reports `activated, paired=1, installed=1` — but the delivery itself never completes between two
  simulators. `simctl` also warns "App database is out of sync", because installing the watch app
  directly is not the normal pairing path. **Test this on the real watch before trusting it.**
- **No coach audio on the wrist.** Step *prompts* now work (the step list comes over from the plan),
  but spoken coaching needs the engine's `session-runtime` ported to Swift — watchOS has no
  JavaScriptCore, so the TS engine cannot run there.
- **Sticky sub-tabs never stick.** `#view` has `overflow: auto`, making it a scroll container that
  never actually scrolls, so `position: sticky` on `.subtabs` is inert — it has never worked, in the
  app or the browser. The offset is now correct for when it is fixed; the overflow is the real bug.
- **Build with release Xcode to submit.** `/Applications/Xcode.app` is 26.6 (release, can submit);
  `/Applications/Xcode-beta.app` is 27.0 beta (development only — App Store Connect rejects its
  builds).
