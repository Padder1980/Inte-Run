#if DEBUG
import SwiftUI

/// A DEBUG-only way to put a run screen on the simulator without a run.
///
/// Why this exists: the live numbers page is the screen legibility matters most on, and it was the
/// one screen nobody could look at while designing. Reaching it needs a real `HKWorkoutSession`,
/// GPS and a plan from the phone, and `xcrun simctl` can screenshot a watch simulator but cannot tap
/// it — so there was no way to see the layout, let alone compare two versions of it.
///
/// Launch with:
///     xcrun simctl launch <device> com.interun.app.watchkitapp -InteRunWatchPreview mid-run
///
/// ⚠️ Wrapped in `#if DEBUG`, so it cannot reach a release build or the App Store. It is a viewer
/// only: it renders `MetricsPage` from fixed strings and owns no workout, no HealthKit session and no
/// location manager. It must never be given the ability to start one — a preview that can start a
/// real workout is a preview that can log a fictional run.
enum WatchPreview {
    /// The scene to show, or nil for a normal launch. Read once at startup.
    static var requested: String? {
        guard let i = ProcessInfo.processInfo.arguments.firstIndex(of: "-InteRunWatchPreview"),
              i + 1 < ProcessInfo.processInfo.arguments.count else { return nil }
        return ProcessInfo.processInfo.arguments[i + 1]
    }

    @ViewBuilder
    static func view(_ scene: String) -> some View {
        switch scene {
        // Mid-interval: the moment the screen has to work hardest. Deliberately awkward values —
        // a four-character pace, a three-digit heart rate, a distance that has passed 1 km — because
        // a layout that only survives "0:00" and "--" has not been tested.
        case "mid-run":
            MetricsPage(
                status: nil,
                rows: [
                    .init(value: "1.42", unit: "KM", label: "DISTANCE"),
                    .init(value: "4:58", unit: "/KM", label: "CUR PACE"),
                    .init(value: "162", unit: "BPM", label: "HEART"),
                    .init(value: "12:04", unit: nil, label: "TIME"),
                ],
                stepProgress: 0.62,
                stepLabel: "2 km at 4:55/km")

        // Paused, which must be unmistakable: the status word AND the hero take the amber.
        case "paused":
            MetricsPage(
                status: ("Paused", Brand.ease),
                rows: [
                    .init(value: "1.42", unit: "KM", label: "DISTANCE"),
                    .init(value: "4:58", unit: "/KM", label: "CUR PACE"),
                    .init(value: "162", unit: "BPM", label: "HEART"),
                ],
                stepProgress: 0.62,
                stepLabel: "2 km at 4:55/km")

        // The first seconds of a run, when pace is genuinely unknown and everything is empty. The
        // layout must not collapse or jump when the real numbers arrive.
        case "cold-start":
            MetricsPage(
                status: nil,
                rows: [
                    .init(value: "0", unit: "M", label: "DISTANCE"),
                    .init(value: "--", unit: "/KM", label: "CUR PACE"),
                    .init(value: "--", unit: "BPM", label: "HEART"),
                    .init(value: "0:03", unit: nil, label: "TIME"),
                ],
                stepProgress: 0.0,
                stepLabel: "1 km warm up")

        // A free run: no plan, so no step and no progress bar at all.
        case "free-run":
            MetricsPage(
                status: nil,
                rows: [
                    .init(value: "3.08", unit: "KM", label: "DISTANCE"),
                    .init(value: "5:41", unit: "/KM", label: "AVG PACE"),
                    .init(value: "17:31", unit: nil, label: "TIME"),
                ],
                stepProgress: nil,
                stepLabel: nil)

        // Five metrics, the maximum Settings allows — the tightest the page ever gets.
        case "five-metrics":
            MetricsPage(
                status: nil,
                rows: [
                    .init(value: "1.42", unit: "KM", label: "DISTANCE"),
                    .init(value: "4:58", unit: "/KM", label: "CUR PACE"),
                    .init(value: "5:12", unit: "/KM", label: "AVG PACE"),
                    .init(value: "162", unit: "BPM", label: "HEART"),
                    .init(value: "12:04", unit: nil, label: "TIME"),
                ],
                stepProgress: 0.62,
                stepLabel: "2 km at 4:55/km")

        default:
            Text("Unknown preview scene: \(scene)").font(.caption)
        }
    }
}
#endif
