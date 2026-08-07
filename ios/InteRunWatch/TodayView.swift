import SwiftUI

/// What the runner sees on the wrist: today's session, and one button to start it.
///
/// Deliberately not a port of the phone UI. Plan setup, history and Support all belong on a bigger
/// screen; the watch does the one thing the phone cannot do well, which is be there mid-run.
///
/// Dressed in the app's own palette (`Brand`) so the watch and the phone read as one product.
struct TodayView: View {
    /// True when the phone launched this app specifically to begin a run.
    var autoStart: Bool = false
    @ObservedObject private var launch = LaunchRequest.shared

    @EnvironmentObject private var store: SessionStore
    @StateObject private var workout = WorkoutManager()
    @State private var running = false

    /// Which home page to open on. Exists for WatchPreview, which cannot swipe.
    var initialPage: Int = 0
    /// True only when rendered by WatchPreview: every start path is refused, because a preview
    /// that can start a workout is a preview that can log a fictional run (WatchPreview's own
    /// invariant — a review caught the home scenes violating it).
    var previewInert: Bool = false
    /// WatchPreview only: anchor the today page's scroll, since simctl cannot scroll a watch and
    /// the card's Start button otherwise sits below the fold of every screenshot.
    var previewAnchor: UnitPoint?
    @State private var page = 0
    /// One-shot: initialPage applies on first appearance only. See the onAppear below.
    @State private var pagePlaced = false

    /// Hand the plan to the workout and go. One path, so a run started from the phone and a run
    /// started on the wrist are the same run with the same targets and the same reasons.
    private func begin(_ s: PlannedSession?) {
        beginNow(s, count: true)
    }

    /// The one place a run starts on this watch.
    ///
    /// `count` is false when the PHONE has already counted the runner in — two independent
    /// three-second counts is how the two clocks ended up a second apart.
    private func beginNow(_ s: PlannedSession?, count: Bool = false) {
        // The preview harness renders this view with seeded fake sessions; starting one would open
        // a real HKWorkoutSession and send a fictional run home to the phone's logbook.
        guard !previewInert else { return }
        // Reset FIRST: the manager outlives a run, and a stale phase or a reused run id silently
        // breaks the next one. See WorkoutManager.reset().
        workout.reset()
        workout.plan = s   // nil is a free run: no targets, no steps, just the clock and the GPS
        workout.why = store.why          // the runner's own reasons, for the hard stretch
        workout.whyPerson = store.whyPerson
        workout.coach = store.coach      // the same coach they chose on the phone
        workout.coachLines = store.coachLines
        workout.maxHr = store.maxHr      // the zone ceiling; nil just means no zone colours
        // The phone can finish, pause and resume a wrist run: someone holding their phone should not
        // have to find their watch to stop.
        store.onStopRequested = { [weak workout] in workout?.end() }
        store.onPauseRequested = { [weak workout] in workout?.pause() }
        store.onResumeRequested = { [weak workout] in workout?.resume() }
        running = true
        if count { workout.startCountingDown() } else { workout.start() }
    }

    /// "Inte-" white, "Run" in the brand teal — the same wordmark the phone's splash draws
    /// (#fff + #16b7a4, which is Brand.mark).
    /// ⚠️ Split into two Texts so each half gets its own colour, which also means a search-and-replace
    /// on the brand name cannot see it: the 2026-07-29 rename to Inte-Run missed the hyphen here.
    private var wordmark: some View {
        (Text("Inte-").foregroundStyle(.white) + Text("Run").foregroundStyle(Brand.mark))
            .font(.system(size: 22, weight: .heavy, design: .rounded))
            .kerning(-0.4)
            .padding(.bottom, 2)
    }

    /// Start something with no plan behind it. Always available — and wearing the same primary
    /// button as every Start, because it is the same act: go running now.
    private var freeRun: some View {
        Button {
            begin(nil)
        } label: {
            Brand.RunButtonLabel(title: "Free run")
        }
        .buttonStyle(.plain)
        .padding(.top, 6)
    }

