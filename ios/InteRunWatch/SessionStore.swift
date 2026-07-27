import Foundation
import WatchConnectivity

/// Today's session, as handed over by the phone.
///
/// The plan lives in `localStorage` inside the phone app's web view, and the watch cannot reach it.
/// So the phone extracts just today's session and pushes it across with `updateApplicationContext`,
/// which is latest-value-wins and gets delivered even if the watch app is not running — exactly the
/// semantics for "what am I doing today".
struct PlannedSession: Codable, Equatable {
    var title: String
    var type: String
    var dateIso: String
    var durationMin: Int?
    var distanceKm: Double?
    /// Prescribed pace band for the main work, seconds per km.
    var paceLow: Int?
    var paceHigh: Int?

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
    @Published var reachable = false
    /// True once we have heard from the phone at all, so the UI can tell "nothing today" apart
    /// from "we have not synced yet" — two very different things to show someone.
    @Published var hasSynced = false

    private static let cacheKey = "interun_watch_session"

    override init() {
        super.init()
        restore()
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: Self.cacheKey),
              let cached = try? JSONDecoder().decode(PlannedSession.self, from: data) else { return }
        session = cached
        hasSynced = true
    }

    fileprivate func apply(_ context: [String: Any]) {
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
