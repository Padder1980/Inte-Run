import SwiftUI
import WatchKit

/// The live run, as five swipeable pages — the arrangement a runner's thumb already knows from
/// Apple's Workout app: **Controls ← Metrics → Pace → Session → Music**.
///
/// Metrics is the landing page because it is the one you glance at; the controls live one swipe
/// away precisely so a stray touch mid-stride cannot end your run.
///
/// Metrics holds five numbers and nothing else. An earlier version stacked the pace band, heart
/// rate, a progress bar and a total on the same page, and at running cadence it read as a wall —
/// you cannot parse a chart while your head is bouncing. The band is genuinely useful, so it gets
/// its own page at full size rather than being squeezed in above the numbers.
struct WorkoutView: View {
    @ObservedObject var workout: WorkoutManager
    @ObservedObject private var settings = WatchSettings.shared
    @EnvironmentObject private var store: SessionStore
    @Environment(\.dismiss) private var dismiss
    // Stable integer tags: a conditionally-included page makes SwiftUI's selection unreliable, and
    // landing on the wrong page mid-run is exactly the wrong first impression.
    @State private var page = 1
    @State private var askingEffort = false

    var body: some View {
        Group {
            if let n = workout.countdown {
                countdownScreen(n)
            } else {
            switch workout.phase {
            case let .failed(message):
                failure(message)
            case .ended:
                if askingEffort {
                    EffortView(workout: workout) { dismiss() }
                } else {
                    SummaryView(workout: workout, name: store.runnerName) { askingEffort = true }
                }
            default:
                TabView(selection: $page) {
                    ControlsView(workout: workout, backToMetrics: { page = 1 }).tag(0)
                    metrics.tag(1)
                    PaceView(workout: workout).tag(2)
                    SessionStepsView(workout: workout).tag(3)
                    // The system's own Now Playing, so it controls whatever is actually playing —
                    // Music, a podcast, Spotify — rather than only something we own.
                    NowPlayingView().tag(4)
                }
                .tabViewStyle(.page)
            }
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    /// Three seconds before the clock starts, so there is time to pocket the phone or reach the
    /// start line. The wrist taps on every beat, which matters because the runner is usually looking
    /// at their phone or their shoes rather than at this.
    private func countdownScreen(_ n: Int) -> some View {
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            Text("\(n)")
                .font(.system(size: 84, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Brand.accent)
                .contentTransition(.numericText(countsDown: true))
                .animation(.snappy(duration: 0.25), value: n)
            Text(workout.plan?.title ?? "Free run")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Brand.inkSoft)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            Spacer(minLength: 0)
            Button("Cancel") {
                workout.cancelCountdown()
                dismiss()
            }
            .font(.system(size: 13, weight: .medium))
            .buttonStyle(.plain)
            .foregroundStyle(Brand.inkFaint)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 6)
    }

    // MARK: - Metrics

    /// Layout lives in `MetricsPage`, which takes plain strings — see that file for why. This just
    /// maps the live workout onto it, still in the runner's own chosen metric order.
    private var metrics: some View {
        MetricsPage(
            status: workout.phase == .paused ? ("Paused", Brand.ease) : nil,
            elapsed: workout.value(for: .elapsed).value,
            // ⚠️ ELAPSED IS FILTERED OUT OF THE ROWS, because it now has a permanent line of its own
            // at the top. Left in, a runner who had chosen it would see the same clock twice and lose
            // one of only three slots to a duplicate.
            rows: settings.metrics.filter { $0 != .elapsed }.map { m in
                let v = workout.value(for: m)
                // The heart-rate row carries a heart tinted by training zone — the colour is the
                // whole message. No ceiling from the phone (or no reading yet) → the faint heart.
                let icon: MetricsPage.Icon? = m == .heartRate
                    ? .init(systemName: "heart.fill", tint: Brand.hrZoneTint(workout.hrZone))
                    : nil
                return MetricsPage.Row(value: v.value, unit: v.unit, label: m.caption, icon: icon)
            },
            stepProgress: workout.stepProgress,
            stepLabel: workout.currentStep?.label
        )
    }

    /// Metres while they are still small enough to be meaningful, kilometres after that.
    private var distanceText: String {
        workout.distanceMetres < 1000
            ? String(format: "%.0f M", workout.distanceMetres)
            : String(format: "%.2f KM", workout.distanceKm)
    }

    private func failure(_ message: String) -> some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3).foregroundStyle(Brand.ease)
                Text(message).font(.caption)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Back") { dismiss() }
            }
        }
    }
}

// MARK: - Controls (one swipe left)

