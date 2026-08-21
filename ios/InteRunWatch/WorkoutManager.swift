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
    /// The distance the runner sees, and the one every split, payload and export is built from.
    /// ⚠️ IT IS NO LONGER ALWAYS OUR OWN SUM — see `adoptedHealthKitDistance` below.
    @Published private(set) var distanceMetres: Double = 0
    /// Our own GPS accumulation, kept running whatever the displayed source is, so that a HealthKit
    /// figure which never arrives (permission refused, an indoor session, a delayed first sample)
    /// falls back to something rather than to zero.
    private var gpsDistanceMetres: Double = 0
    /// ⚠️ APPLE'S OWN FUSED FIGURE, AND IT WAS BEING COLLECTED AND THROWN AWAY. The live workout
    /// builder already gathers `distanceWalkingRunning` — GPS blended with wrist motion, calibrated
    /// per-runner, and the number the built-in Workout app shows — and the delegate below read only
    /// heart rate and calories from it. Meanwhile the displayed distance came from summing raw GPS
    /// deltas, which is the very pattern the phone's own code documents as running ~73% long under
    /// jitter. Worse, HealthKit's figure is what gets SAVED to the workout, so the distance in Apple
    /// Health and the distance on screen did not have to agree.
    ///
    /// Once a positive HealthKit sample arrives it becomes the source and stays the source. The
    /// correction at that moment is a few metres, because the first sample lands within seconds of
    /// the workout starting.
    private var adoptedHealthKitDistance = false
    @Published private(set) var heartRate: Double = 0
    /// Smoothed from recent GPS, in seconds per km. Nil until moving.
    @Published private(set) var paceSecPerKm: Double?
    /// When `paceSecPerKm` was last written by a real fix — the heartRateAt precedent. HealthKit and
    /// CoreLocation both simply stop delivering rather than saying so, and a value nobody refreshed
    /// reads exactly like a current one. ⚠️ 8 s, deliberately SHORTER than the 10 s auto-pause
    /// still-threshold, and autoPauseTick keeps reading the RAW field — a stale-pace nil must never
    /// be what starts the auto-pause clock.
    private var paceAt: Date?
    private let paceFreshSec: TimeInterval = 8
    var paceIsFresh: Bool { paceAt.map { Date().timeIntervalSince($0) <= paceFreshSec } ?? false }
    /// A short trailing window of pace samples, so a SPOKEN number is the last ~10 s rather than the
    /// single fix that happened to coincide with the cue — measured, quoting one fix at the biased
    /// moment a hold expires ran ~37 s/km wide of the truth; the window mean halves that. The
    /// VERDICT stays on the instantaneous value: its own 6 s hold is already the smoothing for the
    /// decision, and lagging the decision would be a different (worse) trade.
    private var paceWindow: [(at: Date, p: Double)] = []
    /// Halfway is announced once per run, in the session's own currency — see the ticker.
    private var halfwaySpoken = false
    /// One-shot: the prescription has run out and `end()` has been called for it. See
    /// `finishPrescribedSession`, and note that this is cleared in `reset()` like every other
    /// per-run flag — the manager outlives a run.
    private var autoCompleted = false
    /// Baseline for deriving pace from DISTANCE when the device will not report a speed. Held in
    /// running seconds (`elapsed`), so paused time is excluded by construction. See
    /// `derivePaceIfStale`.
    private var paceRef: (metres: Double, at: TimeInterval)?
    /// The derivation's window and its plausibility bounds.
    ///
    /// ⚠️ 150 s/km is the phone's own `PACE_PLAUSIBLE_MIN`: a derivation faster than any prescribed
    /// band is arithmetic on a lump, not a pace. 1800 is 30:00/km, well below a standstill.
    /// ⚠️ TWO time bounds, not one. Ten metres is covered in about six seconds at running pace and
    /// about seven at a walk, but a 25:00/km shuffle needs fifteen — so the window EXTENDS to
    /// `paceDeriveMaxSec` before it concludes the runner has stopped. Concluding it at six seconds
    /// would clear the pace of every slow runner on every window.
    ///
    /// ⚠️⚠️ AND `paceDeriveMaxSec` WAS A THIRD INDEPENDENT NUMBER THAT CONTRADICTED BOTH OF THE
    /// OTHERS. At a flat 15 it named 25:00/km as the case it existed for and then refused it: ten
    /// metres at 1500 s/km takes exactly 15.0 s, so the two branches tie and float noise decides
    /// which one fires. Driven, the derivation returned 1499 for 1499 and NIL for 1500 — the first
    /// pace it refuses is the one the sentence above promises. And because 1800 needs 18 s, the whole
    /// 1500–1800 top of the declared plausible band was unreachable: `paceMaxPlausible` claimed a
    /// range its only writer could not produce.
    ///
    /// So the window is now DERIVED from the two constants it has to reconcile — the distance it
    /// waits for and the slowest pace the model calls plausible — and 25:00/km derives with three
    /// seconds to spare. It is the CLAMP that was wrong, not the comment. Nothing acts on the
    /// difference except the display: `autoPauseTick` treats anything slower than 900 s/km as not
    /// moving, so a 25:00/km shuffle is auto-paused whether its pace reads 25:00 or "--".
    private static let paceDeriveSec: TimeInterval = 6
    private static let paceDeriveMetres: Double = 10
    private static let paceMinPlausible: Double = 150
    private static let paceMaxPlausible: Double = 1800
    private static let paceDeriveMaxSec: TimeInterval = paceDeriveMetres / 1000 * paceMaxPlausible
    var spokenPaceQuote: Double? {
        let cut = Date().addingTimeInterval(-10)
        let recent = paceWindow.filter { $0.at > cut }
        guard !recent.isEmpty else { return paceIsFresh ? paceSecPerKm : nil }
        return recent.map { $0.p }.reduce(0, +) / Double(recent.count)
    }
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
    /// Estimated max heart rate, handed over at start like the fields above. Zones need a ceiling;
    /// nil means the phone could not estimate one and the heart simply is not zone-coloured.
    var maxHr: Int?
    /// The heart-rate trace: one (metres, bpm) pair every HR_SAMPLE_SEC of RUNNING time.
    ///
    /// ⚠️ Paired with DISTANCE, not with time, because the chart the phone draws is heart rate
    /// across the run's distance — pairing with time would make every pause a flat plateau on a
    /// distance axis. Paused seconds are not sampled at all, for the same reason the zone
    /// accumulator skips them.
    ///
    /// ⚠️ Bounded at source. It is downsampled to HR_MAX_POINTS before it is sent, so a marathon
    /// costs the same as a 5k: the phone keeps fifty runs in localStorage and an unbounded trace
    /// would be the one field that grows without limit.
    /// When `heartRate` last ARRIVED. ⚠️ The property itself is never cleared — HealthKit simply
    /// stops delivering when the watch loses skin contact — so reading it is not evidence of a
    /// reading. Without this stamp the sampler charges an entire dropout to the last bpm it saw and
    /// the phone draws it as a flat line across the run: a runner whose strap loosened 20 minutes
    /// into an hour gets two thirds of the trace fabricated, and it is indistinguishable from a
    /// genuinely steady effort. The average could absorb a stale value; a chart renders it as shape.
    private var heartRateAt: Date?
    /// The dropout window. A gap in the trace draws as a diagonal, which is honest; a plateau is not.
    private static let hrFreshSec: TimeInterval = 15
    private var hrTrack: [(m: Double, bpm: Double)] = []
    private var lastHrSampleAt: TimeInterval = -99
    /// Peak heart rate seen this run, and seconds spent in each of the five training zones.
    ///
    /// ⚠️ TIME IN ZONE IS ACCUMULATED HERE, not reconstructed on the phone from a sample series.
    /// Five running totals answer the whole zones panel for six numbers in the payload; shipping
    /// every sample so the phone could add them up would cost hundreds per run against a store that
    /// holds fifty runs, to answer exactly the same question. It also survives a run done entirely
    /// out of range of the phone, which a live-streamed version would not.
    ///
    /// ⚠️ FIVE buckets, not six. `hrZone` returns 0-5 with 0 meaning "below 50% of max", but the
    /// phone's zones panel is 1-5 like every other running app, so zone 0 and zone 1 both land in
    /// index 0. Time below 50% is still time on your feet and must not be silently dropped.
    private(set) var maxHeartRate: Double = 0
    private var zoneSeconds: [Double] = [0, 0, 0, 0, 0]
    /// Cadence, accumulated exactly the way the zone totals and the average heart rate are: sampled
    /// only while RUNNING, so a runner standing at a crossing cannot drag the average toward a
    /// cadence they never ran at.
    ///
    /// ⚠️ THE WRIST SENT NO CADENCE AT ALL, so the debrief's cadence tile was permanently blank on
    /// every watch run and the share card lost a rung. The phone has always had one
    /// (`PedometerService` → `LIVE.cadSum`/`cadN`); the wrist's `summaryPayload` simply had no such
    /// field. There is no CMPedometer here, so the source is HealthKit's own step count, collected
    /// by the live workout builder.
    ///
    /// ⚠️ TIME-WEIGHTED, i.e. steps banked over the running seconds they were banked in. HealthKit
    /// delivers `stepCount` in irregular batches, so an unweighted mean of "steps ÷ this window"
    /// would be dominated by the shortest windows. `avgCadence` is what a runner means by average
    /// cadence and is the same shape as HealthKit's own average heart rate.
    private var cadSteps: Double = 0
    private var cadSeconds: TimeInterval = 0
    /// HealthKit's CUMULATIVE step total at the last delivery, and the running clock then, so each
    /// delivery contributes only its own interval. Updated on EVERY delivery — including ones that
    /// arrive while paused — so a paused stretch is absorbed into the baseline rather than counted.
    private var lastStepTotal: Double?
    private var lastStepElapsed: TimeInterval = 0
    /// Metres climbed, accumulated the same way the phone does it, from the fixes we already have.
    private var elevGainM: Double = 0
    private var lastAltitude: Double?
    /// The shape of the run, as `[lat, lng, t]` triples where `t` is the run's own running seconds at
    /// the moment the fix was taken. Thinned in place, never truncated — see `appendRoutePoint` and
    /// `thinRoutePoints` below, and read through `route` rather than directly.
    ///
    /// ⚠️ THE THIRD ELEMENT IS WHY A WRIST RUN CAN REACH STRAVA AS A REAL ACTIVITY. `runStravaPayload`
    /// filters on `isFinite(p.t)`, so while these were bare pairs EVERY wrist run went up as a MANUAL
    /// activity: the right distance and the right duration, and no map, no splits and no pace — which
    /// is most of why anybody sends a run there at all. See `routeSecondsAt` for what the number means
    /// and `routeLastT` for the one rule that keeps it usable.
    ///
    /// ⚠️ THE CAP USED TO BE `routePoints.count < 600` AT THE APPEND SITE, WHICH SIMPLY STOPPED
    /// RECORDING. At roughly a fix a second that is ten minutes, so every wrist run longer than that
    /// stored its first ten minutes and nothing after — and the debrief, the recap and the share card
    /// each drew that prefix as though it were the whole outing. Measured on a synthetic
    /// point-to-point three-hour run: the stored line was 1.82 km of 32.65 km of ground, and the
    /// missing ground sat a mean of 1540 m and a worst of 4134 m away from anything that was kept.
    private(set) var routePoints: [[Double]] = []
    /// One point is kept per this many credited fixes, and it DOUBLES whenever the buffer is halved.
    ///
    /// ⚠️ HALVING THE BUFFER ALONE IS NOT A FIX, AND NEITHER A POINT COUNT NOR A SPAN CAN SEE WHY.
    /// Fixes keep arriving once a second, so a buffer that is merely halved refills at full rate:
    /// the surviving old region's spacing doubles at every pass while the newest region stays dense.
    /// Measured on the same three-hour track, that put 306 of 336 points in the LAST TENTH of the run
    /// and represented the first tenth with two — the mirror image of the truncation being fixed,
    /// with a perfect 100% span and a plausible count. Doubling the intake at the same moment makes
    /// every region converge on one spacing: measured after, 34 points in each tenth of that run and
    /// a mean deviation from the full-resolution track of 1.53 m.
    private var routeStride = 1
    /// Credited fixes since the last one that was kept.
    private var routeSinceKeep = 0
    /// The newest credited fix, when the stride did not keep it. Always shown last, by `route`.
    ///
    /// ⚠️ WITHOUT THIS THE LINE ENDS BEFORE THE RUN DOES. At a stride of 32 up to 31 fixes at the end
    /// of a run are skipped, so the drawn route stops up to 90 m short of where the runner actually
    /// finished. It is the same trap `downsampledHrTrack` already records guarding against —
    /// "dropping the last one would end the chart before the end of the run, which reads as a shorter
    /// run rather than as a thinned trace".
    private var routeTail: [Double]?
    /// The running seconds carried by the last route point ACCEPTED — kept or provisional.
    ///
    /// ⚠️ IT IS A WATERMARK, AND IT IS WHAT MAKES THE PAUSE HANDLING HONEST RATHER THAN A CLAMP. A fix
    /// is timed against `pausedAccum` as it stands when the fix is PROCESSED, so a fix whose own clock
    /// predates the end of the last pause has a pause subtracted from it that had not happened when it
    /// was taken — and comes out EARLIER than the point before it. That is exactly the batch
    /// CoreLocation delivers on the resume. Refusing a point that cannot be placed strictly after the
    /// last one drops those, keeps every post-resume fix, and needs no history of the pauses: nothing
    /// is nudged, nothing is invented, and a point we cannot time is simply not a point.
    ///
    /// ⚠️ AND IT IS THE DUPLICATE-TIME CHECK. The times are whole seconds, because that is all a GPX
    /// trackpoint carries once `runStravaPayload` strips the milliseconds — so two fixes inside one
    /// second would reach Strava sharing a timestamp, which is an infinite speed between them.
    ///
    /// -1, not 0: a run's very first fix is second zero of the run and has to be accepted.
    private var routeLastT: Double = -1
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
        // ⚠️ A PACE NOBODY REFRESHED IS NOT A SIGNAL. Under trees the fixes stop but the last value
        // stays put, so the wrist spent GPS dropouts confidently judging — and quoting, out loud —
        // a number from before the trees. Same mechanism as heartRateAt: measured there, a loose
        // strap fabricated two thirds of an hour-long trace. Stale reads as FINDING GPS and silence.
        guard paceIsFresh, let p = paceSecPerKm, p.isFinite, p > 0 else { return .noSignal }
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
        case .tooSlow: return slowIsFine ? "SLOWER IS FINE" : "PICK IT UP"
        }
    }

    /// Running slower than the band on a low-intensity session is FINE — the plan's own engine has
    /// said so since it was written (its pace log stays quiet there), while the wrist nagged anyway:
    /// measured on the owner's 2026-08-17 walk, sixteen spoken "Speed up a little" corrections on one
    /// easy kilometre. Work keeps its correction: a rep by kind, or a step the PAYLOAD marks as work
    /// (the engine's own isWorkStep — RPE 6+ — decided once on the phone and carried per step, so a
    /// long run's goal-pace block is still coached even though its kind is "steady").
    /// ⚠️ Too FAST is never fine and is untouched by this.
    var slowIsFine: Bool {
        guard ["easy", "long", "recovery"].contains(plan?.type ?? "") else { return false }
        guard let st = currentStep else { return true }
        return st.kind != "rep" && st.work != true
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
        // ⚠️ BOTH OF THESE MUST CLEAR TOO. WorkoutManager is a @StateObject and outlives a run, so a
        // second run in one app session inherits whatever the first left behind — the documented
        // reason reset() exists at all. A stale adoption flag would leave run two showing run one's
        // total until HealthKit's first sample landed.
        gpsDistanceMetres = 0
        adoptedHealthKitDistance = false
        heartRate = 0
        avgHeartRate = 0
        activeCalories = 0
        paceSecPerKm = nil
        stepIndex = 0
        stepStartElapsed = 0
        stepStartMetres = 0
        reportedRpe = nil
        hrTrack = []
        lastHrSampleAt = -99
        heartRateAt = nil
        maxHeartRate = 0
        zoneSeconds = [0, 0, 0, 0, 0]
        // ⚠️ ALL FOUR. Two totals and two baselines: leaving the baselines behind would charge run
        // two's first interval against run one's last step count, and leaving the totals behind
        // would report run one's cadence on run two.
        cadSteps = 0
        cadSeconds = 0
        lastStepTotal = nil
        lastStepElapsed = 0
        elevGainM = 0
        lastAltitude = nil
        // ⚠️ ALL FOUR. WorkoutManager is a @StateObject and outlives a run, so a stride left at 32
        // would have run two keeping one fix in thirty-two from its very first minute, and a tail left
        // behind would put a point from run one at the end of run two's route.
        routePoints = []
        routeStride = 1
        routeSinceKeep = 0
        routeTail = nil
        // ⚠️ AND THE TIME WATERMARK. Left behind, run two of an app session is refused ENTIRELY — every
        // one of its fixes is earlier in its own run than run one's last point was in that one, so the
        // gate in appendRoutePoint declines all of them and the second run records no route at all.
        routeLastT = -1
        splits = []
        lastSplitMetre = 0
        lastSplitElapsed = 0
        lastLocation = nil
        paceAt = nil
        paceWindow = []
        paceRef = nil
        halfwaySpoken = false
        // ⚠️ A completion flag left set makes run two of an app session start already finished —
        // the documented reason this whole function exists.
        autoCompleted = false
        stillSince = nil
        movingSince = nil
        autoPaused = false
        pausedAccum = 0
        pauseBegan = nil
        ticker?.invalidate(); ticker = nil
        lastLiveSend = .distantPast
        startedAt = nil
        session = nil
        builder = nil
        routeBuilder = nil
        voice = nil
        runId = "watch-" + UUID().uuidString
    }

    /// The four beats of the count, as their own cue triggers.
    ///
    /// ⚠️ ONE MESSAGE PER BEAT, NOT ONE FOR THE SEQUENCE — this is the whole fix for "the audio
    /// countdown didn't match the screen countdown and the session had already started before the
    /// audio countdown fired". The wrist used to send a single `"countdown"` and the PHONE then ran
    /// its own 0/1/2/3-second schedule from whenever it got round to it, so the two were two
    /// independent three-second timers started at different moments and the spoken sequence could
    /// only ever be late. Sent per beat, each beat carries the one-way latency and nothing else, and
    /// "Go." lands with the clock.
    ///
    /// ⚠️ FOUR TRIGGERS, NOT ONE REUSED FOUR TIMES. The phone's native player plays exactly one file
    /// per call and holds a per-trigger dedupe window, so one shared trigger sent four times would
    /// speak one number and suppress the other three — and rotate WHICH number across runs.
    ///
    /// ⚠️ THE PHONE MUST KNOW THESE NAMES. They have to be in the page's own cue-trigger list and its
    /// by-id path before any of this is audible; until then the count is carried by the haptics
    /// alone, which is what it was designed to fall back to and what an out-of-range phone gets
    /// anyway (`WorkoutVoice.fallback` is deliberately silent for a count — a late "three, two, one"
    /// is worse than nothing).
    static let countdownTriggers = ["count-3", "count-2", "count-1", "count-go"]

    /// Begin, after a three-second count if the runner has left it on. Each beat taps the wrist, so
    /// it works with the screen down and the phone already in a pocket.
    ///
    /// ⚠️ A STATUS SHORTCUT PAST `requestAuthorization` WAS CONSIDERED AND REJECTED. The remaining
    /// misalignment is `start()`'s HealthKit round trip between the "go" haptic and `begin()` setting
    /// the clock. Going straight to `begin()` when the share types read `.sharingAuthorized` would
    /// shave it — and `HKHealthStore.authorizationStatus(for:)` answers ONLY for types the app
    /// writes, because read permission is deliberately undisclosed. So the shortcut would silently
    /// never ask for a newly added READ type, and `.stepCount` (cadence) is exactly such a type: the
    /// cost would be a permanently blank cadence tile with nothing to see. Doing the request early
    /// instead is no better — it puts iOS's own permission sheet over the count on a first run and
    /// leaves two requests racing. The round trip is milliseconds when already granted; the seconds
    /// he heard were the re-based sequence above.
    func startCountingDown() {
        guard WatchSettings.shared.countdown else { return start() }
        guard countdown == nil, phase == .idle else { return }
        countdown = 3
        WKInterfaceDevice.current().play(.start)
        // The phone says the number, in the coach's recorded voice, one beat at a time. If it is out
        // of range the wrist is silent rather than robotic — the haptics still carry the beat, which
        // is what matters when you are looking at your phone or your shoes.
        _ = speakOnPhone(Self.countdownTriggers[0])
        countdownTimer?.invalidate()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] t in
            Task { @MainActor in
                guard let self else { t.invalidate(); return }
                let left = (self.countdown ?? 1) - 1
                if left > 0 {
                    self.countdown = left
                    WKInterfaceDevice.current().play(.click)
                    // Beat 2 is index 1, beat 1 is index 2 — the number on the screen this instant.
                    _ = self.speakOnPhone(Self.countdownTriggers[3 - left])
                } else {
                    t.invalidate()
                    self.countdownTimer = nil
                    self.countdown = nil
                    WKInterfaceDevice.current().play(.success)
                    // "Go." travels BEFORE start(), so the word and the clock leave together rather
                    // than the word queueing behind a HealthKit round trip.
                    _ = self.speakOnPhone(Self.countdownTriggers[3])
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
            // ⚠️ CADENCE. There is no CMPedometer on watchOS, so steps per minute has to come from
            // HealthKit's own step count — which means asking to READ it. A runner upgrading gets one
            // extra line in the Health prompt once; without it `avgCadence` is silently nil forever
            // and the debrief's cadence tile stays as blank as it has always been on wrist runs.
            HKQuantityType(.stepCount),
        ]

        healthStore.requestAuthorization(toShare: share, read: read) { [weak self] ok, error in
            Task { @MainActor in
                guard let self else { return }
                guard ok else {
                    self.phase = .failed(error?.localizedDescription
                        ?? "Inte-Run needs Health access to record your run.")
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
            let source = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
            // ⚠️ ENABLED EXPLICITLY. The default type set for a running configuration carries heart
            // rate, energy and distance; step count is NOT in it, so the builder would collect
            // nothing and `didCollectDataOf` would never mention it — a cadence branch reading a type
            // nobody collects is the computed-and-discarded trap in a new place.
            source.enableCollection(for: HKQuantityType(.stepCount), predicate: nil)
            b.dataSource = source
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
            // The tick travels FIRST — sendMessage also wakes the phone in the background — so by
            // the time the mirrored-launch handler runs, the phone usually knows the run's real
            // title and the lock-screen card is named after the run, not after today's plan.
            sendLiveTick(force: true)
            // ⚠️ This is what puts a card on a locked iPhone for a wrist-started run. It launches
            // the companion app in the background, and THAT launch carries Apple's one-time
            // permission to start a Live Activity from the background — the WatchConnectivity wake
            // we were using does not. See MirroredWorkoutService on the phone.
            // A failure here costs the card, never the run.
            s.startMirroringToCompanionDevice { ok, error in
                if !ok {
                    let why = error?.localizedDescription ?? "unknown"
                    print("workout mirroring did not start: \(why)")
                }
            }
            voice = WatchSettings.shared.voiceCues ? WorkoutVoice() : nil
            voice?.loadCoach(coach, lines: coachLines)
            voice?.loadWhy(why, person: whyPerson)
            // Step announcements carry no numbers: the step's KIND picks a catalogue trigger and
            // the phone plays the real clip when in range (see announceStep). What DOES stay on the
            // wrist by necessity is anything recordings can't say — pace corrections with the
            // runner's numbers (paceCue), and their own words/name (whyMoment, keepGoing).
            if let first = currentStep {
                voice?.announceStep(kind: first.kind, via: self)
            } else {
                if !speakOnPhone("session-start") { voice?.say("Let\u{2019}s go. Run by feel.") }
            }

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
                    guard let self, let started = self.startedAt else { return }
                    // ⚠️ A paused run still needs the ticker: auto-resume lives in autoPauseTick,
                    // and the phone's mirror needs ticks or it declares the run dead after 45 s.
                    // The old guard returned for any non-running phase, so the first auto-pause was
                    // permanent — the branch that would have resumed could never execute again.
                    guard self.phase == .running || self.phase == .paused else { return }
                    if self.phase == .paused {
                        self.autoPauseTick()
                        self.sendLiveTick()
                        return
                    }
                    // ⚠️ Minus the paused time. Elapsed was wall-clock since start, so pausing froze
                    // the display and then SNAPPED FORWARD on resume, counting the whole pause.
                    self.elapsed = Date().timeIntervalSince(started) - self.pausedAccum
                    self.accumulateZone(0.5)
                    // ⚠️ Before the step check, so a step that completes this tick is judged against
                    // the same numbers the runner is looking at.
                    self.derivePaceIfStale()
                    self.advanceStepIfDue()
                    // ⚠️ THE PRESCRIPTION MAY HAVE JUST ENDED THE RUN, AND THIS CLOSURE CARRIES ON.
                    // `advanceStepIfDue` calls `end()` when the last step completes; `end()`
                    // invalidates the ticker, but the tick already executing runs to its last line.
                    // Two things then happened by accident rather than by design, both AFTER the
                    // forced "ended" tick that takes the phone's mirror and the lock-screen card
                    // down: a trailing non-forced `sendLiveTick()` reporting "running", suppressed
                    // only by the 2 s send throttle; and `autoPauseTick()`, which reads `phase` —
                    // still `.running` until HealthKit's teardown completion lands — and can
                    // therefore `pause()` a session that has just ended, sending a forced "paused"
                    // tick after the "ended" one. Reachable on a TIMED final step that expires while
                    // the runner is already standing still. `autoCompleted` is one-shot and cleared
                    // in `reset()`, so this can never wedge the next run's ticker.
                    if self.autoCompleted { return }
                    // The window feeding the SPOKEN quote — the verdict below stays instantaneous.
                    if let p = self.paceSecPerKm, self.paceIsFresh { self.paceWindow.append((Date(), p)) }
                    if self.paceWindow.count > 40 { self.paceWindow.removeFirst(self.paceWindow.count - 40) }
                    // Pace corrections are the wrist's own voice, WITH the numbers — the owner's
                    // spec ("your current pace is…, your target pace is…") can never come from a
                    // recorded clip, so unlike the step cues these are not forwarded to the phone.
                    // ⚠️ The quote is the ~10 s window mean, not the fix of the moment; and a slow
                    // verdict on a low-intensity session is treated as "ok" (see slowIsFine) — that
                    // resets the hold too, so easing back onto pace never triggers a late nag.
                    switch self.paceVerdict {
                    case .tooFast: self.voice?.paceCue("fast", currentSecPerKm: self.spokenPaceQuote, band: self.targetBand)
                    case .tooSlow where !self.slowIsFine:
                        self.voice?.paceCue("slow", currentSecPerKm: self.spokenPaceQuote, band: self.targetBand)
                    default: self.voice?.paceCue("ok", currentSecPerKm: nil, band: nil)
                    }
                    // Halfway, measured in the session's own currency — sessionProgress is
                    // distance-led for a distance session, time-led otherwise, the same rule the
                    // phone follows. Recorded clip via the phone when it can answer; the fallback
                    // is deliberate silence, never a robot, matching the no-robot-encouragement rule.
                    if !self.halfwaySpoken, self.targetSeconds > 120,
                       let prog = self.sessionProgress, prog >= 0.5 {
                        self.halfwaySpoken = true
                        _ = self.speakOnPhone("halfway")
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
        pauseBegan = Date()
        paceRef = nil            // and neither must a derivation baseline
        voice?.resetPaceHold()   // a hold accrued before the pause must not survive it
        if !speakOnPhone("paused") { voice?.sayPaused() }
        sendLiveTick(force: true)
    }

    func resume() {
        guard phase == .paused else { return }
        session?.resume()
        if let began = pauseBegan { pausedAccum += Date().timeIntervalSince(began) }
        pauseBegan = nil
        phase = .running
        paceRef = nil            // a fresh window from the resume, not one spanning the pause
        // Both ends, deliberately: GPS kept updating pace from WALKING speed during the pause, so
        // without a fresh hold the first post-resume tick could speak a numbered cue quoting the
        // walk, straight over this "resumed" clip. The verdict must re-earn its 6 seconds.
        voice?.resetPaceHold()
        if !speakOnPhone("resumed") { voice?.sayResumed() }
        sendLiveTick(force: true)
    }

    func end() {
        if !speakOnPhone("session-complete") { voice?.sayComplete() }
        // Drop the phone's mirror now; the recorded run follows by its own durable path. The phase
        // is deliberately NOT set here — HealthKit teardown below owns that transition.
        sendLiveTick(force: true, stateOverride: "ended")
        // ⚠️ Durable, immediately. sendHome was only wired to the effort screen's buttons, so a run
        // finished from the phone — or a watch that slept on the summary screen — never reached the
        // Logbook at all. The effort screen still sends again; that delivery carries the RPE and
        // the phone updates rather than duplicating.
        sendHome()
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

    /// Move to the next step when the current one is complete — and FINISH when there is no next one.
    /// A wrist tap marks the change, since the runner is not looking at the screen; that is the whole
    /// point of it being on a wrist.
    ///
    /// ⚠️ THE LAST STEP USED TO BE A DEAD END, AND THAT IS WHY A CUSTOM 2 km RAN TO 2.05 km AND KEPT
    /// GOING. The line here was `guard stepIndex + 1 < steps.count else { return }`, so on the final
    /// step the whole function returned and nothing else in the watch target ever ended a session:
    /// the only callers of `end()` were the phone's relayed stop command and the runner's own "End
    /// session" button. It was never distance-specific — a single TIMED step hung in exactly the same
    /// way (simulated: a 32′ moderate session ran to 3600 s and 9.4 km without ending). The phone has
    /// always had this (`src/live/session-runtime.ts`: last step done → status "completed" → the
    /// finish screen); the wrist never did.
    ///
    /// ⚠️ A FREE RUN MUST NOT GAIN AN END, and the guard for it is the `currentStep` bail above:
    /// `plan` nil → `steps` is `[]` → `currentStep` is nil → we return before anything here can fire.
    /// A free run has no prescription to finish, so it runs until the runner says otherwise.
    private func advanceStepIfDue() {
        guard let step = currentStep else { return }
        guard let p = step.progress(elapsed: stepElapsed, metresDone: stepMetres), p >= 1 else { return }
        guard stepIndex + 1 < steps.count else { return finishPrescribedSession() }
        stepIndex += 1
        stepStartElapsed = elapsed
        stepStartMetres = distanceMetres
        WKInterfaceDevice.current().play(.notification)
        if let st = currentStep { voice?.announceStep(kind: st.kind, via: self) }
    }

    /// The prescription is complete: bank the run and show the summary.
    ///
    /// ⚠️ IT GOES THROUGH `end()` RATHER THAN SETTING `phase` ITSELF. `end()` does a lot in a fixed
    /// order — the session-complete cue, a final "ended" tick so the phone's mirror and the
    /// lock-screen card come down, `sendHome()` BEFORE the HealthKit teardown, then the teardown that
    /// owns the transition to `.ended`. An auto-complete that assigned `phase = .ended` directly
    /// would skip `sendHome()` and lose the run.
    ///
    /// ⚠️ `autoCompleted` is one-shot and is cleared in `reset()`. The manager outlives a run, so a
    /// flag left set would make run two of an app session start already finished — the documented
    /// trap that once had the second run silently dropped.
    private func finishPrescribedSession() {
        guard !autoCompleted else { return }
        autoCompleted = true
        // A tap of its own before the summary lands: the runner is not looking at the wrist, and the
        // one thing they want to know at the end of a prescribed session is that it IS the end.
        WKInterfaceDevice.current().play(.success)
        end()
    }

    /// Skip forward manually — recoveries especially never line up exactly with real terrain.
    func nextStep() {
        guard stepIndex + 1 < steps.count else { return }
        stepIndex += 1
        stepStartElapsed = elapsed
        if let st = currentStep { voice?.announceStep(kind: st.kind, via: self) }
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
    /// Charge half a second to whichever zone the current reading sits in. Called only from the
    /// RUNNING branch of the ticker, so a paused run banks nothing — a runner standing at a
    /// crossing is not accumulating training time, and counting it would inflate every zone.
    private func accumulateZone(_ seconds: Double) {
        guard heartRate > 0 else { return }
        if heartRate > maxHeartRate { maxHeartRate = heartRate }
        if let at = heartRateAt, Date().timeIntervalSince(at) <= Self.hrFreshSec,
           elapsed - lastHrSampleAt >= Self.hrSampleSec {
            lastHrSampleAt = elapsed
            hrTrack.append((m: distanceMetres, bpm: heartRate))
        }
        guard let z = hrZone else { return }
        let idx = max(0, z - 1)
        if idx < zoneSeconds.count { zoneSeconds[idx] += seconds }
    }

    /// Bank the steps taken since the last delivery, against the running seconds they were taken in.
    ///
    /// ⚠️ THE BASELINES ADVANCE EVEN WHEN THE SAMPLE IS REFUSED (the `defer`), which is what makes a
    /// pause free: the steps somebody shuffles at a crossing are absorbed into the baseline and the
    /// next running interval measures only itself. Same rule as `accumulateZone`, which skips paused
    /// seconds so the zone totals cannot exceed the elapsed time printed beside them.
    private func tookSteps(_ total: Double) {
        defer { lastStepTotal = total; lastStepElapsed = elapsed }
        guard phase == .running, let prev = lastStepTotal else { return }
        let dSteps = total - prev
        let dSec = elapsed - lastStepElapsed
        // A negative delta means HealthKit restated the total; nothing to bank either way.
        guard dSteps > 0, dSec > 0 else { return }
        cadSteps += dSteps
        cadSeconds += dSec
    }

    /// Average cadence in steps per minute, or nil.
    ///
    /// ⚠️ NIL, NEVER ZERO. A stored zero renders as a measurement of somebody standing still, which
    /// is the rule the phone's own save path already states. Twenty seconds of banked running is the
    /// floor: below that the figure is one HealthKit batch and says nothing.
    var avgCadence: Double? {
        guard cadSeconds >= 20, cadSteps > 0 else { return nil }
        let spm = cadSteps / (cadSeconds / 60)
        return spm.isFinite && spm > 0 && spm < 400 ? spm : nil
    }

    /// Derive pace from DISTANCE when the device will not report a speed.
    ///
    /// ⚠️ THIS IS WHY "CURRENT" READ "—" FOR A WHOLE WATCH RUN ON THE PHONE'S MIRROR.
    /// `paceSecPerKm` had exactly one writer — `CLLocation.speed` in the location delegate — and that
    /// value is -1 whenever the receiver will not commit to one. The delegate's own branches then read
    /// `if sp > 0.5 {…} else if sp >= 0 {…} else if !movedThisBatch {…}`, so the case "no speed
    /// reported AND the runner is moving" assigned nothing at all: the published pace stayed at
    /// whatever it was, which for a run where speed is never reported is nil from `reset()` onwards.
    /// No current pace on the wrist, none in the tick, "FINDING GPS" for the whole run, no pace cues,
    /// and auto-pause blind — all while HealthKit's fused distance advanced perfectly well two lines
    /// away. The PHONE has always had this fallback (`onGpsPos` derives from displacement when the
    /// device speed is absent); the wrist never did.
    ///
    /// ⚠️ IT ONLY RUNS WHEN THE DEVICE'S OWN FIGURE HAS GONE STALE. Doppler speed is far steadier
    /// than differentiating positions, so it keeps priority; this fills the gaps it leaves. Measured
    /// in `elapsed`, which is running time, so a pause contributes no seconds.
    ///
    /// ⚠️ AND IT CLEARS THE PACE WHEN THE WINDOW EXPIRES WITH NOTHING IN IT, because that is the only
    /// thing keeping auto-pause honest here: a derived value that persisted through a standstill would
    /// mean `autoPauseTick` never saw the runner stop.
    private func derivePaceIfStale() {
        guard !paceIsFresh else { paceRef = nil; return }
        guard let ref = paceRef else { paceRef = (metres: distanceMetres, at: elapsed); return }
        let dSec = elapsed - ref.at
        guard dSec >= Self.paceDeriveSec else { return }
        let dM = distanceMetres - ref.metres
        if dM >= Self.paceDeriveMetres {
            paceRef = (metres: distanceMetres, at: elapsed)
            let derived = dSec / (dM / 1000)
            guard derived.isFinite, derived >= Self.paceMinPlausible, derived <= Self.paceMaxPlausible
            else { return }
            paceSecPerKm = derived
            paceAt = Date()
        } else if dSec >= Self.paceDeriveMaxSec {
            paceRef = (metres: distanceMetres, at: elapsed)
            paceSecPerKm = nil
            paceAt = nil
        }
    }

    /// One sample every five seconds of running: dense enough that a two-minute interval has 24
    /// points and its shape survives, sparse enough that an hour is 720 pairs before downsampling.
    private static let hrSampleSec: TimeInterval = 5
    /// What actually crosses to the phone and is stored forever. 160 points across any run is more
    /// than a 320-pixel-wide chart can resolve, so nothing visible is lost by capping here.
    private static let hrMaxPoints = 160

    /// Even thinning that keeps the FIRST and LAST samples. Dropping the last one would end the
    /// chart before the end of the run, which reads as a shorter run rather than as a thinned trace.
    private func downsampledHrTrack() -> [[Double]] {
        guard !hrTrack.isEmpty else { return [] }
        let n = hrTrack.count
        let pack: ((m: Double, bpm: Double)) -> [Double] = {
            [($0.m).rounded(), ($0.bpm).rounded()]
        }
        if n <= Self.hrMaxPoints { return hrTrack.map(pack) }
        var out: [[Double]] = []
        let step = Double(n - 1) / Double(Self.hrMaxPoints - 1)
        for i in 0..<Self.hrMaxPoints {
            out.append(pack(hrTrack[min(n - 1, Int((Double(i) * step).rounded()))]))
        }
        return out
    }

    func summaryPayload() -> [String: Any] {
        var out: [String: Any] = [
            "id": runId,
            "sec": Int(elapsed.rounded()),
            "distKm": (distanceMetres / 1000),
            // ⚠️ `route`, NOT `routePoints`: the newest fix is held provisionally and only the
            // accessor knows about it, so reading the array here would send the phone a line ending
            // up to 90 m short of where the run finished. One definition of what the route is.
            "route": route,
            "splits": splits,
            "source": "watch",
        ]
        // ⚠️ WHEN THE RUN BEGAN, AND IT TRAVELS WITH THE TIMED ROUTE BECAUSE THE ROUTE IS USELESS
        // WITHOUT IT. A route point's time is seconds since the start, so the phone needs the start to
        // turn it into a real instant — and `runStartMs` cannot recover one from a wrist run's id,
        // which is a UUID. Its documented fallback is 09:00 on the run's date, so a properly mapped
        // wrist run would have landed in somebody's Strava feed nine hours from when they ran it.
        // Absent on an older build, where the route carries no times either, so that run stays manual
        // and nothing has to guess.
        if let began = startedAt { out["startMs"] = began.timeIntervalSince1970 * 1000 }
        if let p = plan {
            out["title"] = p.title
            out["type"] = p.type
            out["dateIso"] = p.dateIso
        }
        if let rpe = reportedRpe { out["rpe"] = rpe }
        if avgHeartRate > 0 { out["avgHr"] = avgHeartRate }
        if maxHeartRate > 0 { out["maxHr"] = maxHeartRate }
        if zoneSeconds.contains(where: { $0 > 0 }) { out["zoneSec"] = zoneSeconds }
        if activeCalories > 0 { out["kcal"] = activeCalories }
        // ⚠️ Only when there is one. The key is ABSENT rather than 0 for a run that banked no steps,
        // so the phone stores null and the debrief's tile stays away instead of claiming a measured
        // zero — the rule the phone's own save path states at its `cadence:` line.
        if let cad = avgCadence { out["cadence"] = Int(cad.rounded()) }
        let hr = downsampledHrTrack()
        if hr.count >= 4 { out["hrSeries"] = hr }
        if elevGainM > 0 { out["elevGain"] = elevGainM }
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
        // ⚠️ Spoken cues OFF must mean off. Returning true — "handled, say nothing" — also stops
        // every caller's `voice?` fallback from speaking, and survives a future non-nil voice.
        guard WatchSettings.shared.voiceCues else { return true }
        guard WCSession.isSupported() else { return false }
        let s = WCSession.default
        guard s.activationState == .activated, s.isReachable else { return false }
        var msg: [String: Any] = ["cue": trigger]
        if let text { msg["text"] = text }
        // ⚠️ THIS RETURNS TRUE ON *SEND*, NOT ON SPEECH, AND THAT IS DELIBERATE — BUT IT NEEDS AN ACK
        // BEHIND IT. Every caller reads the Bool as "the phone has this, stay quiet", so when the phone
        // was reachable but played nothing the two halves were each silent for a different reason and
        // neither knew: the phone because its cue map was empty and its page suspended, the wrist
        // because it believed the phone had handled it. That is what "only said the start but then
        // nothing after" sounded like from the outside.
        //
        // We cannot wait for the reply — the caller needs an answer now, and blocking the wrist on the
        // phone would be worse than either failure. So the ack arrives late and is acted on late: if
        // the phone says it did NOT play, the wrist speaks the line itself. A synthesised line a second
        // after the moment is a poor coach; silence for a whole run is not a coach at all.
        s.sendMessage(msg, replyHandler: { [weak self] reply in
            let played = (reply["played"] as? Bool) ?? true
            guard !played else { return }
            Task { @MainActor in self?.voice?.fallback(for: trigger, text: text) }
        }, errorHandler: { [weak self] _ in
            // Unreachable after all — the wrist owns it.
            Task { @MainActor in self?.voice?.fallback(for: trigger, text: text) }
        })
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
        // Always stated, never conditional: the phone names the lock-screen card from this, and a
        // free run must say "Free run", not inherit today's plan.
        live["title"] = plan?.title ?? "Free run"
        live["type"] = plan?.type ?? "easy"
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
    /// Time spent paused, subtracted from the wall clock so a pause actually stops the clock.
    private var pausedAccum: TimeInterval = 0
    private var pauseBegan: Date?
    private func autoPauseTick() {
        guard WatchSettings.shared.autoPause else { return }
        let moving = (paceSecPerKm.map { $0 < 900 } ?? false)
        if phase == .running {
            // A run that has not yet acquired GPS is not "stopped" — pausing it during the first
            // fix would strand a run that never began. Movement has to have existed to be lost.
            guard distanceMetres > 0 || paceSecPerKm != nil else { stillSince = nil; return }
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

    /// How far through the current step, 0–1, via `PlannedStep.progress` — nil for a step with no
    /// defined end (or a free run), so callers hide their bar instead of pinning it at zero.
    /// Shared by the metrics and pace pages; keep the arithmetic in one place.
    var stepProgress: Double? {
        guard let step = currentStep else { return nil }
        return step.progress(elapsed: stepElapsed, metresDone: stepMetres)
    }

    /// Which training zone the current heart rate sits in, on the owner's reference chart's bands:
    /// zone 0 ("rest") below 50% of max, then 1–5 at 50–60 / 60–70 / 70–80 / 80–90 / 90%+.
    /// Nil when there is no ceiling to measure against or no reading yet — callers show the faint
    /// no-data heart rather than guessing.
    var hrZone: Int? {
        guard let m = maxHr, m > 60, heartRate > 0 else { return nil }
        let pct = heartRate / Double(m)
        if pct < 0.50 { return 0 }
        if pct < 0.60 { return 1 }
        if pct < 0.70 { return 2 }
        if pct < 0.80 { return 3 }
        if pct < 0.90 { return 4 }
        return 5
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

    /// The route so far: every point kept, with the newest credited fix last.
    ///
    /// ⚠️ ONE DEFINITION, AND `summaryPayload` READS THIS RATHER THAN `routePoints`. The payload used
    /// to read the array directly, so the provisional tail added below would have shown on the
    /// watch's own map and been missing from the run the phone stores — two builders of one route,
    /// which is the fault this project has now shipped four times over.
    var route: [[Double]] {
        guard let tail = routeTail else { return routePoints }
        return routePoints + [tail]
    }

    /// The most points the wrist will hold.
    ///
    /// ⚠️ THIS AND THE PHONE'S OWN CAP ARE A DELIBERATE PAIR AND NEITHER CAN BE DELETED AS A
    /// DUPLICATE OF THE OTHER. They bound different things:
    ///
    ///   • 600 here bounds MEMORY AND THE PAYLOAD. A three-hour run is about 10,800 fixes, and an
    ///     unbounded array is the one thing on the watch that grows for as long as somebody keeps
    ///     running; 10,800 pairs is also far more than one `transferUserInfo` should be asked to
    ///     carry. The wrist thins AS IT GOES and cannot know how long the run will turn out to be, so
    ///     it keeps headroom — thinning to the phone's 150 in flight would leave a ten-minute run
    ///     with 150 points when 600 cost nothing, and there is no way to get the detail back.
    ///   • 150 on the phone (`ROUTE_MAX_POINTS`, applied by `downsampleRoute` at ingest and again on
    ///     the phone's own save) bounds WHAT IS STORED, because localStorage holds fifty runs and the
    ///     route is the largest field on one. It thins ONCE, with the whole run in hand, which is why
    ///     it can afford to be the tighter of the two.
    ///
    /// Exactly the division the heart-rate trace already uses: sampled every five seconds here,
    /// downsampled to 160 on the way out, and re-capped at 160 by the phone at ingest.
    private static let routeMaxPoints = 600

    /// Running seconds at the instant a fix was TAKEN, which is the number Strava reads to derive
    /// pace, moving time and splits.
    ///
    /// ⚠️ PAUSED TIME IS SUBTRACTED, because otherwise a runner who waits at a crossing gets a
    /// straight line through the junction at walking pace — the phone's own route push carries the same
    /// warning against `Date.now()` minus a start, and `elapsed` on this class subtracts `pausedAccum`
    /// for exactly this reason.
    ///
    /// ⚠️ AND IT IS THE FIX'S OWN CLOCK, NOT THE MOMENT IT IS PROCESSED. A batch delivered when the
    /// watch next gets a moment to breathe would otherwise share one identical time, which is the
    /// collapsed-batch lie the phone already records fixing: ten quiet minutes as one instant, in the
    /// one field the whole point of storing a time was to keep honest.
    ///
    /// ⚠️ STATIC AND PURE ON PURPOSE, SO IT CAN BE EXECUTED RATHER THAN READ. The pause attribution is
    /// the whole subtlety of this feature and a source-text guard cannot see it; taking the two pieces
    /// of state as arguments is what lets `test/watch-route-swift.test.ts` lift this function on its own
    /// and drive real pauses through it.
    static func routeSecondsAt(_ when: Date, started: Date?, pausedSoFar: TimeInterval) -> Double {
        guard let started else { return 0 }
        // Whole seconds, and ROUNDED rather than truncated: a GPX trackpoint carries no fraction once
        // the payload strips the milliseconds, so a fraction stored here is a fraction thrown away
        // later — and the phone's own route push rounds for the same reason.
        return max(0, (when.timeIntervalSince(started) - pausedSoFar).rounded())
    }

    /// Where the runner was, and when in the run they were there.
    ///
    /// ⚠️ ONE BUILDER, so the shape of a route point is decided in one place. A second call site
    /// assembling a bare pair by hand would be refused by `appendRoutePoint` and the route would
    /// silently vanish — the shape and the time have to arrive together or not at all.
    private func routeSample(_ loc: CLLocation) -> [Double] {
        return [
            (loc.coordinate.latitude * 100000).rounded() / 100000,
            (loc.coordinate.longitude * 100000).rounded() / 100000,
            Self.routeSecondsAt(loc.timestamp, started: startedAt, pausedSoFar: pausedAccum),
        ]
    }

    /// Record a point of the run's shape, thinning rather than truncating when the buffer is full.
    private func appendRoutePoint(_ pt: [Double]) {
        // ⚠️ A POINT WE CANNOT PLACE IN TIME IS NOT A POINT. Both halves are load-bearing and neither
        // is defensive padding: a triple is required because a bare pair would reach Strava inside an
        // otherwise-timed route and be silently dropped there instead, leaving a map with a hole in it;
        // and the time must be strictly LATER than the last one accepted, which is what refuses the
        // mid-pause fixes CoreLocation delivers after a resume and what stops two fixes in one second
        // sharing a GPX timestamp. See `routeLastT`.
        guard pt.count >= 3, pt[2] > routeLastT else { return }
        routeLastT = pt[2]
        routeSinceKeep += 1
        // Not this one — but it is the newest ground covered, so it is held as the provisional last
        // point rather than dropped. See `routeTail`.
        guard routeSinceKeep >= routeStride else { routeTail = pt; return }
        routeSinceKeep = 0
        routeTail = nil
        if routePoints.count >= Self.routeMaxPoints { thinRoutePoints() }
        routePoints.append(pt)
    }

    /// Drop every other point, keeping the FIRST and the LAST, and halve the intake with it.
    private func thinRoutePoints() {
        let n = routePoints.count
        // A guard rather than an assumption: with a cap of two or fewer there is nothing to drop, and
        // without this the stride would stay at 1 while the array grew past its own bound forever.
        guard n > 2 else { return }
        var kept: [[Double]] = []
        kept.reserveCapacity(n / 2 + 2)
        for i in stride(from: 0, to: n, by: 2) { kept.append(routePoints[i]) }
        // The last point only needs adding when the even walk missed it. A newer point is appended
        // immediately after this returns, so the end of the run is never the thing that is lost.
        if (n - 1) % 2 != 0 { kept.append(routePoints[n - 1]) }
        routePoints = kept
        routeStride *= 2
    }

    var paceText: String {
        guard let p = paceSecPerKm, p.isFinite, p > 0, p < 3600 else { return "--:--" }
        // Rounded, not truncated, so the screen and the spoken sentence always name the same second
        // (the voice rounds — 697.6 was printed 11:37 and spoken "11 minutes 38", which reads as the
        // coach getting the runner's own number wrong).
        let s = Int(p.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
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
            guard phase == .running || phase == .paused else { return }
            // 25 m, not 50: a fix that vague is a circle the size of a house, and differencing
            // two of them produces "movement" out of nothing.
            let usable = locs.filter { $0.horizontalAccuracy > 0 && $0.horizontalAccuracy < 25 }
            guard !usable.isEmpty else { return }

            // Paused: pace only, so auto-resume can SEE the runner set off again. No distance, no
            // splits, no route — a pause must never bank metres.
            if phase == .paused {
                let sp = usable.last?.speed ?? -1
                paceSecPerKm = sp > 0.5 ? 1000 / sp : nil
                // The derivation baseline is held in running seconds; a pause is not one of them, so
                // it is dropped rather than left to span the pause on the next running tick.
                paceRef = nil
                return
            }

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
                    if step > 1.0 && step < 80 { gpsDistanceMetres += step; movedThisBatch = true }
                }
                lastLocation = loc
            }
            // ⚠️ ONLY DRIVE THE DISPLAY WHILE HEALTHKIT IS SILENT. Once its fused figure has arrived
            // it owns the number; writing our sum over it here would undo the whole point on the very
            // next fix, and the two would fight for the rest of the run.
            if !adoptedHealthKitDistance { distanceMetres = gpsDistanceMetres }
            // Prefer the device's own speed when it reports one; it is far steadier than
            // differentiating positions. A KNOWN standstill clears the pace — leaving the last
            // good pace in place made auto-pause blind, because "moving" read stale data forever.
            // ⚠️ THE THIRD BRANCH USED TO BE `else if !movedThisBatch`, WHICH LEFT A HOLE: no speed
            // reported AND the runner moving assigned nothing at all, so the published pace stayed at
            // whatever it was — nil from reset() for the whole run when the device never reports one.
            // The gap is filled by derivePaceIfStale() from the ticker rather than here, because the
            // honest baseline for a displacement derivation is several seconds of running, not one
            // fix. The baseline is dropped whenever the device answers, so the two never mix.
            let sp = usable.last?.speed ?? -1
            if sp > 0.5 { paceSecPerKm = 1000 / sp; paceAt = Date(); paceRef = nil }
            else if sp >= 0 { paceSecPerKm = nil; paceAt = nil; paceRef = nil }
            else if !movedThisBatch { paceSecPerKm = nil; paceAt = nil; paceRef = nil }
            recordSplits()
            // Downsampled, and only when the runner actually moved. Recording a point per fix
            // regardless drew a map out of standing-still drift — the numbers said 0.02 km and the
            // map still showed a wandering line, which is worse than showing nothing.
            // Climb, from fixes already in hand. ⚠️ Gated on verticalAccuracy: CoreLocation reports
            // a negative value when the altitude is unusable, and summing garbage would invent
            // hills. The 0.6 m step matches the phone's accumulator so a wrist run and a phone run
            // over the same hill report the same climb.
            for fix in usable where fix.verticalAccuracy >= 0 && fix.verticalAccuracy < 15 {
                if let prev = lastAltitude {
                    let d = fix.altitude - prev
                    if d > 0.6 { elevGainM += d }
                    if abs(d) > 0.6 { lastAltitude = fix.altitude }
                } else {
                    lastAltitude = fix.altitude
                }
            }
            // ⚠️ NO COUNT GATE HERE. This used to read `routePoints.count < 600`, which stopped
            // recording ten minutes into every run. The bound is kept by thinning what is already
            // held, inside appendRoutePoint, so the line always spans the whole outing.
            // ⚠️ AND THE POINT CARRIES ITS OWN TIME NOW. Built by `routeSample`, from the fix's own
            // clock and the pause total in force when the fix is seen — never assembled here, because
            // a hand-built pair is refused by the append gate and the route disappears in silence.
            if movedThisBatch, let last = usable.last {
                appendRoutePoint(routeSample(last))
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
                    if value > 0 { self.heartRateAt = Date() }
                    if mean > 0 { self.avgHeartRate = mean }
                }
            } else if quantityType == HKQuantityType(.activeEnergyBurned) {
                let kcal = stats.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                Task { @MainActor in self.activeCalories = kcal }
            } else if quantityType == HKQuantityType(.stepCount) {
                // Cumulative from the start of the workout, like the distance below — so it is a
                // TOTAL, and only its delta since the last delivery belongs to this interval.
                let steps = stats.sumQuantity()?.doubleValue(for: .count()) ?? 0
                guard steps > 0 else { continue }
                Task { @MainActor in self.tookSteps(steps) }
            } else if quantityType == HKQuantityType(.distanceWalkingRunning) {
                // ⚠️ THIS BRANCH DID NOT EXIST, AND THAT WAS THE FAULT. The data source has always
                // collected this type; nothing read it. It is a CUMULATIVE sum from the start of the
                // workout, so it is assigned, never added to.
                let metres = stats.sumQuantity()?.doubleValue(for: .meter()) ?? 0
                guard metres > 0 else { continue }
                Task { @MainActor in
                    self.adoptedHealthKitDistance = true
                    // ⚠️ NEVER BACKWARDS. A distance that decreases mid-run is worse than one that is
                    // slightly wrong: it reads as the app losing the run. HealthKit's sum can lag our
                    // own by a sample, so take the greater and let it catch up.
                    if metres > self.distanceMetres { self.distanceMetres = metres }
                    self.recordSplits()
                }
            }
        }
    }
}
