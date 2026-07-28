import SwiftUI

/// The pace band, given a whole page.
///
/// It used to sit squeezed above the numbers on the metrics page, where it was too small to read at
/// running cadence and made everything around it harder to read too. On its own page it can be the
/// size it needs to be: one verdict word you can take in at a glance, a needle showing where you
/// are, and the band's edges labelled so the number has a context.
///
/// The axis runs fast-on-the-left, matching how runners read pace (a smaller number is quicker).
struct PaceView: View {
    @ObservedObject var workout: WorkoutManager

    var body: some View {
        VStack(spacing: 0) {
            if let band = workout.targetBand {
                Text(verdictLabel(band))
                    .font(.system(size: 19, weight: .heavy, design: .rounded))
                    .foregroundStyle(tint)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .padding(.bottom, 2)

                Text(workout.paceText + " /KM")
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .padding(.bottom, 10)

                needle(low: band.low, high: band.high)

                HStack {
                    Text(mmss(band.low)).font(.system(size: 11, weight: .semibold))
                    Text("TARGET").font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
                    Text(mmss(band.high)).font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.secondary)
                .padding(.top, 6)
            } else {
                Text("BY FEEL")
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                    .foregroundStyle(Brand.inkFaint)
                Text("This session sets no pace target.")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
                Text(workout.paceText + " /KM")
                    .font(.system(size: 26, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .padding(.top, 12)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 2)
        .padding(.bottom, 10)   // clear of the page dots
        .accessibilityElement(children: .combine)
    }

    // MARK: - The needle

    /// A window a little wider than the band, so being outside it is still visible rather than
    /// silently pinned to an edge — "off the scale" and "just outside" must not look the same.
    private func window(low: Int, high: Int) -> (lo: Double, hi: Double) {
        let pad = max(25, Double(high - low) * 0.8)
        return (Double(low) - pad, Double(high) + pad)
    }

    private func needle(low: Int, high: Int) -> some View {
        let w = window(low: low, high: high)
        let span = max(1, w.hi - w.lo)
        let bandStart = (Double(low) - w.lo) / span
        let bandWidth = Double(high - low) / span
        let mark: Double? = workout.paceSecPerKm.flatMap {
            guard $0.isFinite, $0 > 0 else { return nil }
            return min(1, max(0, ($0 - w.lo) / span))
        }

        return GeometryReader { geo in
            let width = geo.size.width
            ZStack(alignment: .leading) {
                Capsule().fill(Color.gray.opacity(0.28)).frame(height: 12)
                Capsule().fill(Color.green.opacity(0.5))
                    .frame(width: max(10, width * bandWidth), height: 12)
                    .offset(x: width * bandStart)
                if let f = mark {
                    // A pointer rather than a bar: it has a direction, so which side of the band
                    // you are on is obvious without reading the label above.
                    VStack(spacing: 0) {
                        Triangle().fill(tint).frame(width: 11, height: 7)
                        Rectangle().fill(tint).frame(width: 3, height: 17)
                    }
                    .offset(x: min(width - 11, max(0, width * f - 5.5)), y: -3)
                    .animation(.easeOut(duration: 0.35), value: f)
                }
            }
            .frame(height: 24)
        }
        .frame(height: 24)
    }

    private var tint: Color {
        switch workout.paceVerdict {
        case .good: return .green
        case .tooFast, .tooSlow: return .orange
        default: return Brand.inkFaint
        }
    }

    private func verdictLabel(_ band: (low: Int, high: Int)) -> String {
        switch workout.paceVerdict {
        case .noTarget: return "BY FEEL"
        case .noSignal: return "FINDING GPS"
        case .tooFast: return "EASE OFF"
        case .good: return "GOOD PACE"
        case .tooSlow: return "PICK IT UP"
        }
    }

    private func mmss(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
}

/// A downward-pointing triangle — the needle's head.
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.closeSubpath()
        return p
    }
}
