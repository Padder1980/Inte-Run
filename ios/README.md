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

1. Point the toolchain at Xcode and accept the licence (needs your password):
   ```bash
   sudo xcode-select -s /Applications/Xcode-beta.app/Contents/Developer
   ```
   ```bash
   sudo xcodebuild -license accept
   ```
2. Xcode → **Settings → Components** → download the **iOS** and **watchOS** simulator runtimes.
3. Open `ios/InteRun.xcodeproj`, select the **InteRun** target → **Signing & Capabilities**, and set
   your team. The bundle ID is `com.interun.app` — change it if you want a different one, and
   register the same value in App Store Connect.

## Building

```bash
xcodebuild -project ios/InteRun.xcodeproj -scheme InteRun -sdk iphonesimulator -configuration Debug build
```

## Known gaps

These are real, deliberate, and not yet done:

- **Blob downloads.** The calendar `.ics` export uses a blob + `download` attribute. WKWebView needs
  a `WKDownloadDelegate` for that; without one the button does nothing. Needs wiring.
- **Background GPS.** `UIBackgroundModes: location` is declared, but nothing yet holds a
  `CLLocationManager` with `allowsBackgroundLocationUpdates`, so tracking still stops when the
  screen locks. The declaration alone is not enough.
- **Local notifications.** Session reminders still use the web timer, which dies with the app. A
  native `UNUserNotificationCenter` bridge is the fix, and would finally make reminders reliable.
- **No data migration from the PWA.** A runner who has been using the Home Screen PWA has their
  history in Safari's storage for `padder1980.github.io`; the app starts empty. An export/import
  needs building before asking anyone to switch.
- **Beta Xcode cannot submit.** App Store Connect rejects builds from a beta Xcode. Fine for
  development; install release Xcode before submitting.
