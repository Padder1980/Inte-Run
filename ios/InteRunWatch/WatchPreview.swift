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

        // ── The pace page ─────────────────────────────────────────────────────────────────────
        // The marker/label agreement is GEOMETRY, and CLAUDE.md's rule for geometry is to verify
        // with a known marker at a known place. These scenes are that: each pins the expected
        // marker position, so a screenshot either shows it there or the axis is wrong again.

        // The owner's reference values exactly: band 5:30–5:50, running 5:34. Expected: GOOD PACE,
        // marker inside the zone toward its fast (right) side — fraction (375−334)/70 ≈ 0.59.
        case "pace-good":
            PacePage(elapsed: "12:46", hero: ("880", "M TO GO"),
                     band: (low: 330, high: 350), verdict: .good,
                     currentSec: 334, currentText: "5:34",
                     lap: ("5:33", "LAP PACE"), stepProgress: 0.56, totalDist: "2.12 KM")

        // The bug the owner hit on a real run: band 6:15–6:50, crawling at 9:43. Expected:
        // PICK IT UP with the marker pinned at the LEFT (slow) edge. The old view pinned it at the
        // fast edge — if this screenshot ever shows the marker on the right, the mirror is back.
        case "pace-slow":
            PacePage(elapsed: "0:09", hero: ("14:50", "TO GO"),
                     band: (low: 375, high: 410), verdict: .tooSlow,
                     currentSec: 583, currentText: "9:43",
                     lap: ("--:--", "LAP PACE"), stepProgress: 0.01, totalDist: "1.91 KM")

        // Overcooking a recovery: same band, running 5:20. Expected: EASE OFF, marker pinned RIGHT.
        case "pace-fast":
            PacePage(elapsed: "31:12", hero: ("2:04", "TO GO"),
                     band: (low: 375, high: 410), verdict: .tooFast,
                     currentSec: 320, currentText: "5:20",
                     lap: ("5:24", "LAP PACE"), stepProgress: 0.84, totalDist: "6.48 KM")

        // First seconds: a target but no fix yet. No marker, no bubble, verdict says why.
        case "pace-gps":
            PacePage(elapsed: "0:04", hero: ("1.00", "KM TO GO"),
                     band: (low: 330, high: 350), verdict: .noSignal,
                     currentSec: nil, currentText: "--:--",
                     lap: ("--:--", "LAP PACE"), stepProgress: 0.0, totalDist: "0 M")

        // A free run: no step, no band, no progress — elapsed takes the hero slot.
        case "pace-feel":
            PacePage(elapsed: nil, hero: ("17:31", "ELAPSED"),
                     band: nil, verdict: .noTarget,
                     currentSec: nil, currentText: "--:--",
                     lap: ("5:41", "LAP PACE"), stepProgress: nil, totalDist: "3.08 KM")

        default:
            Text("Unknown preview scene: \(scene)").font(.caption)
        }
    }
}
#endif
