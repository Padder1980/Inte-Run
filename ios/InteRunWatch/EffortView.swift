import SwiftUI

/// "How hard did that feel?" on the wrist, straight after the run.
///
/// Apple asks this too, and the answer goes into Health and stops there. Here it is one half of the
/// adaptive-flags signal: an effort consistently outside what the session intended, for two or more
/// sessions running, is what makes InteRun offer to change the plan. Asked on the wrist because
/// asking twenty minutes later, on a phone, gets you a guess.
struct EffortView: View {
    @ObservedObject var workout: WorkoutManager
    var onDone: () -> Void

    /// Borg-style descriptors, matched to the 1–10 scale the plan prescribes against.
    private static let labels = [
        "", "Extremely easy", "Very easy", "Easy", "Comfortable", "Moderate",
        "Somewhat hard", "Hard", "Very hard", "Extremely hard", "Maximal",
    ]

    @State private var value: Int = 4

    private var intended: String? {
        guard let lo = workout.plan?.rpeMin, let hi = workout.plan?.rpeMax else { return nil }
        return lo == hi ? "\(lo)" : "\(lo)–\(hi)"
    }

    private var againstPlan: String? {
        guard let lo = workout.plan?.rpeMin, let hi = workout.plan?.rpeMax else { return nil }
        if value > hi { return "Harder than planned" }
        if value < lo { return "Easier than planned" }
        return "As planned"
    }

    var body: some View {
        ZStack {
            Brand.backdrop
            content
        }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("How hard did that feel?")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkSoft)
                    .multilineTextAlignment(.center)

                // Coloured by the app's own effort scale, so the number carries meaning before
                // you have read the word underneath it.
                Text("\(value)")
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .foregroundStyle(Brand.effort(value))
                    // The crown is the natural way to pick a number on a watch — no tiny targets.
                    .focusable()
                    .digitalCrownRotation(
                        Binding(get: { Double(value) }, set: { value = min(10, max(1, Int($0.rounded()))) }),
                        from: 1, through: 10, by: 1, sensitivity: .low,
                        isContinuous: false, isHapticFeedbackEnabled: true)

                Text(Self.labels[value])
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                    .multilineTextAlignment(.center)

                if let intended {
                    Text("Planned: \(intended)")
                        .font(.system(size: 11)).foregroundStyle(Brand.inkFaint)
                }
                if let againstPlan {
                    Text(againstPlan)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(againstPlan == "As planned" ? Brand.accent : Brand.ease)
                }

                Button {
                    workout.reportedRpe = value
                    workout.sendHome()
                    onDone()
                } label: {
                    Text("Save")
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

                Button("Skip") {
                    workout.sendHome()
                    onDone()
                }
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 2)
        }
        .navigationBarBackButtonHidden(true)
        .onAppear {
            // Start on the middle of the intended band, so agreeing with the plan is one tap.
            if let lo = workout.plan?.rpeMin, let hi = workout.plan?.rpeMax { value = (lo + hi) / 2 }
        }
    }
}
