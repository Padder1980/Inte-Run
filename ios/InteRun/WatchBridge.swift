import Foundation
import HealthKit
import WatchConnectivity
import UIKit
import UserNotifications
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

    /// ⚠️ App-lifetime, not web-view-lifetime.
    ///
    /// This used to be created inside `WebHost.makeUIView`, so the WCSession delegate only existed
    /// while the page did. Two consequences, both of which the owner hit: a freshly installed watch
    /// sat on "Waiting for your plan" until the phone app was opened at least once, and a
    /// background wake from the watch had nobody to answer it. The bridge is now built at launch and
    /// keeps its own copy of the last payload on disk, so it can answer from cache with no web view
    /// anywhere in sight.
    static let shared = WatchBridge()

    weak var webView: WKWebView?
    private static let payloadKey = "interun_watch_last_payload"
    private var lastPayload: [String: Any]? {
        get { UserDefaults.standard.dictionary(forKey: Self.payloadKey) }
        set {
            if let v = newValue { UserDefaults.standard.set(v, forKey: Self.payloadKey) }
            else { UserDefaults.standard.removeObject(forKey: Self.payloadKey) }
        }
    }
    /// Held separately from the persisted copy: a payload that arrived before activation still has
    /// to be sent once the session comes up.
    private var awaitingActivation: [String: Any]?

    /// Held between "start on my watch" and the count-in reaching go.
    private var pendingWatchSession: [String: Any]?

    /// Today's session title/type from the last sync, so a mirrored workout can name its card
    /// without waiting for a live tick it may not get for two seconds.
    var cachedSessionTitle: String? { (lastPayload?["session"] as? [String: Any])?["title"] as? String }
    var cachedSessionType: String? { (lastPayload?["session"] as? [String: Any])?["type"] as? String }

    /// The most recent live tick, so the page can be dropped straight onto the live screen the
    /// moment the app becomes active — rather than showing Today for two seconds and then jumping.
    private var lastLive: [String: Any]?
    private var lastLiveAt = Date.distantPast
    private var notifiedRun: String?

    private override init() {
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

    private func push(_ payload: [String: Any], force: Bool = false) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        lastPayload = payload   // cached first, so a background wake can answer even if the send fails
        guard session.activationState == .activated else {
            awaitingActivation = payload // replay once the session comes up
            return
        }
        // An unchanged context is rejected by WatchConnectivity, so only send real changes — unless
        // the watch has explicitly asked, in which case it plainly does not have it.
        do {
            var out = payload
            if force { out["at"] = Date().timeIntervalSince1970 }
            try session.updateApplicationContext(out)
        } catch {
            SelfCheck.logger.error("watch context failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension WatchBridge: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        SelfCheck.logger.notice("watch bridge activated: state=\(state.rawValue) paired=\(session.isPaired) installed=\(session.isWatchAppInstalled)")
        guard state == .activated else { return }
        if let pending = awaitingActivation {
            awaitingActivation = nil
            push(pending)
        } else if let cached = lastPayload {
            // Re-deliver on every reconnect. Cheap, and it is what rescues a watch that was
            // installed or reset after the last real sync.
            push(cached, force: true)
        }
        drainPendingRuns()
    }

    /// The watch asking for its plan, which it does when it has nothing current. iOS wakes this app
    /// in the background to deliver the message, so the reply comes from the persisted cache — the
    /// web view is almost certainly not running at this point.
    private func handleSyncRequest(_ reply: @escaping ([String: Any]) -> Void) {
        let cached = lastPayload ?? [:]
        reply(cached)
        if !cached.isEmpty { push(cached, force: true) }
    }

    /// A finished run arriving from the wrist. Queued rather than applied immediately: the page may
    /// not exist yet, and losing someone's run because the app happened to be closed is unforgivable.
    /// The immediate path, used when the phone is reachable. Same handling as the queued one; the
    /// run id makes a double delivery a no-op.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any],
                 replyHandler: @escaping ([String: Any]) -> Void) {
        if message["request"] as? String == "sync" { return handleSyncRequest(replyHandler) }
        replyHandler([:])
        route(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        route(message)
    }

    /// Everything the watch can send that is not a sync request.
    private func route(_ message: [String: Any]) {
        // The wrist asking the phone to speak. It decides WHEN; we decide what it sounds like, which
        // is the whole point — the recorded coaches live here, not on the watch.
        if let cue = message["cue"] as? String {
            let text = (message["text"] as? String) ?? ""
            DispatchQueue.main.async { self.forwardCue(cue, text: text) }
            return
        }
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
    /// One place that talks to the wrist, so reachability is checked once.
    private func sendToWatch(_ payload: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return }
        s.sendMessage(payload, replyHandler: nil, errorHandler: { _ in })
    }

    private func startWatchWorkout(title: String, type: String, companion: Bool = false) {
        // ⚠️ The Live Activity is raised HERE, and it has to be. This tap happens with the app on
        // screen, and the foreground is the only place iOS permits `Activity.request` — a wrist run
        // never gets another one. Every watch tick after this updates the card, which the background
        // IS allowed to do. Raised before requestAuthorization below, because that callback can run
        // long after the runner has pocketed the phone.
        Task { @MainActor in
            // A companion launch means the PHONE is recording and already owns the card.
            guard !companion else { return }
            LiveActivityService.shared.start(
                runId: "watch-pending", title: title, type: type,
                state: .init(elapsedSeconds: 0, distanceKm: 0, paceSecPerKm: nil, heartRate: nil,
                             step: nil, paused: false, onWatch: true),
            )
        }
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

    private func forwardCue(_ trigger: String, text: String) {
        guard let webView else { return }
        let safe = { (v: String) in v.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") }
        webView.evaluateJavaScript(
            "window.__interunWatchCue && window.__interunWatchCue(\"\(safe(trigger))\", \"\(safe(text))\");")
    }

    private func forwardLive(_ live: [String: Any]) {
        let ended = (live["state"] as? String) == "ended"
        lastLive = ended ? nil : live
        lastLiveAt = Date()
        if ended { notifiedRun = nil }

        if let webView,
           let data = try? JSONSerialization.data(withJSONObject: live),
           let json = String(data: data, encoding: .utf8) {
            webView.evaluateJavaScript("window.__interunWatchLive && window.__interunWatchLive(\(json));")
        }
        // Keep the card in step. ⚠️ This can only ever UPDATE — starting one from here is refused,
        // because a WatchConnectivity wake is a background context. The card is raised when the
        // runner taps "Apple Watch" in the start sheet (startWatchWorkout), which is a foreground
        // moment; a run begun entirely on the wrist gets the follow-along notification instead.
        Task { @MainActor in
            self.driveLiveActivity(live, ended: ended)
            // The notification is a FALLBACK, not a companion. Now that the Live Activity works it
            // says the same thing twice, so it only fires when there is no card — which still
            // happens if the runner has Live Activities switched off, or the mirrored launch was
            // missed. Checked after driveLiveActivity, on the same actor, so isRunning is settled.
            if !ended, !LiveActivityService.shared.isRunning { self.offerToFollowAlong(live) }
        }
    }

    @MainActor
    private func driveLiveActivity(_ live: [String: Any], ended: Bool) {
        let state = RunActivityAttributes.ContentState(
            elapsedSeconds: (live["sec"] as? Int) ?? 0,
            distanceKm: (live["distKm"] as? Double) ?? 0,
            paceSecPerKm: live["paceSec"] as? Int,
            heartRate: live["hr"] as? Int,
            step: live["step"] as? String,
            paused: (live["state"] as? String) == "paused",
            onWatch: true,
        )
        if ended {
            LiveActivityService.shared.end(state)
        } else {
            LiveActivityService.shared.start(
                runId: (live["id"] as? String) ?? "watch",
                title: (live["title"] as? String) ?? "Run",
                type: (live["type"] as? String) ?? "easy",
                state: state,
            )
        }
    }

    /// ⚠️ A watchOS app CANNOT bring the iPhone app to the foreground. There is no API for it —
    /// `sendMessage` wakes this app in the BACKGROUND only, and `startWatchApp` runs the other way.
    /// Apple does not permit the reverse, so "start on the watch and the phone opens itself" is not
    /// buildable however it is wired.
    ///
    /// What is buildable is one tap. When a run starts on the wrist and this app is not in front, a
    /// notification offers to follow along; tapping it opens the app, and `replayLiveOnActivate`
    /// puts it straight on the live screen. Sent once per run, because a nag every two seconds
    /// while someone runs would be intolerable.
    @MainActor
    private func offerToFollowAlong(_ live: [String: Any]) {
        guard let id = live["id"] as? String, notifiedRun != id else { return }
        do {
            guard UIApplication.shared.applicationState != .active else { return }
            self.notifiedRun = id
            let content = UNMutableNotificationContent()
            content.title = (live["title"] as? String) ?? "Run started"
            content.body = "Running on your Apple Watch — tap to follow along here."
            content.sound = nil          // the wrist already buzzed; a chime mid-stride is noise
            content.interruptionLevel = .passive
            content.userInfo = ["interunWatchLive": true]
            let req = UNNotificationRequest(identifier: "interun-watch-live-\(id)",
                                            content: content, trigger: nil)
            UNUserNotificationCenter.current().add(req)
        }
    }

    /// Called when the app comes to the front. If the wrist is still running, hand the page the last
    /// tick immediately so it lands on the live screen rather than on Today.
    func replayLiveOnActivate() {
        guard let live = lastLive, Date().timeIntervalSince(lastLiveAt) < 45 else { return }
        forwardLive(live)
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
        case "liveActivity":
            // The phone's OWN run driving the same card the wrist drives. Marked onWatch: false so
            // the card says which device is recording.
            let ended = (body["state"] as? String) == "ended"
            let state = RunActivityAttributes.ContentState(
                elapsedSeconds: (body["sec"] as? Int) ?? 0,
                distanceKm: (body["distKm"] as? Double) ?? 0,
                paceSecPerKm: body["paceSec"] as? Int,
                heartRate: body["hr"] as? Int,
                step: body["step"] as? String,
                paused: (body["paused"] as? Bool) ?? false,
                onWatch: false,
            )
            Task { @MainActor in
                if ended { LiveActivityService.shared.end(state) }
                else {
                    LiveActivityService.shared.start(
                        runId: (body["id"] as? String) ?? "phone",
                        title: (body["title"] as? String) ?? "Run",
                        type: (body["type"] as? String) ?? "easy",
                        state: state,
                    )
                }
            }
        case "startCompanion":
            // Launch the watch to WATCH. HealthKit's startWatchApp is the only way to wake it from
            // here; the watch decides what to do with the launch, and companionOnly tells it to
            // display rather than record.
            sendToWatch(["command": "companionStart"])
            startWatchWorkout(title: (body["title"] as? String) ?? "Run",
                              type: (body["type"] as? String) ?? "easy",
                              companion: true)
        case "companionTick":
            var live: [String: Any] = [:]
            for k in ["sec", "distKm", "paceSec"] { if let v = body[k] { live[k] = v } }
            live["title"] = body["title"] as? String ?? "Run"
            sendToWatch(["phoneLive": live])
        case "endCompanion":
            sendToWatch(["command": "companionEnd"])
        case "watchCommand":
            // Straight through to the wrist. Fire-and-forget: if the watch is unreachable the run
            // simply carries on there, which is the safe failure — a run must never be ended by a
            // message that only half-arrived.
            if let cmd = body["command"] as? String {
                var msg: [String: Any] = ["command": cmd]
                // The go signal carries the session, because only now is the watch listening.
                if cmd == "startNow", let sess = pendingWatchSession {
                    msg["session"] = sess
                    pendingWatchSession = nil
                }
                sendToWatch(msg)
            }
        case "sync":
            // `session` is deliberately allowed to be absent: that is how the page says "rest day",
            // which the watch must be able to tell apart from "we have not synced yet".
            // Forward by key list rather than cherry-picking: a field added on the page side must
            // not need a matching edit here to travel. Absent keys are meaningful (a cleared "why",
            // a rest day), so they are simply left out and the watch treats that as "none".
            var payload: [String: Any] = ["at": Date().timeIntervalSince1970]
            for key in ["session", "name", "why", "whyName", "dateIso", "upcoming", "coach", "coachLines"] where body[key] != nil {
                payload[key] = body[key]
            }
            push(payload)
        case "ready":
            // The page has finished booting and can accept runs now.
            drainPendingRuns()
        case "startWorkout":
            // ⚠️ Do NOT try to push the session here. sendMessage needs the watch app RUNNING, and
            // it is not — we are about to launch it. The message was silently dropped and the wrist
            // fell back to its cached copy of today, so starting any other day ran the wrong run.
            // The session travels on "startNow" instead, by which time the watch is up.
            pendingWatchSession = body["session"] as? [String: Any]
            startWatchWorkout(title: (body["title"] as? String) ?? "Run",
                              type: (body["type"] as? String) ?? "easy")
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
