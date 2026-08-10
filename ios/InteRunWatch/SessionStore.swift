import Foundation
import WatchConnectivity

/// Today's session, as handed over by the phone.
///
/// The plan lives in `localStorage` inside the phone app's web view, and the watch cannot reach it.
/// So the phone extracts just today's session and pushes it across with `updateApplicationContext`,
/// which is latest-value-wins and gets delivered even if the watch app is not running — exactly the
/// semantics for "what am I doing today".
/// One block of the session, as the plan prescribes it — this is what makes the wrist a coach
/// rather than a stopwatch. Apple's Workout app can hold a target you typed in; this holds the
/// target your plan worked out for you.
struct PlannedStep: Codable, Equatable, Identifiable {
    var label: String
    var kind: String
    var seconds: Int?
    var metres: Int?
    var paceLow: Int?
    var paceHigh: Int?
    var repIndex: Int?
    var repCount: Int?

    var id: String { "\(label)|\(kind)|\(seconds ?? 0)|\(metres ?? 0)|\(repIndex ?? 0)" }

    /// How far through this step we are, 0...1, or nil for a step with no defined end.
    func progress(elapsed: TimeInterval, metresDone: Double) -> Double? {
        if let s = seconds, s > 0 { return min(1, elapsed / Double(s)) }
        if let m = metres, m > 0 { return min(1, metresDone / Double(m)) }
        return nil
    }

    var goalText: String? {
        if let m = metres, m > 0 {
            return m >= 1000 ? String(format: "%.1f km", Double(m) / 1000) : "\(m) m"
        }
        if let s = seconds, s > 0 {
            if s < 60 { return "\(s) s" }
            // ⚠️ NOT `s / 60` minutes: that is integer division, so a 90″ recovery printed as
            // "1 min" — a third short, directly beneath a step the plan literally labels 90″, on a
            // page whose whole job is telling the runner what the session is. The library is full
            // of 90″ jogs, 2′30 jogs and Mona-fartlek 90/60/30/15s.
            return s % 60 == 0 ? "\(s / 60) min" : String(format: "%d:%02d", s / 60, s % 60)
        }
        return nil
    }
}

struct PlannedSession: Codable, Equatable {
    var title: String
    var type: String
    var dateIso: String
    var durationMin: Int?
    var distanceKm: Double?
    /// Prescribed pace band for the main work, seconds per km.
    var paceLow: Int?
    var paceHigh: Int?
    var rpeMin: Int?
    var rpeMax: Int?
    var steps: [PlannedStep]?

    var paceText: String? {
        guard let lo = paceLow, let hi = paceHigh else { return nil }
        return "\(Self.mmss(lo))–\(Self.mmss(hi))/km"
    }

    static func mmss(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }

    var subtitle: String {
        var bits: [String] = []
        if let d = durationMin { bits.append("\(d) min") }
        if let k = distanceKm { bits.append(String(format: "%.1f km", k)) }
        return bits.joined(separator: " · ")
    }

    /// "Wed 29 Jul" from dateIso. On the session rather than in a view, because the home cards and
    /// the detail page both need it and two DateFormatters would drift.
    var dayLabel: String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        guard let d = f.date(from: dateIso) else { return dateIso }
        let out = DateFormatter(); out.dateFormat = "EEE d MMM"; out.timeZone = .current
        return out.string(from: d)
    }

    /// Can this session be RUN? Mirrors the phone's `PRIMARY_TYPES` (web/app.ts) exactly.
    ///
    /// ⚠️ Strength and mobility days reach the watch — `rawSessionsForIso` filters out only `rest`,
    /// and the generator puts a mobility session on a free day most weeks — and the phone refuses
    /// to offer Start for them on both of its own surfaces. The watch had no such gate, so tapping
    /// Start on a mobility day opened an HKWorkoutSession with `activityType = .running` and
    /// outdoor GPS, and a bodyweight routine was logged as a run: fabricated distance in the
    /// Logbook, and for strength (which carries an RPE band) evidence fed to the adaptive engine.
    /// Keep this list in step with PRIMARY_TYPES.
    var isRunnable: Bool {
        ["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"].contains(type)
    }

    /// How hard the plan says this should feel, as words plus the numbers. RPE is InteRun's own
    /// signal — it is what the adaptive engine later compares against — so the runner should see
    /// the intended effort before they start, not only be asked for it afterwards.
    var effortText: String? {
        guard let lo = rpeMin, let hi = rpeMax, lo > 0 else { return nil }
        let word: String
        switch hi {
        case ...3: word = "Easy"
        case 4...6: word = "Moderate"
        default: word = "Hard"
        }
        return lo == hi ? "\(word) · \(lo) of 10" : "\(word) · \(lo)–\(hi) of 10"
    }
}

