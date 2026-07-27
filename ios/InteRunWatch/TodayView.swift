import SwiftUI

/// What the runner sees on the wrist: today's session, and one button to start it.
///
/// Deliberately not a port of the phone UI. Plan setup, history and Support all belong on a bigger
/// screen; the watch does the one thing the phone cannot do well, which is be there mid-run.
struct TodayView: View {
    @EnvironmentObject private var store: SessionStore
    @StateObject private var workout = WorkoutManager()
    @State private var running = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let s = store.session {
                        Text(s.title)
                            .font(.headline)
                            .fixedSize(horizontal: false, vertical: true)

                        if !s.subtitle.isEmpty {
                            Text(s.subtitle).font(.caption).foregroundStyle(.secondary)
                        }
                        if let pace = s.paceText {
                            Label(pace, systemImage: "speedometer")
                                .font(.caption)
                                .foregroundStyle(Color.accentColor)
                        }

                        Button {
                            running = true
                            workout.start()
                        } label: {
                            Label("Start", systemImage: "play.fill").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .padding(.top, 2)

                    } else if store.hasSynced {
                        // A real rest day, which is part of the plan rather than an absence of one.
                        Image(systemName: "moon.zzz.fill")
                            .font(.title2).foregroundStyle(Color.accentColor)
                        Text("Rest day").font(.headline)
                        Text("Nothing planned today. Recovery is training too.")
                            .font(.caption).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        ProgressView()
                        Text("Waiting for your plan")
                            .font(.caption).foregroundStyle(.secondary)
                        Text("Open InteRun on your iPhone.")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 2)
            }
            .navigationTitle("InteRun")
            .navigationDestination(isPresented: $running) {
                WorkoutView(workout: workout)
            }
        }
    }
}
