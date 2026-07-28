import SwiftUI

/// What the runner sees on the wrist: today's session, and one button to start it.
///
/// Deliberately not a port of the phone UI. Plan setup, history and Support all belong on a bigger
/// screen; the watch does the one thing the phone cannot do well, which is be there mid-run.
///
/// Dressed in the app's own palette (`Brand`) so the watch and the phone read as one product.
struct TodayView: View {
    /// True when the phone launched this app specifically to begin a run.
    var autoStart: Bool = false

    @EnvironmentObject private var store: SessionStore
    @StateObject private var workout = WorkoutManager()
    @State private var running = false

    /// Hand the plan to the workout and go. One path, so a run started from the phone and a run
    /// started on the wrist are the same run with the same targets and the same reasons.
    private func begin(_ s: PlannedSession) {
        workout.plan = s   // the target band and step list come from the plan
        workout.why = store.why          // the runner's own reasons, for the hard stretch
        workout.whyPerson = store.whyPerson
        running = true
        workout.start()
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.backdrop
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        // A context from a previous day is worse than none: showing yesterday's
                        // session (or yesterday's rest) as today's would quietly mislead. Fall back
                        // to the waiting state, whose advice - open the phone app - is the fix.
                        if store.isCurrent, let s = store.session {
                            session(s)
                        } else if store.isCurrent, store.hasSynced {
                            restDay
                        } else {
                            waiting
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 2)
                }
            }
            .navigationTitle("InteRun")
            .navigationDestination(isPresented: $running) {
                WorkoutView(workout: workout)
                    .environmentObject(store)
            }
            // Launched from the phone's "record on my watch": begin without a second tap. Gated on
            // a session actually being synced, because starting a run the watch knows nothing about
            // would lose the pace targets and the step list -- the whole reason to use this app.
            .onChange(of: autoStart, initial: true) { _, want in
                guard want, !running, store.isCurrent, let s = store.session else { return }
                LaunchRequest.shared.consume()
                begin(s)
            }
            // The context can land a moment after the launch, so try again when it does.
            .onChange(of: store.session) { _, s in
                guard autoStart, !running, store.isCurrent, let s else { return }
                LaunchRequest.shared.consume()
                begin(s)
            }
        }
    }

    private func session(_ s: PlannedSession) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let name = store.runnerName {
                Text("TODAY, \(name.uppercased())")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Brand.accent)
            }

            Text(s.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .fixedSize(horizontal: false, vertical: true)

            if !s.subtitle.isEmpty {
                Text(s.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
            }

            if let pace = s.paceText {
                HStack(spacing: 4) {
                    Image(systemName: "speedometer").font(.system(size: 10))
                    Text(pace).font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Brand.accent)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(Capsule().fill(Brand.surface2))
            }

            if let steps = s.steps, steps.count > 1 {
                Text("\(steps.count) steps")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
            }

            Button {
                begin(s)
            } label: {
                Label("Start", systemImage: "play.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.accentInk)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    // The brand mark's own gradient, so the button is unmistakably InteRun's.
                    .background(
                        Capsule().fill(LinearGradient(colors: [Brand.mark, Brand.markDeep],
                                                      startPoint: .topLeading, endPoint: .bottomTrailing))
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
    }

    /// A real rest day, which is part of the plan rather than an absence of one.
    private var restDay: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "moon.zzz.fill")
                .font(.title2)
                .foregroundStyle(Brand.accent)
            Text(store.runnerName.map { "Rest day, \($0)" } ?? "Rest day")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text("Nothing planned today. Recovery is training too.")
                .font(.system(size: 12))
                .foregroundStyle(Brand.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var waiting: some View {
        VStack(alignment: .leading, spacing: 6) {
            ProgressView().tint(Brand.accent)
            Text("Waiting for your plan")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Brand.ink)
            Text("Open InteRun on your iPhone.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
    }
}
