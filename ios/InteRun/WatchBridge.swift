import Foundation
import HealthKit
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
        guard WCSession.isSupported() else { SelfCheck.logger.notice("watch bridge: WatchConnectivity unsupported"); return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    /// Runs finished on the wrist, waiting to be handed to the page.
    ///
    /// The phone app is usually closed when a run ends, so these arrive by `transferUserInfo`
    /// (queued and guaranteed, unlike `sendMessage` which needs both apps live) and are held on
    /// disk until the web view is up and has told us it is ready to receive them.
    private static let pendingKey = "interun_pending_watch_runs"

    private var pendingRuns: [[String: Any]] {
        get { (UserDefaults.standard.array(forKey: Self.pendingKey) as? [[String: Any]]) ?? [] }
        set { UserDefaults.standard.set(newValue, forKey: Self.pendingKey) }
    }

    /// Hand every queued run to the page, dropping only the ones it confirms it has taken. A run
    /// that fails to land stays queued rather than evaporating.
    func drainPendingRuns() {
        let runs = pendingRuns
        guard !runs.isEmpty, let webView else { return }
        var remaining = runs
        let group = DispatchGroup()

        for run in runs {
            guard let data = try? JSONSerialization.data(withJSONObject: run),
                  let json = String(data: data, encoding: .utf8) else {
                remaining.removeAll { NSDictionary(dictionary: $0).isEqual(to: run) }
                continue
            }
            let safe = json
                .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
            group.enter()
            webView.evaluateJavaScript("window.__interunWatchRun && window.__interunWatchRun(\(safe));") { result, _ in
                // "" means logged; "already logged" means a duplicate delivery. Both are done with.
                let outcome = (result as? String) ?? "no handler"
                if outcome.isEmpty || outcome == "already logged" || outcome == "too short to log" {
                    remaining.removeAll { NSDictionary(dictionary: $0).isEqual(to: run) }
                }
                group.leave()
            }
        }
        group.notify(queue: .main) { [weak self] in self?.pendingRuns = remaining }
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
        SelfCheck.logger.notice("watch bridge activated: state=\(state.rawValue) paired=\(session.isPaired) installed=\(session.isWatchAppInstalled)")
        if state == .activated, let pending = lastPayload {
            lastPayload = nil
            push(pending)
        }
    }

    /// A finished run arriving from the wrist. Queued rather than applied immediately: the page may
    /// not exist yet, and losing someone's run because the app happened to be closed is unforgivable.
    /// The immediate path, used when the phone is reachable. Same handling as the queued one; the
    /// run id makes a double delivery a no-op.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        // Live ticks from a run happening on the wrist right now. These are transient by design:
        // if the phone is asleep they are simply missed, and the next tick two seconds later
        // catches up. Nothing about the recorded run depends on them.
        if let live = message["live"] as? [String: Any] {
            DispatchQueue.main.async { self.forwardLive(live) }
            return
        }
        SelfCheck.logger.notice("watch run arrived (message)")
        acceptRun(from: message)
    }

    /// Launch the watch app straight into a run.
    ///
    /// `sendMessage` cannot do this — it needs the watch app already running — so this goes through
    /// HealthKit's `startWatchApp(toHandle:)`, the one API that will wake a watchOS app from the
    /// phone. It needs HealthKit authorisation first, which is why the request is inline rather
    /// than at launch: asking for health permissions before someone has expressed any interest in
    /// the watch is exactly the prompt everyone declines.
    private func startWatchWorkout() {
        guard HKHealthStore.isHealthDataAvailable() else {
            return reportStart(false, "This iPhone can’t talk to HealthKit.")
        }
        guard WCSession.isSupported(), WCSession.default.isWatchAppInstalled else {
            return reportStart(false, "InteRun isn’t installed on your Apple Watch yet.")
        }
        let store = HKHealthStore()
        let share: Set<HKSampleType> = [HKObjectType.workoutType()]
        let read: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!,
        ]
        store.requestAuthorization(toShare: share, read: read) { [weak self] _, _ in
            // A declined prompt is not a reason to stop: the watch asks for its own permissions,
            // and the run can still be recorded there.
            let config = HKWorkoutConfiguration()
            config.activityType = .running
            config.locationType = .outdoor
            store.startWatchApp(with: config) { ok, error in
                self?.reportStart(ok, ok ? nil : (error?.localizedDescription ?? "Couldn’t open InteRun on your watch."))
            }
        }
    }

    private func reportStart(_ ok: Bool, _ reason: String?) {
        DispatchQueue.main.async { [weak self] in
            guard let webView = self?.webView else { return }
            let msg = (reason ?? "").replacingOccurrences(of: "\\", with: "\\\\")
                                    .replacingOccurrences(of: "\"", with: "\\\"")
            webView.evaluateJavaScript(
                "window.__interunWatchStart && window.__interunWatchStart(\(ok), \"\(msg)\");")
        }
    }

    private func forwardLive(_ live: [String: Any]) {
        guard let webView,
              let data = try? JSONSerialization.data(withJSONObject: live),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__interunWatchLive && window.__interunWatchLive(\(json));")
    }

    /// NOTE: no default value on `userInfo`. Xcode's autocomplete offers `= [:]`, which changes the
    /// Swift signature so it no longer satisfies the @objc protocol requirement — the delegate then
    /// silently never fires and runs vanish with no error anywhere.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        SelfCheck.logger.notice("watch run arrived (queued transfer)")
        acceptRun(from: userInfo)
    }

    private func acceptRun(from payload: [String: Any]) {
        guard let run = payload["run"] as? [String: Any] else { return }
        DispatchQueue.main.async {
            var queue = self.pendingRuns
            let id = run["id"] as? String
            if let id, queue.contains(where: { ($0["id"] as? String) == id }) { return }
            queue.append(run)
            self.pendingRuns = queue
            self.drainPendingRuns()
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
            // Forward by key list rather than cherry-picking: a field added on the page side must
            // not need a matching edit here to travel. Absent keys are meaningful (a cleared "why",
            // a rest day), so they are simply left out and the watch treats that as "none".
            var payload: [String: Any] = ["at": Date().timeIntervalSince1970]
            for key in ["session", "name", "why", "whyName", "dateIso"] where body[key] != nil {
                payload[key] = body[key]
            }
            push(payload)
        case "ready":
            // The page has finished booting and can accept runs now.
            drainPendingRuns()
        case "startWorkout":
            startWatchWorkout()
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
