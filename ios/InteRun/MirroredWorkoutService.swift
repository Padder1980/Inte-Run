import ActivityKit
import Foundation
import HealthKit

/// Receives the workout the Apple Watch is running, and raises the Live Activity for it.
///
/// This is the one path that lets a run begun entirely on the wrist put a card on a locked iPhone.
/// From `HKHealthStore.h`, verbatim:
///
///   "If your app is not active when a mirrored session starts, it will be launched in the
///    background and given a one-time permission to start a Live Activity from the background."
///
/// ⚠️ That permission is specific to THIS launch path and nothing else. `Activity.request` from a
/// WatchConnectivity wake is still refused with `ActivityAuthorizationError.visibility` — the
/// difference is not "being awake", it is *how* you were woken. Two device sessions were spent
/// concluding the feature was impossible because the wrong doorbell was being rung.
///
/// ⚠️ The budget is about ten seconds from launch (WWDC23 session 10023), and the handler arrives on
/// an arbitrary background queue. So the activity is raised first and everything else follows.
///
/// ⚠️ Mirroring does not work in the Simulator at all — Apple DTS confirms it. This can only be
/// proven on the real iPhone and Watch.
final class MirroredWorkoutService: NSObject {
    static let shared = MirroredWorkoutService()

    /// Long-lived on purpose: a store that goes out of scope takes the handler with it, and the
    /// handler has to be installed before the launch that needs it.
    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?

    private override init() { super.init() }

    /// Install the handler. Called at every launch, foreground or background — the header is
    /// explicit that this must happen "promptly after your app is launched".
    func begin() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        healthStore.workoutSessionMirroringStartHandler = { [weak self] mirrored in
            Task { @MainActor in self?.adopt(mirrored) }
        }
    }

    @MainActor
    private func adopt(_ mirrored: HKWorkoutSession) {
        session = mirrored
        mirrored.delegate = self

        // First, and before anything that could fail: the ten-second grant is what we came for.
        // Named after the run the wrist says it is RUNNING (its live tick), never after today's
        // plan — a free run is not "4 × 6′ threshold". If the tick loses the race the card says
        // "Run", which is generic but never a lie.
        let title = WatchBridge.shared.liveRunTitle ?? "Run"
        let type = WatchBridge.shared.liveRunType ?? "easy"
        let state = RunActivityAttributes.ContentState(
            elapsedSeconds: 0, distanceKm: 0, paceSecPerKm: nil, heartRate: nil,
            step: nil, paused: false, onWatch: true)
        if LiveActivityService.shared.isRunning {
            // The tap on the phone already raised the card (correctly titled). Keep it; the ticks
            // will drive it. Requesting a fresh one here would tear it down and re-request.
            LiveActivityService.shared.update(state)
        } else {
            LiveActivityService.shared.start(
                runId: "mirrored-\(mirrored.startDate?.timeIntervalSince1970 ?? 0)",
                title: title, type: type, state: state,
                allowBackground: true,
            )
        }
        SelfCheck.logger.notice("mirrored workout adopted; live activity requested")
    }
}

extension MirroredWorkoutService: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession,
                        didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState,
                        date: Date) {
        guard toState == .ended || toState == .stopped else { return }
        Task { @MainActor in
            LiveActivityService.shared.end(nil)
            self.session = nil
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            LiveActivityService.shared.end(nil)
            self.session = nil
        }
    }
}
