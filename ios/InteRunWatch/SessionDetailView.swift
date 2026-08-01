import SwiftUI

/// What a session actually is, before you commit to running it — reached by tapping a workout card
/// on the home screen.
///
/// ⚠️ **One scrollable page, not three.** The reference app splits this across three swipe pages;
/// the owner asked for a single scroll, and he is right for a watch: three pages hide both the
/// step list and the button behind a guess about which way to swipe, whereas one scroll shows the
/// shape of the whole thing.
///
/// ⚠️ **Start is at the TOP, not the foot** (owner's call, 2026-07-31 — an earlier version put it
/// last and argued the page should "end on the button you came for"). You arrive here having
/// already chosen this session, so committing should never require scrolling past detail you may
/// not want to read; the detail lives below for the times you do.
///
/// Deliberately NOT copied from the reference:
/// - **No Outdoor/Treadmill toggle.** The wrist has no treadmill mode (no indoor path exists in
///   WorkoutManager), and this project's rule is that every control does something.
/// - **No coach comment.** There is no per-session note anywhere in the plan data, and inventing
///   an encouraging sentence on the watch would be words the coach never wrote.
///
/// Everything shown is real: the plan's own distance, duration, pace band, intended effort and
/// step list.
struct SessionDetailView: View {
    let session: PlannedSession
    /// Called when the runner commits. The caller dismisses and starts — see TodayView.
    var start: () -> Void
    /// True only in WatchPreview: the button renders but refuses to fire, because a preview that
    /// can start a workout is a preview that can log a fictional run.
    var previewInert: Bool = false
    /// WatchPreview only. simctl can screenshot a watch but cannot scroll one, so the foot of this
    /// page — the tail of the step list — could not otherwise be looked at at all. Nil in the app,
    /// where the page must obviously open at the top.
    var previewAnchor: UnitPoint?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(session.dayLabel.uppercased())
                    .font(.system(size: 10, weight: .bold)).kerning(0.5)
                    .foregroundStyle(Brand.accent)

                Text(session.title)
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Brand.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 1)

                if !session.subtitle.isEmpty {
                    Text(session.subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)
                        .padding(.top, 2)
                }

                // ⚠️ Start sits AT THE TOP, under the name and nothing else — the owner's call, and
                // the right one: you arrive here having already chosen this session, so committing
                // to it should never require scrolling past the detail you may not want to read.
                // What the session IS lives underneath, for the times you do.
                //
                // ⚠️ Only for sessions that can actually be RUN. A strength or mobility day reaches
                // the wrist like any other, and starting one opens a running workout with GPS —
                // logging a bodyweight routine as a run. The phone gates this the same way.
                if session.isRunnable {
                    startButton.padding(.vertical, 12)
                } else {
                    Text("Do this one off the watch — it isn't a run, so there's nothing here to track.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Brand.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.vertical, 10)
                }

                // The two things that decide how the run should go.
                VStack(alignment: .leading, spacing: 4) {
                    if let pace = session.paceText {
                        factRow(icon: "speedometer", label: "TARGET PACE", value: pace)
                    }
                    if let effort = session.effortText {
                        factRow(icon: "gauge.medium", label: "SHOULD FEEL", value: effort)
                    }
                }
                .padding(.top, 9)

                stepList
                    .padding(.bottom, 10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
        }
        .defaultScrollAnchor(previewAnchor ?? .top)
        .navigationTitle("")
    }

    // MARK: - Pieces

    private var startButton: some View {
        Button {
            guard !previewInert else { return }
            // ⚠️ Do NOT dismiss() first. This page is pushed on the same NavigationStack whose
            // root carries .navigationDestination(isPresented: $running), so a pop and the
            // run-screen push land in one transaction and the pop wins: measured on the simulator,
            // WorkoutView appeared and was torn down ~400ms later with SwiftUI writing `running`
            // back to false, while startCountingDown()'s timer kept going. Three seconds later a
            // real HKWorkoutSession, GPS and Live Activity began with no run screen and NO WAY
            // BACK — Pause, End and the countdown's Cancel all live on WorkoutView, and nothing on
            // the wrist can set `running` true again. Setting it alone is correct AND does what the
            // pop was meant to: SwiftUI evicts this page itself, and finishing lands on home.
            start()
        } label: {
            Brand.RunButtonLabel(title: "Start")
        }
        .buttonStyle(.plain)
    }

    private func factRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(Brand.accent)
                .frame(width: 15)
            VStack(alignment: .leading, spacing: 0) {
                Text(label)
                    .font(.system(size: 9, weight: .bold)).kerning(0.5)
                    .foregroundStyle(Brand.inkFaint)
                Text(value)
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Brand.ink)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 6).padding(.horizontal, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Brand.surface))
    }

    @ViewBuilder
    private var stepList: some View {
        let steps = session.steps ?? []
        if steps.isEmpty {
            // Unreachable from real sync (every engine session has steps and the payload always
            // sends the array), so this describes MISSING DETAIL rather than asserting the plan has
            // no structure — a claim about the plan would be the one thing this page can't check.
            Text("No step-by-step detail on the watch for this one — run it by feel, or open it on your iPhone.")
                .font(.system(size: 11.5))
                .foregroundStyle(Brand.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
        } else {
            Text(steps.count == 1 ? "THE SESSION" : "THE SESSION · \(steps.count) STEPS")
                .font(.system(size: 9.5, weight: .bold)).kerning(0.5)
                .foregroundStyle(Brand.inkFaint)
                .padding(.top, 13).padding(.bottom, 4)

            VStack(alignment: .leading, spacing: 5) {
                ForEach(Array(steps.enumerated()), id: \.offset) { i, st in
                    HStack(alignment: .top, spacing: 7) {
                        Text("\(i + 1)")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Brand.inkFaint)
                            .frame(width: 13, alignment: .trailing)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(st.label)
                                .font(.system(size: 12.5, weight: .medium))
                                .foregroundStyle(Brand.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            if let detail = stepDetail(st) {
                                Text(detail)
                                    .font(.system(size: 10.5))
                                    .monospacedDigit()
                                    .foregroundStyle(Brand.inkFaint)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }

    /// A step's own numbers: how long or how far, and the pace it asks for. Both are optional —
    /// an effort-only step (hill sprints) has no pace by design, which is why this can return nil
    /// rather than printing an empty band.
    private func stepDetail(_ st: PlannedStep) -> String? {
        var bits: [String] = []
        // Which rep, of how many. Without it a 12 × 400 m session is twelve byte-identical rows —
        // the phone's live card already shows "rep 3/12" for exactly this reason, and the leading
        // number here counts STEPS (row 5 is rep 3), so it cannot stand in.
        if let i = st.repIndex, let n = st.repCount, n > 1 { bits.append("Rep \(i) of \(n)") }
        if let g = st.goalText { bits.append(g) }
        if let lo = st.paceLow, let hi = st.paceHigh {
            bits.append("\(PlannedSession.mmss(lo))–\(PlannedSession.mmss(hi))/km")
        }
        return bits.isEmpty ? nil : bits.joined(separator: " · ")
    }
}
