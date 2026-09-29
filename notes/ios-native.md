# The native iPhone app — shell, over-the-air web layer, keyboard, builds, Apple Health

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> The watch app's notes that used to follow here are in notes/watch.md.

## The iOS keyboard pan must be UNDONE, not just absorbed (fixed 2026-08-01, needs on-device proof)

The profile screen mangled itself when a field was focused: app shoved up under the status bar, dead
black band between the nav and the keyboard, for as long as the keyboard stayed up. ⚠️ **iOS decides
instantly on focus — before any of our handlers run — whether the field will sit under the keyboard,
and if so it PANS the visual viewport** (`visualViewport.offsetTop` goes positive). The `--vvh`
machinery then shrinks the shell and `keepVisible` scrolls the field into view inside `#view`, but
nothing ever reverted the pan, so the shell sat offset inside the visible area. `overflow: hidden`
does not prevent this pan; **the only remedy is `window.scrollTo(0, 0)` — AFTER the field is visible
in its own scroller**, or iOS immediately pans again. `unpan()` runs at the end of every
`keepVisible` pass, on `visualViewport` **scroll** (the event the pan itself raises — resize alone
never fires for a pan), and 350 ms after `focusout` so a pan cannot outlive the keyboard.

⚠️ **The first version did NOT hold on the owner's phone.** Round two adds three things:
- **A window `scroll` listener** — in a standalone Home Screen app the pan can be reported as a
  window scroll rather than a visualViewport one, and the document cannot legitimately scroll
  (overflow: hidden), so any window scroll IS the pan, whichever event WebKit raised for it.
- **`followPan`, the fallback that cannot lose**: some WKWebView states refuse a programmatic
  `scrollTo` while the keyboard is animating. One frame after scrolling, if the offset survived, the
  shell is translated down by exactly that offset so it covers the visible region — stop fighting
  the pan and track it. The transform clears with the keyboard. (While it is set, `position: fixed`
  descendants become fixed to the shell — acceptable for the duration of a keyboard.)
- **`window.__kbDiag`**, surfaced as the "keyboard" line in Support › Your data: pans seen, max
  offset, cleared vs followed counts. ⚠️ A failed fix cannot be diagnosed from a screenshot — a pan
  scrollTo cleared, a pan that survived it, and a build without the fix look identical by eye.
  **All zeros while the glitch reproduces = the phone is running an old copy** (the three-copies
  trap); nonzero `followed` = the fallback is carrying it; nonzero pans with the glitch visible =
  new information, report the line.

## KEYBOARD V3 — the keyboard OVERLAYS the app; nothing moves (2026-08-01, owner's design)

