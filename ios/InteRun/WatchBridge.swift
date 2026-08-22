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
    /// ⚠️ "startNow" fires three seconds after `startWatchApp`, and the watch app has almost never
    /// finished launching and activating its WCSession by then — `isReachable` is false and a plain
    /// send is silently dropped, taking the prescribed session with it. So the go signal stays
    /// ARMED here and is flushed the moment the watch becomes reachable. Nothing started, nothing
    /// told the runner: that was the "watch waits forever" failure.
    private var pendingStartNow = false
    /// Same delivery problem for the companion launch: the display request must survive the gap.
    private var pendingCompanionStart = false
    /// Generation counter for the give-up timer, so an old deadline cannot cancel a new attempt.
    private var startNowGeneration = 0

    /// What the wrist says it is RUNNING, from the most recent live tick — not today's plan, which
    /// is wrong for a free run, an added session or another day's. Stale ticks don't count.
    var liveRunTitle: String? { Date().timeIntervalSince(lastLiveAt) < 30 ? lastLive?["title"] as? String : nil }
    var liveRunType: String? { Date().timeIntervalSince(lastLiveAt) < 30 ? lastLive?["type"] as? String : nil }

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
        // ⚠️ A CUE IS ANSWERED WITH WHETHER IT WAS ACTUALLY SOUNDED, not merely received. The wrist
        // treats a successful SEND as "the phone has this, stay quiet", so a phone that took the
        // message and played nothing left both devices silent, each believing the other had it. That
        // is what the owner heard as "only said the start but then nothing after".
        if let cue = message["cue"] as? String {
            let text = (message["text"] as? String) ?? ""
            DispatchQueue.main.async {
                replyHandler(["played": self.forwardCue(cue, text: text)])
            }
            return
        }
        replyHandler([:])
        route(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        route(message)
    }

    /// Everything the watch can send that is not a sync request.
    private func route(_ message: [String: Any]) {
        // Heart rate from the wrist while the PHONE records — the companion's whole purpose.
        if let hr = message["companionHR"] as? Int {
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript("window.__interunCompanionHR && window.__interunCompanionHR(\(hr));")
            }
            return
        }
        // The wrist driving the PHONE's own run — pause, resume, finish — while it is only a
        // companion. The mirror direction of `watchCommand` (which lets the phone drive a WRIST run)
        // and, until now, the one that did not exist: a runner recording on their phone had no
        // controls on their wrist at all.
        //
        // ⚠️ FIRE AND FORGET, exactly like the other direction, and for the same reason: a run must
        // never be ended by a message that only half-arrived. `evaluateJavaScript` does nothing at all
        // against a suspended web content process and reports no error, so the honest failure is that
        // the run simply carries on and is finished on the phone.
        //
        // ⚠️ THE BUTTONS ONLY APPEAR WHEN THE PAGE SAYS IT CAN ANSWER. The wrist gates its Controls
        // page on the `control` flag the page puts in its own companion tick, so a page without
        // `window.__interunWatchControl` never shows a control at all. That is what keeps this from
        // becoming another button that looks live and does nothing.
        if let cmd = message["phoneCommand"] as? String,
           ["pause", "resume", "stop"].contains(cmd) {
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(
                    "window.__interunWatchControl && window.__interunWatchControl(\"\(cmd)\");")
            }
            return
        }
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
                // ⚠️ A PLACEHOLDER CARD GETS NO ANCHOR. The run has not started — the watch is only
                // being woken — so a system timer here would count up from zero beside a distance
                // that stays at zero, which reads as a run in progress that is going nowhere.
                state: .init(elapsedSeconds: 0, distanceKm: 0, paceSecPerKm: nil, heartRate: nil,
                             step: nil, paused: false, onWatch: true, runningSince: nil),
            )
        }
        guard HKHealthStore.isHealthDataAvailable() else {
            return reportStart(false, "This iPhone can’t talk to HealthKit.")
        }
        guard WCSession.isSupported(), WCSession.default.isWatchAppInstalled else {
            return reportStart(false, "Inte-Run isn’t installed on your Apple Watch yet.")
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
                if !ok {
                    // The tap raised a placeholder Live Activity; a launch that failed must take it
                    // down or a dead card sits on the lock screen forever, surviving relaunches.
                    Task { @MainActor in LiveActivityService.shared.endIfCurrent("watch-pending") }
                }
                // ⚠️⚠️ NEVER THE NSError's OWN WORDS. This read
                // `error?.localizedDescription ?? "..."`, and reportStart's string goes
                // straight into a toast in front of a running runner — so a failed XPC handshake
                // put "Couldn't communicate with a helper application." on screen mid-run, which is
                // Cocoa error 4099 and names nothing anybody can act on. Three of reportStart's four
                // callers already pass plain English we wrote; this was the one that did not. The
                // detail is worth keeping, so it goes to the log rather than to the runner.
                if let error { SelfCheck.logger.error("startWatchApp failed: \(error.localizedDescription, privacy: .public)") }
                self?.reportStart(ok, ok ? nil : "Couldn’t open Inte-Run on your watch.")
            }
        }
    }

    private func armStartNow() {
        pendingStartNow = true
        startNowGeneration += 1
        let gen = startNowGeneration
        flushStartNow()
        // If the watch never becomes reachable, say so — a runner staring at "Starting on your
        // Apple Watch…" deserves an answer, and the stranded placeholder card must come down.
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { [weak self] in
            guard let self, self.pendingStartNow, self.startNowGeneration == gen else { return }
            self.pendingStartNow = false
            self.pendingWatchSession = nil
            Task { @MainActor in LiveActivityService.shared.endIfCurrent("watch-pending") }
            self.reportStart(false, "Couldn’t reach your watch — open Inte-Run on it and press start.")
        }
    }

    /// Deliver the armed go signal, with the session riding on it. Stays armed on any failure;
    /// re-run from sessionReachabilityDidChange the moment the watch comes up.
    private func flushStartNow() {
        guard pendingStartNow, WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return }
        var msg: [String: Any] = ["command": "startNow"]
        let sess = pendingWatchSession
        if let sess { msg["session"] = sess }
        pendingStartNow = false
        pendingWatchSession = nil
        s.sendMessage(msg, replyHandler: nil, errorHandler: { [weak self] _ in
            // Undelivered: re-arm and let the next reachability change retry. A duplicate on the
            // watch is harmless — its start guards on !running.
            DispatchQueue.main.async {
                self?.pendingStartNow = true
                self?.pendingWatchSession = sess
            }
        })
    }

    /// Same pattern for the companion request: hold it until the watch can hear.
    private func flushCompanionStart() {
        guard pendingCompanionStart, WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return }
        pendingCompanionStart = false
        s.sendMessage(["command": "companionStart"], replyHandler: nil, errorHandler: { [weak self] _ in
            DispatchQueue.main.async { self?.pendingCompanionStart = true }
        })
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

    @MainActor
    /// Returns whether the cue was actually SOUNDED, so the wrist knows whether to speak it itself.
    @discardableResult
    private func forwardCue(_ trigger: String, text: String) -> Bool {
        // ⚠️ evaluateJavaScript DOES NOTHING against a suspended web content process, and iOS suspends
        // it the moment the phone goes in a pocket. That is why a wrist run's coach spoke once and
        // then fell silent: every later cue was handed to a page that was not running.
        // With the app out of the foreground the native player answers instead — it stays alive on the
        // audio/location background modes, which is the whole reason it exists.
        let active = UIApplication.shared.applicationState == .active
        // Trace: absent on a locked run means the cue never arrived; see CoachAudioService for the rest.
        SelfCheck.logger.notice("watch->phone cue \(trigger, privacy: .public) active=\(active)")
        if !active {
            if CoachAudioService.shared.playWatchCue(trigger) { return true }
            // Nothing to play natively (no cue map yet): fall through and try the page, which may
            // still be alive if the screen is merely off.
        }
        guard let webView else { return false }
        let safe = { (v: String) in v.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") }
        webView.evaluateJavaScript(
            "window.__interunWatchCue && window.__interunWatchCue(\"\(safe(trigger))\", \"\(safe(text))\");")
        // ⚠️ Optimistic ONLY when the app is in front, because that is the one state where the page is
        // certainly running and will certainly play. Backgrounded, evaluateJavaScript against a
        // suspended content process does nothing at all and returns no error — so claiming success
        // there is exactly the lie that produced the silence. Say no, and let the wrist cover it.
        return active
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
            // ⚠️ COMPUTED HERE, NOT SENT BY THE SENDER. The anchor is "now minus the elapsed we were
            // just told", and only this side knows what "now" is on this device — a wrist tick crosses
            // WatchConnectivity and a page post crosses a message handler, so a timestamp made at the
            // far end would carry the delivery delay into the clock. Recomputed on every push, so it
            // cannot drift and pauses cannot accumulate.
            runningSince: Date().addingTimeInterval(-Double((live["sec"] as? Int) ?? 0)),
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
    /// ⚠️ No default arguments on WCSessionDelegate methods (they break the @objc signature and the
    /// delegate silently stops firing — see CLAUDE.md).
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in
            self?.flushStartNow()
            self?.flushCompanionStart()
        }
    }

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
                // Same anchor, same reason — see driveLiveActivity above.
                runningSince: Date().addingTimeInterval(-Double((body["sec"] as? Int) ?? 0)),
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
            // here — which also means the watch is NOT yet reachable, so the request is armed and
            // flushed on reachability rather than sent into the void.
            pendingCompanionStart = true
            flushCompanionStart()
            startWatchWorkout(title: (body["title"] as? String) ?? "Run",
                              type: (body["type"] as? String) ?? "easy",
                              companion: true)
        case "companionTick":
            // ⚠️ FORWARD BY KEY LIST, not a cherry-pick. This was `for k in ["sec","distKm","paceSec"]`
            // — the same fault the `sync` case below already records being fixed, left un-fixed here.
            // Three numbers reached the wrist while the page computed heart rate, the step and the
            // paused flag ten lines above, so a phone-recorded run gave the wrist four numbers where a
            // wrist-recorded run offers nine, and a field added on the page side could not travel
            // without a matching Swift edit and an Xcode build.
            //
            // ⚠️ Absent keys are MEANINGFUL and are simply left out: a run with no watch has no heart
            // rate, a free run has no step, and the wrist renders "--" for anything it was not sent
            // rather than a zero. Never a zero — a stored or shown 0 reads as a measurement.
            //
            // ⚠️ `control` is a CAPABILITY the page declares about itself, and it is the only thing
            // that puts pause/resume/finish buttons on the wrist. Old page, no key, no buttons — which
            // is the point: a control that looks live and does nothing is the defect this project has
            // shipped twice, and this is the OTA/native asymmetry that would produce it.
            //
            // ⚠️ EVERY KEY HERE IS READ BY THE WRIST, AND NOTHING ELSE IS FORWARDED. A first version
            // also carried elevGain, paceLow and paceHigh against a pace page that does not exist yet
            // — and an unread value is what the next reader copies without checking. When the wrist
            // grows a pace page, adding its two keys here is a one-line edit.
            //
            // ⚠️⚠️ AND THE CLAIM ABOVE WAS FALSE IN THIS VERY FUNCTION FOR A WHOLE BUILD. A `type`
            // key was forwarded by a statement of its own, three lines below that sentence: the page
            // deliberately does not send one (its own comment in `pushToCompanion` says why), and
            // nothing on the wrist could read it if it did — `SessionStore` reduces `phoneLive` with
            // `compactMapValues { $0 as? Double }` and names only title/step/paused/control, so a
            // String would be dropped on arrival. The two guards written to prevent exactly this were
            // both scoped to the `for k in [...]` literal, so a key added by a separate statement was
            // invisible to them; they now derive the sent set from EVERY write into `live` and require
            // each one to be read by a named reader on the wrist. A guard over a collection is only
            // as good as the collection.
            var live: [String: Any] = [:]
            for k in ["sec", "distKm", "paceSec", "avgPaceSec", "lapPaceSec", "lapNumber",
                      "kcal", "hr", "stepProgress", "paused", "control"] where body[k] != nil {
                live[k] = body[k]
            }
            live["title"] = body["title"] as? String ?? "Run"
            if let step = body["step"] as? String, !step.isEmpty { live["step"] = step }
            sendToWatch(["phoneLive": live])
        case "endCompanion":
            pendingCompanionStart = false   // a run that ended before the watch woke needs nothing
            sendToWatch(["command": "companionEnd"])
        case "watchCommand":
            // Pause/resume/stop stay fire-and-forget: if the watch is unreachable the run simply
            // carries on there, which is the safe failure — a run must never be ended by a message
            // that only half-arrived. "startNow" is different: it MUST arrive, so it arms and
            // flushes rather than firing blind.
            if let cmd = body["command"] as? String {
                if cmd == "startNow" { armStartNow() } else { sendToWatch(["command": cmd]) }
            }
        case "sync":
            // `session` is deliberately allowed to be absent: that is how the page says "rest day",
            // which the watch must be able to tell apart from "we have not synced yet".
            // Forward by key list rather than cherry-picking: a field added on the page side must
            // not need a matching edit here to travel. Absent keys are meaningful (a cleared "why",
            // a rest day), so they are simply left out and the watch treats that as "none".
            var payload: [String: Any] = ["at": Date().timeIntervalSince1970]
            for key in ["session", "name", "why", "whyName", "dateIso", "upcoming", "coach", "coachLines", "maxHr"] where body[key] != nil {
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
