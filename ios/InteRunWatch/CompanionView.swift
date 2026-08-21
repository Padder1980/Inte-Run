import SwiftUI
import WatchKit

/// The wrist while the PHONE is recording.
///
/// ⚠️ Display only. It starts no workout session and logs nothing — two recorders double-count and
/// would put the same outing in the Logbook twice, which is the rule the whole watch design is built
/// around. What appears here is the phone's own numbers, pushed across every couple of seconds.
///
/// Heart rate comes from CompanionSession — a sensors-only workout session whose workout is
/// DISCARDED at the end, so the wrist contributes its one irreplaceable signal without ever
/// becoming a second recorder. The number shows here and streams to the phone's run.
///
/// ⚠️ IT IS A PAGER NOW, AND IT RENDERS `MetricsPage`. The owner photographed the old version on an
/// Apple Watch Ultra — the largest screen Apple makes — with the labels clipped off the right-hand
/// edge and a third row cut off mid-glyph, and wrote "Can't see the whole screen and there are no
/// options to see other metrics or music controls". Both halves were real and both had one cause:
/// this screen was a bespoke scrolling stack of four hardcoded numbers that never received any of the
/// work done on the run screen it sits beside.
///
/// - The layout fault was the fix-one-builder-not-the-other trap. `MetricsPage` records four
///   successive attempts at the rounded glass ("AUSED" at 2pt of inset; still clipped at 16pt) and
///   settled on 8pt insets all round, 18pt at the bottom, and the LABEL WRAPPED BESIDE the number
///   instead of pushed to the far edge by a `Spacer`. The old `stat()` here was exactly the layout
///   that was abandoned: a Spacer pinning each label against the right edge inside 4pt of total
///   padding. It is gone; the companion renders the same page a wrist-recorded run does, so it can
///   never drift from it again.
/// - The poverty was three layers deep. The page sent three numbers, the phone's bridge cherry-picked
///   the same three, and this view honoured none of the runner's own metric choices. All three are
///   fixed: the bridge forwards by key list, and the rows below come from `WatchSettings.metrics` —
///   ONE metric picker for both recorders.
///
/// ⚠️ ANYTHING THE PHONE HAS NOT SENT READS "--", NEVER 0. A zero is a measurement of standing still.
/// What CAN be worked out from what did arrive is worked out (average pace and the lap number are
/// arithmetic on the clock and the distance) and what cannot is left honest.
struct CompanionView: View {
    @EnvironmentObject private var store: SessionStore
    @ObservedObject private var sensors = CompanionSession.shared
    @ObservedObject private var settings = WatchSettings.shared

    /// Which page to open on. Exists for WatchPreview, which cannot swipe a watch simulator — the
    /// same reason `SettingsView` and `TodayView` take one.
    var initialPage: Int = 1
    /// WatchPreview only: render a specific metric list without touching the runner's own setting.
    ///
    /// ⚠️ The harness's first version assigned `WatchSettings.shared.metrics` instead, and
    /// `WatchSettings` persists on `didSet` — so a "four metrics" scene rewrote the real stored
    /// setting and every scene launched after it inherited four metrics. Measured: the paused scene
    /// then clipped at the top on a 41mm watch for reasons that had nothing to do with pausing. It is
    /// the same trap WatchPreview's own notes record for `apply()` leaving fake sessions in the cache.
    var metricsOverride: [WatchSettings.Metric]?

    /// Stable integer tags, and Metrics is the landing page — the same arrangement as a
    /// wrist-recorded run, so the runner's thumb learns one thing. Controls sit one swipe LEFT
    /// precisely so a stray touch mid-stride cannot reach them.
    @State private var page = 1
    /// One-shot, for the same reason TodayView's is: a NavigationStack pop re-fires onAppear, and a
    /// plain assignment would snap the pager back mid-run.
    @State private var pagePlaced = false

