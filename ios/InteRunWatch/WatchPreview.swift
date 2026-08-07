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
                elapsed: "12:04",
                rows: [
                    .init(value: "1.42", unit: "KM", label: "DISTANCE"),
                    .init(value: "4:58", unit: "/KM", label: "CUR PACE"),
                    // 162 against a ceiling of 182 is 89% — zone 4, so the heart wears the gold.
                    .init(value: "162", unit: "BPM", label: "HEART",
                          icon: .init(systemName: "heart.fill", tint: Brand.hrZoneTint(4))),
                    .init(value: "5:12", unit: "/KM", label: "AVG PACE"),
                ],
                stepProgress: 0.62,
                stepLabel: "2 km at 4:55/km")

        // Paused, which must be unmistakable: the status word AND the hero take the amber.
        case "paused":
            MetricsPage(
                status: ("Paused", Brand.ease),
                elapsed: "12:04",
                rows: [
                    .init(value: "1.42", unit: "KM", label: "DISTANCE"),
                    .init(value: "4:58", unit: "/KM", label: "CUR PACE"),
                    .init(value: "162", unit: "BPM", label: "HEART"),
                    .init(value: "148", unit: "CAL", label: "CALORIES"),
                ],
                stepProgress: 0.08,
                // ⚠️ THE REAL CUE HE PHOTOGRAPHED, at full length. The preview used a four-word
                // label, which fits on one line and so could never show the truncation he reported —
                // "EASE IN — START GENTLY AND LET THE…". A fixture that only exercises the easy case
                // is why a legibility fault survived being "verified".
                stepLabel: "Ease in — start gently and let the legs come to you")

        // The first seconds of a run, when pace is genuinely unknown and everything is empty. The
        // layout must not collapse or jump when the real numbers arrive.
        case "cold-start":
            MetricsPage(
                status: nil,
                elapsed: "12:04",
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
                elapsed: "12:04",
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
                elapsed: "12:04",
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
                elapsed: "12:04",
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

        // ── Home ──────────────────────────────────────────────────────────────────────────────
        // Seeded by setting the store's published fields DIRECTLY — apply() would persist to
        // UserDefaults and leave fake sessions haunting the simulator's real cache.
        case "home-today":    homeScene(0)
        // The FOOT of the today page: the card's pace row, its Start button and Settings — all of
        // which "home-today" cuts off. Measured: Free run and the card's Start are ~236pt apart on
        // a ~213pt scrollport, so NO anchor can show both in one shot; do not add a scene claiming
        // otherwise.
        case "home-today-bottom": homeScene(0, anchor: .bottom)
        case "home-upcoming": homeScene(1)

        // ── Session detail ────────────────────────────────────────────────────────────────────
        // One scrollable page. Start is at the TOP (owner's call), so "detail" is the scene that
        // shows the button, with the pace/effort facts under it; "detail-bottom" anchors at the
        // tail of the step list, which is otherwise permanently below the fold.
        case "detail":
            NavigationStack {
                SessionDetailView(session: intervalSession, start: {}, previewInert: true)
            }
        case "detail-bottom":
            NavigationStack {
                SessionDetailView(session: intervalSession, start: {},
                                  previewInert: true, previewAnchor: .bottom)
            }
        // The other shape of session: an easy day, whose steps are long sentences rather than
        // rep labels. It used to seed steps: nil to exercise the empty branch — but real sync data
        // can never produce that (watchSessionPayload always sends an array, and every engine
        // session has steps), so the screenshot showed "no set structure" for a session that
        // really lists four, and the actual easy-run detail was never looked at.
        case "detail-easy":
            NavigationStack {
                SessionDetailView(session: easySession, start: {}, previewInert: true)
            }
        // A mobility day: reaches the wrist like any other session, but must NOT offer Start.
        case "detail-mobility":
            NavigationStack {
                SessionDetailView(
                    session: PlannedSession(
                        title: "Mobility flow (15′)", type: "mobility",
                        dateIso: SessionStore.localTodayIso(),
                        durationMin: 15, distanceKm: nil, paceLow: nil, paceHigh: nil,
                        rpeMin: nil, rpeMax: nil,
                        steps: [PlannedStep(label: "Hip openers, ankle mobility, thoracic rotations",
                                            kind: "steady", seconds: 900, metres: nil,
                                            paceLow: nil, paceHigh: nil,
                                            repIndex: nil, repCount: nil)]),
                    start: {}, previewInert: true)
            }
        case "detail-easy-bottom":
            NavigationStack {
                SessionDetailView(session: easySession, start: {},
                                  previewInert: true, previewAnchor: .bottom)
            }

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

    /// A real structured session, shared by the home and detail scenes.
    ///
    /// ⚠️ Labels, durations and pace bands are copied from what the ENGINE actually emits for a
    /// thr-3×8 (src/plan/session-templates.ts), not invented. A seed that writes its own short
    /// labels ("Warm up easy") makes the screenshots lie about wrapping — the real warm-up is 65
    /// characters and takes three lines — and a 90″ recovery is what exposed the minute-rounding
    /// bug. Same principle the type strings already follow further down.
    @MainActor
    private static var intervalSession: PlannedSession {
        PlannedSession(
            title: "Threshold 3 × 8′", type: "threshold", dateIso: SessionStore.localTodayIso(),
            durationMin: 52, distanceKm: 8.6, paceLow: 305, paceHigh: 320,
            rpeMin: 6, rpeMax: 7,
            steps: [
                PlannedStep(label: "Easy jog, dynamic leg swings/drills, then 4–6 progressive strides",
                            kind: "warmup", seconds: 900, metres: nil,
                            paceLow: 366, paceHigh: 399, repIndex: nil, repCount: nil),
                PlannedStep(label: "8′ rep", kind: "rep", seconds: 480, metres: nil,
                            paceLow: 305, paceHigh: 320, repIndex: 1, repCount: 3),
                PlannedStep(label: "Easy jog recovery", kind: "recovery", seconds: 90, metres: nil,
                            paceLow: 366, paceHigh: 399, repIndex: nil, repCount: nil),
                PlannedStep(label: "8′ rep", kind: "rep", seconds: 480, metres: nil,
                            paceLow: 305, paceHigh: 320, repIndex: 2, repCount: 3),
                PlannedStep(label: "Easy jog recovery", kind: "recovery", seconds: 90, metres: nil,
                            paceLow: 366, paceHigh: 399, repIndex: nil, repCount: nil),
                PlannedStep(label: "8′ rep", kind: "rep", seconds: 480, metres: nil,
                            paceLow: 305, paceHigh: 320, repIndex: 3, repCount: 3),
                PlannedStep(label: "Easy jog to finish", kind: "cooldown", seconds: 600, metres: nil,
                            paceLow: 366, paceHigh: 420, repIndex: nil, repCount: nil),
            ])
    }

    /// The easy+strides day as the engine really builds it: framedRun gives ease-in, the
    /// conversational middle, the strides block, then ease-down — four steps, never nil.
    @MainActor
    private static var easySession: PlannedSession {
        PlannedSession(
            title: "45′ easy + strides", type: "strides", dateIso: SessionStore.localTodayIso(),
            durationMin: 47, distanceKm: 7.5, paceLow: 366, paceHigh: 399,
            rpeMin: 2, rpeMax: 3,
            steps: [
                PlannedStep(label: "Ease in — start gently and let the pace come to you",
                            kind: "warmup", seconds: 360, metres: nil,
                            paceLow: 366, paceHigh: 399, repIndex: nil, repCount: nil),
                PlannedStep(label: "Conversational easy running (below the first threshold)",
                            kind: "steady", seconds: 2100, metres: nil,
                            paceLow: 366, paceHigh: 399, repIndex: nil, repCount: nil),
                PlannedStep(label: "6 × 20s relaxed strides, full recovery",
                            kind: "rep", seconds: 120, metres: nil,
                            paceLow: 255, paceHigh: 270, repIndex: nil, repCount: 6),
                PlannedStep(label: "Ease down — relax the pace and let your breathing settle",
                            kind: "cooldown", seconds: 240, metres: nil,
                            paceLow: 366, paceHigh: 399, repIndex: nil, repCount: nil),
            ])
    }

    @MainActor
    private static func homeScene(_ page: Int, anchor: UnitPoint? = nil) -> some View {
        let store = SessionStore()
        let today = SessionStore.localTodayIso()
        store.runnerName = "Adam"
        store.contextIso = today
        store.hasSynced = true
        store.session = intervalSession
        // Types are the engine's REAL SessionType strings — a seed that invents its own types
        // (the first draft typed an "easy + strides" day as "easy") masks colour-map bugs in the
        // very screenshots meant to catch them.
        // ⚠️ Steps are never nil in real data — watchSessionPayload always sends the array and
        // every engine session has steps — so seeding nil here would let a card open onto the
        // "no detail" branch that a real runner can never reach.
        var easyAhead = easySession; easyAhead.dateIso = "2099-01-02"
        var longAhead = easySession
        longAhead.dateIso = "2099-01-04"; longAhead.title = "Long run 14 km"
        longAhead.type = "long"; longAhead.durationMin = 84; longAhead.distanceKm = 14
        var vo2Ahead = intervalSession
        vo2Ahead.dateIso = "2099-01-06"; vo2Ahead.title = "VO2 6 × 3′"
        vo2Ahead.type = "vo2"; vo2Ahead.durationMin = 48; vo2Ahead.distanceKm = 8
        store.upcoming = [store.session!, easyAhead, longAhead, vo2Ahead]
        // previewInert: the buttons render but refuse to start — a preview that can start a
        // workout is a preview that can log a fictional run.
        return TodayView(initialPage: page, previewInert: true, previewAnchor: anchor)
            .environmentObject(store)
    }
}
#endif
