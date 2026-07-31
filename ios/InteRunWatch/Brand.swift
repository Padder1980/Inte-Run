import SwiftUI

/// InteRun's palette on the wrist.
///
/// These are the **exact** dark-theme tokens from `web/app.ts` (`:root[data-theme="dark"]`) plus the
/// two stops of `BRAND_MARK`'s gradient. The watch is always dark, so only the dark set is needed.
/// Copied as literals rather than approximated by eye — a watch face sitting next to the phone in
/// the same hand makes any drift obvious.
///
/// If the web tokens change, change these to match.
enum Brand {
    // Core
    static let accent = hex(0x2BB3A3)     // --accent
    static let accentInk = hex(0x06231F)  // --accent-ink
    static let bg = hex(0x0A100E)         // --bg
    static let surface = hex(0x151E1B)    // --surface
    static let surface2 = hex(0x1B2622)   // --surface-2
    static let line = hex(0x26332E)       // --line
    static let ink = hex(0xE7EEEA)        // --ink
    static let inkSoft = hex(0xA9B7B0)    // --ink-soft
    static let inkFaint = hex(0x74847C)   // --ink-faint

    // The brand mark's own gradient, used for anything that should read as "InteRun" itself.
    static let mark = hex(0x16B7A4)
    static let markDeep = hex(0x0A6F64)

    // Status
    static let ease = hex(0xEB9748)       // --ease  (amber: off target)
    static let rest = hex(0xE8765C)       // --rest  (coral: stop / hard)

    // Effort scale, used by the RPE picker
    static let effEasy = hex(0x4CB98A)    // --eff-easy
    static let effModerate = hex(0xE6AC3E) // --eff-moderate
    static let effHard = hex(0xE56F49)    // --eff-hard

    /// Heart-rate training zones 1–5, as a cool→hot ramp built from the tokens above rather than
    /// a new palette: Z1 barely working (quiet grey-green), Z2 easy (green), Z3 moderate (amber),
    /// Z4 threshold (orange), Z5 maximal (coral).
    /// ⚠️ Nil (no ceiling from the phone, or no reading yet — the first seconds of every run) is
    /// FAINT, deliberately distinct from every zone. It briefly shipped as `rest`, which made
    /// "no data" byte-identical to "maximal effort" — a standing-still runner wore a redlining
    /// heart, and the only tiebreaker was a digit too small to read mid-run.
    static func hrZoneTint(_ zone: Int?) -> Color {
        switch zone {
        case 1: return inkSoft
        case 2: return effEasy
        case 3: return effModerate
        case 4: return ease
        case 5: return rest
        default: return inkFaint
        }
    }

    /// The splash gradient from the web app: radial from the top, teal fading to black.
    /// Reused so the watch feels like the same product rather than a companion someone else wrote.
    static var backdrop: some View {
        RadialGradient(
            gradient: Gradient(stops: [
                .init(color: hex(0x0C2B28), location: 0),
                .init(color: hex(0x06110F), location: 0.56),
                .init(color: .black, location: 1),
            ]),
            center: .top, startRadius: 0, endRadius: 300
        )
        .ignoresSafeArea()
    }

    /// Where an effort sits on the 1–10 scale, in the app's own effort colours.
    static func effort(_ rpe: Int) -> Color {
        switch rpe {
        case ...3: return effEasy
        case 4...6: return effModerate
        default: return effHard
        }
    }

    private static func hex(_ v: UInt32) -> Color {
        Color(red: Double((v >> 16) & 0xFF) / 255,
              green: Double((v >> 8) & 0xFF) / 255,
              blue: Double(v & 0xFF) / 255)
    }
}