@MainActor
final class SessionStore: NSObject, ObservableObject {
    @Published var session: PlannedSession?
    /// The week ahead, so the wrist can offer a choice of runs on its own. ⚠️ Cached to disk for the
    /// same reason today's session is: the phone app is usually NOT open when someone taps start on
    /// their watch, and "open the app on your phone first" is not a running app, it is a chore.
    @Published var upcoming: [PlannedSession] = []

    /// Which coach the runner picked on the phone, and that coach's own wordings.
    @Published var coach: String?
    @Published var coachLines: [String: String] = [:]

    /// The runner's first name, so the watch can speak to a person rather than a device.
    @Published var runnerName: String?
    /// The runner's own answers to "why are you doing this" — spoken back at the hardest point of a
    /// long run. Keyed by question ("inspire", "reason", "goal", "anchor").
    @Published var why: [String: String] = [:]
    /// The person behind it all, if they named one. The phone can only say this aloud when a voice
    /// pack was recorded for the name; the watch synthesises speech live, so it always can.
    @Published var whyPerson: String?
    @Published var reachable = false
    /// True once we have heard from the phone at all, so the UI can tell "nothing today" apart
    /// from "we have not synced yet" — two very different things to show someone.
    @Published var hasSynced = false

    /// The local date the last context described, so yesterday's session is never shown as today's.
    @Published var contextIso: String?

    /// Estimated max heart rate, sent by the phone (it owns the estimate — 220−age today, a real
    /// measurement some day). The wrist only uses it to colour the heart by training zone.
    @Published var maxHr: Int?

    private static let cacheKey = "interun_watch_session"
    private static let nameKey = "interun_watch_name"
    private static let upcomingKey = "interun_watch_upcoming"
    private static let coachKey = "interun_watch_coach"
    private static let coachLinesKey = "interun_watch_coach_lines"
    private static let whyKey = "interun_watch_why"
    private static let whyPersonKey = "interun_watch_why_person"
    private static let isoKey = "interun_watch_iso"
    private static let maxHrKey = "interun_watch_maxhr"

