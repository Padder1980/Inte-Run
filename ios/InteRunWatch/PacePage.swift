import SwiftUI

/// The pace page of a live run — one swipe right from the numbers.
///
/// The owner supplied a reference layout he finds legible mid-run and asked for it "with my
/// branding", so the *structure* is the reference's and every colour and token is Inte-Run's:
///
///   elapsed, small and quiet
///   880 M TO GO                ← the hero: what's left of the current step, in the accent
///   5:50   GOOD PACE   5:30    ← slow edge LEFT, verdict centre, fast edge RIGHT
///   ───────█████──▮──────      ← the prescribed band on a muted track, marker at current pace
///              ◤5:34◥          ← a bubble pinned to the marker saying what you're running NOW
///   5:33 /KM LAP PACE          ← the smoothed number underneath
///   ▁▁▁▁▁▁▁▁ step progress
///   TOTAL DIST: 2.12 KM
///
/// ⚠️ **The axis runs slow-on-the-LEFT, fast-on-the-RIGHT**, and the labels, band and marker must
/// all agree on that. The predecessor (`PaceBandView`, now deleted) printed its labels slow-left
/// while computing the marker fast-left — mirror images — so a runner far *slower* than the band
/// saw the marker pinned at the *fast* end while the verdict said PICK IT UP. The owner hit exactly
/// that on a real run. Slow-left also gives the accelerator reading: "pick it up" means the marker
/// needs to move right.
///
/// Like `MetricsPage`, this is a **pure** view: plain values in, no `WorkoutManager`, so
/// `WatchPreview` can render every state without a workout, GPS or a plan.
struct PacePage: View {
    /// Total elapsed, shown small at the top. Nil when it is already the hero (a free run).
    var elapsed: String?
    /// The big number: what remains of the current step ("880", "M TO GO"). For a free run the
    /// mapper passes elapsed here instead — there is no step to count down.
    var hero: (value: String, unit: String)
    /// The prescribed band in s/km. Nil for a session with no pace target.
    var band: (low: Int, high: Int)?
    var verdict: WorkoutManager.PaceVerdict
    /// Current pace in s/km for the marker position, and its text for the bubble. Nil = no GPS fix.
    var currentSec: Double?
    var currentText: String
    /// The steadier readout under the band.
    var lap: (value: String, label: String)
    /// 0–1 through the current step; nil hides the bar (free run, or a step with no defined end).
    var stepProgress: Double?
    var totalDist: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let elapsed {
                Text(elapsed)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Brand.ink)
            }

            heroRow

            if let band {
                bandBlock(band).padding(.top, 4)
            } else {
                Text("No pace target — run this one by feel.")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
            }

            Spacer(minLength: 2)

            lapRow

            Spacer(minLength: 2)

            if let p = stepProgress {
                ProgressBar(fraction: p).padding(.bottom, 3)
            }
            Text("TOTAL DIST: \(totalDist)")
                .font(.system(size: 12, weight: .bold))
                .kerning(0.3)
                .foregroundStyle(Brand.ink)
                .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 2)
        .padding(.bottom, 12)   // clear of the page dots
    }

    // MARK: - Pieces

    private var heroRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(hero.value)
                .font(.system(size: 36, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(Brand.accent)
            Text(hero.unit)
                .font(.system(size: 12, weight: .bold))
                .kerning(0.4)
                .foregroundStyle(Brand.accent.opacity(0.75))
        }
    }

    private var lapRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(lap.value)
                .font(.system(size: 32, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(Brand.accent)
            Text("/KM")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Brand.ink)
            Text(lap.label)
                .font(.system(size: 12, weight: .bold))
                .kerning(0.3)
                .foregroundStyle(Brand.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.leading, 2)
            Spacer(minLength: 0)
        }
    }

    // MARK: - The band

    /// A window a little wider than the band, so "just outside" and "off the scale" look different
    /// rather than both silently pinning to an edge.
    private func window(_ band: (low: Int, high: Int)) -> (lo: Double, hi: Double) {
        let pad = max(25, Double(band.high - band.low) * 0.8)
        return (Double(band.low) - pad, Double(band.high) + pad)
    }

    /// Position on the slow-left axis: 0 = slowest edge of the window, 1 = fastest.
    /// ⚠️ This is THE line the old view got mirrored. Bigger seconds = slower = smaller fraction.
    private func fraction(_ sec: Double, in band: (low: Int, high: Int)) -> Double {
        let w = window(band)
        return min(1, max(0, (w.hi - sec) / max(1, w.hi - w.lo)))
    }

    private func bandBlock(_ band: (low: Int, high: Int)) -> some View {
        let zoneStart = fraction(Double(band.high), in: band)          // slow edge of the zone
        let zoneWidth = fraction(Double(band.low), in: band) - zoneStart
        let mark: Double? = currentSec.flatMap { $0.isFinite && $0 > 0 ? fraction($0, in: band) : nil }

        return VStack(spacing: 0) {
            // Slow on the left, fast on the right — the same order the geometry uses below.
            HStack {
                // ⚠️ BIGGER AND BRIGHTER — "the bar and the numbers are far too small and dim to see".
                // inkSoft is a mid-grey on near-black: fine on a phone at reading distance, gone on a
                // wrist in daylight. These two numbers are the point of the bar — they say what the
                // band actually IS.
                Text(mmss(band.high))
                    .font(.system(size: 15, weight: .bold)).monospacedDigit()
                    .foregroundStyle(Brand.ink)
                Spacer(minLength: 4)
                Text(verdictLabel)
                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                    .kerning(0.5)
                    .foregroundStyle(tint)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                Text(mmss(band.low))
                    .font(.system(size: 15, weight: .bold)).monospacedDigit()
                    .foregroundStyle(Brand.ink)
            }
            .padding(.bottom, 4)

            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(Brand.surface2).frame(height: 16)
                    Capsule()
                        .fill(LinearGradient(colors: [Brand.markDeep, Brand.mark],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(10, w * zoneWidth), height: 16)
                        .offset(x: w * zoneStart)
                    if let f = mark {
                        Capsule().fill(Brand.ink)
                            .frame(width: 5, height: 28)
                            .shadow(color: .black.opacity(0.5), radius: 1, y: 0.5)
                            .offset(x: min(w - 4, max(0, w * f - 2)))
                            .animation(.easeOut(duration: 0.35), value: f)
                    }
                }
                .frame(height: 16)
            }
            .frame(height: 16)

            // The bubble: what you are running right now, pinned under the marker. High-contrast
            // ink-on-dark inverted, so it is the one thing on the page that reads like a callout.
            GeometryReader { geo in
                if let f = mark {
                    let w = geo.size.width
                    // Approximate half-width so the bubble clamps inside the screen instead of
                    // clipping at the edges when the marker is pinned.
                    let half = CGFloat(currentText.count) * 4.5 + 10
                    BubbleCallout(text: currentText)
                        .position(x: min(w - half, max(half, w * f)), y: 15)
                        .animation(.easeOut(duration: 0.35), value: f)
                }
            }
            .frame(height: 28)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Target \(mmss(band.low)) to \(mmss(band.high)) per kilometre, currently \(currentText). \(verdictLabel).")
    }

    private var tint: Color {
        switch verdict {
        case .good: return Brand.effEasy
        case .tooFast, .tooSlow: return Brand.ease
        default: return Brand.inkFaint
        }
    }

    private var verdictLabel: String {
        switch verdict {
        case .noTarget: return "BY FEEL"
        case .noSignal: return "FINDING GPS"
        case .tooFast: return "EASE OFF"
        case .good: return "GOOD PACE"
        case .tooSlow: return "PICK IT UP"
        }
    }

    private func mmss(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
}

/// The current-pace callout: an upward arrow into a rounded tag.
private struct BubbleCallout: View {
    let text: String
    var body: some View {
        VStack(spacing: 0) {
            UpTriangle()
                .fill(Brand.ink)
                .frame(width: 10, height: 5)
            Text(text)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Brand.bg)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Brand.ink))
        }
    }
}

private struct UpTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

/// The thin step-progress bar shared by the bottom of this page.
private struct ProgressBar: View {
    let fraction: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Brand.line)
                Capsule().fill(Brand.accent)
                    .frame(width: max(2, geo.size.width * min(max(fraction, 0), 1)))
            }
        }
        .frame(height: 4)
    }
}
