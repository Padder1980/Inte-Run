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
/// ⚠️ Starting one from the background needs iOS 17 and a legitimate reason to be awake. The watch
/// sending a live tick wakes this app via WatchConnectivity, which qualifies. If the start is
/// refused (Live Activities switched off for InteRun, or too many already running) every call here
/// degrades to doing nothing — a run must never depend on its own decoration.
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
    func start(runId: String, title: String, type: String, state: RunActivityAttributes.ContentState) {
        // ⚠️ Do NOT gate this on `areActivitiesEnabled`. It is false until the runner grants
        // permission, and the grant prompt only appears when an app actually ATTEMPTS a request —
        // so guarding on it means the prompt never appears, the permission never becomes true, and
        // the feature can never start. A deadlock that looks exactly like "it silently doesn't work".
        if currentRunId == runId, activity != nil { return update(state) }
        endImmediately()
        let attrs = RunActivityAttributes(title: title, sessionType: type)
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
            // Swallowing this is what made the last attempt undiagnosable. Recorded where the app's
            // own version screen can show it, because the failure is invisible from the outside:
            // a missing card looks identical whatever the cause.
            activity = nil
            currentRunId = nil
            note("failed: \(error.localizedDescription)")
        }
    }

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
        }
    }
}
