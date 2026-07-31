import SwiftUI

/// The session page of a live run — one swipe right of the pace page.
///
/// The owner's reference layout, in Inte-Run's tokens: what you are doing NOW in big accent caps,
/// what comes NEXT under it, and then the whole session — title, distance/duration, every step —
/// so the answer to "what is this run again?" never needs the phone. The page scrolls; the two
/// live sections stay at the top where a glance lands.
///
/// Like `MetricsPage` and `PacePage`, this is a **pure** view — plain values in, no
/// `WorkoutManager` — so `WatchPreview` can render it without a workout running.
struct StepsPage: View {
    /// One word, top-left, when the run is not simply running ("Paused"). Nil when it is.
    var status: (text: String, tint: Color)?
    /// The step underway. `target` is its pace band already formatted ("5:30–5:45/km"), or nil.
    var current: (label: String, target: String?)
    /// The next step's label; nil on the final step.
    var upcoming: String?
    /// The whole session, for the recap below the fold.
    var title: String
    var subtitle: String
    var steps: [String]
    var currentIndex: Int

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let status {
                    Text(status.text.uppercased())
                        .font(.system(size: 11, weight: .heavy))
                        .kerning(0.6)
                        .foregroundStyle(status.tint)
                        .padding(.bottom, 4)
                }

                Text("CURRENT STEP")
                    .font(.system(size: 10, weight: .bold)).kerning(0.6)
                    .foregroundStyle(Brand.inkFaint)
                Text(current.label.uppercased())
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(Brand.accent)
                    .lineLimit(3)
                    .minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 1)
                if let t = current.target {
                    Text(t)
                        .font(.system(size: 11, weight: .semibold)).monospacedDigit()
                        .foregroundStyle(Brand.inkSoft)
                        .padding(.top, 1)
                }

                Divider().padding(.vertical, 7)

                Text("UPCOMING STEP")
                    .font(.system(size: 10, weight: .bold)).kerning(0.6)
                    .foregroundStyle(Brand.inkFaint)
                Text(upcoming?.uppercased() ?? "THIS IS THE LAST STEP")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(upcoming == nil ? Brand.inkSoft : Brand.accent.opacity(0.85))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 1)

                Divider().padding(.vertical, 7)

                // The whole session, so mid-run doubt ("was it three reps or four?") has an answer.
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkSoft)
                        .padding(.top, 1)
                }

                VStack(alignment: .leading, spacing: 3) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                        HStack(alignment: .top, spacing: 7) {
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(i == currentIndex ? Brand.accent : Brand.line)
                                .frame(width: 3)
                            Text(s)
                                .font(.system(size: 12, weight: i == currentIndex ? .semibold : .regular))
                                // Done steps recede, the current one is bright, the rest are readable.
                                .foregroundStyle(i < currentIndex ? Brand.inkFaint
                                                 : i == currentIndex ? Brand.ink : Brand.inkSoft)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(.top, 6)
                .padding(.bottom, 12)   // clear of the page dots
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
