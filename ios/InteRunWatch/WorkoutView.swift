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
    @EnvironmentObject private var store: SessionStore
    @Environment(\.dismiss) private var dismiss
    // Stable integer tags: a conditionally-included page makes SwiftUI's selection unreliable, and
    // landing on the wrong page mid-run is exactly the wrong first impression.
    @State private var page = 1
    @State private var askingEffort = false

    var body: some View {
        Group {
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
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - Metrics

    private var metrics: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Elapsed, and how much of the current step is left — the two clock figures, together.
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(workout.elapsedText)
                    .font(.system(size: 34, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .foregroundStyle(workout.phase == .paused ? Brand.ease : Brand.accent)
                if workout.phase == .paused {
                    Text("PAUSED").font(.system(size: 10, weight: .bold)).foregroundStyle(Brand.ease)
                } else if let left = workout.stepRemaining {
                    Spacer(minLength: 0)
                    VStack(alignment: .trailing, spacing: -2) {
                        Text(left.value)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                        Text(left.unit).font(.system(size: 8, weight: .bold)).foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.bottom, 2)

            metric(distanceText, "DISTANCE", size: 27, tint: Brand.ink)
            metric(workout.paceText, "CUR PACE", size: 25, tint: Brand.ink, unit: "/KM")
            metric(workout.lapPaceText, "LAP \(workout.lapNumber)", size: 25, tint: Brand.ink, unit: "/KM")
            metric(workout.avgPaceText, "AVG PACE", size: 25, tint: Brand.ink, unit: "/KM")

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 10)   // clear of the page dots
    }

    /// One number, its unit and its label on a single line: value left, label right. Reading down
    /// the left edge gives you the figures; the labels are there for the glance that needs them.
    private func metric(_ value: String, _ label: String, size: CGFloat, tint: Color, unit: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(value)
                .font(.system(size: size, weight: .medium, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.7)
                .lineLimit(1)
                .foregroundStyle(tint)
            if let unit {
                Text(unit).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
        }
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

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    Button {
                        workout.end()
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
    }
}

// MARK: - The session, step by step

struct SessionStepsView: View {
    @ObservedObject var workout: WorkoutManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                if workout.steps.isEmpty {
                    Text("Run by feel").font(.system(size: 14, weight: .semibold))
                    Text("This session has no set structure — just settle into a comfortable rhythm.")
                        .font(.system(size: 11)).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !workout.steps.isEmpty {
                Text("STEP \(workout.stepIndex + 1) OF \(workout.steps.count)")
                    .font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)

                if let step = workout.currentStep {
                    Text(step.label)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Brand.accent)
                        .fixedSize(horizontal: false, vertical: true)

                    if let goal = step.goalText {
                        Text(goal).font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                    if let p = step.progress(elapsed: workout.stepElapsed, metresDone: workout.stepMetres) {
                        ProgressView(value: p).tint(Brand.accent)
                    }
                    if let lo = step.paceLow, let hi = step.paceHigh {
                        Text("Target \(WorkoutManager.pace(Double(lo)))–\(WorkoutManager.pace(Double(hi)))/km")
                            .font(.system(size: 10)).foregroundStyle(.secondary)
                    }
                }

                if workout.stepIndex + 1 < workout.steps.count {
                    Divider()
                    Text("NEXT").font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
                    Text(workout.steps[workout.stepIndex + 1].label)
                        .font(.system(size: 12))
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
