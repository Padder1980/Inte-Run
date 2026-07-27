import Foundation
import HealthKit
import CoreLocation
import WatchKit
import WatchConnectivity

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
    @Published private(set) var stepIndex = 0
    /// Where the current step began, so its own progress is measured from there.
    @Published private(set) var stepStartElapsed: TimeInterval = 0
    @Published private(set) var stepStartMetres: Double = 0
    @Published private(set) var avgHeartRate: Double = 0
    /// Filled in when the run ends, ready to be sent home.
    @Published var reportedRpe: Int?

    /// The session being run, if the phone sent one. Nil means a free run.
    var plan: PlannedSession?
    private var hrSamples: [Double] = []
    private var routePoints: [[Double]] = []
    private var splits: [Int] = []
    private var lastSplitMetre = 0.0
    private var lastSplitElapsed: TimeInterval = 0
    private let runId = "watch-" + UUID().uuidString

    var steps: [PlannedStep] { plan?.steps ?? [] }
    var currentStep: PlannedStep? { stepIndex < steps.count ? steps[stepIndex] : nil }

    /// Distance covered inside the current step.
    var stepMetres: Double { max(0, distanceMetres - stepStartMetres) }
    var stepElapsed: TimeInterval { max(0, elapsed - stepStartElapsed) }

    /// The pace band for right now: the current step's if it has one, else the session's.
    var targetBand: (low: Int, high: Int)? {
        if let st = currentStep, let lo = st.paceLow, let hi = st.paceHigh { return (lo, hi) }
        if let p = plan, let lo = p.paceLow, let hi = p.paceHigh { return (lo, hi) }
        return nil
    }

    /// Where the runner actually is against the plan's band. This is the part Apple cannot do:
    /// the target is not something typed in beforehand, it is what the plan prescribed for today.
    enum PaceVerdict: Equatable { case noTarget, noSignal, tooFast, good, tooSlow }

    var paceVerdict: PaceVerdict {
        guard let band = targetBand else { return .noTarget }
        guard let p = paceSecPerKm, p.isFinite, p > 0 else { return .noSignal }
        // A few seconds either side is noise, not a coaching moment.
        let slack = 5.0
        if p < Double(band.low) - slack { return .tooFast }
        if p > Double(band.high) + slack { return .tooSlow }
        return .good
    }

    var verdictText: String {
        switch paceVerdict {
        case .noTarget: return "RUN BY FEEL"
        case .noSignal: return "FINDING GPS"
        case .tooFast: return "EASE OFF"
        case .good: return "GOOD PACE"
        case .tooSlow: return "PICK IT UP"
        }
    }

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
                    self.advanceStepIfDue()
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

    /// Move to the next step when the current one is complete. A wrist tap marks the change, since
    /// the runner is not looking at the screen — that is the whole point of it being on a wrist.
    private func advanceStepIfDue() {
        guard let step = currentStep else { return }
        guard let p = step.progress(elapsed: stepElapsed, metresDone: stepMetres), p >= 1 else { return }
        guard stepIndex + 1 < steps.count else { return }
        stepIndex += 1
        stepStartElapsed = elapsed
        stepStartMetres = distanceMetres
        WKInterfaceDevice.current().play(.notification)
    }

    /// Skip forward manually — recoveries especially never line up exactly with real terrain.
    func nextStep() {
        guard stepIndex + 1 < steps.count else { return }
        stepIndex += 1
        stepStartElapsed = elapsed
        stepStartMetres = distanceMetres
        WKInterfaceDevice.current().play(.click)
    }

    private func recordSplits() {
        while distanceMetres - lastSplitMetre >= 1000 {
            lastSplitMetre += 1000
            let at = elapsed * (lastSplitMetre / max(distanceMetres, 1))
            splits.append(Int((at - lastSplitElapsed).rounded()))
            lastSplitElapsed = at
        }
    }

    /// The finished run, in the shape the phone's plan already understands.
    func summaryPayload() -> [String: Any] {
        var out: [String: Any] = [
            "id": runId,
            "sec": Int(elapsed.rounded()),
            "distKm": (distanceMetres / 1000),
            "route": routePoints,
            "splits": splits,
            "source": "watch",
        ]
        if let p = plan {
            out["title"] = p.title
            out["type"] = p.type
            out["dateIso"] = p.dateIso
        }
        if let rpe = reportedRpe { out["rpe"] = rpe }
        if avgHeartRate > 0 { out["avgHr"] = avgHeartRate }
        return out
    }

    /// Hand it to the phone. `transferUserInfo` queues and is guaranteed, which matters because the
    /// phone app is almost always closed when a run ends.
    func sendHome() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.activationState != .activated { session.activate() }
        let payload: [String: Any] = ["run": summaryPayload()]
        // Two paths on purpose. sendMessage lands instantly when the phone is to hand, which is the
        // common case (it is in a pocket, not another county). transferUserInfo is the durable
        // backstop: queued by the OS and delivered whenever the phone next comes up. The phone
        // de-duplicates on the run id, so arriving twice is harmless.
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { err in
                NSLog("INTERUN sendMessage failed: %@", err.localizedDescription)
            }
        }
        let t = session.transferUserInfo(payload)
        NSLog("InteRun: run sent home (reachable=%d queued=%d)",
              session.isReachable ? 1 : 0, session.outstandingUserInfoTransfers.count)
        _ = t
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
            recordSplits()
            // Downsampled: a route is for drawing a map, not for storing every fix.
            if let last = usable.last, routePoints.count < 600 {
                routePoints.append([
                    (last.coordinate.latitude * 100000).rounded() / 100000,
                    (last.coordinate.longitude * 100000).rounded() / 100000,
                ])
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
                let mean = stats.averageQuantity()?.doubleValue(for: bpm) ?? 0
                Task { @MainActor in
                    self.heartRate = value
                    if mean > 0 { self.avgHeartRate = mean }
                }
            }
        }
    }
}