    private var settingsLink: some View {
        NavigationLink {
            SettingsView().environmentObject(store)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "gearshape.fill").font(.system(size: 12))
                Text("Settings").font(.system(size: 13, weight: .medium))
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(Brand.inkFaint)
            }
            .foregroundStyle(Brand.inkSoft)
            .padding(.vertical, 9).padding(.horizontal, 12)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Brand.surface))
        }
        .buttonStyle(.plain)
        .padding(.top, 10)
        .padding(.bottom, 6)
    }

    // "Wed 29 Jul" now lives on PlannedSession itself (`dayLabel`), because the home cards and the
    // detail page both need it and two DateFormatters would eventually disagree.

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.backdrop
                // The home is TWO swipeable pages, the owner's reference layout: today (with Free
                // Run always available) and the upcoming week. The companion state replaces the
                // pager wholesale — a wrist that is only mirroring the phone has no pages to offer.
                if launch.companionOnly {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 8) {
                            wordmark
                            CompanionView().environmentObject(store)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 2)
                    }
                } else {
                    TabView(selection: $page) {
                        todayPage.tag(0)
                        upcomingPage.tag(1)
                    }
                    .tabViewStyle(.page)
                    // ⚠️ ONCE. A NavigationStack pop re-fires the root's onAppear, so a plain
                    // assignment here snapped the pager back to Today every time the runner backed
                    // out of a session detail — measured on the simulator: page 1 → push → Back →
                    // page 0. Reading the week means opening a card, backing out, opening the next,
                    // so it would have fought the runner on every tap.
                    .onAppear {
                        guard !pagePlaced else { return }
                        pagePlaced = true
                        page = initialPage
                    }
                }
            }
            // The wordmark is drawn in the content (see `wordmark`) rather than set as the
            // navigation title. Handing watchOS a two-tone Text does keep the colours, but it also
            // re-lays the bar out — the mark shrinks and shifts under the clock. In the content it
            // sits where the phone's splash puts it, at the size it should be.
            .navigationTitle("")
            .onAppear { store.requestSync() }
            .navigationDestination(isPresented: $running) {
                WorkoutView(workout: workout)
                    .environmentObject(store)
            }
            // Launched from the phone's "record on my watch": begin without a second tap. Gated on
            // a session actually being synced, because starting a run the watch knows nothing about
            // would lose the pace targets and the step list -- the whole reason to use this app.
            // ⚠️ Launched by the phone means WAIT, not start.
            //
            // The phone is counting the runner in and will say when. Starting here as well produced
            // two independent three-second counts and two clocks a second apart. And it used to
            // begin `store.session` — today's CACHED session — so starting anything else on the
            // phone quietly ran the wrong workout on the wrist.
            // ⚠️ INSTALLED ALWAYS, NOT ONLY ON A HEALTHKIT LAUNCH. This was gated on `autoStart`, which
            // is LaunchRequest.pending — true only when iOS woke the app specifically to run. So if
            // the watch app was ALREADY OPEN when the runner tapped "My Apple Watch" on the phone,
            // the handler was never installed at all: the phone counted them in, sent the go, and the
            // watch parked it in `pendingGo` where nothing would ever read it. The wrist sat on Today
            // looking like the button had done nothing, which is exactly what the owner reported
            // after a real run — he gave up and started it on the watch instead.
            //
            // ⚠️ `guard !running` belonged at FIRE time, and it was ALSO at install time. A run that
            // ended without clearing `running` therefore left the watch permanently deaf to the phone,
            // with nothing on screen to say so. Listening costs nothing; acting is what needs a guard,
            // and the closure already has one.
            .onAppear {
                guard !previewInert else { return }   // a preview must never be able to start a run
                store.onStartNow = {
                    guard !running else { return }
                    LaunchRequest.shared.consume()
                    let s = store.pendingSession ?? store.session ?? store.todayFromCache
                    store.pendingSession = nil
                    beginNow(s)          // no count: the phone has already done it
                }
            }
            // ⚠️ Deliberately NO .onChange(of: store.session) auto-start here. One existed, and it
            // raced the phone: a context landing after launch began TODAY'S CACHED session with its
            // own second countdown, while the phone counted the session actually chosen. The
            // onStartNow closure above resolves the session at go-time; a go that never arrives
            // leaves the watch honestly on Today with its Start button.
        }
    }

    // MARK: - The two home pages

    /// Page 1: the brand, a Free Run that is ALWAYS there, and today's workout as a card.
    private var todayPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                wordmark
                // ⚠️ Always offered, even when nothing has synced. Requiring the phone app to be
                // open before the watch will start a run is not a running app, it is a chore — and
                // it is exactly the state you are in at the front door.
                freeRun
                Text("TODAY'S WORKOUT")
                    .font(.system(size: 10, weight: .bold)).kerning(0.6)
                    .foregroundStyle(Brand.inkFaint)
                    .padding(.top, 4)
                // A context from a previous day is worse than none: showing yesterday's session
                // (or yesterday's rest) as today's would quietly mislead. Fall back to the waiting
                // state, whose advice - open the phone app - is the fix.
                if store.isCurrent, let s = store.session {
                    card(bar: typeBar(s.type)) { session(s) }
                } else if let s = store.todayFromCache {
                    // Stale context but the cached week still covers today. Better a day-old copy
                    // of the right session than a spinner.
                    card(bar: typeBar(s.type)) { session(s) }
                } else if store.isCurrent, store.hasSynced {
                    card(bar: Brand.inkFaint) { restDay }
                } else {
                    card(bar: Brand.inkFaint) { waiting }
                }
                settingsLink
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
            .padding(.bottom, 12)   // clear of the page dots
        }
        .defaultScrollAnchor(previewAnchor ?? .top)
    }

    /// Page 2: the rest of the week, so a session can be started early — or caught up — from the
    /// wrist without the phone.
    private var upcomingPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("UPCOMING")
                    .font(.system(size: 10, weight: .bold)).kerning(0.6)
                    .foregroundStyle(Brand.inkFaint)
                let ahead = store.upcomingAhead.filter { $0.dateIso != SessionStore.localTodayIso() }
                if ahead.isEmpty {
                    Text("Nothing else synced this week — your phone has the full plan.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    // No cap: the phone syncs up to seven sessions and the ten-day window exists
                    // precisely so the wrist stands alone — a prefix(5) here silently binned the
                    // last sessions the phone deliberately sent. The page scrolls.
                    //
                    // ⚠️ Tapping a card opens its DETAIL, it does not start the run. These cards
                    // used to begin a workout on a single tap, so a mis-tap while scrolling the
                    // week started a session — and starting the wrong day's run is not undoable
                    // once it is in the logbook.
                    ForEach(Array(ahead.enumerated()), id: \.offset) { _, s in
                        NavigationLink {
                            detail(for: s)
                        } label: {
                            card(bar: typeBar(s.type)) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.dayLabel.uppercased())
                                        .font(.system(size: 10, weight: .bold)).kerning(0.4)
                                        .foregroundStyle(Brand.accent)
                                    Text(s.title)
                                        .font(.system(size: 15, weight: .bold))
                                        .foregroundStyle(Brand.ink)
                                        .lineLimit(2).multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                    if !s.subtitle.isEmpty {
                                        Text(s.subtitle).font(.system(size: 10.5)).foregroundStyle(Brand.inkSoft)
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 2)
            .padding(.bottom, 12)
        }
    }

    /// The reference's card: content on a surface, with a colour bar down the LEFT EDGE carrying
    /// the session type — quality amber, easy green, long run teal — so the kind of day is read
    /// before a single word is.
    private func card<Content: View>(bar: Color, @ViewBuilder _ content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 0) {
            RoundedRectangle(cornerRadius: 2)
                .fill(bar)
                .frame(width: 4)
                .padding(.vertical, 3)
            content()
                .padding(.leading, 9)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10).padding(.horizontal, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(Brand.surface))
    }

    /// Session type → the card's edge colour: anything easy is green, the long run is the brand
    /// teal, and the quality days are amber.
    /// ⚠️ The strings are the ENGINE's SessionType union (src/domain/types.ts), not guesses — a
    /// review caught this map inventing types ("tempo", "hills") while missing "strides", which is
    /// how the generator types every routine "easy + strides" day: an EASY day, RPE two-ish, that
    /// was wearing the hard-day amber. "cross-training" is likewise an easy replacement.
    private func typeBar(_ type: String) -> Color {
        switch type {
        case "race": return Brand.rest      // the goal race itself — unmistakable
        case "easy", "recovery", "strides", "cross-training": return Brand.effEasy
        case "long": return Brand.accent
        case "rest": return Brand.inkFaint
        case "strength", "mobility": return Brand.inkSoft
        default: return Brand.ease   // threshold, vo2, race-specific — the quality days
        }
    }

    /// The session detail, reached from any card. One page, scrollable, ending in Start.
    private func detail(for s: PlannedSession) -> some View {
        SessionDetailView(session: s, start: { begin(s) }, previewInert: previewInert)
    }

    private func session(_ s: PlannedSession) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // The summary opens the detail; Start below it stays a single tap, because starting
            // today's run is the thing this app is opened for and it should never cost two.
            NavigationLink {
                detail(for: s)
            } label: {
                VStack(alignment: .leading, spacing: 6) {
                    if let name = store.runnerName {
                        Text("TODAY, \(name.uppercased())")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Brand.accent)
                    }

                    Text(s.title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Brand.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)

                    if !s.subtitle.isEmpty {
                        Text(s.subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Brand.inkSoft)
                    }

                    HStack(spacing: 6) {
                        if let pace = s.paceText {
                            HStack(spacing: 4) {
                                Image(systemName: "speedometer").font(.system(size: 10))
                                Text(pace).font(.system(size: 12, weight: .medium))
                            }
                            .foregroundStyle(Brand.accent)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(Capsule().fill(Brand.surface2))
                        }
                        Spacer(minLength: 0)
                        // The affordance: this card leads somewhere.
                        HStack(spacing: 2) {
                            if let steps = s.steps, steps.count > 1 {
                                Text("\(steps.count) steps").font(.system(size: 10.5))
                            }
                            Image(systemName: "chevron.right").font(.system(size: 9, weight: .semibold))
                        }
                        .foregroundStyle(Brand.inkFaint)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            // ⚠️ Only when the session is actually a run. Mobility and strength days land here
            // like any other; starting one opens a GPS running workout and logs a bodyweight
            // routine as a run. Same gate the phone applies. See PlannedSession.isRunnable.
            if s.isRunnable {
                Button {
                    begin(s)
                } label: {
                    Brand.RunButtonLabel(title: "Start")
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
    }

    /// A real rest day, which is part of the plan rather than an absence of one.
    private var restDay: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "moon.zzz.fill")
                .font(.title2)
                .foregroundStyle(Brand.accent)
            Text(store.runnerName.map { "Rest day, \($0)" } ?? "Rest day")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Brand.ink)
            Text("Nothing planned today. Recovery is training too.")
                .font(.system(size: 12))
                .foregroundStyle(Brand.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var waiting: some View {
        VStack(alignment: .leading, spacing: 6) {
            ProgressView().tint(Brand.accent)
            Text("Waiting for your plan")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Brand.ink)
            // Not an instruction any more, just an explanation: a free run is right below this, so
            // the runner is never actually blocked on the phone.
            Text("Open Inte-Run on your iPhone to sync it. You can still run without it.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
