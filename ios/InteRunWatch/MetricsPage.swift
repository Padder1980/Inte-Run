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
/// The hierarchy rules, all learned from watching the screen at arm's length while moving — and then
/// from the owner reporting three times that the numbers were still too small:
/// - **Three metrics, not five.** Five numbers on a watch face means five small numbers.
/// - **No hero.** Among three, making one bigger just makes the other two the small ones again.
/// - **The label goes UNDERNEATH the number, and this is the one that mattered.** Beside it, the label
///   and unit competed for the same 205pt of width and `minimumScaleFactor` silently shrank the digits
///   to fit — measured at 15pt of cap height from a 40pt font. On its own line the number keeps the
///   whole display: 26pt from a 46pt font, a 73% increase, with no font change that would have shown
///   up in a diff. Raising the point size would have done nothing; the constraint was the width left
///   over after the words.
/// - **Number in the accent, words in bright white.** `inkFaint` labels vanish outdoors.
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

    /// One word, centred at the top, when the run is not simply running. Nil when it is.
    var status: (text: String, tint: Color)?
    /// ⚠️ THE CLOCK IS ITS OWN LINE NOW, not the biggest number on the page. Owner's call after a real
    /// run: "the continuous elapsed time to be in white at the top but smaller". It is the one figure
    /// that is always wanted and never urgent — you glance at it between efforts, not mid-stride — so
    /// spending the largest type on it was taking the size away from the numbers being read on the move.
    var elapsed: String?
    /// In the runner's own chosen order. The first is the hero.
    var rows: [Row]
    /// Progress through the current step, 0–1. Nil for a run with no structure.
    var stepProgress: Double?
    /// The step's own words, e.g. "2 km at 4:55/km" — context for the progress bar.
    var stepLabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // ⚠️ THE TOP STRIP IS ALWAYS RESERVED, WHETHER OR NOT THERE IS A STATUS WORD.
            //
            // This is the third and last form of the same fault. Centring fixed PAUSED — centred text
            // cannot be reached by either corner at any radius — but it fixed only the paused case.
            // With no status the hero number became the FIRST line, rode up into the curve, and the
            // owner photographed a running screen with the "3" of 3:26 shaved. The biggest number on
            // the display, clipped, on the screen you look at most.
            //
            // Reserving the strip solves both at once and also delivers what the old comment here
            // already CLAIMED to deliver — "so the hero number does not move when a run is not
            // paused". It did move: pausing pushed everything down a line. A layout that shifts on
            // pause is its own legibility problem at arm's length.
            //
            // ⚠️ Do not replace this with a bigger leading inset on the hero. For a ~62pt corner
            // radius, text 6pt from the top edge needs ~35pt of inset — a third of the width of the
            // watch, taken from the one number that has to be readable at a glance. Move the content
            // out of the curve instead of squeezing it past.
            ZStack {
                if let status {
                    Text(status.text.uppercased())
                        .font(.system(size: 13, weight: .heavy))
                        .kerning(0.6)
                        .foregroundStyle(status.tint)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 20, alignment: .center)
            .padding(.bottom, 2)

            if let elapsed {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(elapsed)
                        .font(.system(size: 26, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(status?.tint ?? Brand.ink)
                    Text("ELAPSED")
                        .font(.system(size: 10, weight: .bold))
                        .kerning(0.4)
                        .foregroundStyle(Brand.ink)
                    Spacer(minLength: 0)
                }
                .padding(.leading, 2)
                .padding(.bottom, 4)
            }

            // ⚠️ EVERY ROW THE SAME SIZE, AND ALL OF THEM BIG. There is no hero any more: with three
            // metrics instead of five there is room to make each one readable at arm's length, which
            // is the whole point. A hero among three just makes the other two the small ones again.
            ForEach(rows) { r in
                metricRow(r)
            }

            Spacer(minLength: 0)

            if let p = stepProgress {
                progress(p)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // ⚠️ THE ROUNDED GLASS CUTS INTO EVERY EDGE, AND IT TOOK FOUR ATTEMPTS TO STOP FIGHTING IT.
        // "AUSED" at 2pt of inset; still clipped at 16pt; centring the status word fixed the paused
        // case and left the hero clipped whenever the run was NOT paused; and the progress bar's left
        // end sat outside the glass in every state. The pattern in all four is the same — content
        // placed at an extreme edge and a margin chosen by eye.
        // ⚠️ 8pt, not 2pt. A couple of points buys margin against a corner radius I do not actually
        // know, and costs almost nothing on numbers that are 50pt and 30pt tall. Guessing the exact
        // inset is what failed twice; leaving real headroom is what does not.
        .padding(.top, 8)
        .padding(.horizontal, 8)
        // ⚠️ LIFTED CLEAR OF THE CURVE, not just of the page dots. The lower the text, the further in
        // the rounded glass cuts, so the bottom-most line needs vertical clearance as well as a
        // leading inset — either alone still loses characters.
        .padding(.bottom, 18)
    }

    // MARK: - Rows

    /// One metric: a big number and the words that say what it is.
    ///
    /// ⚠️ THE COLOURS ARE HIS, FROM A REAL RUN. "the wording e.g. km curr pace needs to be in bright
    /// white and the clock digits down the left hand side to be bright teal". The numbers were white
    /// on near-black and the labels were `inkFaint` — which is a deliberate hierarchy on a phone at
    /// reading distance and the wrong one on a wrist at arm's length in daylight, where the faint
    /// grey simply disappears and nothing tells you which number you are looking at.
    private func metricRow(_ r: MetricsPage.Row) -> some View {
        // ⚠️ THE LABEL GOES UNDERNEATH, and that is what actually makes the number big.
        //
        // It was beside the number, sharing one line with the unit — and the number carried
        // `minimumScaleFactor(0.55)`. So a 40pt font was a CEILING it almost never reached: with
        // "CUR PACE" and "DISTANCE" competing for the same 205pt of width, SwiftUI shrank the digits
        // to fit, as far as 22pt. Setting a bigger number here would have changed nothing, because
        // the constraint was never the font size — it was the width left over after the words.
        //
        // On its own line the number has the whole display and renders at its stated size. The words
        // sit under it, small and bright white, where they cost the number nothing.
        VStack(alignment: .leading, spacing: -4) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                if let ic = r.icon { glyph(ic, size: 22) }
                Text(r.value)
                    .font(.system(size: 46, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    // Only a genuinely enormous value may shrink, and only a little.
                    .minimumScaleFactor(0.8)
                    .lineLimit(1)
                    .foregroundStyle(Brand.accent)
                if let u = r.unit {
                    Text(u)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Brand.ink)
                }
                Spacer(minLength: 0)
            }
            Text(r.label)
                .font(.system(size: 11, weight: .bold))
                .kerning(0.4)
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
        }
        .padding(.bottom, 4)
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
                // ⚠️ AND THE BOTTOM CORNER EATS THE SECOND LINE. Fixing the truncation created a
                // second line of text at the very bottom-left — the deepest part of the lower curve —
                // and the owner photographed it reading "…ce come to you", with the "pa" of "pace"
                // outside the glass. Same fault as the status word, opposite corner, and it appeared
                // only BECAUSE the cue now wraps. The inset is the one the status row needs, applied
                // to whichever line sits lowest.
                Text(s)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.inkSoft)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 16)
                    .padding(.trailing, 6)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Brand.line)
                    Capsule().fill(Brand.accent)
                        .frame(width: max(2, geo.size.width * min(max(p, 0), 1)))
                }
            }
            .frame(height: 4)
            // ⚠️ THE BAR NEEDS THE SAME INSET AS THE TEXT ABOVE IT. It spans the full width at the very
            // bottom of the display, so its left end sat outside the glass — found by counting bright
            // pixels beyond a corner mask rather than by looking, which is exactly the kind of small
            // clipping the eye skips over. Matching the cue's inset also lines the two up.
            .padding(.horizontal, 16)
        }
    }
}
