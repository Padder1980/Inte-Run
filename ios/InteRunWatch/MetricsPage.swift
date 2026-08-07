import SwiftUI

/// The live numbers page of a run — the screen a runner glances at mid-stride, so the one where
/// legibility matters most.
///
/// It is a **pure** view: plain strings in, no `WorkoutManager`. That is deliberate. The old layout
/// lived as a private computed property inside `WorkoutView`, reading `private(set) @Published` state,
/// so there was no way to look at it without a real HealthKit workout running — which meant the
/// hardest screen to get right was the one nobody could see while designing it. Now it renders from
/// values anyone can supply, including `WatchPreview`.
///
/// The hierarchy rules, all learned from watching the screen at arm's length while moving:
/// - **One number dominates.** The runner's first metric is nearly twice the others. At the old
///   34-vs-25 the two competed and the eye had to choose, which is the same as reading nothing.
/// - **The value is big, the label is small and next to it.** The label used to be pushed to the
///   opposite edge by a `Spacer`, so reading one metric meant crossing the whole watch.
/// - **Status has one colour-coded word at the top** and never has to be inferred from the numbers.
struct MetricsPage: View {
    struct Row: Identifiable, Equatable {
        let value: String
        let unit: String?
        let label: String
        /// A leading glyph, used by the heart-rate row: a heart tinted by training zone. The tint
        /// is the whole message — the owner explicitly asked for no digit inside the heart, so
        /// every zone (and "no data") must stay distinguishable by colour alone.
        var icon: Icon?
        var id: String { label + value }
    }

    struct Icon: Equatable {
        let systemName: String
        let tint: Color
    }

    /// One word, top-left, when the run is not simply running. Nil when it is.
    var status: (text: String, tint: Color)?
    /// In the runner's own chosen order. The first is the hero.
    var rows: [Row]
    /// Progress through the current step, 0–1. Nil for a run with no structure.
    var stepProgress: Double?
    /// The step's own words, e.g. "2 km at 4:55/km" — context for the progress bar.
    var stepLabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let status {
                // ⚠️ THE CORNER EATS THE FIRST CHARACTERS, and a 2pt inset was nowhere near enough.
                // Reported reading "AUSED" once, and still cut off after the first attempt: on a
                // rounded watch face the top-left curve is many points deep, so a word starting at
                // x=2 on the very first line sits outside the drawable area whatever the top padding
                // is. This row — and only this row — is inset past the curve. The numbers below keep
                // the full width because by then the edge has straightened out.
                Text(status.text.uppercased())
                    .font(.system(size: 13, weight: .heavy))
                    .kerning(0.6)
                    .foregroundStyle(status.tint)
                    .padding(.leading, 16)
                    .padding(.bottom, 2)
            }

            if let hero = rows.first {
                heroRow(hero)
            }

            ForEach(rows.dropFirst()) { r in
                secondaryRow(r)
            }

            Spacer(minLength: 0)

            if let p = stepProgress {
                progress(p)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // ⚠️ THE STATUS WORD WAS BEING CLIPPED BY THE TOP-LEFT CORNER OF THE DISPLAY. The owner
        // photographed it mid-run reading "AUSED": this VStack started at the very top of the page, and
        // on a rounded watch face the first line's leading characters fall outside the drawable area
        // while the system clock occupies the same strip on the right. `.padding(.horizontal, 2)` is what
        // PacePage already uses; the top inset is new, and it is applied to the whole stack rather than
        // to the status word alone so the hero number does not move when a run is not paused (a layout
        // that shifts on pause is its own legibility problem at arm's length).
        .padding(.top, 6)
        .padding(.horizontal, 2)
        .padding(.bottom, 10)   // clear of the page dots
    }

    // MARK: - Rows

    /// The one number you can read without focusing. Its label sits underneath, small and quiet,
    /// because at this size the number is self-explanatory to the person who chose it.
    private func heroRow(_ r: MetricsPage.Row) -> some View {
        VStack(alignment: .leading, spacing: -2) {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                if let ic = r.icon { glyph(ic, size: 22) }
                Text(r.value)
                    .font(.system(size: 50, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .foregroundStyle(status?.tint ?? Brand.accent)
                if let u = r.unit {
                    Text(u)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Brand.inkSoft)
                }
            }
            Text(r.label)
                .font(.system(size: 10, weight: .bold))
                .kerning(0.5)
                .foregroundStyle(Brand.inkFaint)
        }
        .padding(.bottom, 6)
    }

    /// Supporting numbers: still big enough to read moving, with the label immediately after the
    /// value rather than across the watch from it.
    private func secondaryRow(_ r: MetricsPage.Row) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            if let ic = r.icon { glyph(ic, size: 14) }
            // ⚠️ 24pt was too small to read moving — his words, on a real run. These are the numbers
            // you glance at mid-stride, so they get the increase the hero does not need.
            Text(r.value)
                .font(.system(size: 30, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(Brand.ink)
            if let u = r.unit {
                Text(u)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.inkFaint)
            }
            Text(r.label)
                .font(.system(size: 10, weight: .bold))
                .kerning(0.3)
                .foregroundStyle(Brand.inkFaint)
                .padding(.leading, 3)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 1)
    }

    /// The row's leading glyph — the zone-tinted heart. The tint carries the zone by itself
    /// (owner's call: no digit inside the heart), which is safe only because every zone's tint is
    /// distinct, including "no data".
    private func glyph(_ ic: MetricsPage.Icon, size: CGFloat) -> some View {
        Image(systemName: ic.systemName)
            .font(.system(size: size, weight: .bold))
            .foregroundStyle(ic.tint)
    }

    /// How far through the current step, with the step's own words above it. The reference watch app
    /// carries a bar like this and it answers "how much more of this?" without a page swipe.
    private func progress(_ p: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            if let s = stepLabel {
                // ⚠️ TWO LINES, because one truncated it mid-sentence: "EASE IN — START GENTLY AND
                // LET THE…". A coaching cue you cannot finish reading is worse than no cue — it takes
                // the space and gives nothing back. Sentence case rather than caps: caps are for the
                // one-word labels, and a full sentence in caps is markedly slower to read.
                Text(s)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Brand.line)
                    Capsule().fill(Brand.accent)
                        .frame(width: max(2, geo.size.width * min(max(p, 0), 1)))
                }
            }
            .frame(height: 4)
        }
    }
}
