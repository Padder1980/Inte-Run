import Foundation
import WebKit

/// Over-the-air updates for the web layer.
///
/// InteRun is a thin Swift shell around a single self-contained web page (`docs/index.html`). Almost
/// everything we build lives in that page — every screen, the layouts, the stretch artwork, the plan
/// logic — and until now it was FROZEN into the app bundle at build time. A change only reached the
/// phone on an Xcode rebuild, which is a trap that has bitten repeatedly (a fix reported "not working"
/// that had simply never been installed). This checks GitHub Pages on launch and, when a newer build
/// is published, downloads `index.html` and serves THAT in place of the bundled copy — over the SAME
/// `interun://app` origin, so `localStorage` (the app's entire database) is untouched.
///
/// Safety is the whole design, and the bundle is always the floor:
///  - No network, a bad download, a download older than the bundle — every one of them falls back to
///    the bundled copy, which shipped working.
///  - A download is only ADOPTED on the NEXT launch, never mid-session: swapping the page under a live
///    run would be a disaster. `checkForUpdate` writes the file; `prepare` (next launch) reads it.
///  - A WATCHDOG reverts a copy that cannot boot. An adopted build must post `booted` from the page;
///    a build served twice that never confirms is deleted and the app falls back to the bundle. This
///    is what makes a bad web push recoverable WITHOUT a Mac.
///  - Only `index.html` travels over the air. Voices, icons and the peripheral pages stay bundle-served
///    (they change rarely and are large); a genuinely new coach clip still needs a rebuild, and the
///    page already falls back to the device voice when a clip is missing. A future page that needs a
///    NEW native bridge degrades gracefully too — it guards `window.webkit.messageHandlers.*` — so the
///    web feature simply stays dormant until a rebuild adds the Swift.
final class WebUpdateService: NSObject {
    static let shared = WebUpdateService()
    static let messageName = "interunUpdate"

    /// The published web layer. Same host GitHub Pages serves the PWA from.
    private let remoteIndex = URL(string: "https://padder1980.github.io/Inte-Run/index.html")!

    private let dEtag = "InteRunWebUpdate.etag"
    private let dConfirmed = "InteRunWebUpdate.confirmedBuild"   // a build stamp proven to boot
    private let dAttemptBuild = "InteRunWebUpdate.attemptBuild"
    private let dAttemptCount = "InteRunWebUpdate.attemptCount"
    private let dRejected = "InteRunWebUpdate.rejectedBuild"     // a build that failed the watchdog

    /// The page pushes its diagnostic here so Support › Your data can show which copy is running.
    weak var webView: WKWebView?

