import SwiftUI
import WatchKit

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
    /// Which device owns this run, when it is worth saying — one short word shown BEFORE the clock in
    /// the same reserved strip, so it costs no height at all. Nil for a run recorded on this wrist,
    /// where there is nothing to disambiguate.
    ///
    /// ⚠️ LEADING, NEVER TRAILING. The strip is the topmost line on the display and this page's own
    /// notes above record losing characters to the top corners twice; the trailing end of the top
    /// strip is the worst place on the screen to put a word. Left of the clock it sits inside the same
    /// inset the clock already survives.
    ///
    /// ⚠️ It is deliberately NOT folded into `status`. Status replaces the clock, and a mirror screen
    /// that gave up its clock to say "iPhone" would be trading the number a runner looks at most for a
    /// fact that does not change.
    var provenance: (text: String, tint: Color)?
    /// In the runner's own chosen order. The first is the hero.
    var rows: [Row]
    /// Progress through the current step, 0–1. Nil for a run with no structure.
    var stepProgress: Double?
    /// The step's own words, e.g. "2 km at 4:55/km" — context for the progress bar.
    var stepLabel: String?

    // MARK: - The strip watchOS shares with us

    /// The page's own inset from the glass. One owner, because the strip's clock reserve below is
    /// expressed from the DISPLAY's trailing edge and has to subtract it.
    private static let edge: CGFloat = 8

    /// ⚠️ THE TRAILING END OF THE TOP STRIP BELONGS TO watchOS, AND NOTHING WAS LEAVING IT ALONE.
    ///
    /// The system draws the time in the top-trailing corner, over whatever the app has put there.
    /// This page's strip filled the whole width and ended in `Spacer(minLength: 0)`, so on the small
    /// watches the app's own content ran straight under it. Measured by colour separation on five
    /// real simulators (the app never uses pure white; the system clock is exactly 255,255,255), the
    /// gap between the app's rightmost ink and the clock's leftmost glyph, in the rows they share:
    ///
    ///     size            running        paused ("PAUSED · IPHONE")
    ///     40mm (162pt)    +3px           −48px
    ///     41mm (176pt)    +27px          −24px
    ///     42mm (187pt)    +46px          −5px
    ///     45mm (198pt)    own line       own line
    ///     49mm (205pt)    own line       own line
    ///
    /// So "PAUSED · IPHO" plus a clock on top of the rest of the word, on three of the five sizes —
    /// and the +3px is no better: the spacing WITHIN a number is 4–5px, so "23:10" beside "06:19"
    /// rendered as "23:1006:19", one long number. The owner happens to own the one size where the
    /// system gives its clock a line of its own.
    ///
    /// ⚠️ IT CANNOT BE FIXED BY MOVING DOWN, and that is why this is a width. The page is vertically
    /// CENTRED, so where the strip lands depends on how tall the content is: the same view puts the
    /// strip on the clock's row when there are three metrics and below it when the phone has not
    /// ticked yet. Top-anchoring it instead would raise the FIRST METRIC ROW into the clock's row on
    /// the big watches, where its label already reaches x=340 of 396. A reserved width is true
    /// wherever the block happens to sit.
    ///
    /// ⚠️ MEASURED, NOT GUESSED, AND IT IS PROPORTIONAL BECAUSE THE THING IT AVOIDS IS. The clock's
    /// leading edge sits at 0.679 / 0.693 / 0.700 / 0.710 / 0.705 of the display width across those
    /// five sizes — near enough constant, so a fraction tracks it where a constant would not. This
    /// fraction plus the page's own `edge` puts the strip's content right edge at 0.66 of the display
    /// width, which leaves 11–18pt of daylight at every size, including the 40mm that is the smallest
    /// watch `WATCHOS_DEPLOYMENT_TARGET` admits.
    ///
    /// ⚠️ Read from the device rather than passed in. This page is otherwise pure — plain strings, no
    /// `WorkoutManager` — and a display width is a device constant rather than app state; passing it
    /// in would make every caller responsible for remembering, which is the convention-somebody-
    /// breaks trap this project has shipped twice. There is exactly one reader, below.
    private static let clockReserveFraction: CGFloat = 0.34

    /// The reserve as a trailing inset inside the page's own content box, which `edge` has already
    /// pulled in from the glass. Total space left to watchOS is therefore this plus `edge`.
    private static var clockInset: CGFloat {
        WKInterfaceDevice.current().screenBounds.width * clockReserveFraction
    }

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
            // ⚠️ ONE STRIP, ONE LINE. The elapsed clock had a line of its own beneath this, and with
            // four metrics below it the page simply did not fit — the overflow is what clipped the
            // clock into the top curve. The reference app puts a single word here and nothing else,
            // with the system clock opposite; this carries the run clock in that same strip, which
            // costs no height at all.
            //
            // ⚠️⚠️ NOTHING IN THIS STRIP MAY CARRY `.kerning`, AND THE REASON IS THE WHOLE FIX.
            // A `Text` with custom letter spacing does not honour `minimumScaleFactor` — it
            // TRUNCATES instead of shrinking. Both of these strings already carried a scale factor
            // AND a kerning, so the give they were written for had never once worked: measured on a
            // 40mm watch with the clock's columns reserved, "PAUSED · IPHONE" rendered as
            // "PAUSED · IPHO…" and "IPHONE" as "IPH…", while the identical view with the kerning
            // deleted shrank and fitted whole. That is also why the fault this reserve fixes
            // presented as an OVERPRINT rather than as small text in the first place: given too
            // little room the strip did not shrink, it ran on under the system clock.
            // Half a point of tracking is not worth the word.
            HStack(spacing: 6) {
                if let status {
                    // ⚠️ ONE LINE, ALWAYS. The strip is reserved at a single line's height precisely so
                    // the rows below never move; a status long enough to wrap would take a second line
                    // out of them and push the last metric into the bottom curve. "Paused" always fit,
                    // so nothing forced it — until the companion started putting the run's provenance
                    // here ("PAUSED · IPHONE"). Shrinking beats wrapping.
                    Text(status.text.uppercased())
                        .font(.system(size: 13, weight: .heavy))
                        .lineLimit(1)
                        // 0.6, not 0.7. With the clock's own columns reserved, "PAUSED · IPHONE"
                        // needs 0.72 of its size to fit a 40mm watch — measured — so a 0.7 floor sat
                        // three points from truncating, and what truncation gives you here is
                        // "PAUSED · IPHO…", which is the defect this reserve exists to remove
                        // wearing an ellipsis. The floor costs nothing at any size that fits.
                        .minimumScaleFactor(0.6)
                        .foregroundStyle(status.tint)
                } else {
                    if let p = provenance {
                        Text(p.text.uppercased())
                            .font(.system(size: 11, weight: .heavy))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .foregroundStyle(p.tint)
                    }
                    if let elapsed {
                        Text(elapsed)
                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .lineLimit(1)
                            // ⚠️ THE CLOCK HAD NO GIVE AT ALL, and past an hour it needs some: the
                            // companion renders h:mm:ss, which is 62pt of monospaced digits against
                            // the 85pt the whole strip gets on a 40mm watch. With nothing to shrink,
                            // a long run's clock is the one thing that would truncate — and a clock
                            // reading "1:05:2…" is worse than a small one. It takes the priority so
                            // the WORD beside it gives way first; the number is what is being read.
                            .minimumScaleFactor(0.7)
                            .layoutPriority(1)
                            .foregroundStyle(Brand.ink)
                    }
                }
                // ⚠️ NO SPACER. There was one, and it cost the word: an HStack shares its width
                // among the children that can flex, a Spacer flexes without limit, and its share
                // plus the 6pt of spacing it brought with it left "IPHONE 23:10" rendering as
                // "IPH… 23:10" on a 40mm watch — measured, 33..173px of ink in a 198px box, i.e.
                // truncated with room going spare. `.frame(alignment: .leading)` below already
                // pushes the strip to the leading edge, so the Spacer was never doing anything the
                // frame was not; taking it out gives the two words the whole strip to negotiate over.
            }
            .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
            .padding(.leading, 6)
            // ⚠️ THE ONE READER OF THE RESERVE. See `systemClockReserve` above for the measurements;
            // without this the strip runs under the system clock on every watch below 45mm.
            .padding(.trailing, MetricsPage.clockInset)
            .padding(.bottom, 2)


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
        .padding(.top, MetricsPage.edge)
        .padding(.horizontal, MetricsPage.edge)
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
        // ⚠️ THE LABEL GOES TO THE RIGHT, WRAPPED ONTO TWO SHORT LINES. This is the whole trick, and
        // it took three wrong attempts to see it. Beside the number on ONE line, the words stole the
        // width and `minimumScaleFactor` silently shrank the digits to 15pt. Underneath, the number
        // was full size but every row became two lines tall — so with four metrics saved the page
        // overflowed, pushing the clock into the top curve and shoving AVG PACE off the bottom.
        //
        // Wrapped to the right, the label uses vertical space the number already occupies. The row
        // stays one number high, the number keeps its size, and four rows still fit. That is what the
        // reference app does — "NEXT / LAP", "CUR / PACE" — and why its screen holds more while
        // reading bigger.
        HStack(alignment: .center, spacing: 0) {
            if let ic = r.icon { glyph(ic, size: 22).padding(.trailing, 4) }
            // ⚠️ THE NUMBER GETS THE WIDTH FIRST, AND WITHOUT THIS IT DID NOT. Measured on a 41mm
            // watch (176pt wide): "1.42 KM DISTANCE" wants about 177pt of the 160pt available, and
            // SwiftUI divided the shortfall by shrinking the row's flexible children — so the VALUE
            // came out as "1...." and a three-digit heart rate as "...". The label losing a couple of
            // points is invisible; the number losing its digits is the whole screen failing. Same
            // fault the layout notes above record twice already, one screen size further down.
            Text(r.value)
                .font(.system(size: 42, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.85)
                .lineLimit(1)
                .layoutPriority(2)
                .foregroundStyle(Brand.accent)
            // The unit rides on the number with no gap, so "3.50KM" reads as one token rather than
            // two competing things — so it takes the same priority as the number it belongs to.
            if let u = r.unit {
                Text(u)
                    .font(.system(size: 16, weight: .bold))
                    .lineLimit(1)
                    .layoutPriority(2)
                    .foregroundStyle(Brand.ink)
            }
            // ⚠️ A ONE-WORD CAPTION MUST NOT BREAK, and a flat `lineLimit(2)` let it. Once the number
            // took priority, "HEART" had the room taken from it instead and SwiftUI split it across
            // two lines as "HEAR / T" — a caption hyphenated mid-word reads as damage. The two-word
            // captions carry an explicit newline from `wrapped()`, so the limit follows the string:
            // two lines only when there really are two words, and shrinking is the give otherwise.
            let label = wrapped(r.label)
            Text(label)
                .font(.system(size: 12, weight: .bold))
                // ⚠️ NO `.kerning` — SAME MECHANISM AS THE STRIP ABOVE, AND IT WAS COSTING A WORD
                // HERE TOO. With 0.2pt of tracking this caption did not shrink, it truncated:
                // measured on a 40mm watch, "DISTANCE" rendered "DISTAN…" beside a number with room
                // to spare beneath it. The scale factor below has been the intended give since the
                // page was built and was inert the whole time.
                .lineSpacing(-2)
                .foregroundStyle(Brand.ink)
                .lineLimit(label.contains("\n") ? 2 : 1)
                // 0.7, not 0.8: a single-word caption ("DISTANCE", "CALORIES") cannot wrap, so
                // shrinking is the only give it has — and 0.8 was not enough give at 41mm.
                .minimumScaleFactor(0.7)
                .padding(.leading, 6)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 1)
    }

    /// Break a two-word label so it stacks beside the number instead of stretching the row.
    /// ⚠️ Done here rather than by letting SwiftUI choose, because a label allowed to wrap naturally
    /// takes whatever width is left and pushes the number to shrink — which is the fault this layout
    /// exists to remove.
    private func wrapped(_ label: String) -> String {
        let parts = label.split(separator: " ")
        guard parts.count == 2 else { return label }
        return parts[0] + "\n" + parts[1]
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
