import ActivityKit
import Foundation

/// The shape of the Live Activity that shows a run on the lock screen and in the Dynamic Island.
///
/// ⚠️ This file is a member of BOTH the app target and the widget extension. The app creates and
/// updates the activity; the extension renders it. They must agree exactly, so it lives in
/// ios/InteRunShared/ rather than being copied into each.
struct RunActivityAttributes: ActivityAttributes {
    /// Everything that changes while the run is happening.
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var distanceKm: Double
        /// Seconds per kilometre, or nil before there is a usable fix.
        var paceSecPerKm: Int?
        var heartRate: Int?
        /// The step the runner is in, e.g. "Rep 3 of 4 — threshold".
        var step: String?
        var paused: Bool
        /// True when the wrist is recording, so the card can say which device owns the run.
        var onWatch: Bool
        /// The instant the elapsed clock would have read zero, i.e. now minus `elapsedSeconds`,
        /// recomputed on every push. Nil while paused, and nil from any producer that has not been
        /// taught to send one.
        ///
        /// ⚠️⚠️ THIS EXISTS BECAUSE A PUSHED CLOCK STANDS STILL WHEN THE PAGE DOES. `pushLiveActivity`
        /// is called from the web layer's own tick, and iOS throttles the web content process the
        /// moment the screen locks — so every number on the card froze together and a runner glancing
        /// at their locked phone saw a clock that had stopped, which reads as the run having stopped.
        /// A system-rendered timer needs no pushes at all: the widget counts from this anchor by
        /// itself, for as long as the card is up.
        /// ⚠️ AN ANCHOR, NOT A DURATION, and re-sent every push. Our own elapsed already subtracts
        /// paused time, so re-anchoring is what keeps the system's count equal to it — a timer started
        /// once at the beginning would run ahead by the length of every pause.
        /// ⚠️ It does NOT make the DISTANCE live. That would need a second distance accumulator in
        /// Swift, which would disagree with the run being recorded; the clock can be made honest
        /// without one, so it is.
        var runningSince: Date?

        /// The window a system timer counts over. Nil when there is nothing to count from.
        var timerRange: ClosedRange<Date>? {
            guard !paused, let from = runningSince else { return nil }
            return from...from.addingTimeInterval(24 * 60 * 60)
        }
        var elapsedText: String {
            let t = max(0, elapsedSeconds)
            return t >= 3600
                ? String(format: "%d:%02d:%02d", t / 3600, (t % 3600) / 60, t % 60)
                : String(format: "%d:%02d", t / 60, t % 60)
        }
        var distanceText: String { String(format: "%.2f", distanceKm) }
        var paceText: String {
            guard let p = paceSecPerKm, p > 0, p < 3600 else { return "--:--" }
            return String(format: "%d:%02d", p / 60, p % 60)
        }
    }

    /// Fixed for the life of the activity.
    var title: String
    var sessionType: String
    /// Which run this card belongs to, so a relaunch can adopt an existing card and keep driving it
    /// rather than ending it (which, from the background, would be permanent).
    var runId: String
}