/// Pause, end and lock, deliberately off the page you look at. Ending a run by accident is the one
/// mistake there is no undo for.
struct ControlsView: View {
    @ObservedObject var workout: WorkoutManager
    var backToMetrics: () -> Void
    /// ⚠️ Ending asks first. Putting the button off the main page made a knock less likely; it did
    /// not make it impossible, and a wrist is exactly where an accidental press happens — sleeve,
    /// doorframe, wiping sweat. There is no way back into a session once it has ended.
    @State private var confirmingEnd = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    Button {
                        confirmingEnd = true
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: "stop.fill").font(.title3)
                            Text("End").font(.system(size: 10))
                        }.frame(maxWidth: .infinity)
                    }
                    .tint(Brand.rest)

                    Button {
                        if workout.phase == .paused { workout.resume() } else { workout.pause() }
                        backToMetrics()
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: workout.phase == .paused ? "play.fill" : "pause.fill")
                                .font(.title3)
                            Text(workout.phase == .paused ? "Resume" : "Pause").font(.system(size: 10))
                        }.frame(maxWidth: .infinity)
                    }
                    .tint(workout.phase == .paused ? Brand.accent : Brand.ease)
                }

                Button {
                    // Water Lock is also the screen lock: taps are ignored until the crown is
                    // turned, which is what stops rain and a sleeve from pausing your run.
                    WKInterfaceDevice.current().enableWaterLock()
                } label: {
                    Label("Lock screen", systemImage: "drop.fill").frame(maxWidth: .infinity)
                }
                .tint(.blue)

                if workout.stepIndex + 1 < workout.steps.count {
                    Button {
                        workout.nextStep()
                        backToMetrics()
                    } label: {
                        Label("Skip step", systemImage: "forward.end.fill").frame(maxWidth: .infinity)
                    }
                }
            }
            .buttonStyle(.bordered)
            .padding(.horizontal, 2)
        }
        // ⚠️ A confirmationDialog rather than a second tap-to-arm on the button itself: on a wrist the
        // dialog takes over the whole screen, so the confirm cannot be hit by the same knock that
        // opened it. "Cancel" returns to the run with nothing changed — the run is still recording
        // throughout, because asking must never itself pause or stop anything.
        .confirmationDialog("End session?", isPresented: $confirmingEnd, titleVisibility: .visible) {
            Button("End session", role: .destructive) { workout.end() }
            Button("Cancel", role: .cancel) { backToMetrics() }
        } message: {
            Text("This stops recording now. Your run will be saved.")
        }
    }
}

// MARK: - The session, step by step

/// Maps the live workout onto `StepsPage` (the owner's reference layout — see that file). A free
/// run has no steps and keeps its own honest message instead of an empty recap.
struct SessionStepsView: View {
    @ObservedObject var workout: WorkoutManager

    var body: some View {
        if workout.steps.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Run by feel").font(.system(size: 14, weight: .semibold))
                Text("This session has no set structure — just settle into a comfortable rhythm.")
                    .font(.system(size: 11)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            StepsPage(
                status: workout.phase == .paused ? ("Paused", Brand.ease) : nil,
                current: (workout.currentStep?.label ?? "",
                          workout.currentStep.flatMap { s in
                              guard let lo = s.paceLow, let hi = s.paceHigh else { return nil }
                              return "Target \(WorkoutManager.pace(Double(lo)))–\(WorkoutManager.pace(Double(hi)))/km"
                          }),
                upcoming: workout.stepIndex + 1 < workout.steps.count
                    ? workout.steps[workout.stepIndex + 1].label : nil,
                title: workout.plan?.title ?? "Session",
                subtitle: workout.plan?.subtitle ?? "",
                steps: workout.steps.map(\.label),
                currentIndex: workout.stepIndex
            )
        }
    }
}

// MARK: - After the run

struct SummaryView: View {
    @ObservedObject var workout: WorkoutManager
    /// The runner's first name, carried over from the phone.
    var name: String?
    var onNext: () -> Void

    /// The first thing you see after a run should be a person talking to you, not a table.
    private var congratulation: String {
        name.map { "Well done, \($0)" } ?? "Well done"
    }

    var body: some View {
        ZStack {
            Brand.backdrop
            ScrollView {
                VStack(spacing: 5) {
                    Text(congratulation)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Brand.accent)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("You smashed it")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Brand.ink)

                    Text(workout.plan?.title ?? "Run")
                        .font(.system(size: 10))
                        .foregroundStyle(Brand.inkFaint)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 1)

                    if workout.route.count > 1 {
                        RouteMapView(points: workout.route, tint: Brand.mark)
                            .frame(height: 62)
                            .padding(.vertical, 2)
                    }

                    Text(String(format: "%.2fKM", workout.distanceKm))
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Brand.ink)

                    HStack(alignment: .top) {
                        stat("TIME", workout.elapsedText)
                        Spacer()
                        stat("AVG. PACE", workout.avgPaceText + "/KM")
                    }
                    if workout.avgHeartRate > 0 {
                        stat("AVG. HR", "\(Int(workout.avgHeartRate)) bpm")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button(action: onNext) {
                        Text("Next")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.accentInk)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(
                                Capsule().fill(LinearGradient(colors: [Brand.mark, Brand.markDeep],
                                                              startPoint: .topLeading, endPoint: .bottomTrailing))
                            )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 6)
                }
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(.system(size: 9)).foregroundStyle(Brand.inkFaint)
            Text(value).font(.system(size: 15, weight: .medium)).monospacedDigit()
                .foregroundStyle(Brand.ink)
        }
    }
}
