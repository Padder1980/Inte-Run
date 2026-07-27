import SwiftUI

/// Live metrics, sized to be readable at a glance with a bouncing arm.
struct WorkoutView: View {
    @ObservedObject var workout: WorkoutManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            switch workout.phase {
            case let .failed(message):
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
            case .ended:
                ScrollView {
                    VStack(spacing: 6) {
                        Text("Well done").font(.headline)
                        metric(workout.elapsedText, "time")
                        metric(String(format: "%.2f km", workout.distanceKm), "distance")
                        Button("Done") { dismiss() }.padding(.top, 4)
                    }
                }
            default:
                live
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    private var live: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(workout.elapsedText)
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.accentColor)

                HStack {
                    metric(String(format: "%.2f", workout.distanceKm), "km")
                    Spacer()
                    metric(workout.paceText, "/km")
                }
                HStack(spacing: 4) {
                    Image(systemName: "heart.fill").foregroundStyle(.red).font(.caption2)
                    Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                        .font(.title3).monospacedDigit()
                    Text("bpm").font(.caption2).foregroundStyle(.secondary)
                }

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
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value).font(.title3).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }
}
