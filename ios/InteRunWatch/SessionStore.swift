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
        if let s = seconds, s > 0 { return s >= 60 ? "\(s / 60) min" : "\(s) s" }
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
}

@MainActor
final class SessionStore: NSObject, ObservableObject {
    @Published var session: PlannedSession?
    /// The week ahead, so the wrist can offer a choice of runs on its own. ⚠️ Cached to disk for the
    /// same reason today's session is: the phone app is usually NOT open when someone taps start on
    /// their watch, and "open the app on your phone first" is not a running app, it is a chore.
    @Published var upcoming: [PlannedSession] = []

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

    private static let cacheKey = "interun_watch_session"
    private static let nameKey = "interun_watch_name"
    private static let upcomingKey = "interun_watch_upcoming"
    private static let whyKey = "interun_watch_why"
    private static let whyPersonKey = "interun_watch_why_person"
    private static let isoKey = "interun_watch_iso"

    static func localTodayIso() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
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
        why = UserDefaults.standard.dictionary(forKey: Self.whyKey) as? [String: String] ?? [:]
        whyPerson = UserDefaults.standard.string(forKey: Self.whyPersonKey)
        contextIso = UserDefaults.standard.string(forKey: Self.isoKey)
        guard let data = UserDefaults.standard.data(forKey: Self.cacheKey),
              let cached = try? JSONDecoder().decode(PlannedSession.self, from: data) else { return }
        session = cached
        hasSynced = true
    }

    fileprivate func apply(_ context: [String: Any]) {
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
        why = (context["why"] as? [String: String])?.filter { !$0.value.isEmpty } ?? [:]
        UserDefaults.standard.set(why, forKey: Self.whyKey)
        whyPerson = (context["whyName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        UserDefaults.standard.set(whyPerson, forKey: Self.whyPersonKey)
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
    nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        let ctx = session.receivedApplicationContext
        Task { @MainActor in
            self.reachable = session.isReachable
            if !ctx.isEmpty { self.apply(ctx) }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.apply(applicationContext) }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let r = session.isReachable
        Task { @MainActor in self.reachable = r }
    }
}
