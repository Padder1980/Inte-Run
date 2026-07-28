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
    @ObservedObject private var launch = LaunchRequest.shared

    @EnvironmentObject private var store: SessionStore
    @StateObject private var workout = WorkoutManager()
    @State private var running = false

    /// Hand the plan to the workout and go. One path, so a run started from the phone and a run
    /// started on the wrist are the same run with the same targets and the same reasons.
    private func begin(_ s: PlannedSession?) {
        workout.plan = s   // nil is a free run: no targets, no steps, just the clock and the GPS
        workout.why = store.why          // the runner's own reasons, for the hard stretch
        workout.whyPerson = store.whyPerson
        workout.coach = store.coach      // the same coach they chose on the phone
        workout.coachLines = store.coachLines
        // The phone can finish, pause and resume a wrist run: someone holding their phone should not
        // have to find their watch to stop. Cleared when the run ends so a late command does nothing.
        store.onStopRequested = { [weak workout] in workout?.end() }
        store.onPauseRequested = { [weak workout] in workout?.pause() }
        store.onResumeRequested = { [weak workout] in workout?.resume() }
        running = true
        workout.startCountingDown()
    }

    /// "Inte" white, "Run" in the brand teal — the same wordmark the phone's splash draws
    /// (#fff + #16b7a4, which is Brand.mark).
    private var wordmark: some View {
        (Text("Inte").foregroundStyle(.white) + Text("Run").foregroundStyle(Brand.mark))
            .font(.system(size: 22, weight: .heavy, design: .rounded))
            .kerning(-0.4)
            .padding(.bottom, 2)
    }

    /// Start something with no plan behind it. Always available.
    private var freeRun: some View {
        Button {
            begin(nil)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "figure.run").font(.system(size: 14, weight: .semibold))
                Text("Free run").font(.system(size: 15, weight: .semibold))
                Spacer(minLength: 0)
            }
            .foregroundStyle(Brand.ink)
            .padding(.vertical, 10).padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Brand.surface2))
        }
        .buttonStyle(.plain)
        .padding(.top, 6)
    }

    /// The rest of the week, so a session can be started early — or caught up — from the wrist.
    @ViewBuilder private var upcomingList: some View {
        let ahead = store.upcomingAhead.filter { $0.dateIso != SessionStore.localTodayIso() }
        if !ahead.isEmpty {
            Text("COMING UP")
                .font(.system(size: 10, weight: .bold)).kerning(0.6)
                .foregroundStyle(Brand.inkFaint)
                .padding(.top, 10)
            ForEach(Array(ahead.prefix(5).enumerated()), id: \.offset) { _, s in
                Button { begin(s) } label: {
                    HStack(spacing: 9) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Brand.accent).frame(width: 3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dayLabel(s.dateIso))
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Brand.inkFaint)
                            Text(s.title)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Brand.ink)
                                .lineLimit(2).multilineTextAlignment(.leading)
                            if !s.subtitle.isEmpty {
                                Text(s.subtitle).font(.system(size: 10)).foregroundStyle(Brand.inkSoft)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8).padding(.horizontal, 10)
                    .frame(maxWidth: .infinity)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Brand.surface))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var settingsLink: some View {
        NavigationLink {
            SettingsView().environmentObject(store)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "gearshape.fill").font(.system(size: 12))
                Text("Settings").font(.system(size: 13, weight: .medium))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(Brand.inkFaint)
            }
            .foregroundStyle(Brand.inkSoft)
            .padding(.vertical, 9).padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Brand.surface))
        }
        .buttonStyle(.plain)
        .padding(.top, 10)
        .padding(.bottom, 6)
    }

    /// "Wed 29 Jul" from an ISO date, without dragging a DateFormatter through every row.
    private func dayLabel(_ iso: String) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        guard let d = f.date(from: iso) else { return iso }
        let out = DateFormatter(); out.dateFormat = "EEE d MMM"; out.timeZone = .current
        return out.string(from: d)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.backdrop
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        wordmark
                        // A context from a previous day is worse than none: showing yesterday's
                        // session (or yesterday's rest) as today's would quietly mislead. Fall back
                        // to the waiting state, whose advice - open the phone app - is the fix.
                        if launch.companionOnly {
                            // The phone is recording; the wrist is only watching.
                            CompanionView().environmentObject(store)
                        } else if store.isCurrent, let s = store.session {
                            session(s)
                        } else if let s = store.todayFromCache {
                            // The context is stale but the cached week still covers today. Better a
                            // day-old copy of the right session than a spinner.
                            session(s)
                        } else if store.isCurrent, store.hasSynced {
                            restDay
                        } else {
                            waiting
                        }
                        // ⚠️ Always offered, even when nothing has synced. Requiring the phone app
                        // to be open before the watch will start a run is not a running app, it is
                        // a chore — and it is exactly the state you are in at the front door.
                        freeRun
                        upcomingList
                        settingsLink
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 2)
                }
            }
            // The wordmark is drawn in the content (see `wordmark`) rather than set as the
            // navigation title. Handing watchOS a two-tone Text does keep the colours, but it also
            // re-lays the bar out — the mark shrinks and shifts under the clock. In the content it
            // sits where the phone's splash puts it, at the size it should be.
            .navigationTitle("")
            .onAppear { store.requestSync() }
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
            // Not an instruction any more, just an explanation: a free run is right below this, so
            // the runner is never actually blocked on the phone.
            Text("Open InteRun on your iPhone to sync it. You can still run without it.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
