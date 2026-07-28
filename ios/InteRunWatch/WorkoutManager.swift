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
    /// Seconds left before the clock starts, or nil when not counting down. The workout session is
    /// NOT started until this reaches zero — counting down with the timer already running would
    /// record three seconds of standing still, which is the whole thing this exists to avoid.
    @Published private(set) var countdown: Int?
    private var countdownTimer: Timer?
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
    /// Active energy, for the runners who want it on their run screen.
    @Published private(set) var activeCalories: Double = 0
    /// Filled in when the run ends, ready to be sent home.
    @Published var reportedRpe: Int?

    /// The session being run, if the phone sent one. Nil means a free run.
    var plan: PlannedSession?
    /// The runner's own reasons, handed over by the phone. Spoken once, deep into a hard run.
    var why: [String: String] = [:]
    var whyPerson: String?
    /// The coach picked on the phone, and their wordings, so the wrist sounds like the same coach.
    var coach: String?
    var coachLines: [String: String] = [:]
    private var hrSamples: [Double] = []
    private(set) var routePoints: [[Double]] = []
    private var splits: [Int] = []
    private var lastSplitMetre = 0.0
    private var lastSplitElapsed: TimeInterval = 0
    /// ⚠️ A var, and reset for every run. As a `let` it was reused across runs in the same app
    /// session, and the phone dedupes ingest on this id — so a second run was silently dropped as
    /// "already logged", with nothing anywhere to say why.
    private var runId = "watch-" + UUID().uuidString

    var steps: [PlannedStep] { plan?.steps ?? [] }

    /// How long today's session is meant to take. Distance-only plans are converted through the
    /// target pace so the why-moment lands at the same point in either kind of session.
    var targetSeconds: TimeInterval {
        if let mins = plan?.durationMin, mins > 0 { return Double(mins) * 60 }
        if let km = plan?.distanceKm, km > 0, let band = targetBand {
            return km * Double(band.low + band.high) / 2
        }
        return 0
    }

    /// Sessions where the closing stretch is genuinely a grind, so encouragement is earned rather
    /// than automatic. Mirrors the phone's list.
    var isHardSession: Bool {
        ["threshold", "vo2max", "vo2", "intervals", "long", "tempo", "race"].contains(plan?.type ?? "")
    }
    var currentStep: PlannedStep? { stepIndex < steps.count ? steps[stepIndex] : nil }

    /// Distance covered inside the current step.
    var stepMetres: Double { max(0, distanceMetres - stepStartMetres) }
    var stepElapsed: TimeInterval { max(0, elapsed - stepStartElapsed) }

    /// The pace band for right now: the current step's if it has one, else the session's.
    var targetBand: (low: Int, high: Int)? {
        if let st = currentStep {
            // A step with no band has none deliberately: hills, sprints and walk-backs are effort,
            // not pace. Falling back to the session band here meant the watch compared hill pace to
            // the threshold band and said "pick it up a little" while the runner ground uphill.
            guard let lo = st.paceLow, let hi = st.paceHigh else { return nil }
            return (lo, hi)
        }
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
    /// Spoken cues; created when the run starts so the audio session is claimed no earlier.
    private var voice: WorkoutVoice?

    override init() {
        super.init()
        locations.delegate = self
        locations.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locations.activityType = .fitness
    }

    // MARK: - Lifecycle

    /// Wipe every trace of the previous run.
    ///
    /// ⚠️ The manager outlives a run — it is a @StateObject on TodayView — so without this a second
    /// run inherits the first one's distance, splits, route, step position and, worst of all, its
    /// id. It also never leaves `.ended`, which is why starting a run from the phone opened the
    /// watch straight onto the finish screen: `startCountingDown` refuses unless the phase is idle.
    func reset() {
        countdownTimer?.invalidate(); countdownTimer = nil
        countdown = nil
        phase = .idle
        elapsed = 0
        distanceMetres = 0
        heartRate = 0
        avgHeartRate = 0
        activeCalories = 0
        paceSecPerKm = nil
        stepIndex = 0
        stepStartElapsed = 0
        stepStartMetres = 0
        reportedRpe = nil
        hrSamples = []
        routePoints = []
        splits = []
        lastSplitMetre = 0
        lastSplitElapsed = 0
        lastLocation = nil
        startedAt = nil
        session = nil
        builder = nil
        routeBuilder = nil
        voice = nil
        runId = "watch-" + UUID().uuidString
    }

    /// Begin, after a three-second count if the runner has left it on. Each beat taps the wrist, so
    /// it works with the screen down and the phone already in a pocket.
    func startCountingDown() {
        guard WatchSettings.shared.countdown else { return start() }
        guard countdown == nil, phase == .idle else { return }
        countdown = 3
        WKInterfaceDevice.current().play(.start)
        // The phone says the numbers, in the coach's recorded voice. If it is out of range the
        // wrist is silent rather than robotic — the haptics still carry the beat, which is what
        // matters when you are looking at your phone or your shoes.
        _ = speakOnPhone("countdown")
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                guard let self else { t.invalidate(); return }
                let left = (self.countdown ?? 1) - 1
                if left > 0 {
                    self.countdown = left
                    WKInterfaceDevice.current().play(.click)
                } else {
                    t.invalidate()
                    self.countdownTimer = nil
                    self.countdown = nil
                    WKInterfaceDevice.current().play(.success)
                    self.start()
                }
            }
        }
    }

    /// Abandon a countdown that has not fired yet — backing out before the clock starts should leave
    /// no run behind at all.
    func cancelCountdown() {
        countdownTimer?.invalidate()
        countdownTimer = nil
        countdown = nil
    }

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
            // ⚠️ This is what puts a card on a locked iPhone for a wrist-started run. It launches
            // the companion app in the background, and THAT launch carries Apple's one-time
            // permission to start a Live Activity from the background — the WatchConnectivity wake
            // we were using does not. See MirroredWorkoutService on the phone.
            // Called immediately after startActivity so the phone's ~10-second budget begins as
            // early as possible. A failure here costs the card, never the run.
            s.startMirroringToCompanionDevice { ok, error in
                if !ok {
                    let why = error?.localizedDescription ?? "unknown"
                    print("workout mirroring did not start: \(why)")
                }
            }
            b.beginCollection(withStart: now) { _, _ in }
            startedAt = now
            phase = .running
            voice = WatchSettings.shared.voiceCues ? WorkoutVoice() : nil
            voice?.loadCoach(coach, lines: coachLines)
            voice?.loadWhy(why, person: whyPerson)
            // The step announcement carries the runner's own pace numbers, so no recorded clip can
            // ever say it — this one stays on the wrist's synthesiser by necessity, and only this one.
            if let first = currentStep {
                voice?.announceStep(label: "Let\u{2019}s go. " + first.label, paceLow: first.paceLow, paceHigh: first.paceHigh, via: self)
            } else {
                if !speakOnPhone("session-start", text: "Let\u{2019}s go. Run by feel.") { voice?.say("Let\u{2019}s go. Run by feel.") }
            }

            sendLiveTick(force: true)   // the phone shows the run the moment the wrist starts it

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
                    // The wrist still decides WHEN — it owns the pace data and the hold/quiet
                    // windows — but the phone says it, in the coach's own recorded voice.
                    switch self.paceVerdict {
                    case .tooFast: self.voice?.paceCue("fast", via: self)
                    case .tooSlow: self.voice?.paceCue("slow", via: self)
                    default: self.voice?.paceCue("ok", via: self)
                    }
                    let target = self.targetSeconds
                    self.voice?.whyMoment(elapsed: self.elapsed, target: target, hard: self.isHardSession)
                    self.voice?.keepGoing(elapsed: self.elapsed, target: target, hard: self.isHardSession)
                    self.sendLiveTick()
                    self.autoPauseTick()
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
        if !speakOnPhone("paused") { voice?.sayPaused() }
        sendLiveTick(force: true)
    }

    func resume() {
        guard phase == .paused else { return }
        session?.resume()
        phase = .running
        if !speakOnPhone("resumed") { voice?.sayResumed() }
        sendLiveTick(force: true)
    }

    func end() {
        if !speakOnPhone("session-complete") { voice?.sayComplete() }
        // Drop the phone's mirror now; the recorded run follows by its own durable path. The phase
        // is deliberately NOT set here — HealthKit teardown below owns that transition.
        sendLiveTick(force: true, stateOverride: "ended")
        ticker?.invalidate(); ticker = nil
        locations.stopUpdatingLocation()
        guard let s = session, let b = builder else { phase = .ended; return }
        // Read the route builder HERE, while still on the main actor. HealthKit runs these
        // completion handlers on a background queue, so reaching for main-actor state inside them
        // is a real data race — and an error outright under the Swift 6 language mode.
        let rb = routeBuilder
        let now = Date()
        s.end()
        b.endCollection(withEnd: now) { [weak self] _, _ in
            b.finishWorkout { workout, _ in
                if let workout, let rb {
                    rb.finishRoute(with: workout, metadata: nil) { _, _ in }
                }
                // Bind self once, so the Task captures a constant rather than a mutable capture -
                // the class is @MainActor and therefore Sendable, so holding it here is safe.
                guard let self else { return }
                Task { @MainActor in self.phase = .ended }
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
        if let st = currentStep { voice?.announceStep(label: st.label, paceLow: st.paceLow, paceHigh: st.paceHigh, via: self) }
    }

    /// Skip forward manually — recoveries especially never line up exactly with real terrain.
    func nextStep() {
        guard stepIndex + 1 < steps.count else { return }
        stepIndex += 1
        stepStartElapsed = elapsed
        if let st = currentStep { voice?.announceStep(label: st.label, paceLow: st.paceLow, paceHigh: st.paceHigh, via: self) }
        stepStartMetres = distanceMetres
        WKInterfaceDevice.current().play(.click)
    }

    private func recordSplits() {
        while distanceMetres - lastSplitMetre >= 1000 {
            lastSplitMetre += 1000
            let at = elapsed * (lastSplitMetre / max(distanceMetres, 1))
            splits.append(Int((at - lastSplitElapsed).rounded()))
            lastSplitElapsed = at
            if WatchSettings.shared.hapticOnLap { WKInterfaceDevice.current().play(.notification) }
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

    /// Ask the PHONE to speak a cue.
    ///
    /// ⚠️ The phone owns the voice. It has the four recorded coaches and an `audio` background mode
    /// that keeps them playing from a pocket; the wrist only has the system synthesiser, which
    /// sounds like a computer next to them. So the watch decides WHEN a cue is due and the phone
    /// decides what it sounds like. `WorkoutVoice` is now only the fallback for when the phone is
    /// out of range.
    func speakOnPhone(_ trigger: String, text: String? = nil) -> Bool {
        guard WCSession.isSupported() else { return false }
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return false }
        var msg: [String: Any] = ["cue": trigger]
        if let text { msg["text"] = text }
        s.sendMessage(msg, replyHandler: nil, errorHandler: { _ in })
        return true
    }

    /// A snapshot of the run in progress, sent to the phone every couple of seconds while it is
    /// reachable. Deliberately fire-and-forget: the wrist is the recorder and owes the phone
    /// nothing, so a phone in a pocket with the screen off just misses ticks and catches up on the
    /// next one. Nothing here feeds the saved run.
    private var lastLiveSend = Date.distantPast
    func sendLiveTick(force: Bool = false, stateOverride: String? = nil) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else { return }
        guard force || Date().timeIntervalSince(lastLiveSend) >= 2 else { return }
        lastLiveSend = Date()
        var live: [String: Any] = [
            "id": runId,
            "state": stateOverride ?? phaseName,
            "sec": Int(elapsed.rounded()),
            "distKm": distanceKm,
        ]
        if let p = paceSecPerKm, p.isFinite, p > 0 { live["paceSec"] = Int(p.rounded()) }
        if let a = avgPaceSecPerKm { live["avgPaceSec"] = Int(a.rounded()) }
        if let l = lapPaceSecPerKm { live["lapPaceSec"] = Int(l.rounded()) }
        if heartRate > 0 { live["hr"] = Int(heartRate) }
        if let st = currentStep { live["step"] = st.label }
        if let plan { live["title"] = plan.title; live["type"] = plan.type }
        session.sendMessage(["live": live], replyHandler: nil, errorHandler: { _ in })
    }

    /// Pause when the runner stops, resume when they go again.
    ///
    /// Deliberately slow on both edges: pausing the instant someone slows for a kerb, or resuming on
    /// one stray GPS wobble, produces a run full of phantom splits. Ten seconds still, five seconds
    /// moving.
    private var stillSince: Date?
    private var movingSince: Date?
    private var autoPaused = false
    private func autoPauseTick() {
        guard WatchSettings.shared.autoPause else { return }
        let moving = (paceSecPerKm.map { $0 < 900 } ?? false)
        if phase == .running {
            if moving { stillSince = nil } else if stillSince == nil { stillSince = Date() }
            if let since = stillSince, Date().timeIntervalSince(since) > 10 {
                autoPaused = true; stillSince = nil; movingSince = nil
                pause()
            }
        } else if phase == .paused, autoPaused {
            if !moving { movingSince = nil } else if movingSince == nil { movingSince = Date() }
            if let since = movingSince, Date().timeIntervalSince(since) > 5 {
                autoPaused = false; movingSince = nil
                resume()
            }
        }
    }

    private var phaseName: String {
        switch phase {
        case .running: return "running"
        case .paused: return "paused"
        case .ended: return "ended"
        default: return "idle"
        }
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

    /// Average pace over the whole run so far — steadier than the instantaneous figure, and the one
    /// that actually tells you how the session is going.
    var avgPaceSecPerKm: Double? {
        guard distanceMetres > 50, elapsed > 10 else { return nil }
        return elapsed / (distanceMetres / 1000)
    }
    var avgPaceText: String { Self.pace(avgPaceSecPerKm) }

    /// Pace over the kilometre you are in right now. Average pace hides a fade because it is
    /// dragged by everything already banked; the lap is what tells you how this km is going.
    /// Nil until enough of the lap has been covered for the figure to mean anything.
    var lapPaceSecPerKm: Double? {
        let lapMetres = distanceMetres - lastSplitMetre
        let lapElapsed = elapsed - lastSplitElapsed
        guard lapMetres > 60, lapElapsed > 8 else { return nil }
        return lapElapsed / (lapMetres / 1000)
    }
    var lapPaceText: String { Self.pace(lapPaceSecPerKm) }
    /// Which lap is in progress, one-based, for the label.
    var lapNumber: Int { Int(lastSplitMetre / 1000) + 1 }

    /// How far through the whole session, by distance if it has one, else by time. Nil when the
    /// session sets no overall goal (a "run by feel" has nothing to fill up).
    var sessionProgress: Double? {
        if let km = plan?.distanceKm, km > 0 { return min(1, distanceKm / km) }
        if let mins = plan?.durationMin, mins > 0 { return min(1, elapsed / (Double(mins) * 60)) }
        return nil
    }

    /// Distance left in the current step — the number a runner actually wants mid-rep.
    var stepRemaining: (value: String, unit: String)? {
        guard let step = currentStep else { return nil }
        if let m = step.metres, m > 0 {
            let left = max(0, Double(m) - stepMetres)
            return left >= 1000 ? (String(format: "%.2f", left / 1000), "KM TO GO")
                                : (String(format: "%.0f", left), "M TO GO")
        }
        if let sec = step.seconds, sec > 0 {
            let left = max(0, Int(Double(sec) - stepElapsed))
            return (String(format: "%d:%02d", left / 60, left % 60), "TO GO")
        }
        return nil
    }

    static func pace(_ p: Double?) -> String {
        guard let p, p.isFinite, p > 0, p < 3600 else { return "--:--" }
        return String(format: "%d:%02d", Int(p) / 60, Int(p) % 60)
    }

    /// The current value of any metric the runner can put on their run screen.
    func value(for m: WatchSettings.Metric) -> (value: String, unit: String?) {
        switch m {
        case .elapsed: return (elapsedText, nil)
        case .distance: return distanceMetres < 1000
            ? (String(format: "%.0f", distanceMetres), "M")
            : (String(format: "%.2f", distanceKm), "KM")
        case .currentPace: return (paceText, "/KM")
        case .lapPace: return (lapPaceText, "/KM")
        case .avgPace: return (avgPaceText, "/KM")
        case .heartRate: return (heartRate > 0 ? String(Int(heartRate)) : "--", "BPM")
        case .stepRemaining: return stepRemaining.map { ($0.value, $0.unit) } ?? ("--", nil)
        case .lapNumber: return (String(lapNumber), nil)
        case .calories: return (activeCalories > 0 ? String(Int(activeCalories)) : "--", "CAL")
        }
    }

    /// The route so far, for drawing.
    var route: [[Double]] { routePoints }

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
            // 25 m, not 50: a fix that vague is a circle the size of a house, and differencing
            // two of them produces "movement" out of nothing.
            let usable = locs.filter { $0.horizontalAccuracy > 0 && $0.horizontalAccuracy < 25 }
            guard !usable.isEmpty else { return }

            var movedThisBatch = false
            for loc in usable {
                // ⚠️ CoreLocation reports speed = -1 when it cannot work one out, which is the
                // normal case indoors and in the first seconds of a run. The old guard tested
                // `loc.speed >= 0` FIRST, so an unknown speed skipped the not-moving check
                // altogether and fell straight through to summing position deltas — which is
                // precisely when those deltas are pure drift. Sitting still produced 0.2 km and a
                // map of a route nobody ran.
                if loc.speed >= 0 {
                    if loc.speed < 0.5 { lastLocation = loc; continue }   // known, and stationary
                } else if lastLocation != nil {
                    // Unknown speed: the step has to prove itself against the fix's own noise
                    // floor before it counts. A 15 m-accurate fix can wander 15 m with the watch
                    // on a table, so a 3 m "step" is evidence of nothing.
                    let noise = max(4.0, loc.horizontalAccuracy * 0.75)
                    if loc.distance(from: lastLocation!) < noise { lastLocation = loc; continue }
                }
                if let previous = lastLocation {
                    let step = loc.distance(from: previous)
                    if step > 1.0 && step < 80 { distanceMetres += step; movedThisBatch = true }
                }
                lastLocation = loc
            }
            // Prefer the device's own speed when it reports one; it is far steadier than
            // differentiating positions.
            if let speed = usable.last?.speed, speed > 0.5 {
                paceSecPerKm = 1000 / speed
            }
            recordSplits()
            // Downsampled, and only when the runner actually moved. Recording a point per fix
            // regardless drew a map out of standing-still drift — the numbers said 0.02 km and the
            // map still showed a wandering line, which is worse than showing nothing.
            if movedThisBatch, let last = usable.last, routePoints.count < 600 {
                routePoints.append([
                    (last.coordinate.latitude * 100000).rounded() / 100000,
                    (last.coordinate.longitude * 100000).rounded() / 100000,
                ])
            }
            if let rb = routeBuilder {
                Task { try? await rb.insertRouteData(usable) }
            }
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
            } else if quantityType == HKQuantityType(.activeEnergyBurned) {
                let kcal = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                Task { @MainActor in self.activeCalories = kcal }
            }
        }
    }
}
