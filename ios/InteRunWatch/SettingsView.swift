import SwiftUI

/// Settings, reachable from the Today screen — as swipeable PAGES, one concern per page, in the
/// owner's reference layout: a caps header, big toggles you can hit while moving, and a one-line
/// explanation under every control whose effect is not obvious from its name.
///
/// It used to be one long scrolling list, which buried the fourth toggle below the fold. Paged,
/// each group is a screenful and the dots say where you are.
///
/// ⚠️ Everything here does something real — the same rule as the phone's Connections screen. No
/// toggle ships before the feature behind it exists (see WatchSettings).
struct SettingsView: View {
    @ObservedObject private var settings = WatchSettings.shared
    @EnvironmentObject private var store: SessionStore

    /// Which page to open on. Exists for WatchPreview, which cannot swipe — a screenshot of page
    /// three has to be able to LAND on page three.
    var initialPage: Int = 0
    @State private var page = 0
    /// One-shot, same reason as TodayView's: an onAppear that re-fires would drag the runner back
    /// to page one whenever this view reappears.
    @State private var pagePlaced = false

    var body: some View {
        TabView(selection: $page) {
            runPage.tag(0)
            alertsPage.tag(1)
            audioPage.tag(2)
            MetricsEditor().tag(3)
        }
        .tabViewStyle(.page)
        .tint(Brand.accent)
        .navigationTitle("Settings")
        .onAppear {
            guard !pagePlaced else { return }
            pagePlaced = true
            page = initialPage
        }
    }

    // MARK: - Page 1: the run itself

    private var runPage: some View {
        settingsPage(header: "RUN SETTINGS") {
            toggleRow("Count me in",
                      "Three seconds before the clock starts — time to put your phone away.",
                      isOn: $settings.countdown)
            toggleRow("Auto-Pause",
                      "Pauses when you stop and picks up when you go again.",
                      isOn: $settings.autoPause)
        }
    }

    // MARK: - Page 2: what the watch tells you mid-run

    private var alertsPage: some View {
        settingsPage(header: "ALERTS") {
            toggleRow("Buzz each kilometre",
                      "A tap on the wrist as each kilometre ticks over.",
                      isOn: $settings.hapticOnLap)
            toggleRow("Spoken cues",
                      "Step changes, pace corrections with your actual numbers, and your reasons for running.",
                      isOn: $settings.voiceCues)
        }
    }

    // MARK: - Page 3: who speaks, and from where

    /// The reference dedicates a page to explaining where audio comes out, because "why is my
    /// watch silent" is otherwise a support question. Ours states OUR true routing.
    private var audioPage: some View {
        settingsPage(header: "VOICE & AUDIO") {
            VStack(alignment: .leading, spacing: 3) {
                Text(CoachVoice.character(for: store.coach).name)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Brand.accent)
                Text(store.coach == nil
                     ? "Voice coaching is off on your iPhone — turn it on there to choose a coach."
                     : "Chosen on your iPhone.")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.bottom, 6)

            // ⚠️ Every sentence here was checked against the actual routing code — the first draft
            // claimed step TARGETS were spoken and that everything else came from the phone, and an
            // adversarial review proved both wrong. If the routing changes, change this with it.
            VStack(alignment: .leading, spacing: 5) {
                explain("Phone in range", "step changes and the set moments — start, pause, finish — play from the phone, in your coach's real recorded voice.")
                explain("Spoken by the watch", "anything a recording can't say: pace corrections with your actual numbers, and your own reasons for running. A matched voice, made on the watch.")
                explain("Headphones on the watch", "take over from the watch speaker automatically.")
            }
        }
    }

    private func explain(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title.uppercased())
                .font(.system(size: 9.5, weight: .bold)).kerning(0.5)
                .foregroundStyle(Brand.inkFaint)
            Text(body)
                .font(.system(size: 11.5))
                .foregroundStyle(Brand.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Shared page furniture

    private func settingsPage<Content: View>(header: String, @ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 9) {
                Text(header)
                    .font(.system(size: 10, weight: .bold)).kerning(0.6)
                    .foregroundStyle(Brand.inkFaint)
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 12)   // clear of the page dots
        }
    }

    /// One big toggle with its explanation directly beneath — the reference's pattern. The label
    /// and switch are all one Toggle, so tapping the text flips it; only the card's thin painted
    /// rim (the padding OUTSIDE the control) is dead space, which is cosmetic, not a hit target —
    /// an earlier comment here claimed full-width and a review measured it as an overclaim.
    private func toggleRow(_ title: String, _ note: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Brand.ink)
                Text(note)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Brand.inkFaint)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 9).padding(.horizontal, 11)
        .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Brand.surface))
    }
}

/// Pick the numbers on the run screen, and the order they appear in. The last settings page.
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
                Text("RUN SCREEN — SHOWING \(settings.metrics.count) OF \(WatchSettings.maxMetrics)")
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
    }
}