⚠️ **`--vvh` IS NO LONGER PUBLISHED.** The owner saw the shrink design on his phone and said the
right thing: *"surely the keyboard just overlays the screen and it doesn't move it anywhere"* — which
is what every native app does. Shrinking the shell to the visual viewport dragged the bottom nav up
the screen on every keystroke. Now the shell stays full height; the keyboard covers the bottom bar;
`html.kbup` + `--kbh` (the keyboard's height) add scroll room under `.view` and lift `.sheet-ov`
(sheets hold fields exactly where the keyboard lands — the one thing that must move). All the old
publisher gates still guard `--kbh`: the focused-field requirement, the 120px delta, the focusout
cleanup — a stale value is phantom padding now rather than a dead strip, but the launch-time bogus
`visualViewport.height` would still poison it. `.app { height: var(--vvh, 100%) }` keeps the var as
an inert emergency hook; `test/ios-input-zoom.test.ts` asserts nothing publishes it and that the
kbup rules exist. The unpan/followPan machinery is unchanged and still essential — iOS still pans by
280pt and still refuses `scrollTo`; v3 changes what the shell does, not what iOS does. Every
`--vvh` history note below this point describes the OLD design; the traps are still real, the
mechanism is retired. Proven by the simulator harness: top bar static, field above keyboard, nav
never rides up, full restore on dismissal.

⚠️ **The native app also PINS the web view's scroll view at zero** (KVO in `WebHost.swift`). The
document is exactly viewport-sized and every scrollable surface is an inner CSS scroller, so the
only thing that ever writes a non-zero offset is iOS's own keyboard shove — the "bump" the owner
reported even after v3's layout was correct. The offset is zeroed in the same frame it is written;
there is no correction to see because the movement never happens. The JS unpan/followPan stays for
the PWA, where no native hand can hold the scroll view. **Confirmed fixed by the owner on his real
phone (2026-08-01, build 21:26).**

⚠️ **Assert TRANSITIONS, not just destinations.** The harness passed while the phone visibly bumped,
because every assertion measured the settled state. The test now samples the top bar every 100 ms
through the whole keyboard animation (fails on 4pt), and runs the scenario twice — the second time
on a field LOW on the screen, where iOS genuinely wants to shove; the top-of-screen name field never
triggers it, which is how the bump hid behind a green test.

## The keyboard harness: XCUITest on the simulator (added 2026-08-01)

**`InteRunUITests`** is a fourth target (generated by `make-project.py`, scheme included), built
because the keyboard-pan bug class is invisible everywhere except a REAL tap raising the REAL
software keyboard — desktop browsers can't, programmatic focus() can't, and before this target every
keyboard fix shipped blind and was proven or disproven on the owner's phone. Run it:

```bash
node web/app.ts && xcodebuild test -project ios/InteRun.xcodeproj -scheme InteRunUITests \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:InteRunUITests/KeyboardUITests/testKeyboardKeepsLayout
```

⚠️ Prerequisites, each of which cost a cycle: `defaults write com.apple.iphonesimulator
ConnectHardwareKeyboard -bool false` (a hardware keyboard means no software keyboard, which means a
test that passes while the bug lives); and `xcrun simctl spawn <device> defaults write
com.apple.keyboard.preferences DidShowContinuousPathIntroduction -bool true` (the first-run swipe
tutorial replaces the keyboard with a taller panel and poisons every measurement). The first-run
welcome button says **"Get started"**, not "Let's go". ⚠️ Tapping empty page does NOT blur a
WKWebView field — the keyboard stays up; dismiss via the accessory bar's `Done` button.
`testDriver` runs a tap script from `TEST_RUNNER_TAPS="x,y,waitMs;..."` for choreography iteration
without recompiling.

**What it measured (iOS 26.5 sim, native app):** iOS pans the viewport by up to **280pt** on focus;
`window.scrollTo(0,0)` NEVER cleared it (`__kbDiag` cleared: 0) — so the round-one fix was genuinely
broken, exactly as the owner reported — and the round-two `followPan` fallback carried all of it
(followed: 3), settling to a correct layout. The test asserts the settled geometry from the outside:
nav-to-keyboard gap under 200pt (measured healthy chrome is ~110–150: accessory bar + predictive row
+ label-to-shell padding; the glitch is 300+), top bar still in the top tenth, and full-height
restore after dismissal.

**The debug overlay** (`kbOverlay` in web/app.ts) paints live `visualViewport` numbers on screen so
a simulator screenshot carries the measurements. It is enabled ONLY by a `#if DEBUG` user script in
`WebHost.swift` (`window.__kbDebugOverlay`); the PWA and release builds never define the flag.
⚠️ Writing it hit the `\n`-in-runtime-strings trap AGAIN (a real newline inside an emitted string
kills the whole page silently); the `node --check` step caught it — never skip that step.

**`html.kbup`** rides with `--vvh` (set and removed in the same branch of `apply()`): while the
keyboard is up, the nav's `env(safe-area-inset-bottom)` padding is 34pt of nothing above the
keyboard — the home indicator it exists for is UNDERNEATH the keyboard — so `.kbup` collapses it.

## THE NATIVE APP NOW SELF-UPDATES THE WEB LAYER OVER THE AIR (2026-08-10)

⚠️ **THE DEPLOY MODEL CHANGED. A web-only change on `main` now reaches the phone on the NEXT LAUNCH,
with no Xcode rebuild.** This retires the trap documented all over this file — "three copies update
differently", and the repeated "a fix reported not working that had simply never been installed"
(the keyboard fixes on 2026-08-01, and the notifications/stretch fixes on 2026-08-10, which cost the
owner two mystified rebuilds in one day). `WebUpdateService.swift` checks GitHub Pages on launch and
on foreground; when a newer `index.html` is published it downloads it and serves THAT over the same
`interun://app` origin from the next launch. `localStorage` is untouched (same origin).

- **Only `docs/index.html` travels over the air.** It is one self-contained ~11.5 MB file (the frames
  are inlined). **Voices, icons, the peripheral pages (`roadmap/`, `mapstyles/`) and ALL native/Swift
  code still need a rebuild** — a new coach clip, a GPS/notification/watch change. The page already
  falls back to the device voice when a clip is missing, and a page that needs a NEW native bridge
  degrades gracefully (it guards `window.webkit.messageHandlers.*`), so a web feature can ship OTA and
  stay dormant until a rebuild adds the Swift.
- ⚠️ **THE BUNDLE IS ALWAYS THE FLOOR.** No network, a bad/short download, or a download older than the
  bundle → serve the bundled copy, which shipped working. A native rebuild whose bundle is newer than a
  stored OTA copy wins and deletes the stale copy.
- ⚠️ **AN UPDATE IS ADOPTED ONLY ON THE NEXT LAUNCH, never hot-swapped** — swapping the page under a
  live run would be a disaster. `checkForUpdate` writes the file; `prepare` (next launch) reads it.
- ⚠️ **A WATCHDOG MAKES A BAD WEB PUSH RECOVERABLE WITHOUT A MAC.** An adopted build must post
  `interunUpdate {action:"booted"}` from the page — placed right after `render()` in the boot tail, so
  a build that throws before rendering never confirms. A build served twice without confirming is
  **rejected** (deleted, and its stamp remembered so `checkForUpdate` won't re-download it), and the
  app falls back to the bundle. Only a NEWER published stamp clears the rejection. Without the reject
  memory a broken build would revert → re-download → revert forever.
- ⚠️ **Version compare is the `const BUILD = "YYYY-MM-DD HH:MM"` stamp** (lexical == chronological),
  read from the raw bytes so an 11 MB doc isn't decoded to find one string. Efficiency: a conditional
  GET (`If-None-Match` ETag) returns 304 when nothing changed, so only a genuinely new build transfers
  the 11.5 MB. `validate()` refuses anything under 1 MB or without a stamp (captive portal, 404 page).
- **Diagnostic:** Support › Your data now carries a **`web layer:`** line — `built-in <stamp>` vs
  `over-the-air <stamp>`, plus the last check result (`up-to-date` / `downloaded <stamp>` / `offline`).
  ⚠️ **THIS is now the source of truth for "did my change land", not the build stamp** — a fresh stamp
  can sit on stale code (it did, twice, on 2026-08-10). `channel=ota` with the new stamp is the proof.
- The wiring: `WebHost` calls `prepare` before load + injects `window.__interunWebUpdate` + registers
  the `interunUpdate` handler + kicks `checkForUpdate`; `BundleSchemeHandler` serves `activeIndexData`
  for the index request only; `InteRunApp` re-checks on `scenePhase == .active`.
- ⚠️ **The owner must do ONE more manual Xcode rebuild to install this OTA-capable build.** After that,
  web-only changes flow automatically. (Native changes always need a rebuild — that is unchanged.)

## The native app (`ios/`) — started 2026-07-27

InteRun is now **also a native iPhone app**, built as a **hybrid**: a thin Swift shell that runs the
existing web UI, so there is still **one UI to design** (`web/app.ts`). Decided with the owner on
2026-07-27, along with: iPhone first, then the Watch; the owner **has** a real Apple Watch to test on.

- **`docs/` stays the single source of truth.** An "Embed web app" build phase rsyncs it into the
  bundle every build (minus `roadmap/`, `walkthrough.html`, `coverage.html`). Nothing is duplicated
  into git. **Run `node web/app.ts` before building in Xcode.**
- **The page is served over `interun://app/…`**, not `file://` — WKWebView blocks `fetch()` on file
  URLs and the app fetches `voices/manifest.json`. `BundleSchemeHandler` also implements HTTP range
  requests, without which `<audio>` will not play the coach MP3s.
  ⚠️ **The origin is load-bearing:** `localStorage` (the app's entire database) is keyed to
  `interun://app`. Changing the scheme or host would orphan every user's data. Never change it.
- The service-worker registration in `app.ts` is already gated on `location.protocol` being http(s),
  so it skips silently under the custom scheme. **No web-side changes were needed at all.**
- `ios/InteRun.xcodeproj` is **generated** by `python3 ios/make-project.py` (so the build-phase shell
  script can be written as real shell and escaped correctly). Regenerating **overwrites** it — mirror
  any Xcode-UI build-setting changes back into that script first. `ios/InteRun/` is a synchronized
  folder group, so new Swift files need no project edit.
- **Moving data in from the PWA** is built and lives in the web layer (`dataView()`, Support › Your
  data), so one screen serves both sides: export in the browser, restore in the app. The two origins
  are separate sandboxes — nothing crosses automatically and no native code can reach in and take it.
  Restoring **replaces** rather than merges (merging two histories would duplicate runs). Backup keys
  are discovered at runtime by prefix (`interun_`, `rc_`), so a key added later still travels — do
  not replace that with a hardcoded list. `Downloads.swift` gives `<a download>` a real
  `WKDownloadDelegate`, which also fixes the calendar `.ics` export (it silently did nothing before).
- **Background GPS** works by *replacing* `navigator.geolocation` with a `CLLocationManager`-backed
  shim injected at document start (`GeolocationShim.swift` + `LocationService.swift`), so `web/app.ts`
  is untouched and still behaves normally in a browser. Fixes are **buffered and replayed in order** —
  iOS can suspend the web content process even while the app lives on the location background mode,
  and distance accumulates incrementally, so a replayed backlog gives the same total.
- ⚠️ **`.app` is `height: var(--vvh, 100%)`, not `100dvh`.** `100%` chains html → body → the real
layout viewport, so the shell is exactly as tall as the page it was given, whatever that page is.
- ⚠️ **`.app` uses `--vvh` as the keyboard override.** `dvh` tracks the LAYOUT viewport,
which the iOS keyboard does not change — so the shell stayed full-screen with a third of it behind
the keyboard, `#view` had zero scroll room, and the focus handler had nothing to scroll. iOS then
panned the visual viewport instead, sliding both bars off screen. A listener publishes
`visualViewport.height` as `--vvh`. Measured: with a 300px keyboard the shell now shrinks 812→512,
the nav sits exactly on the visible bottom, and `#view` gains 322px of room where it had 22.
⚠️ `--vvh` is only SET when the visual viewport is >120px smaller than the layout viewport — i.e. a
keyboard is genuinely up — and removed otherwise. A Home Screen PWA reports `visualViewport.height`
wrong at launch (short, no corrective resize ever fires), and trusting it unconditionally left the
whole shell short: nav floating above a dead strip. The layout viewport never shrinks for the iOS
keyboard, so the delta IS the keyboard detector.

⚠️ **THE ROOT CAUSE was `viewport-fit=cover` in the shared page, and it is now native-app-only.**
This was the "the Home Screen app isn't positioning correctly" bug. It took five wrong fixes and a
`git log -S` to find, because it cannot be seen from a screenshot — the app looked almost right.

`6abb4d0` (2026-07-27, *"Background GPS, and unbury the app bar from the Dynamic Island"*) is a
**native-app** commit. Its only chrome change to the shared page was adding `viewport-fit=cover`,
which WKWebView needs for `env(safe-area-inset-*)` to report anything at all. But `docs/` is **one
page serving the PWA and the native app**, so the Home Screen PWA inherited it — and
`cover` + `black-translucent` is what gave the PWA a misplaced viewport.

**So the static meta has no `viewport-fit=cover`, and the native app adds it for itself** in the
inline `<head>` script, keyed on `location.protocol === 'interun:'`, before first paint. Every
`env()` use in the CSS is `calc(N + env(..., 0px))`, so with no insets they collapse to exactly the
constants the app shipped with — verified: `.topbar` padding-top back to `14px`. **The CSS never
needed changing; only the meta did.**

⚠️ **This is the trap to remember: `docs/` is one page for two platforms.** A change made for the
native app lands on the PWA too. Check both before shipping anything in the `<head>`.

**Measured on the owner's 16 Pro Max, iOS 18.7, from the Home Screen** (Support › Your data prints
all of this):
```
SCREEN 440×956 · PAGE 440×894 · INSETS T62 R0 B34 L0 · VVH UNSET
FIXED INSET:0 → 0..894 H894 · APP 0..894 H894 · NAV 796..894 H98
```
With `black-translucent` the layout viewport was 894 tall **anchored at 0..894** on a 956 screen, so
**62pt of the screen BOTTOM was dead** — while `safe-area-inset-top` still reported **62**, so the top
bar padded 62pt for a status bar that already overlapped it. The app was compensating at the top for
space that was missing at the bottom. Note `APP 0..894` and `NAV 796..894`: **the CSS was correct
throughout** — the shell filled the viewport and the nav sat exactly on its bottom edge. The viewport
itself was in the wrong place, which is why no amount of CSS work moved it.

With `default`, iOS places the view **below** the status bar (62..956): the same 894 height, but it
reaches the bottom edge, `inset-top` becomes 0 so the top bar stops double-padding, and the status-bar
strip is system-painted from `theme-color`. Keep `viewport-fit=cover` — it is what still yields
`inset-bottom: 34` for the home indicator. **No effect on the native app**: WKWebView ignores this meta
and supplies real insets.

⚠️ **Diagnose this with numbers, never by eye.** A dead band looks identical whether the viewport is
short, the viewport is misplaced, or the shell is short inside a correct viewport — three different
causes needing opposite fixes. The `FIXED INSET:0` line is the discriminator: a `position: fixed;
inset: 0` element always covers the layout viewport exactly, so its rect **is** the viewport. Chasing
this from screenshots produced three plausible, confidently-argued, wrong diagnoses in a row (a
`dvh`-vs-page mismatch, a `theme-color` mismatch, and iOS 26's WebKit bug 301994 — which is real but
applies to iOS 26, and this phone is on **18.7**; always read the OS version before trusting research).

⚠️ **iOS SNAPSHOTS `apple-mobile-web-app-status-bar-style` AT ADD-TO-HOME-SCREEN.** Changing it did
nothing across five deploys and only took effect once the icon was deleted and re-added. If it ever
changes again, **the app must be re-added before the change can be judged** — otherwise you are
testing the old value and every conclusion drawn is worthless. (Deleting a Home Screen web app
deletes its `localStorage`; export a backup from Support › Your data first.)

⚠️ **The strip is painted from the CANVAS BACKGROUND (`html`/`body`), latched at first paint, and
never re-read. NOT from `theme-color`.** Established by an accidental single-variable A/B on the
device: with the meta held at `#0c2b28` in both states, moving only the canvas moved the strip.
Two consequences, and both were learned by shipping the wrong thing:
- ⚠️ **The strip must be `--bg`, never the launch screen's colour.** Colouring it from the splash
  matched the splash for two seconds and then left a dark strip above the light app *for the whole
  session* — verified that both the meta and the canvas do switch to `--bg` when the app appears, and
  iOS ignores it. A brief mismatch beats a permanent one.
- ⚠️ **So `--splash-bg` must START at that theme's `--bg`, in BOTH themes.** That is what makes the
  launch seamless, and it is the only lever left. Asserted per-theme by
  `test/home-screen-chrome.test.ts`; light shipped exact while dark did not (`#0a100e` vs a `#0c2b28`
  top stop, ΔL\* ≈ 12) with a comment claiming otherwise and no test to catch it.

`theme-color` still matters for Android/Chrome and in-Safari, so it stays — as a per-scheme static
pair equal to that scheme's `--bg`, with `syncThemeColor()` collapsing to **one un-media'd meta** at
runtime (with several present the browser takes the first that matches, so the pair would outvote the
live one) and re-running on the theme button, which no media query can see.

⚠️ **The theme is remembered, and it MUST be applied before first paint — the two are inseparable.**
`interun_theme_v1` is written by the theme button and applied by a **tiny inline script in `<head>`**.
Both halves are load-bearing and shipping either alone is a bug that reached the owner's phone:

- Not persisting it at all meant a runner whose phone is light but who prefers dark had to re-toggle
  every launch — so the strip latched LIGHT while the app rendered DARK, *every session*.
- Persisting it but restoring it from the main script (at the end of `<body>`) would be just as
  broken: the first paint would still use the system scheme, and the strip latches at first paint.

So the restore stays inline, stays in `<head>`, and stays before `<body>`. `test/home-screen-chrome.test.ts`
asserts all three. The strip still goes stale if the theme is changed **mid-session** — unavoidable
with a latched value, and it corrects itself on the next launch.

⚠️ **`--vvh` requires a FOCUSED FIELD, not just a size delta** — this was the dead strip *below* the
nav, and a threshold alone cannot prevent it. A Home Screen web app reports `visualViewport.height`
wrong at launch (short, with no corrective resize ever firing), and at that moment the layout viewport
still reads full height, so the bogus delta sails past any threshold. `--vvh` latched the short value
and the shell stayed short for the entire session. A keyboard cannot be up unless something focusable
is focused, and nothing is focused at launch — so the gate is `keyboardPossible() && layout - h > 120`,
with both halves load-bearing (a field can be focused with no keyboard). It is re-evaluated on
`focusin`/`focusout`/`pageshow`/`visibilitychange`, because a value left behind is the same strip.

⚠️ **The app shell owns the viewport; the document must never scroll.** `html, body` are
`overflow: hidden`, `.app` is `height: var(--vvh, 100%)` (not `min-height`), and `.view` carries
**`min-height: 0`** — that last one is load-bearing. A flex item defaults to `min-height: auto` and
refuses to shrink below its content, so `flex: 1; overflow-y: auto` silently did nothing: `.view`
grew to full content height and the PAGE scrolled instead. Two symptoms followed, and neither looked
like a CSS bug: an iOS rubber-band drag slid the whole shell so the "sticky" top bar and bottom nav
left the screen, and `v.scrollTop = 0` in every render branch was a no-op, so switching tabs left you
stranded half way down the previous screen. Verify with `#view.scrollHeight - clientHeight > 0` and
`documentElement.scrollHeight - clientHeight === 0`.

⚠️ **16px is a hard floor for anything focusable, and a blanket rule will NOT save you.**
`input, select, textarea { font-size: 16px }` has specificity (0,0,1) and loses to any single class,
so `.set-in` (the strength log's weight/reps boxes) stayed at 14px and reproduced the bug in a
different screen. iOS auto-zooms on focus below 16px, and since pinch is blocked the runner can
never zoom back out — the app stays scaled on every screen after it. `test/ios-input-zoom.test.ts`
now scans the generated CSS for any sub-16px rule whose class appears on a field in the markup;
grepping for selectors that NAME input/select/textarea is what missed it the first time.

⚠️ **Pinch-to-zoom is deliberately off**, in two places that both matter. iOS Safari ignores
`user-scalable=no`, and `touch-action` does not stop a pinch either — the only thing that works on
the web side is preventing WebKit's non-standard `gesture*` events, which a document-level guard near
`buildNav()` does. `touch-action: manipulation` separately kills double-tap zoom. On the native side
`WebHost.swift` also disables the scroll view's own `pinchGestureRecognizer`. ⚠️ **The avatar cropper
is excluded from the guard** (`.crop-stage`) — it drives its own zoom from those same events, and
breaking it would silently return an off-centre crop rather than an obvious error.

⚠️ **`viewport-fit=cover` is required** in the meta viewport. Without it every
  `env(safe-area-inset-*)` resolves to **0**, which silently put the app bar under the Dynamic Island
  and the bottom nav under the home indicator. Because `apple-mobile-web-app-status-bar-style` is
  `black-translucent`, this was already wrong for Home Screen PWA users on notched iPhones.
- **Session reminders** are scheduled by iOS (`NotificationService.swift`), not by a page timer. The
  page hands over a *schedule*; the OS fires it with the app closed. Note WKWebView has **no
  `Notification` API at all**, so before this the feature was inert in the app, not merely unreliable.
  Two traps: iOS caps pending local notifications at **64** (we cap at 60 and re-sync), and
  `UNCalendarNotificationTrigger` **matches to the minute** — a time inside the current minute never
  fires. The reminders-sheet copy adapts to the platform so it never overpromises on the web.
- Full detail, including the known gaps, is in **`ios/README.md`** — read it before touching `ios/`.

### Installing to the owner's iPhone (works over the air — no cable needed)

⚠️ **The owner uses the Xcode-installed NATIVE app day-to-day, not the PWA** (established
2026-08-01, after two keyboard fixes "failed" that had simply never reached his phone — the native
app only updates when rebuilt). His iPhone 16 Pro Max is wirelessly paired to this Mac as
"Addo's iPhone (2)", devicectl id `9AC09027-7780-558A-824A-2C535D8203D2`. Ship him a build with:

```bash
node web/app.ts && xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun -configuration Release \
  -destination 'platform=iOS,id=9AC09027-7780-558A-824A-2C535D8203D2' \
  -allowProvisioningUpdates -derivedDataPath /tmp/interun-dev build && \
xcrun devicectl device install app --device 9AC09027-7780-558A-824A-2C535D8203D2 \
  /tmp/interun-dev/Build/Products/Release-iphoneos/InteRun.app
```

- **Release, not Debug** — Debug builds show the green keyboard-geometry overlay on every screen.
- Signing needs `ios/team.txt`, which is gitignored and does NOT follow into worktrees — copy it
  from the main checkout (`/Users/adampalmer/Developer/InteRun/ios/team.txt`) and re-run
  `python3 ios/make-project.py` so DEVELOPMENT_TEAM lands in the project.
- Data survives: an in-place upgrade keeps localStorage (same bundle id). Tell him the new
  `BUILD` stamp so he can verify in Support › Your data — ⚠️ the stamp is UTC, an hour behind UK
  summer time, and it only changes when `node web/app.ts` is re-run, so re-run it before a build
  that follows a Swift-only change or two installs become indistinguishable.

### Getting a build onto TestFlight (the Developer Program is joined, 2026-08-07)

```bash
node web/app.ts && python3 ios/make-project.py
xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun -configuration Release \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  -archivePath /tmp/InteRun.xcarchive archive
xcodebuild -exportArchive -archivePath /tmp/InteRun.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/InteRun-ipa \
  -allowProvisioningUpdates
```
⚠️ **UPLOADING NEEDS NO API KEY, NO TRANSPORTER AND NO APP-SPECIFIC PASSWORD — `xcodebuild` USES
XCODE'S OWN SIGNED-IN ACCOUNT.** Add `<key>destination</key><string>upload</string>` to a copy of
`ExportOptions.plist` and the export IS the upload:

```bash
cp ios/ExportOptions.plist /tmp/ExportOptions-upload.plist
/usr/libexec/PlistBuddy -c "Add :destination string upload" /tmp/ExportOptions-upload.plist
xcodebuild -exportArchive -archivePath /tmp/InteRun.xcarchive \
  -exportOptionsPlist /tmp/ExportOptions-upload.plist -exportPath /tmp/InteRun-upload \
  -allowProvisioningUpdates
```

⚠️ **I TOLD THE OWNER THIS WAS IMPOSSIBLE ON THIS MAC, AND IT WAS NOT** (2026-08-16). The reasoning
looked sound — no `.p8` in `~/.appstoreconnect/private_keys/`, `xcrun altool --list-apps` refusing
with an authentication error, no `Transporter.app` — and every one of those observations was true and
irrelevant. **`-allowProvisioningUpdates` had been succeeding all along, which is proof of an
authenticated App Store Connect session in Xcode**; that same session uploads. Check what already
works before concluding a thing cannot be done, and treat a succeeding command as evidence.

The app record has to exist in App Store Connect first (same bundle id, `com.interun.app`).
⚠️ **Adding the build to a tester group is still a manual step in App Store Connect**, unless the
internal group has automatic distribution switched on.

⚠️ **THE BUILD NUMBER NOW COMES FROM THE COMMIT COUNT** (`build_number()` in `make-project.py`),
floored at 36. App Store Connect **rejects a second upload carrying a build number it has already
seen**, and hand-bumping a constant before each archive is the step that gets forgotten exactly once.
⚠️ **All four targets must carry the SAME number** — phone, watch, watch extension, widget — or the
embedded binaries are refused with an error that names the wrong problem. That is why the value is
one variable applied in four places rather than four literals.
⚠️ `MARKETING_VERSION` (1.0) is the number a human sees and is bumped by hand, per release.

Already in place, so none of these will surprise anyone at upload time: `ITSAppUsesNonExemptEncryption
= false` (or App Store Connect asks the export-compliance question on every single upload), app icons
for both targets, and plain-English `NS*UsageDescription` strings for location, HealthKit and motion —
which a reviewer does read.

⚠️ **Internal testing (up to 100 people) needs no review and no privacy policy. EXTERNAL testing does
— a Beta App Review and a privacy-policy URL.** Start internal.

### Toolchain on this Mac (re-verified 2026-08-25 — this section changed TWICE, don't work from memory)

⚠️⚠️ **THE BETA IS THE WORKING TOOLCHAIN, AND THIS SECTION SAID THE OPPOSITE FOR A MONTH.** The owner's
correction, verbatim: *"We have always used the beta version in here because my phone is on ios 27
beta"*. That is decisive and it is not a preference — **an Xcode can only deploy to a device whose iOS
it supports, so Xcode 26.6 cannot install anything on a phone running iOS 27 at all.** Measured
2026-08-25: `DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer xcodebuild -showdestinations`
offers real destinations with **no error**, while the release Xcode refuses every one of them with
*"iOS 26.5 is not installed"*. The 2026-07-29 note below was true when it was written (the beta's
runtimes had just been deleted to reclaim disk) and became false the moment an iOS 27.0 runtime was
installed — and it cost a whole session, because I read it, concluded the rebuild was blocked, and
told him to install the wrong component.

- **Two Xcodes are installed. Use the BETA for anything that touches his phone:**
  - `/Applications/Xcode-beta.app` — **27.0 beta**, iOS 27.0 SDK, an iOS 27.0 simulator runtime, and
    the only one that can build for a phone on iOS 27. **`export
    DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer`** for every build.
  - `/Applications/Xcode.app` — **26.6 release**. `xcode-select` points here, so it is what a bare
    `xcodebuild` picks up, and it has the iOS 26.5 **SDK** but **not** the iOS 26.5 platform — so a
    bare `xcodebuild` fails with a message naming a component nobody needs. It is still the one App
    Store Connect accepts release builds from, so a TestFlight archive is its job and a device install
    is the beta's.
⚠️ **THE ERROR MESSAGE NAMES THE WRONG PROBLEM, WHICH IS WHY THIS IS WORTH READING TWICE.** *"iOS 26.5
is not installed. Please download and install the platform from Xcode > Settings > Components"* is a
true statement about the release Xcode and an irrelevant one about this project: installing iOS 26.5
would fix the message and still not put a build on his phone. **Check `xcode-select -p` before
believing any destination error.**
- **The licence is accepted.** `xcodebuild -version` runs clean — no `sudo xcodebuild -license accept`
  needed. (It genuinely wasn't accepted on 2026-07-27, and until it is, every `xcrun`-shimmed tool
  refuses to run **including `git`**, which is a baffling way to meet the problem. If that ever
  returns, that's why.)
- ⚠️⚠️ **THE OLD "Do NOT export DEVELOPER_DIR=/Applications/Xcode-beta.app" RULE IS REVERSED.** It was
  written because the beta's runtimes had been deleted, so a build through it had no simulator to
  target. An iOS 27.0 runtime is installed again and his phone is on iOS 27, so exporting
  `DEVELOPER_DIR` at the beta is now the ONLY way a build reaches him. Kept here rather than deleted
  because the reasoning behind it was sound and its expiry is the lesson.
- Build + inspect — note `-destination`, never `-sdk` (the watch section below explains why `-sdk`
  breaks this project specifically):
  ```bash
  node web/app.ts && xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
  ```
- Simulator runtimes ship **separately from Xcode** and neither Xcode bundles one. ⚠️ **Installed as of
  2026-08-25: iOS 27.0 ONLY**, which belongs to the beta — the iOS 26.5 and watchOS 26.5 pair described
  here on 2026-07-29 is gone, and the release Xcode therefore has nothing to run. There are **no
  simulator devices** either (one was created on the 27.0 runtime to test this and deleted again).
  They live in `/Library/Developer/CoreSimulator/Volumes`, not in `~`.
  A runtime install step needs root, so `xcodebuild -downloadPlatform iOS` exits 0 without installing
  anything when run unprivileged. Use `sudo xcodebuild -downloadPlatform iOS`, or Xcode → Settings →
  Components.
- Simulator **devices** were all deleted in the same clear-out and two were recreated: an
  **iPhone 17 Pro** (iOS 26.5) and an **Apple Watch Series 11 (46mm)** (watchOS 26.5), **paired** —
  which is what the embedded watch app needs. `xcrun simctl list devices` if in doubt; recreate with
  `xcrun simctl create` + `xcrun simctl pair`.
- ⚠️ Installing an Xcode **silently repoints `xcode-select` system-wide**. If shell tools suddenly
  start failing with a licence error, that is why.
- **Disk:** the project itself is only ~240 MB; the space goes on Xcode caches. `DerivedData`,
  `~/Library/Developer/Xcode/iOS DeviceSupport` and `xcrun simctl delete all` are all safe to clear
  and rebuild themselves. Don't move the repo to a network drive to save space — it isn't where the
  space went, and git and Xcode both misbehave over SMB.

⚠️ **`WatchBridge` is `WatchBridge.shared`, built at app launch — never tie it to the web view.**
It used to be created in `WebHost.makeUIView`, so the WCSession delegate only existed while the page
did. A freshly installed watch therefore sat on "Waiting for your plan" until the phone app was
opened at least once, and a background wake from the watch had nobody to answer it. The bridge now
persists its last payload to UserDefaults and re-pushes on every activation, and the watch calls
`requestSync()` (a `sendMessage`, the one channel that makes iOS wake the containing app in the
BACKGROUND) whenever it has nothing current. The phone answers from cache with no web view running.

**The watch stands alone (2026-07-28).** It caches the WEEK, not just today (`upcoming` in the sync
payload, `SessionStore.upcomingAhead`), and always offers a **Free run** — ⚠️ requiring the phone app
to be open before the watch will start a run is a chore at the front door, not a running app.
The week payload includes TODAY, so `todayFromCache` can show today's session even when the context
has gone stale — a day-old copy of the right session beats a spinner.
`SettingsView`/`WatchSettings` let the runner choose which metrics appear on the run screen (max 5,
ordered, first one largest) plus auto-pause, lap haptics, spoken cues and always-on. ⚠️ Every toggle
there does something — the same rule as the phone's Connections screen; no "start on motion" until
it is actually built.

⚠️ **`CLLocation.speed` is −1 when unknown**, which is the normal case indoors and in the first
seconds of a run. A guard written as `if loc.speed >= 0, loc.speed < 0.5` therefore SKIPS the
not-moving check exactly when it is needed and falls through to summing position deltas — pure
drift. That is how a watch sitting on a table logged 0.2 km and drew a map. Unknown speed must prove
itself against the fix's own noise floor, fixes worse than 25 m are dropped, and route points are
only recorded when the runner actually moved.

## APPLE HEALTH: A PHONE RUN IS SAVED AS A REAL WORKOUT (owner, 2026-08-21)

*"i would like the app to sync with apple health naturally like all running apps do."* Naturally means the
run appears in Health and Fitness the way one recorded by any other running app does — a workout with its
distance, duration, route and heart rate — rather than a row in this app that Health knows nothing about.
`ios/InteRun/HealthKitService.swift`, `HKWorkoutBuilder` + `HKWorkoutRouteBuilder`, written at save time.

⚠️⚠️ **ONLY PHONE-RECORDED RUNS ARE WRITTEN, AND THIS IS THE RULE THAT WOULD HURT IF IT WERE MISSING.** A
wrist run is ALREADY in Health: `WorkoutManager` runs a real `HKWorkoutSession`, so watchOS saves the
workout before the phone has been told the run happened. Writing it again gives the runner **two workouts
for one run** — double distance in their week, double energy in their rings — and the duplicate looks
exactly as legitimate as the original. Gated twice: `healthSendRun` refuses `run.source === "watch"`, and
the service refuses any id it has already written.
⚠️ **AND THE NATIVE REFUSAL IS NOT BELT-AND-BRACES FOR ITS OWN SAKE.** HealthKit has no upsert, the finish
screen allows Save more than once, and a re-render can produce it. The id is stamped into the workout as
`HKMetadataKeyExternalUUID` as well, so a duplicate is identifiable rather than merely suspected.

⚠️ **AUTHORISATION IS REQUESTED ON THE SAVE PATH, NEVER AT LAUNCH.** A Health prompt on first open, before
the runner has recorded anything, is a prompt with no context — and from the app's point of view a refusal
is permanent. `capabilityJS()` answers only whether Health exists on the device and asks for nothing.

⚠️ **NOTHING IS FABRICATED TO FILL A FIELD, and this matters more here than anywhere else in the app
because the data lands in somebody's medical app under their name.** No route means no route is written
(fewer than two timed points is a refusal); a zero distance is absent rather than written as a
measurement; an indoor run declares `.indoor`, because a run with no route claiming to be outdoors is a
claim its own data cannot support. Same rule as `runStravaPayload`'s never-invent-the-missing-half.

⚠️ **AN UNKNOWN START IS A REFUSAL.** `runStartMs` answers that date at 09:00 when it does not know, and
Health is precisely where a person looks to see what they did *when* — so `healthSendRun` uses
`runStartExactMs` and declines on null. Worse than the same fault in a GPX, and the GPX gate already
closed it.

⚠️ **THE HEART RATE IS CONVERTED FROM DISTANCE TO TIME IN THE PAGE, NOT IN SWIFT.** `hrSeries` is
`[metres, bpm]` because the in-app chart is drawn across the run rather than the clock — on a time axis
every pause is a plateau — and Health stores a sample at a moment. The route carries both, so walking it
gives each reading its own time. Doing it in Swift would be a second copy of arithmetic the Strava GPX
already had to get right.

⚠️ **THE CONSENT STRING WAS FALSE THE MOMENT THIS SHIPPED, AND CHANGING IT WAS PART OF THE WORK.**
`NSHealthUpdateUsageDescription` read *"InteRun uses HealthKit only to start a run on your Apple Watch
from your phone"* — true until now, and the sentence a reviewer reads and a runner consents to. It now
names what is written, and says that watch runs are not written twice.
⚠️ **THE ENTITLEMENT NEEDED NOTHING.** `com.apple.developer.healthkit` was already there for
`startWatchApp`; `com.apple.developer.healthkit.access` is for CLINICAL records and stays empty. Verified
rather than assumed.

⚠️ **THE FINISH SCREEN'S HEALTH ROW IS A REAL SWITCH NOW, AND ITS OWN KEY.** `interun_health_v1`, separate
from Strava's — two destinations, two decisions, and a runner may well want Health and not Strava. It
**defaults ON** where Health exists, because that is what "naturally, like all running apps" means: the
run appears in Fitness without being asked to.
⚠️ **AND EACH ROW APPEARS ONLY WHERE IT CAN ACT.** Strava when connected, Health where the native flag
says this build can write. `test/live-screens.test.ts`'s previous version asserted Health was ABSENT — it
was not built — so that guard moved from "not offered" to "offered only where it works" rather than being
deleted.
⚠️ **A NOTE I WROTE AND REMOVED BEFORE IT SHIPPED**: "your watch already saved this run to Health". It was
gated on `LIVE.summary.fromWatch`, which nothing sets, on the PHONE's finish screen — which a wrist run
never reaches, because `ingestWatchRun` puts it straight in the Logbook. An explanation of something that
cannot happen on the screen carrying it. Seventh outing of the invented-identifier trap.

⚠️ **STILL UNPROVEN ON HARDWARE.** A simulator has no Health data and grants nothing meaningful, so the
first real evidence is a phone run appearing in Fitness with its route and heart rate. `PHOTODIAG.health`
records what the native side reported, because a missing workout looks identical whatever the cause —
permission refused, an older build, or a duplicate already there.

⚠️ **ADDING A BUILD TO TESTFLIGHT TESTERS NEEDS AN API KEY, AND THE SCRIPT FOR IT IS WRITTEN AND WAITING.**
`node tools/testflight-distribute.mjs [build] [group]` finds the app by bundle id, finds the build, checks
it is VALID, picks the internal group by default and POSTs the association. It signs its own ES256 JWT —
this repo has no runtime deps — and it **fails loudly with the five steps** rather than skipping, because
a distribution step that silently does nothing reports a build as delivered when it is sitting untouched.
⚠️ **THE KEY IS THE ONLY MISSING PIECE, AND IT IS DOWNLOADABLE EXACTLY ONCE.** App Store Connect → Users
and Access → Integrations → App Store Connect API → a key with the **App Manager** role →
`~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`, plus the Issuer ID in `issuer_id.txt` beside it.
⚠️ **AND EVERYTHING ELSE WAS CHECKED FIRST, BECAUSE THIS FILE ALREADY RECORDS ME WRONGLY DECLARING AN
UPLOAD IMPOSSIBLE.** Verified absent: any `.p8` anywhere under `~`, fastlane, any keychain item for App
Store Connect or Transporter, and `xcrun altool`, which refuses without either a JWT or an app-specific
password. The Claude-in-Chrome extension — which would have driven his own logged-in session — reports
not connected. So the CLI genuinely cannot do it today, and **an upload is not a distribution: never
report a build as being with the testers.**

## ✅ D2, PART ONE — THE FIRST TESTFLIGHT UPLOAD THROUGH xcodebuild: BUILD 562 (2026-09-28/29)

**Build 562 uploaded to App Store Connect on 2026-09-29 at 09:29 ("Upload succeeded … Uploaded package
is processing").** Archived with the RELEASE Xcode (26.6, `xcode-select`'s default), exported with
`destination upload` through Xcode's own signed-in account — no Transporter, no key, no password. The app
record for `com.interun.app` exists (the upload would have been refused otherwise). What is NOT done: the
build is not with any tester. Adding it to a group needs the owner (or the App Store Connect key, still
absent from `~/.appstoreconnect/private_keys/`); **never report an upload as a distribution.**

### ⚠️ THREE THINGS THIS UPLOAD PAID FOR

1. ⚠️⚠️ **THE RELEASE XCODE COULD NOT ARCHIVE AT ALL: "This scheme builds an embedded Apple Watch app.
   watchOS 26.5 must be installed in order to archive the scheme."** The watchOS 26.5 SDK was listed by
   `xcodebuild -showsdks`, which is why this reads as impossible; what was missing is the watchOS 26.5
   PLATFORM (a simulator runtime, 3.96 GB), which Xcode 26 wants installed before it will archive an
   embedded watch app. Fixed with the owner's OK: `/usr/bin/xcodebuild -downloadPlatform watchOS` (about
   ten minutes here). `xcrun simctl runtime list` now shows `watchOS 26.5 (23T570) (Ready)`.
2. ⚠️⚠️ **THE OWNER'S PERSONAL VOICE PACK WAS INSIDE THE ARCHIVE**, 680 KB of clips saying "Alfie", on
   its way to every tester's phone. The notes said the pack is "baked into his own build only", and the
   embed phase copied all of `docs/` regardless. His ruling (2026-09-29): leave it out of anything for
   Apple, and plan "the coach says each runner's own name" (PLAN.md B13). The embed phase now runs
   `rsync … ${PERSONAL_EXCLUDE}`, set to `--exclude voices-personal` when `ACTION=install` — which an
   archive is, and a build straight to his phone is not. **Measured: build 561's archive held
   `web/voices-personal/`, build 562's does not, and the build log says "personal voice packs left out".**
   ⚠️ So build 561 was archived and NEVER uploaded; 562 is the first one with Apple.
3. ⚠️ **THE FIRST UPLOAD ATTEMPT FAILED WITH "The Internet connection appears to be offline" AFTER
   STALLING FOR 17 MINUTES**, while `curl` reached every Apple host moments later. A network drop, not a
   configuration fault: the same command, re-run on the same archive, uploaded in eleven seconds of
   transfer. Re-run once before diagnosing anything.

### Also in D2 part one

- `docs/testflight/testers/` — the tester brief (install, what to try, what is not ready, how to report
  with the "This version" lines), and the TestFlight pages are left out of the app bundle.
- TESTFLIGHT.md and `docs/testflight/index.html` describe the xcodebuild upload, the release Xcode, and
  the group name the script expects: **"Internal Testers"**, with automatic distribution on.
- The privacy policy says what TestFlight shows the developer about a tester.

### What finishes D2 (the owner's)

1. When App Store Connect shows build 562 as Ready to Test: TestFlight → Internal Testing → new group
   **Internal Testers**, automatic distribution ON, add himself, add build 562.
2. Install from TestFlight; **Profile › Your data › This version** must say 562 — PLAN.md's verify step.
3. Optionally the App Store Connect key (App Manager), so `node tools/testflight-distribute.mjs 562
   "Internal Testers"` can do step 1's last part and report it — the other half of the verify step.
