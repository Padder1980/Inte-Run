import SwiftUI

/// Where you are against the pace the plan asked for.
///
/// The band itself is the point. A number alone makes you do the arithmetic mid-run; a band tells
/// you at a glance whether you are where you should be, and the target comes from your plan rather
/// than something you typed in beforehand.
///
/// Faster pace = smaller seconds, so the axis runs fast-on-the-left to match how runners read pace.
struct PaceBandView: View {
    let low: Int          // fast edge, s/km
    let high: Int         // slow edge, s/km
    let current: Double?  // s/km, nil when there is no GPS fix yet
    let verdict: WorkoutManager.PaceVerdict

    /// Show a window a little wider than the band so "outside it" is still visible rather than
    /// pinned silently to an edge.
    private var window: (lo: Double, hi: Double) {
        let pad = max(25, Double(high - low) * 0.8)
        return (Double(low) - pad, Double(high) + pad)
    }

    private var markerFraction: Double? {
        guard let c = current, c.isFinite, c > 0 else { return nil }
        let w = window
        return min(1, max(0, (c - w.lo) / (w.hi - w.lo)))
    }

    private var bandRange: (start: Double, width: Double) {
        let w = window
        let span = w.hi - w.lo
        return ((Double(low) - w.lo) / span, Double(high - low) / span)
    }

    private var tint: Color {
        switch verdict {
        case .good: return .green
        case .tooFast, .tooSlow: return .orange
        default: return .gray
        }
    }

    var body: some View {
        VStack(spacing: 3) {
            HStack {
                Text(mmss(high)).font(.system(size: 11)).foregroundStyle(.secondary)
                Spacer()
                Text(verdict == .noSignal ? "FINDING GPS" : verdictLabel)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(tint)
                Spacer()
                Text(mmss(low)).font(.system(size: 11)).foregroundStyle(.secondary)
            }
            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.gray.opacity(0.28)).frame(height: 6)
                    // The prescribed band.
                    Capsule().fill(Color.green.opacity(0.55))
                        .frame(width: max(6, w * bandRange.width), height: 6)
                        .offset(x: w * bandRange.start)
                    if let f = markerFraction {
                        Capsule().fill(tint)
                            .frame(width: 4, height: 16)
                            .offset(x: min(w - 4, max(0, w * f - 2)))
                    }
                }
                .frame(height: 16)
            }
            .frame(height: 16)
        }
        // The axis is reversed from the numbers' natural order, so say so once rather than
        // leaving someone to work it out at 5 a.m.
        .accessibilityLabel("Target \(mmss(low)) to \(mmss(high)) per kilometre. \(verdictLabel).")
    }

    private var verdictLabel: String {
        switch verdict {
        case .noTarget: return "BY FEEL"
        case .noSignal: return "NO SIGNAL"
        case .tooFast: return "EASE OFF"
        case .good: return "GOOD PACE"
        case .tooSlow: return "PICK IT UP"
        }
    }

    private func mmss(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
}
