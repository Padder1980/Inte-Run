import Foundation
import HealthKit
import WatchConnectivity

/// The wrist's heart-rate sensor, streaming to a run the PHONE is recording.
///
/// watchOS only delivers continuous heart rate inside an `HKWorkoutSession`, so a session runs here
/// — but purely as a sensor switch. ⚠️ Nothing it collects is ever kept: the builder's workout is
/// **discarded**, never finished, because the phone owns this run and a finished workout here would
/// put a duplicate in Health. It also never calls `sendHome()` — the phone's Logbook entry is the
/// only record.
///
/// Every reading goes to the phone as `companionHR`, throttled to one message every ~3 seconds.
/// If the phone is unreachable the readings are simply missed — heart rate is a garnish on the
/// phone's run, not data this side is responsible for keeping.
@MainActor
final class CompanionSession: NSObject, ObservableObject {
    static let shared = CompanionSession()

    /// The latest reading, for CompanionView's own display.
    @Published private(set) var heartRate: Double = 0

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var lastSent = Date.distantPast

    private override init() { super.init() }

    var isRunning: Bool { session != nil }

    func start() {
        guard session == nil else { return }
        guard HKHealthStore.isHealthDataAvailable() else { return }
        // Same sets as a real run, so a runner who has recorded on the wrist before sees no prompt.
        let share: Set = [HKQuantityType.workoutType()]
        let read: Set = [HKQuantityType(.heartRate)]
        healthStore.requestAuthorization(toShare: share, read: read) { [weak self] ok, _ in
            Task { @MainActor in
                guard let self, ok, self.session == nil else { return }
                self.begin()
            }
        }
    }

    private func begin() {
        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor
        do {
            let s = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let b = s.associatedWorkoutBuilder()
            b.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            s.delegate = self
            b.delegate = self
            session = s
            builder = b
            let now = Date()
            s.startActivity(with: now)
            b.beginCollection(withStart: now) { _, _ in }
        } catch {
            session = nil
            builder = nil
        }
    }

    func stop() {
        guard let s = session, let b = builder else { session = nil; builder = nil; return }
        session = nil
        builder = nil
        heartRate = 0
        s.end()
        b.endCollection(withEnd: Date()) { _, _ in
            // ⚠️ discard, never finish — see the type comment. This is the line that keeps the
            // companion from becoming a second recorder.
            b.discardWorkout()
        }
    }

    fileprivate func took(_ bpm: Double) {
        heartRate = bpm
        guard Date().timeIntervalSince(lastSent) >= 3 else { return }
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return }
        lastSent = Date()
        s.sendMessage(["companionHR": Int(bpm.rounded())], replyHandler: nil, errorHandler: { _ in })
    }
}

extension CompanionSession: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {}

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in self.stop() }
    }
}

extension CompanionSession: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  quantityType == HKQuantityType(.heartRate),
                  let stats = workoutBuilder.statistics(for: quantityType) else { continue }
            let bpm = HKUnit.count().unitDivided(by: .minute())
            let value = stats.mostRecentQuantity()?.doubleValue(for: bpm) ?? 0
            if value > 0 { Task { @MainActor in self.took(value) } }
        }
    }
}
