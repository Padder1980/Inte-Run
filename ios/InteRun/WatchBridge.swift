import Foundation
import WatchConnectivity
import WebKit

/// Carries today's session from the web app to the watch.
///
/// The plan lives in `localStorage` inside the web view, which the watch has no way to reach —
/// and unlike the iPhone, watchOS has no JavaScriptCore, so it cannot run the engine either. The
/// phone therefore extracts just the one thing the wrist needs and pushes it across.
///
/// `updateApplicationContext` is the right channel: latest-value-wins, coalesced by the system, and
/// delivered even when the watch app is not running. A reminder to check "is the watch awake" would
/// be exactly the wrong design for "what am I doing today".
final class WatchBridge: NSObject {
    static let messageName = "interunWatch"

    private weak var webView: WKWebView?
    private var lastPayload: [String: Any]?

    init(webView: WKWebView?) {
        self.webView = webView
        super.init()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    private func push(_ payload: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else {
            lastPayload = payload // replay once the session comes up
            return
        }
        // An unchanged context is rejected by WatchConnectivity, so only send real changes.
        if let last = lastPayload, NSDictionary(dictionary: last).isEqual(to: payload) { return }
        do {
            try session.updateApplicationContext(payload)
            lastPayload = payload
        } catch {
            SelfCheck.logger.error("watch context failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension WatchBridge: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        if state == .activated, let pending = lastPayload {
            lastPayload = nil
            push(pending)
        }
    }

    // Required on iOS: the user can unpair one watch and pair another without relaunching.
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
}

extension WatchBridge: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "sync":
            // `session` is deliberately allowed to be absent: that is how the page says "rest day",
            // which the watch must be able to tell apart from "we have not synced yet".
            var payload: [String: Any] = ["at": Date().timeIntervalSince1970]
            if let s = body["session"] as? [String: Any] { payload["session"] = s }
            push(payload)
        case "status":
            let paired: Bool
            let installed: Bool
            if WCSession.isSupported() {
                paired = WCSession.default.isPaired
                installed = WCSession.default.isWatchAppInstalled
            } else {
                paired = false; installed = false
            }
            webView?.evaluateJavaScript(
                "window.__interunWatch && window.__interunWatch.status(\(paired), \(installed));")
        default: break
        }
    }
}
