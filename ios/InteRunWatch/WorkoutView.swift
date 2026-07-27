import SwiftUI

/// The live run. Two pages, swipeable: metrics, and the session's own structure.
///
/// Everything here is sized to be read with a bouncing arm and a glance, and everything on the
/// first page answers a question a runner actually asks mid-session: how long, how far, am I going
/// at the right speed, how hard is my heart working.
struct WorkoutView: View {
    @ObservedObject var workout: WorkoutManager
    @Environment(\.dismiss) private var dismiss
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
                    summary
                }
            default:
                TabView {
                    metrics.tag(0)
                    if !workout.steps.isEmpty { structure.tag(1) }
                }
                .tabViewStyle(.verticalPage)
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    // MARK: - Live metrics

    private var metrics: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 7) {
                if let step = workout.currentStep {
                    Text(step.label.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.green)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text(workout.elapsedText)
                    .font(.system(size: 38, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.accentColor)

                // The plan's own pace band, live. The reason to run this app and not Apple's.
                if let band = workout.targetBand {
                    PaceBandView(low: band.low, high: band.high,
                                 current: workout.paceSecPerKm, verdict: workout.paceVerdict)
                }

                HStack(alignment: .firstTextBaseline) {
                    stat(workout.paceText, "/KM")
                    Spacer()
                    stat(String(format: "%.2f", workout.distanceKm), "KM")
                }

                HStack(spacing: 5) {
                    Image(systemName: "heart.fill").foregroundStyle(.red).font(.system(size: 11))
                    Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                        .font(.system(size: 19, weight: .medium)).monospacedDigit()
                    Text("BPM").font(.system(size: 10)).foregroundStyle(.secondary)
                }

                controls
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var controls: some View {
        HStack {
            if workout.phase == .paused {
                Button { workout.resume() } label: {
                    Image(systemName: "play.fill").frame(maxWidth: .infinity)
                }.tint(.green)
            } else {
                Button { workout.pause() } label: {
                    Image(systemName: "pause.fill").frame(maxWidth: .infinity)
                }.tint(.orange)
            }
            Button { workout.end() } label: {
                Image(systemName: "stop.fill").frame(maxWidth: .infinity)
            }.tint(.red)
        }
        .buttonStyle(.bordered)
        .padding(.top, 2)
    }

    // MARK: - The session, step by step

    private var structure: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                if let step = workout.currentStep {
                    Text("NOW").font(.system(size: 10, weight: .bold)).foregroundStyle(.secondary)
                    Text(step.label)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.green)
                        .fixedSize(horizontal: false, vertical: true)

                    if let p = step.progress(elapsed: workout.stepElapsed, metresDone: workout.stepMetres) {
                        ProgressView(value: p).tint(.green)
                        Text(remainingText(step)).font(.caption2).foregroundStyle(.secondary)
                    }
                    if workout.stepIndex + 1 < workout.steps.count {
                        Text("NEXT: " + workout.steps[workout.stepIndex + 1].label)
                            .font(.system(size: 11)).foregroundStyle(.secondary)
                            .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                        Button("Skip to next") { workout.nextStep() }
                            .font(.caption2).buttonStyle(.bordered)
                    }
                }
                Divider()
                Text("Step \(workout.stepIndex + 1) of \(workout.steps.count)")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// What is left of this step, in whichever unit the step is measured in.
    private func remainingText(_ step: PlannedStep) -> String {
        if let m = step.metres, m > 0 {
            let left = max(0, Double(m) - workout.stepMetres)
            return left >= 1000 ? String(format: "%.2f km to go", left / 1000)
                                : String(format: "%.0f m to go", left)
        }
        if let sec = step.seconds, sec > 0 {
            let left = max(0, Int(Double(sec) - workout.stepElapsed))
            return String(format: "%d:%02d to go", left / 60, left % 60)
        }
        return ""
    }

    // MARK: - After

    private var summary: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("Well done").font(.headline)
                stat(workout.elapsedText, "TIME")
                stat(String(format: "%.2f km", workout.distanceKm), "DISTANCE")
                stat(workout.paceText + " /km", "AVG PACE")
                Button {
                    askingEffort = true
                } label: {
                    Text("Next").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .padding(.top, 4)
            }
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

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value).font(.system(size: 19, weight: .medium)).monospacedDigit()
            Text(label).font(.system(size: 10)).foregroundStyle(.secondary)
        }
    }
}
