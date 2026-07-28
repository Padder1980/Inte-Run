import ActivityKit
import Foundation
import UIKit

/// The run's Live Activity: the lock-screen card and Dynamic Island pill, kept in step with the run.
///
/// This is the honest answer to "start on my watch and open the phone on the live screen". iOS does
/// not let a watchOS app foreground the iPhone app — no API exists — but it does let the phone show
/// a live card the moment the wrist starts running, and tapping that card opens the app, which
/// `replayLiveOnActivate()` then drops straight onto the live session screen.
///
/// ⚠️ **`Activity.request` normally requires the FOREGROUND**, since iOS 16.1 and unchanged through
/// iOS 27. A WatchConnectivity wake, a CoreLocation wake and a plain background task are all refused
/// with `ActivityAuthorizationError.visibility`.
///
/// ⚠️ **There is exactly ONE documented exemption, and we use it.** `HKHealthStore.h` says of
/// `workoutSessionMirroringStartHandler`: "If your app is not active when a mirrored session starts,
/// it will be launched in the background and given a one-time permission to start a Live Activity
/// from the background." That is how a run begun on the wrist gets a card on a locked phone — see
/// MirroredWorkoutService. The difference is not *being* awake, it is *how you were woken*, and
/// mistaking one for the other cost two on-device debugging sessions.
///
/// `update()` and `end()` from the background ARE permitted. So the shape of the feature is: raise
/// the card at a foreground moment, then let background ticks drive it.
///
/// Every failure degrades to doing nothing — a run must never depend on its own decoration.
@MainActor
final class LiveActivityService {
    static let shared = LiveActivityService()
    private init() {}

    private var activity: Activity<RunActivityAttributes>?
    private var currentRunId: String?
    private var lastUpdate = Date.distantPast

    var isRunning: Bool { activity != nil }

    /// Whether the runner has Live Activities enabled for InteRun at all.
    var permitted: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    /// Begin, or update in place if this run already has a card.
    /// `allowBackground` is only ever true on the HealthKit mirroring path, which carries Apple's
    /// one-time grant. Passing it anywhere else just buys a `.visibility` throw.
    func start(runId: String, title: String, type: String,
               state: RunActivityAttributes.ContentState, allowBackground: Bool = false) {
        // Not gated on `areActivitiesEnabled`: a stale false read would cost us the card for
        // nothing, and attempting costs nothing when it is genuinely off.
        if let existing = activity {
            // Already showing something. Adopt it rather than tearing it down — a background tick
            // that ends the card CANNOT recreate it (foreground-only), so destroying a working card
            // out here is permanent. A slightly stale title beats no card.
            if currentRunId != runId, !isForeground { currentRunId = runId }
            if currentRunId == runId { return update(state) }
            _ = existing
            endImmediately()
        }
        // Nothing to show yet, and only the foreground may create one. From the background this is
        // simply not possible; retrying every two seconds for an hour would burn battery to no end.
        guard isForeground || allowBackground else {
            if let id = runId as String?, !refusedRunIds.contains(id) {
                refusedRunIds.insert(id)
                note("not started: app is in the background (iOS only allows this in the foreground)")
            }
            return
        }
        if refusedRunIds.contains(runId) { refusedRunIds.remove(runId) }
        let attrs = RunActivityAttributes(title: title, sessionType: type, runId: runId)
        do {
            activity = try Activity.request(
                attributes: attrs,
                content: .init(state: state, staleDate: Date().addingTimeInterval(120)),
                pushType: nil,
            )
            currentRunId = runId
            lastUpdate = Date()
            note("started")
        } catch {
            // ⚠️ `localizedDescription` on ActivityAuthorizationError is a generic domain+code string
            // and names nothing. `String(describing:)` gives the case — "visibility", "denied" — which
            // is the single word that settles what went wrong.
            activity = nil
            currentRunId = nil
            refusedRunIds.insert(runId)
            note("failed: \(String(describing: error))")
        }
    }

    /// Refused starts, so a doomed request is not retried on every one of ~1800 ticks in an hour.
    /// Cleared when the app comes to the front, because that is the only event that can change the
    /// answer.
    private var refusedRunIds: Set<String> = []
    func clearRefusals() { refusedRunIds.removeAll() }

    private var isForeground: Bool { UIApplication.shared.applicationState == .active }

    /// The last thing that happened, for Support › Your data › This version.
    private func note(_ what: String) {
        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        let state = UIApplication.shared.applicationState == .active ? "foreground" : "background"
        let line = "\(what) · \(state) · allowed=\(enabled)"
        UserDefaults.standard.set(line, forKey: "interun_live_activity_status")
        SelfCheck.logger.notice("live activity \(line, privacy: .public)")
    }

    static var lastStatus: String {
        UserDefaults.standard.string(forKey: "interun_live_activity_status") ?? "not attempted yet"
    }

    /// Push new numbers. Throttled: ticks arrive every two seconds and the system coalesces
    /// aggressively anyway, so hammering it only costs battery.
    func update(_ state: RunActivityAttributes.ContentState) {
        guard let activity else { return }
        guard Date().timeIntervalSince(lastUpdate) >= 1.5 || state.paused else { return }
        lastUpdate = Date()
        Task {
            await activity.update(.init(state: state, staleDate: Date().addingTimeInterval(120)))
        }
    }

    /// Finish, leaving the final numbers up briefly so a glance after stopping still shows the run.
    func end(_ finalState: RunActivityAttributes.ContentState?) {
        guard let activity else { return }
        self.activity = nil
        currentRunId = nil
        let content: ActivityContent<RunActivityAttributes.ContentState>? =
            finalState.map { .init(state: $0, staleDate: nil) }
        Task { await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(20))) }
    }

    private func endImmediately() {
        guard let a = activity else { return }
        activity = nil
        currentRunId = nil
        Task { await a.end(nil, dismissalPolicy: .immediate) }
    }

    /// Adopt any card left behind by a previous launch, so a crash or a force-quit mid-run does not
    /// strand a live-looking card that nothing can update or dismiss.
    func reattach() {
        guard activity == nil else { return }
        if let existing = Activity<RunActivityAttributes>.activities.first {
            activity = existing
            // ⚠️ Without the id, the next tick fails the `currentRunId == runId` check and ends the
            // card it has just adopted — and cannot recreate it from the background.
            currentRunId = existing.attributes.runId
        }
    }
}