    private var dir: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("web-ota", isDirectory: true)
    }
    private var otaIndex: URL { dir.appendingPathComponent("index.html") }

    // Decided once by `prepare`, read by the scheme handler on the index request.
    private(set) var activeIndexData: Data?    // non-nil ⇒ serve this instead of the bundle
    private(set) var activeChannel = "bundle"  // "bundle" | "ota"
    private(set) var bundleBuild = ""
    private(set) var otaBuild = ""
    private(set) var lastCheck = "idle"

    private var lastCheckAt: Date?

    // MARK: - Launch decision

    /// Decide which `index.html` to serve for THIS session. Must run before the web view loads.
    func prepare(bundleRoot: URL) {
        let d = UserDefaults.standard
        let bundleIndex = bundleRoot.appendingPathComponent("index.html")
        // Memory-mapped, not copied: these are ~11 MB and this runs on the main thread at launch. The
        // stamp scan and the scheme handler both read straight from the mapping. A later download that
        // replaces the file leaves this mapping valid (Unix unlink semantics) for the current session,
        // which is correct — an update is only adopted on the NEXT launch, never hot-swapped.
        bundleBuild = (try? Data(contentsOf: bundleIndex, options: .mappedIfSafe)).flatMap(Self.buildStamp) ?? ""

        // No downloaded copy, or one that is not usable / not newer than the bundle → bundle wins.
        guard let otaData = try? Data(contentsOf: otaIndex, options: .mappedIfSafe),
              Self.validate(otaData),
              let stamp = Self.buildStamp(in: otaData),
              stamp > bundleBuild else {
            // If a stale OTA copy is now at or behind the bundle (e.g. after a native rebuild), drop it.
            if FileManager.default.fileExists(atPath: otaIndex.path) {
                try? FileManager.default.removeItem(at: otaIndex)
                d.removeObject(forKey: dEtag)
            }
            useBundle()
            return
        }

        // A build the watchdog already gave up on must never be served again — otherwise it is served,
        // reverted, re-downloaded and served once more, for good. It stays rejected until a NEWER build
        // is published (a different stamp), which is the only thing that can fix it.
        if d.string(forKey: dRejected) == stamp {
            try? FileManager.default.removeItem(at: otaIndex)
            useBundle()
            return
        }

        otaBuild = stamp

        // Watchdog. A build proven to boot is served straight away.
        if d.string(forKey: dConfirmed) == stamp {
            activeChannel = "ota"; activeIndexData = otaData
            return
        }
        // Not yet confirmed: count how many times we have SERVED it without a boot confirmation.
        let already = (d.string(forKey: dAttemptBuild) == stamp) ? d.integer(forKey: dAttemptCount) : 0
        if already >= 2 {
            // Served twice, never said it booted → treat as broken. Reject this stamp so it is not
            // re-downloaded, drop the file, and revert to the bundle.
            d.set(stamp, forKey: dRejected)
            try? FileManager.default.removeItem(at: otaIndex)
            d.removeObject(forKey: dEtag)
            d.removeObject(forKey: dAttemptBuild)
            d.removeObject(forKey: dAttemptCount)
            useBundle()
            return
        }
        d.set(stamp, forKey: dAttemptBuild)
        d.set(already + 1, forKey: dAttemptCount)
        activeChannel = "ota"; activeIndexData = otaData
    }

    private func useBundle() { activeChannel = "bundle"; activeIndexData = nil; otaBuild = "" }

    /// The page calls this once it has rendered successfully, clearing the watchdog for this build.
    func confirmBoot() {
        guard activeChannel == "ota", !otaBuild.isEmpty else { return }
        let d = UserDefaults.standard
        d.set(otaBuild, forKey: dConfirmed)
        d.removeObject(forKey: dAttemptBuild)
        d.removeObject(forKey: dAttemptCount)
        // A good boot clears any stale rejection (it can only have named an older, superseded build).
        d.removeObject(forKey: dRejected)
    }

    // MARK: - Fetch

    /// Check GitHub Pages for a newer build and download it for the NEXT launch. Cheap when nothing has
    /// changed: a conditional GET returns 304 and no body. Throttled so launch + foreground don't double up.
    func checkForUpdate() {
        if let t = lastCheckAt, Date().timeIntervalSince(t) < 60 { return }
        lastCheckAt = Date()

        var req = URLRequest(url: remoteIndex, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        if let etag = UserDefaults.standard.string(forKey: dEtag) {
            req.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }
        report("checking")

        URLSession.shared.dataTask(with: req) { [weak self] data, resp, err in
            guard let self else { return }
            let http = resp as? HTTPURLResponse
            if http?.statusCode == 304 { self.report("up-to-date"); return }
            guard err == nil, let http, http.statusCode == 200,
                  let data = data, Self.validate(data), let stamp = Self.buildStamp(in: data) else {
                self.report(err != nil ? "offline" : "no-valid-build")
                return
            }
            // Never re-download a build the watchdog rejected; only a newer stamp can supersede it.
            if UserDefaults.standard.string(forKey: self.dRejected) == stamp { self.report("held (last build failed to boot)"); return }
            // Adopt only a build strictly newer than what we would serve right now.
            let current = max(self.bundleBuild, self.otaBuild)
            guard stamp > current else { self.report("up-to-date"); return }
            do {
                try FileManager.default.createDirectory(at: self.dir, withIntermediateDirectories: true)
                let tmp = self.otaIndex.appendingPathExtension("tmp")
                try? FileManager.default.removeItem(at: tmp)
                try data.write(to: tmp, options: .atomic)
                if FileManager.default.fileExists(atPath: self.otaIndex.path) {
                    _ = try FileManager.default.replaceItemAt(self.otaIndex, withItemAt: tmp)
                } else {
                    try FileManager.default.moveItem(at: tmp, to: self.otaIndex)
                }
                if let etag = http.value(forHTTPHeaderField: "ETag") {
                    UserDefaults.standard.set(etag, forKey: self.dEtag)
                }
                // A fresh build gets a fresh watchdog budget.
                UserDefaults.standard.removeObject(forKey: self.dAttemptBuild)
                UserDefaults.standard.removeObject(forKey: self.dAttemptCount)
                self.report("downloaded " + stamp)
            } catch {
                self.report("save-failed")
            }
        }.resume()
    }

    /// Store the last check result and push the diagnostic into the page (if it is up).
    private func report(_ status: String) {
        lastCheck = status
        let js = "window.__interunWebUpdate && (window.__interunWebUpdate.check = "
            + "\"\(status.replacingOccurrences(of: "\"", with: "'"))\");"
        DispatchQueue.main.async { [weak self] in self?.webView?.evaluateJavaScript(js) }
    }

    /// The `{channel,bundle,ota,check}` object injected at document start.
    var diagnosticJS: String {
        func e(_ s: String) -> String { s.replacingOccurrences(of: "\"", with: "'") }
        return "window.__interunWebUpdate = {channel:\"\(activeChannel)\",bundle:\"\(e(bundleBuild))\","
            + "ota:\"\(e(otaBuild))\",check:\"\(e(lastCheck))\"};"
    }

    // MARK: - Helpers

    /// The page stamps itself `const BUILD = "YYYY-MM-DD HH:MM"`, which orders lexically == chronologically.
    /// Searched in the raw bytes (ASCII marker) to avoid decoding an 11 MB document to find one string.
    static func buildStamp(in data: Data) -> String? {
        let marker = Data("const BUILD = \"".utf8)
        guard let r = data.range(of: marker) else { return nil }
        let tail = data[r.upperBound...]
        guard let q = tail.firstIndex(of: 0x22) else { return nil }   // closing quote
        let stamp = String(data: data[r.upperBound..<q], encoding: .utf8) ?? ""
        return stamp.isEmpty ? nil : stamp
    }

    /// A real build is a large, self-contained document that carries a build stamp. This refuses a
    /// captive-portal page, a GitHub 404, or a truncated download being adopted as an update.
    static func validate(_ data: Data) -> Bool {
        guard data.count > 1_000_000 else { return false }
        return buildStamp(in: data) != nil
    }
}

extension WebUpdateService: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "booted" { confirmBoot() }
    }
}