    var body: some View {
        TabView(selection: $page) {
            CompanionControls(backToMetrics: { page = 1 }).tag(0)
            // Re-rendered once a second so the clock fills the gap between the phone's ~2s ticks.
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                metrics
            }
            .tag(1)
            // The system's own Now Playing, so it controls whatever is actually playing — Music, a
            // podcast, Spotify. It needs nothing at all from the phone, which is why it is here on
            // day one while the pace and session pages wait for payload fields.
            NowPlayingView().tag(2)
        }
        .tabViewStyle(.page)
        .onAppear {
            guard !pagePlaced else { return }
            pagePlaced = true
            page = initialPage
        }
    }

    // MARK: - Metrics

    private var metrics: some View {
        MetricsPage(
            status: statusStrip,
            // ⚠️ THE CLOCK STAYS IN THE STRIP AND ELAPSED IS FILTERED OUT OF THE ROWS, exactly as a
            // wrist-recorded run does it — and that identity is load-bearing rather than tidy.
            // Measured on a 41mm watch (176×215pt), FOUR 42pt rows overflow the page: with the clock
            // promoted to a row of its own the strip was pushed off the top edge (ink on rows 1–5 of
            // the display), which is the very fault this screen was rebuilt to end. Filtering it back
            // out puts the default setting at three rows, which fits with room to spare.
            elapsed: elapsedText,
            provenance: provenanceWord,
            rows: (metricsOverride ?? settings.metrics).filter { $0 != .elapsed }.map { m in
                let v = value(for: m)
                let icon: MetricsPage.Icon? = m == .heartRate
                    ? .init(systemName: "heart.fill", tint: Brand.hrZoneTint(hrZone))
                    : nil
                return MetricsPage.Row(value: v.value, unit: v.unit, label: m.caption, icon: icon)
            },
            stepProgress: live["stepProgress"],
            stepLabel: store.phoneLiveStep
        )
    }

    /// The strip's exceptional states, which replace the clock: nothing has arrived yet, or the phone
    /// is paused. Nil while it is simply running, and then the clock shows with the provenance word
    /// beside it.
    ///
    /// ⚠️ PAUSED SAYS WHICH DEVICE TOO. A wrist reading only "PAUSED" during a phone-recorded run is
    /// the one moment a runner is most likely to reach for the wrong device.
    private var statusStrip: (text: String, tint: Color)? {
        if store.phoneLive == nil { return ("Waiting for iPhone", Brand.inkSoft) }
        if !store.phoneLiveRunning { return ("Paused \u{00b7} iPhone", Brand.ease) }
        return nil
    }

    /// Shown before the clock while the run is simply running: a runner glancing at their wrist must
    /// never have to wonder which device is the real one.
    private var provenanceWord: (text: String, tint: Color)? { ("iPhone", Brand.accent) }

    private var live: [String: Double] { store.phoneLive ?? [:] }

    /// The current value of any metric the runner can put on their run screen, from what the phone
    /// has actually sent. Mirrors `WorkoutManager.value(for:)` case for case, so one picker can serve
    /// both recorders — and returns "--" for anything the phone does not send rather than inventing
    /// a number for it.
    private func value(for m: WatchSettings.Metric) -> (value: String, unit: String?) {
        switch m {
        case .elapsed: return (elapsedText, nil)
        case .distance:
            guard let km = live["distKm"] else { return ("--", nil) }
            return km < 1 ? (String(format: "%.0f", km * 1000), "M")
                          : (String(format: "%.2f", km), "KM")
        case .currentPace: return (paceText(live["paceSec"]), "/KM")
        case .lapPace: return (paceText(live["lapPaceSec"]), "/KM")
        // ⚠️ DERIVED WHEN IT IS NOT SENT, because it is arithmetic on two numbers that are: the
        // clock and the distance. Exactly what `WorkoutManager.avgPaceSecPerKm` does, including its
        // floor — under fifty metres the figure is noise, and its own guard says so.
        case .avgPace: return (paceText(live["avgPaceSec"] ?? derivedAvgPace), "/KM")
        // The wrist's own sensor first: it is the SOURCE of the number the phone is showing, so
        // preferring it means the two devices cannot disagree about the same heartbeat.
        case .heartRate:
            let bpm = sensors.heartRate > 0 ? sensors.heartRate : (live["hr"] ?? 0)
            return (bpm > 0 ? String(Int(bpm)) : "--", "BPM")
        // Needs the phone's own step index and its length, neither of which is in the tick yet.
        case .stepRemaining: return ("--", nil)
        case .lapNumber:
            if let n = live["lapNumber"] { return (String(Int(n)), nil) }
            guard let km = live["distKm"] else { return ("--", nil) }
            return (String(Int(km) + 1), nil)
        case .calories:
            guard let k = live["kcal"], k > 0 else { return ("--", "CAL") }
            return (String(Int(k)), "CAL")
        }
    }

    /// Average pace from the clock and the distance, when the phone has not sent one.
    private var derivedAvgPace: Double? {
        guard let km = live["distKm"], km >= 0.05, let sec = live["sec"], sec > 10 else { return nil }
        return sec / km
    }

    /// The zone tint for the heart glyph. The wrist knows the ceiling (the phone syncs it), so it can
    /// colour its own reading — the same `maxHr` and the same bands the run screen uses.
    private var hrZone: Int? {
        let bpm = sensors.heartRate > 0 ? sensors.heartRate : (live["hr"] ?? 0)
        guard let m = store.maxHr, m > 60, bpm > 0 else { return nil }
        let pct = bpm / Double(m)
        if pct < 0.50 { return 0 }
        if pct < 0.60 { return 1 }
        if pct < 0.70 { return 2 }
        if pct < 0.80 { return 3 }
        if pct < 0.90 { return 4 }
        return 5
    }

    private var elapsedText: String {
        guard var secs = live["sec"] else { return "--" }
        // Fill the seconds between the phone's ~2s ticks so the clock counts smoothly, matching the
        // phone's own mirror. Capped so a lost signal freezes rather than running away; the next tick
        // snaps it back. Frozen entirely while the phone is paused (phoneLiveRunning == false).
        if store.phoneLiveRunning, let at = store.phoneLiveAt {
            let extra = Date().timeIntervalSince(at)
            if extra > 0 { secs += min(extra, 4) }
        }
        let t = Int(secs)
        return t >= 3600
            ? String(format: "%d:%02d:%02d", t / 3600, (t % 3600) / 60, t % 60)
            : String(format: "%d:%02d", t / 60, t % 60)
    }

    private func paceText(_ v: Double?) -> String {
        guard let v, v > 0, v < 3600 else { return "--:--" }
        let s = Int(v.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

// MARK: - Controls (one swipe left)

/// What the wrist can do about a run the phone owns.
///
/// ⚠️ THE PAUSE/RESUME/FINISH BUTTONS APPEAR ONLY WHEN THE PHONE HAS SAID IT CAN ANSWER
/// (`store.phoneCanControl`, set from the `control` flag the page puts in its own companion tick).
/// The wrist-to-phone relay exists in `WatchBridge`, but a page served before it has
/// `window.__interunWatchControl` cannot act on it — and a control that looks live and does nothing
/// is the defect this project has shipped twice. Gating on a flag the capable side declares means the
/// buttons light up on their own the moment a newer page is served, with no watch rebuild.
///
/// The rest of the page needs nothing from the phone at all, so it is never empty: the run's name,
/// Water Lock (the thing that stops rain and a sleeve pausing your music mid-run) and Settings, which
/// is where the metrics on the page next door are chosen. That last one matters here for the same
/// reason it matters during a wrist-recorded run — which numbers you want is a decision you make
/// while looking at them.
struct CompanionControls: View {
    @EnvironmentObject private var store: SessionStore
    var backToMetrics: () -> Void
    @State private var confirmingEnd = false
    @State private var showSettings = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 5) {
                    Circle().fill(Brand.accent).frame(width: 6, height: 6)
                    // ⚠️ NO `.kerning` — it makes the `minimumScaleFactor` beside it inert, so this
                    // line truncated rather than shrinking. See MetricsPage's strip for the
                    // measurement; this is the longest single line on the companion's controls page
                    // and the 40mm watch is where it runs out of room.
                    Text("RECORDING ON YOUR IPHONE")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Brand.accent)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                if let t = store.phoneLiveTitle, !t.isEmpty {
                    Text(t)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if store.phoneCanControl {
                    HStack(spacing: 10) {
                        Button {
                            confirmingEnd = true
                        } label: {
                            VStack(spacing: 2) {
                                Image(systemName: "stop.fill").font(.title3)
                                Text("Finish").font(.system(size: 10))
                            }.frame(maxWidth: .infinity)
                        }
                        .tint(Brand.rest)

                        Button {
                            store.sendPhoneCommand(store.phoneLiveRunning ? "pause" : "resume")
                            backToMetrics()
                        } label: {
                            VStack(spacing: 2) {
                                Image(systemName: store.phoneLiveRunning ? "pause.fill" : "play.fill")
                                    .font(.title3)
                                Text(store.phoneLiveRunning ? "Pause" : "Resume").font(.system(size: 10))
                            }.frame(maxWidth: .infinity)
                        }
                        .tint(store.phoneLiveRunning ? Brand.ease : Brand.accent)
                    }
                    .buttonStyle(.bordered)
                } else {
                    Text("Your phone is recording this run. Finish it there.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Button {
                    // Water Lock is also the screen lock: taps are ignored until the crown is turned,
                    // which is what stops rain and a sleeve from touching anything mid-run.
                    WKInterfaceDevice.current().enableWaterLock()
                } label: {
                    Label("Lock screen", systemImage: "drop.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.blue)

                Button {
                    showSettings = true
                } label: {
                    Label("Settings", systemImage: "gearshape.fill").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            // The same insets the run screen settled on after four attempts at the rounded glass.
            .padding(.horizontal, 8)
            .padding(.top, 4)
            .padding(.bottom, 18)
        }
        // A sheet, not a push: the companion's pages are a TabView, and pushing would trap the runner
        // behind a back chevron they have to find mid-stride.
        .sheet(isPresented: $showSettings) {
            SettingsView().environmentObject(store)
        }
        // ⚠️ Finishing asks first, exactly as it does for a wrist-recorded run. There is no way back
        // into a session once it has ended, and a wrist is where an accidental press happens.
        .confirmationDialog("Finish on your iPhone?", isPresented: $confirmingEnd,
                            titleVisibility: .visible) {
            Button("Finish run", role: .destructive) { store.sendPhoneCommand("stop") }
            Button("Cancel", role: .cancel) { backToMetrics() }
        } message: {
            Text("Your phone stops recording and saves the run.")
        }
    }
}
