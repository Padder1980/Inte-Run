import SwiftUI

/// The pace band, given a whole page.
///
/// It used to sit squeezed above the numbers on the metrics page, where it was too small to read at
/// running cadence and made everything around it harder to read too. On its own page it can be the
/// size it needs to be, and it carries heart rate as well — pace and heart rate are the pair you
/// read together to know whether an effort is honest, so splitting them across pages was wrong.
///
/// The axis runs fast-on-the-left, matching how runners read pace (a smaller number is quicker).
struct PaceView: View {
    @ObservedObject var workout: WorkoutManager

    var body: some View {
        VStack(spacing: 0) {
            header
            paceReadout
            if let band = workout.targetBand {
                needle(low: band.low, high: band.high).padding(.top, 11)
                targetEdges(band).padding(.top, 5)
            } else {
                Text("This session sets no pace target — run it by feel.")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkFaint)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }
            Spacer(minLength: 8)
            heartRate
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 2)
        .padding(.bottom, 10)   // clear of the page dots
    }

    // MARK: - Pieces

    /// The verdict, as a quiet capsule rather than shouting text. A word you can catch in a glance
    /// beats a colour alone, and the capsule keeps it from competing with the pace itself.
    private var header: some View {
        HStack(spacing: 5) {
            Circle().fill(tint).frame(width: 6, height: 6)
            Text(verdictLabel)
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .kerning(0.5)
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Capsule().fill(tint.opacity(0.16)))
        .overlay(Capsule().strokeBorder(tint.opacity(0.32), lineWidth: 0.5))
    }

    /// The number itself, at the size the page exists to allow.
    private var paceReadout: some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(workout.paceText)
                .font(.system(size: 44, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .foregroundStyle(Brand.ink)
            Text("/KM")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Brand.inkFaint)
        }
        .padding(.top, 7)
    }

    private func targetEdges(_ band: (low: Int, high: Int)) -> some View {
        HStack(spacing: 0) {
            Text(mmss(band.low)).font(.system(size: 11, weight: .semibold)).monospacedDigit()
            Spacer(minLength: 6)
            Text("TARGET").font(.system(size: 8.5, weight: .bold)).kerning(0.6)
            Spacer(minLength: 6)
            Text(mmss(band.high)).font(.system(size: 11, weight: .semibold)).monospacedDigit()
        }
        .foregroundStyle(Brand.inkFaint)
    }

    /// Heart rate belongs here: pace tells you what you are doing, heart rate tells you what it is
    /// costing, and reading one without the other is how an easy run quietly becomes a hard one.
    private var heartRate: some View {
        HStack(spacing: 5) {
            Image(systemName: "heart.fill")
                .font(.system(size: 11))
                .foregroundStyle(Brand.rest)
                .symbolEffect(.pulse, options: .repeating, isActive: workout.heartRate > 0)
            Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
                .font(.system(size: 21, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Brand.ink)
            Text("BPM")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Brand.inkFaint)
            Spacer(minLength: 0)
            Text(workout.avgPaceText + " AVG")
                .font(.system(size: 10, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Brand.inkFaint)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(Brand.surface2.opacity(0.85))
        )
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
                Capsule().fill(Brand.surface2).frame(height: 14)
                Capsule()
                    .fill(LinearGradient(colors: [Brand.markDeep, Brand.mark],
                                         startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(12, width * bandWidth), height: 14)
                    .offset(x: width * bandStart)
                if let f = mark {
                    // A pointer rather than a bar: it has a direction, so which side of the band
                    // you are on is legible without reading the label above it.
                    VStack(spacing: 0) {
                        Triangle().fill(tint).frame(width: 12, height: 8)
                        Rectangle().fill(tint).frame(width: 3, height: 18)
                    }
                    .shadow(color: .black.opacity(0.45), radius: 1.5, y: 0.5)
                    .offset(x: min(width - 12, max(0, width * f - 6)), y: -4)
                    .animation(.easeOut(duration: 0.35), value: f)
                }
            }
            .frame(height: 26)
        }
        .frame(height: 26)
        .accessibilityLabel("Target \(mmss(low)) to \(mmss(high)) per kilometre. \(verdictLabel).")
    }

    private var tint: Color {
        switch workout.paceVerdict {
        case .good: return Brand.effEasy
        case .tooFast, .tooSlow: return Brand.ease
        default: return Brand.inkFaint
        }
    }

    private var verdictLabel: String {
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
