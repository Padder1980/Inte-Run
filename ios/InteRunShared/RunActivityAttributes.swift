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
}
