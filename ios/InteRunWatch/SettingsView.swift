import SwiftUI

/// Settings, reachable from the Today screen.
///
/// Two halves: which numbers appear while you run, and how the watch behaves. Everything listed
/// does something — see WatchSettings.
struct SettingsView: View {
    @ObservedObject private var settings = WatchSettings.shared
    @EnvironmentObject private var store: SessionStore

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 3) {
                    Text(CoachVoice.character(for: store.coach).name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Brand.accent)
                    Text(store.coach == nil
                         ? "Voice coaching is off on your iPhone."
                         : "Chosen on your iPhone. Your watch speaks their lines in a matched voice — the recorded coach cannot say your pace numbers, so out here it is synthesised.")
                        .font(.system(size: 10))
                        .foregroundStyle(Brand.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } header: {
                Text("YOUR COACH")
            }
            Section {
                NavigationLink { MetricsEditor() } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Run screen").font(.system(size: 15, weight: .semibold))
                        Text(summary)
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                            .lineLimit(2)
                    }
                }
            } header: {
                Text("CUSTOMISE")
            }

            Section {
                Toggle(isOn: $settings.countdown) {
                    label("Count me in", "Three seconds before the clock starts — time to put your phone away.")
                }
                Toggle(isOn: $settings.autoPause) {
                    label("Auto-pause", "Pauses when you stop and picks up when you go again.")
                }
                Toggle(isOn: $settings.hapticOnLap) {
                    label("Buzz each kilometre", "A tap on the wrist as each kilometre ticks over.")
                }
                Toggle(isOn: $settings.voiceCues) {
                    label("Spoken cues", "Step changes, pace nudges and your reasons for running.")
                }
            } header: {
                Text("RUN SETTINGS")
            }
        }
        .tint(Brand.accent)
        .navigationTitle("Settings")
    }

    private var summary: String {
        settings.metrics.map(\.label).joined(separator: " · ")
    }

    private func label(_ title: String, _ note: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 14, weight: .medium))
            Text(note).font(.system(size: 10)).foregroundStyle(Brand.inkFaint)
        }
    }
}

/// Pick the numbers on the run screen, and the order they appear in.
///
/// Capped at five: more than that on a watch face is a wall of digits at running cadence, which is
/// the mistake the metrics page already had to be rescued from once.
struct MetricsEditor: View {
    @ObservedObject private var settings = WatchSettings.shared

    var body: some View {
        List {
            Section {
                if settings.metrics.isEmpty {
                    Text("Pick at least one.").font(.system(size: 12)).foregroundStyle(Brand.inkFaint)
                }
                ForEach(Array(settings.metrics.enumerated()), id: \.element) { i, m in
                    HStack(spacing: 8) {
                        Text("\(i + 1)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(Brand.accentInk)
                            .frame(width: 18, height: 18)
                            .background(Circle().fill(Brand.accent))
                        Text(m.label).font(.system(size: 14, weight: .medium))
                        Spacer(minLength: 0)
                        Image(systemName: "minus.circle.fill")
                            .foregroundStyle(Brand.rest)
                            .onTapGesture { settings.toggle(m) }
                    }
                }
                .onMove { from, to in settings.metrics.move(fromOffsets: from, toOffset: to) }
            } header: {
                Text("SHOWING (\(settings.metrics.count)/\(WatchSettings.maxMetrics))")
            } footer: {
                Text("Drag to reorder. The first is shown largest.")
                    .font(.system(size: 10)).foregroundStyle(Brand.inkFaint)
            }

            let rest = WatchSettings.Metric.allCases.filter { !settings.metrics.contains($0) }
            if !rest.isEmpty {
                Section {
                    ForEach(rest) { m in
                        Button {
                            settings.toggle(m)
                        } label: {
                            HStack {
                                Text(m.label).font(.system(size: 14))
                                Spacer(minLength: 0)
                                Image(systemName: "plus.circle")
                                    .foregroundStyle(settings.metrics.count < WatchSettings.maxMetrics ? Brand.accent : Brand.inkFaint)
                            }
                        }
                        .disabled(settings.metrics.count >= WatchSettings.maxMetrics)
                    }
                } header: {
                    Text(settings.metrics.count >= WatchSettings.maxMetrics ? "FULL — REMOVE ONE FIRST" : "ADD")
                }
            }

            Section {
                Button("Reset to default") { settings.reset() }
                    .font(.system(size: 13))
                    .foregroundStyle(Brand.ease)
            }
        }
        .navigationTitle("Run screen")
    }
}
