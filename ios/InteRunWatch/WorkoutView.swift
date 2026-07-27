import SwiftUI
import WatchKit

/// The live run, as four swipeable pages — the arrangement a runner's thumb already knows from
/// Apple's Workout app: **Controls ← Metrics → Session → Music**.
///
/// Metrics is the landing page because it is the one you glance at; the controls live one swipe
/// away precisely so a stray touch mid-stride cannot end your run.
struct WorkoutView: View {
    @ObservedObject var workout: WorkoutManager
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
                    SummaryView(workout: workout) { askingEffort = true }
                }
            default:
                TabView(selection: $page) {
                    ControlsView(workout: workout, backToMetrics: { page = 1 }).tag(0)
                    metrics.tag(1)
                    SessionStepsView(workout: workout).tag(2)
                    // The system's own Now Playing, so it controls whatever is actually playing —
                    // Music, a podcast, Spotify — rather than only something we own.
                    NowPlayingView().tag(3)
                }
                .tabViewStyle(.page)
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - Metrics

    private var metrics: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(workout.elapsedText)
                        .font(.system(size: 21, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(workout.phase == .paused ? .orange : Color.accentColor)
                    if workout.phase == .paused {
                        Text("PAUSED").font(.system(size: 10, weight: .bold)).foregroundStyle(.orange)
                    }
                }

                // What is left of the step you are in — the number you actually want mid-rep.
                // The step's NAME lives on the session page; putting it here pushed everything
                // else off the screen, which defeats the point of a glanceable page.
                if let left = workout.stepRemaining {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(left.value)
                            .font(.system(size: 26, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(.green)
                        Text(left.unit)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.green)
                    }
                }

                if let band = workout.targetBand {
                    PaceBandView(low: band.low, high: band.high,
                                 current: workout.paceSecPerKm, verdict: workout.paceVerdict)
                }

                HStack(spacing: 4) {
                    Image(systemName: "heart.fill").foregroundStyle(.red).font(.system(size: 10))
                    Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                        .font(.system(size: 16, weight: .medium)).monospacedDigit()
                    Text("BPM").font(.system(size: 9)).foregroundStyle(.secondary)
                }

                row(workout.paceText, "CUR PACE")
                row(workout.avgPaceText, "AVG PACE")

                // Drawn rather than a ProgressView: on watchOS the tint colours the whole track, so
                // a 1%-complete run looked finished.
                if let p = workout.sessionProgress {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.gray.opacity(0.3))
                            Capsule().fill(Color.green)
                                .frame(width: max(2, geo.size.width * p))
                        }
                    }
                    .frame(height: 4)
                }
                Text("TOTAL DIST: " + distanceText)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 10)   // clear of the page dots
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, 4)   // keep the band's right-hand label clear of the scroll bar
        }
    }

    /// Metres while they are still small enough to be meaningful, kilometres after that.
    private var distanceText: String {
        workout.distanceMetres < 1000
            ? String(format: "%.0fM", workout.distanceMetres)
            : String(format: "%.2fKM", workout.distanceKm)
    }

    private func row(_ value: String, _ label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(value).font(.system(size: 19, weight: .medium)).monospacedDigit()
            Text("/KM").font(.system(size: 10)).foregroundStyle(.secondary)
            Spacer()
            Text(label).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
        }
    }

    private func failure(_ message: String) -> some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title3).foregroundStyle(.orange)
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
                    .tint(.red)

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
                    .tint(workout.phase == .paused ? .green : .orange)
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
                        .foregroundStyle(.green)
                        .fixedSize(horizontal: false, vertical: true)

                    if let goal = step.goalText {
                        Text(goal).font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                    if let p = step.progress(elapsed: workout.stepElapsed, metresDone: workout.stepMetres) {
                        ProgressView(value: p).tint(.green)
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
    var onNext: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text(workout.plan?.title ?? "Run")
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                if workout.route.count > 1 {
                    RouteMapView(points: workout.route)
                        .frame(height: 70)
                        .padding(.vertical, 2)
                }

                Text(String(format: "%.2fKM", workout.distanceKm))
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .monospacedDigit()

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
                    Text("Next").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.top, 4)
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(.system(size: 9)).foregroundStyle(.secondary)
            Text(value).font(.system(size: 15, weight: .medium)).monospacedDigit()
        }
    }
}
