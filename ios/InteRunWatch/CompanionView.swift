import SwiftUI

/// The wrist while the PHONE is recording.
///
/// ⚠️ Display only. It starts no workout session and logs nothing — two recorders double-count and
/// would put the same outing in the Logbook twice, which is the rule the whole watch design is built
/// around. What appears here is the phone's own numbers, pushed across every couple of seconds.
///
/// Because there is no workout session there is also no heart rate: HR needs an `HKWorkoutSession`
/// on the wrist, and starting one here is exactly the double-recording this avoids. If wrist HR
/// during a phone-recorded run is wanted, that is a deliberate piece of work, not a toggle.
struct CompanionView: View {
    @EnvironmentObject private var store: SessionStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 5) {
                    Circle().fill(Brand.accent).frame(width: 6, height: 6)
                    Text("RECORDING ON YOUR IPHONE")
                        .font(.system(size: 9, weight: .bold)).kerning(0.4)
                        .foregroundStyle(Brand.accent)
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                if let t = store.phoneLiveTitle, !t.isEmpty {
                    Text(t)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(2)
                }

                stat(elapsedText, "TIME", big: true)
                stat(distanceText, "DISTANCE")
                stat(paceText, "PACE", unit: "/KM")

                Text("Your phone is recording this run. Finish it there.")
                    .font(.system(size: 10))
                    .foregroundStyle(Brand.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
        }
    }

    private var live: [String: Double] { store.phoneLive ?? [:] }

    private var elapsedText: String {
        let t = Int(live["sec"] ?? 0)
        return t >= 3600
            ? String(format: "%d:%02d:%02d", t / 3600, (t % 3600) / 60, t % 60)
            : String(format: "%d:%02d", t / 60, t % 60)
    }
    private var distanceText: String {
        let km = live["distKm"] ?? 0
        return km < 1 ? String(format: "%.0f M", km * 1000) : String(format: "%.2f KM", km)
    }
    private var paceText: String {
        let p = Int(live["paceSec"] ?? 0)
        guard p > 0, p < 3600 else { return "--:--" }
        return String(format: "%d:%02d", p / 60, p % 60)
    }

    private func stat(_ value: String, _ label: String, unit: String? = nil, big: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3) {
            Text(value)
                .font(.system(size: big ? 32 : 24, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(big ? Brand.accent : Brand.ink)
            if let unit {
                Text(unit).font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)
            Text(label).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
        }
    }
}
