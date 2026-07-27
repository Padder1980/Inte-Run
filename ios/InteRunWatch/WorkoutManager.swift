import Foundation
import HealthKit
import CoreLocation

/// The live run on the wrist — the thing a PWA fundamentally cannot do.
///
/// An `HKWorkoutSession` is what makes this real rather than a stopwatch: it keeps the app running
/// with the wrist down, turns on the heart-rate sensor at workout frequency, and gets the run into
/// the Health app and the Activity rings at the end. Distance comes from the watch's own GPS.
@MainActor
final class WorkoutManager: NSObject, ObservableObject {
    enum Phase: Equatable { case idle, requesting, running, paused, ended, failed(String) }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var distanceMetres: Double = 0
    @Published private(set) var heartRate: Double = 0
    /// Smoothed from recent GPS, in seconds per km. Nil until moving.
    @Published private(set) var paceSecPerKm: Double?

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private let locations = CLLocationManager()
    private var routeBuilder: HKWorkoutRouteBuilder?
    private var startedAt: Date?
    private var ticker: Timer?
    private var lastLocation: CLLocation?

    override init() {
        super.init()
        locations.delegate = self
        locations.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locations.activityType = .fitness
    }

    // MARK: - Lifecycle

    func start() {
        guard HKHealthStore.isHealthDataAvailable() else {
            phase = .failed("Health data isn’t available on this watch.")
            return
        }
        phase = .requesting

        let share: Set = [
            HKQuantityType.workoutType(),
            HKSeriesType.workoutRoute(),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distanceWalkingRunning),
        ]
        let read: Set = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distanceWalkingRunning),
        ]

        healthStore.requestAuthorization(toShare: share, read: read) { [weak self] ok, error in
            Task { @MainActor in
                guard let self else { return }
                guard ok else {
                    self.phase = .failed(error?.localizedDescription
                        ?? "InteRun needs Health access to record your run.")
                    return
                }
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
            routeBuilder = HKWorkoutRouteBuilder(healthStore: healthStore, device: nil)

            let now = Date()
            s.startActivity(with: now)
            b.beginCollection(withStart: now) { _, _ in }
            startedAt = now
            phase = .running

            locations.requestWhenInUseAuthorization()
            // Safe now: an active workout session makes the app backgroundable. Claimed only for
            // the duration of the run, and released in end().
            // Deliberately NOT allowsBackgroundLocationUpdates: on watchOS CoreLocation asserts and
            // kills the app, even with `location` in WKBackgroundModes (verified the hard way).
            // The running HKWorkoutSession is what keeps the app and its GPS alive here - the
            // property is an iOS concept and has no place on the wrist.
            locations.startUpdatingLocation()
            // The builder's own elapsed time only updates on data arrival; a display needs a tick.
            ticker = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, let started = self.startedAt, self.phase == .running else { return }
                    self.elapsed = Date().timeIntervalSince(started)
                }
            }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func pause() {
        guard phase == .running else { return }
        session?.pause()
        phase = .paused
    }

    func resume() {
        guard phase == .paused else { return }
        session?.resume()
        phase = .running
    }

    func end() {
        ticker?.invalidate(); ticker = nil
        locations.stopUpdatingLocation()
        guard let s = session, let b = builder else { phase = .ended; return }
        let now = Date()
        s.end()
        b.endCollection(withEnd: now) { [weak self] _, _ in
            b.finishWorkout { workout, _ in
                if let workout, let rb = self?.routeBuilder {
                    rb.finishRoute(with: workout, metadata: nil) { _, _ in }
                }
                Task { @MainActor in self?.phase = .ended }
            }
        }
    }

    // MARK: - Derived

    var distanceKm: Double { distanceMetres / 1000 }

    var paceText: String {
        guard let p = paceSecPerKm, p.isFinite, p > 0, p < 3600 else { return "--:--" }
        return String(format: "%d:%02d", Int(p) / 60, Int(p) % 60)
    }

    var elapsedText: String {
        let t = Int(elapsed)
        return t >= 3600
            ? String(format: "%d:%02d:%02d", t / 3600, (t % 3600) / 60, t % 60)
            : String(format: "%d:%02d", t / 60, t % 60)
    }
}

// MARK: - GPS

extension WorkoutManager: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        Task { @MainActor in
            guard phase == .running else { return }
            let usable = locs.filter { $0.horizontalAccuracy > 0 && $0.horizontalAccuracy < 50 }
            guard !usable.isEmpty else { return }

            for loc in usable {
                if let previous = lastLocation {
                    let step = loc.distance(from: previous)
                    // Reject GPS jitter while standing still, and impossible jumps.
                    if step > 1.0 && step < 80 { distanceMetres += step }
                }
                lastLocation = loc
            }
            // Prefer the device's own speed when it reports one; it is far steadier than
            // differentiating positions.
            if let speed = usable.last?.speed, speed > 0.5 {
                paceSecPerKm = 1000 / speed
            }
            routeBuilder?.insertRouteData(usable) { _, _ in }
        }
    }
}

// MARK: - HealthKit

extension WorkoutManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession,
                                    didChangeTo toState: HKWorkoutSessionState,
                                    from fromState: HKWorkoutSessionState,
                                    date: Date) {}

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        let message = error.localizedDescription
        Task { @MainActor in self.phase = .failed(message) }
    }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                                    didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  let stats = workoutBuilder.statistics(for: quantityType) else { continue }
            if quantityType == HKQuantityType(.heartRate) {
                let bpm = HKUnit.count().unitDivided(by: .minute())
                let value = stats.mostRecentQuantity()?.doubleValue(for: bpm) ?? 0
                Task { @MainActor in self.heartRate = value }
            }
        }
    }
}
