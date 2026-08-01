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

    @MainActor @ViewBuilder
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
                    // 162 against a ceiling of 182 is 89% — zone 4, so the heart wears the gold.
                    .init(value: "162", unit: "BPM", label: "HEART",
                          icon: .init(systemName: "heart.fill", tint: Brand.hrZoneTint(4))),
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
                    // No reading yet: the faint no-data heart, which must NOT look like any zone.
                    .init(value: "--", unit: "BPM", label: "HEART",
                          icon: .init(systemName: "heart.fill", tint: Brand.hrZoneTint(nil))),
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
                    // An easy-zone heart, so the ramp's cool end is seen somewhere too — zone 2 blue.
                    .init(value: "121", unit: "BPM", label: "HEART",
                          icon: .init(systemName: "heart.fill", tint: Brand.hrZoneTint(2))),
                    .init(value: "12:04", unit: nil, label: "TIME"),
                ],
                stepProgress: 0.62,
                stepLabel: "2 km at 4:55/km")

        // Heart rate as the HERO (the runner can order it first) at maximal effort — the largest
        // glyph in the zone-5 red.
        case "hr-hero":
            MetricsPage(
                status: nil,
                rows: [
                    .init(value: "178", unit: "BPM", label: "HEART",
                          icon: .init(systemName: "heart.fill", tint: Brand.hrZoneTint(5))),
                    .init(value: "4:12", unit: "/KM", label: "CUR PACE"),
                    .init(value: "0:58", unit: nil, label: "TO GO"),
                ],
                stepProgress: 0.81,
                stepLabel: "1 km at 4:15/km")

        // ── The steps page ────────────────────────────────────────────────────────────────────
        // The owner's reference screenshots, near-verbatim: his 7 km progressive long run, mid
        // first step. Current + upcoming live at the top; the whole session recaps below.
        case "steps-mid":
            StepsPage(
                status: nil,
                current: ("3.5 km at a conversational pace", nil),
                upcoming: "1 km at 5:30/km",
                title: "7km Progressive Long Run",
                subtitle: "7.0 km · 38 min",
                steps: ["3.5 km at a conversational pace",
                        "1 km at 5:30/km",
                        "1 km at 5:20/km",
                        "1 km at 5:00/km",
                        "500 m at a conversational pace"],
                currentIndex: 0)

        // Deep in the session, paused: done steps faded above, the LAST-step wording in place of
        // an upcoming one, and the status word up top.
        case "steps-last":
            StepsPage(
                status: ("Paused", Brand.ease),
                current: ("500 m at a conversational pace", "Target 6:15–6:50/km"),
                upcoming: nil,
                title: "7km Progressive Long Run",
                subtitle: "7.0 km · 38 min",
                steps: ["3.5 km at a conversational pace",
                        "1 km at 5:30/km",
                        "1 km at 5:20/km",
                        "1 km at 5:00/km",
                        "500 m at a conversational pace"],
                currentIndex: 4)

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

        // ── Settings ──────────────────────────────────────────────────────────────────────────
        // Four pages; the scene number picks the page, because a screenshot cannot swipe.
        // A fresh SessionStore is safe here: it reads its cache and shows whatever coach is stored,
        // and the preview never starts a workout.
        case "settings-run":     settingsScene(0)
        case "settings-alerts":  settingsScene(1)
        case "settings-audio":   settingsScene(2)
        case "settings-metrics": settingsScene(3)

        default:
            Text("Unknown preview scene: \(scene)").font(.caption)
        }
    }

    @MainActor
    private static func settingsScene(_ page: Int) -> some View {
        NavigationStack {
            SettingsView(initialPage: page)
                .environmentObject(SessionStore())
        }
    }
}
#endif