    static func localTodayIso() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }

    /// The session the phone has told us to get ready for. Nil once it has been consumed.
    @Published var pendingSession: PlannedSession?
    /// Fired when the phone's count-in reaches go.
    var onStartNow: (() -> Void)? {
        didSet { if pendingGo, let go = onStartNow { pendingGo = false; go() } }
    }
    /// A go that arrived before anyone was listening.
    private var pendingGo = false

    /// The phone's own run, while the watch is only watching. Nil when the phone is not recording.
    @Published var phoneLive: [String: Double]?
    @Published var phoneLiveTitle: String?
    /// When the last phone tick arrived, and whether the phone's clock was advancing — so the watch can
    /// FILL the seconds between the phone's ~2s ticks instead of jumping in 2s steps (the phone smooths
    /// its own mirror the same way). Advancing seconds mean running; a repeated value means paused, and
    /// the filled clock then freezes rather than creeping past the phone and snapping back every 2s.
    @Published var phoneLiveAt: Date?
    @Published var phoneLiveRunning = false

    /// Set by whatever is running the workout, so a phone command reaches it. Nil when nothing is
    /// running, which makes a stray command a no-op rather than a crash.
    var onStopRequested: (() -> Void)?
    var onPauseRequested: (() -> Void)?
    var onResumeRequested: (() -> Void)?

    /// Today's session taken from the cached week, for when the context itself has gone stale.
    var todayFromCache: PlannedSession? {
        upcoming.first { $0.dateIso == Self.localTodayIso() }
    }

    /// Ask the phone for the plan.
    ///
    /// `sendMessage` is the one channel that makes iOS wake the containing app in the BACKGROUND,
    /// which is the whole point: the runner is at the front door and their phone is in a drawer.
    /// The phone answers from its own persisted cache, so it does not need the web view running.
    func requestSync() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isCompanionAppInstalled else { return }
        session.sendMessage(["request": "sync"], replyHandler: { [weak self] reply in
            guard !reply.isEmpty else { return }
            Task { @MainActor in self?.apply(reply) }
        }, errorHandler: { error in
            // Nothing to do and nothing to say: the watch already offers a free run, and the
            // context may still arrive on its own later.
            _ = error
        })
    }

    /// Sessions still ahead of us, freshest first — yesterday's leftovers are filtered out rather
    /// than offered, since a stale list is worse than a short one.
    var upcomingAhead: [PlannedSession] {
        let today = Self.localTodayIso()
        return upcoming.filter { $0.dateIso >= today }
    }

    /// True while the stored context still describes today. A context without a date (older phone
    /// build) is trusted, so the two sides can be updated independently.
    var isCurrent: Bool { contextIso == nil || contextIso == Self.localTodayIso() }

    override init() {
        super.init()
        restore()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    private func restore() {
        runnerName = UserDefaults.standard.string(forKey: Self.nameKey)
        if let up = UserDefaults.standard.data(forKey: Self.upcomingKey),
           let list = try? JSONDecoder().decode([PlannedSession].self, from: up) {
            upcoming = list
        }
        coach = UserDefaults.standard.string(forKey: Self.coachKey)
        coachLines = UserDefaults.standard.dictionary(forKey: Self.coachLinesKey) as? [String: String] ?? [:]
        why = UserDefaults.standard.dictionary(forKey: Self.whyKey) as? [String: String] ?? [:]
        whyPerson = UserDefaults.standard.string(forKey: Self.whyPersonKey)
        contextIso = UserDefaults.standard.string(forKey: Self.isoKey)
        let storedMax = UserDefaults.standard.integer(forKey: Self.maxHrKey)
        maxHr = storedMax > 0 ? storedMax : nil
        guard let data = UserDefaults.standard.data(forKey: Self.cacheKey),
              let cached = try? JSONDecoder().decode(PlannedSession.self, from: data) else { return }
        session = cached
        hasSynced = true
    }

    func apply(_ context: [String: Any]) {
        if let iso = context["dateIso"] as? String, !iso.isEmpty {
            contextIso = iso
            UserDefaults.standard.set(iso, forKey: Self.isoKey)
        }
        if let n = context["name"] as? String, !n.isEmpty {
            runnerName = n
            UserDefaults.standard.set(n, forKey: Self.nameKey)
        }
        // Absent keys mean "the runner cleared these", so both are written every sync rather than
        // only when present — otherwise a deleted answer would live on the wrist forever.
        if let raw = context["upcoming"],
           let data = try? JSONSerialization.data(withJSONObject: raw),
           let list = try? JSONDecoder().decode([PlannedSession].self, from: data) {
            upcoming = list
            UserDefaults.standard.set(data, forKey: Self.upcomingKey)
        }
        // Absent means voice coaching is switched off on the phone, so these are cleared rather
        // than left behind — the wrist must not keep speaking as a coach the runner has turned off.
        coach = context["coach"] as? String
        UserDefaults.standard.set(coach, forKey: Self.coachKey)
        coachLines = (context["coachLines"] as? [String: String]) ?? [:]
        UserDefaults.standard.set(coachLines, forKey: Self.coachLinesKey)
        why = (context["why"] as? [String: String])?.filter { !$0.value.isEmpty } ?? [:]
        UserDefaults.standard.set(why, forKey: Self.whyKey)
        whyPerson = (context["whyName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        UserDefaults.standard.set(whyPerson, forKey: Self.whyPersonKey)
        // Written every sync like coach/why: an absent key means the phone no longer has an age to
        // estimate from, and a stale ceiling misclassifying every zone is worse than no zones.
        maxHr = (context["maxHr"] as? Int).flatMap { $0 > 0 ? $0 : nil }
        if let m = maxHr { UserDefaults.standard.set(m, forKey: Self.maxHrKey) }
        else { UserDefaults.standard.removeObject(forKey: Self.maxHrKey) }
        guard let raw = context["session"] else {
            // An explicit empty payload means "nothing planned today" — not a failure to sync.
            session = nil
            hasSynced = true
            UserDefaults.standard.removeObject(forKey: Self.cacheKey)
            return
        }
        guard let data = try? JSONSerialization.data(withJSONObject: raw),
              let decoded = try? JSONDecoder().decode(PlannedSession.self, from: data) else { return }
        session = decoded
        hasSynced = true
        UserDefaults.standard.set(data, forKey: Self.cacheKey)
    }
}

extension SessionStore: WCSessionDelegate {
    nonisolated func sessionCompanionAppInstalledDidChange(_ session: WCSession) {
        Task { @MainActor in self.requestSync() }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let ctx = session.receivedApplicationContext
        Task { @MainActor in
            self.reachable = session.isReachable
            if !ctx.isEmpty { self.apply(ctx) }
            // Nothing cached and nothing waiting: ask. This is what stops a freshly installed watch
            // sitting on "Waiting for your plan" until the phone app happens to be opened.
            if !self.isCurrent || !self.hasSynced { self.requestSync() }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.apply(applicationContext) }
    }

    /// Commands from the phone. Only one so far, and it is the one that matters: finish the run.
    /// Someone who has their phone out should not have to find their watch to stop.
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        // The exact session the phone is starting. Held, not run, until "startNow" arrives — the
        // phone counts us in and owns the moment the clock starts, so both devices agree on it.
        if let raw = message["pendingSession"],
           let data = try? JSONSerialization.data(withJSONObject: raw),
           let decoded = try? JSONDecoder().decode(PlannedSession.self, from: data) {
            Task { @MainActor in self.pendingSession = decoded }
            return
        }
        if let live = message["phoneLive"] as? [String: Any] {
            let nums = live.compactMapValues { $0 as? Double }
            let title = live["title"] as? String
            Task { @MainActor in
                let prev = self.phoneLive?["sec"]
                if let newSec = nums["sec"] { self.phoneLiveRunning = prev.map { newSec > $0 } ?? true }
                self.phoneLive = nums
                self.phoneLiveTitle = title
                self.phoneLiveAt = Date()
            }
            return
        }
        guard let action = message["command"] as? String else { return }
        Task { @MainActor in
            switch action {
            case "startNow":
                if let raw = message["session"],
                   let data = try? JSONSerialization.data(withJSONObject: raw),
                   let decoded = try? JSONDecoder().decode(PlannedSession.self, from: data) {
                    self.pendingSession = decoded
                }
                // The go can beat TodayView installing its handler (both race app launch). Hold it;
                // the handler fires it on installation instead of it evaporating.
                if let go = self.onStartNow { go() } else { self.pendingGo = true }
            case "companionStart":
                LaunchRequest.shared.requestCompanion()
                // The sensor switch: continuous heart rate only flows inside a workout session,
                // so a discard-only one runs for the life of the phone's run.
                CompanionSession.shared.start()
            case "companionEnd":
                LaunchRequest.shared.endCompanion()
                CompanionSession.shared.stop()
                // Stop the filled clock: without this the interpolation would keep ticking against a
                // stale arrival time if the companion view lingered.
                self.phoneLive = nil; self.phoneLiveTitle = nil; self.phoneLiveRunning = false
            case "stop": self.onStopRequested?()
            case "pause": self.onPauseRequested?()
            case "resume": self.onResumeRequested?()
            default: break
            }
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let r = session.isReachable
        Task { @MainActor in
            self.reachable = r
            if r, !self.isCurrent || !self.hasSynced { self.requestSync() }
        }
    }
}
