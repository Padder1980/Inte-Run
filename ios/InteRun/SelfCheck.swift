import Foundation
import WebKit
import os

/// A headless smoke test for the assumptions the hybrid shell rests on.
///
/// The native shell is only sound if four things are true inside the web view, and every one of
/// them is invisible from the outside — a broken one shows up as an app that merely *looks* fine:
///
///  1. the page is served from the expected origin (`localStorage` is keyed to it);
///  2. `localStorage` writes **and survives a relaunch** — it is the app's entire database;
///  3. `fetch()` works, which `file://` would have blocked (the coach manifest needs it);
///  4. the engine global `RC` actually loaded;
///  5. the native GPS shim replaced `navigator.geolocation` before app code ran;
///  6. the PWA-to-app migration path is present and its file picker reachable.
///
/// Run with `-InteRunSelfCheck YES`; results go to the unified log under the "selfcheck" category.
/// Nothing here runs in a normal launch.
enum SelfCheck {
    static let logger = Logger(subsystem: "com.interun.app", category: "selfcheck")

    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: "InteRunSelfCheck")
    }

    /// Written on the first checked launch, looked for on the next one — the only honest way to
    /// prove persistence, since a value read back within the same session proves nothing about disk.
    private static let persistKey = "_selfcheck_persist"  // leading _ keeps it OUT of user backups

    // `callAsyncJavaScript` wraps this as the BODY of an async function — so it is top-level
    // `await` and `return`, not an IIFE. Wrapping it in one returns a discarded promise (`nil`).
    private static let script = """
    const out = { origin: location.origin, href: location.href };

    // 1 + 2. localStorage: does it work at all, and did last launch's value survive?
    try {
      out.priorValue = localStorage.getItem('\(persistKey)');
      localStorage.setItem('\(persistKey)', String(Date.now()));
      out.localStorageWrites = localStorage.getItem('\(persistKey)') !== null;
    } catch (e) {
      out.localStorageWrites = false;
      out.localStorageError = String(e);
    }

    // 3. fetch() — blocked under file://, which is the whole reason for the custom scheme.
    let clip = null;
    try {
      const r = await fetch('voices/manifest.json');
      out.fetchStatus = r.status;
      const m = await r.json();
      out.coaches = (m.coaches || []).map((c) => c.id);
      out.clipCount = (m.clips || []).length;
      clip = (m.clips || [])[0];
    } catch (e) {
      out.fetchError = String(e);
    }

    // Range requests against a REAL clip: without a 206 plus a correct Content-Range, <audio>
    // silently refuses to play the coach voices.
    try {
      if (clip) {
        const r = await fetch(clip.file, { headers: { Range: 'bytes=0-99' } });
        const buf = await r.arrayBuffer();
        out.range = {
          file: clip.file,
          status: r.status,
          contentRange: r.headers.get('Content-Range'),
          bytes: buf.byteLength,
          ok: r.status === 206 && buf.byteLength === 100
            && r.headers.get('Content-Range') === 'bytes 0-99/' + clip.bytes,
        };
      }
    } catch (e) { out.rangeError = String(e); }

    // And that an <audio> element will actually load it end to end.
    try {
      if (clip) {
        out.audio = await new Promise((res) => {
          const a = new Audio(clip.file);
          const t = setTimeout(() => res({ ok: false, why: 'timeout' }), 4000);
          a.addEventListener('loadedmetadata', () => {
            clearTimeout(t); res({ ok: true, duration: Math.round(a.duration * 100) / 100 });
          });
          a.addEventListener('error', () => {
            clearTimeout(t); res({ ok: false, why: 'error', code: a.error && a.error.code });
          });
        });
      }
    } catch (e) { out.audioError = String(e); }

    // 5. Native GPS: the shim must have replaced navigator.geolocation before app code ran, or
    // tracking silently reverts to the web view's own, which dies the moment the phone locks.
    out.geo = {
      shimInstalled: !!window.__interunGeo,
      handlerPresent: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.interunGeo),
      watchIsNative: typeof navigator.geolocation.watchPosition === 'function'
        && String(navigator.geolocation.watchPosition).indexOf('[native code]') === -1,
    };

    // 4. The engine bundle.
    out.engineLoaded = typeof RC !== 'undefined' && typeof RC.generatePlan === 'function';
    out.appBooted = !!document.getElementById('view');

    // 6. The migration path in and out of this app: a backup must round-trip through the same
    // code the runner will use, and the file picker must exist for restore to be reachable.
    try {
      const bk = collectBackup();
      out.backup = { format: bk.format, keys: Object.keys(bk.data).length };
      out.backupValidates = validateBackup(bk) === '' || validateBackup(bk);
      out.canShareFiles = canShareBackup();
      const probe = document.createElement('input');
      probe.type = 'file';
      out.filePickerSupported = probe.type === 'file';
      out.downloadAttrSupported = 'download' in document.createElement('a');
    } catch (e) { out.backupError = String(e); }

    return JSON.stringify(out);
    """

    static func run(on webView: WKWebView) {
        // Let the page's own boot sequence settle before asking it anything.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            webView.callAsyncJavaScript(script, in: nil, in: .page) { result in
                switch result {
                case let .success(value):
                    // os_log truncates around 1 KB, which silently cut results short. Write the
                    // whole thing to the container and log only where to find it.
                    let text = (value as? String) ?? String(describing: value)
                    let url = URL.documentsDirectory.appendingPathComponent("selfcheck.json")
                    try? text.write(to: url, atomically: true, encoding: .utf8)
                    logger.notice("RESULT written to \(url.path, privacy: .public) (\(text.count) chars)")
                case let .failure(error):
                    logger.error("FAILED \(error.localizedDescription, privacy: .public)")
                }
            }
        }
    }
}
