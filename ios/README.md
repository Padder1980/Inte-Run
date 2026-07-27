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

## Known gaps

These are real, deliberate, and not yet done:

- **Background GPS.** `UIBackgroundModes: location` is declared, but nothing yet holds a
  `CLLocationManager` with `allowsBackgroundLocationUpdates`, so tracking still stops when the
  screen locks. The declaration alone is not enough.
- **Local notifications.** Session reminders still use the web timer, which dies with the app. A
  native `UNUserNotificationCenter` bridge is the fix, and would finally make reminders reliable.
- **Build with release Xcode to submit.** `/Applications/Xcode.app` is 26.6 (release, can submit);
  `/Applications/Xcode-beta.app` is 27.0 beta (development only — App Store Connect rejects its
  builds).
