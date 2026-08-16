import AVFoundation
import UIKit
import WebKit

/// The coach keeps talking with the phone locked.
///
/// ⚠️ THE BUG WAS THE TRIGGER, NOT THE OUTPUT, and that is why "we set an audio session and added the
/// background mode" never fixed it. Every cue is fired from `setInterval(liveTick, 200)` inside the
/// WKWebView, and every clip is an `<audio>` element on the page. When the screen locks, iOS suspends or
/// throttles the *web content process*: the interval stops, nothing asks for the next cue, and the coach
/// goes quiet for the rest of the run. An audio session keeps ALREADY-PLAYING audio alive; it cannot keep
/// JavaScript running. The `GeolocationShim` buffering fixes for replay is direct evidence of the same
/// suspension.
///
/// ⚠️ WHAT MAKES THIS SOLVABLE: the APP process stays alive during a run even though the page does not,
/// because `location` is in `UIBackgroundModes` and `LocationService` is streaming fixes throughout. So a
/// Swift `Timer` keeps firing between cues, minutes apart, where a page timer would not. Without the
/// location mode this approach would fail — iOS keeps you alive *while playing audio*, and the gaps
/// between cues are exactly when there is none.
///
/// ⚠️ NOT A SILENT KEEP-ALIVE TRACK. The obvious alternative is to loop silence so the page's audio
/// element never stops. The session is configured `.duckOthers`, so a permanently-playing track would
/// hold the runner's music ducked for the entire run — a worse bug than the one being fixed.
///
/// The page owns WHAT is said and WHEN; this only owns playback while the page cannot run. The schedule
/// is pushed from the page (it already knows the session's steps and their durations), re-pushed whenever
/// the run's shape changes, and every clip that plays is reported back so the page does not repeat it.
@MainActor
final class CoachAudioService: NSObject, WKScriptMessageHandler, AVAudioPlayerDelegate {
    static let messageName = "interunCoachAudio"
    /// ⚠️ Shared, because WatchBridge needs it and the bridge outlives the web view. A wrist-started
    /// run's cues arrive from the watch at unpredictable moments, long after the page that would
    /// normally play them has been suspended.
    static let shared = CoachAudioService()

    private struct Cue {
        /// ⚠️ Unique per SLOT, not per clip. A session legitimately reuses a line — a five-step run drew
        /// warmup_2 twice, eight minutes apart — and a played-set keyed on the prompt id would have
        /// swallowed the second one silently. The runner would simply have heard less, with nothing to
        /// show why.
        let key: Int
        let id: String
        let fireAt: Date
        let file: String
    }

    weak var webView: WKWebView?
    /// ⚠️ Strong, and it must be. An AVAudioPlayer with no owner is deallocated mid-sentence.
    private var player: AVAudioPlayer?
    private var cues: [Cue] = []
    private var played = Set<Int>()
    private var timer: Timer?

    /// ⚠️ THE WRIST'S CUES CANNOT BE SCHEDULED, so they need a different mechanism from the phone's.
    ///
    /// On a watch-recorded run the WATCH decides when a cue is due — it owns the pace data and the
    /// hold windows — and the phone plays it, because the phone has the recorded coaches. That
    /// handover went: watch sendMessage -> WatchBridge.forwardCue -> evaluateJavaScript -> the page's
    /// audio element. And `evaluateJavaScript` DOES NOTHING against a suspended web content process.
    ///
    /// So the coach spoke while the phone was in the runner's hand and fell silent the moment it went
    /// into a pocket — reported after a real run as "only said the start but then nothing after". It
    /// is the same root cause as the locked-phone bug, on a path the schedule-based fix cannot reach:
    /// there is no schedule to push, because only the wrist knows when the next cue is due.
    ///
    /// The page hands over a map of trigger -> candidate clips once, at the start of the run. After
    /// that the native side can answer a cue on its own, with no page involved.
    /// ⚠️ PERSISTED, because the run that needs it most starts with no page in existence. A wrist run
    /// begun without touching the phone wakes this app in the BACKGROUND — there is no web view, so
    /// nothing can push a map, and every cue would be dropped for the whole run. A map from the last
    /// time the app was open is correct unless the runner has since changed coach, and the page
    /// re-pushes on every start, so it is never stale for long.
    private var cueMap: [String: [String]] = [:] {
        didSet { UserDefaults.standard.set(cueMap, forKey: Self.mapKey) }
    }
    private static let mapKey = "interun_coach_cuemap_v1"
    private var cueRotation: [String: Int] = [:]
    private var lastCueAt: [String: Date] = [:]
    /// When the current clip actually began — used to tell a genuinely-playing clip from a player
    /// left stuck by a mid-clip suspension, so a stuck player cannot silence the rest of a run.
    private var playStartedAt = Date.distantPast

    // MARK: - Diagnostics
    //
    // ⚠️ A SILENT COACH LOOKS IDENTICAL WHATEVER THE CAUSE, and this feature had no instrumentation at
    // all — which is why "the voice coaches only said the start but then nothing after" took an audit
    // to explain rather than a glance. Same precedent as __kbDiag for the keyboard, LIVE.gpsDiag for
    // distance and LiveActivityService.note() for the lock-screen card. Surfaced in Support > Your data.
    private var dScheduled = 0, dFired = 0, dStale = 0, dMissing = 0, dFailed = 0
    private var dWatchOK = 0, dWatchMiss = 0, dInterrupt = 0
    private var dLast = "nothing yet"

    private func note(_ what: String) {
        dLast = what
        SelfCheck.logger.notice("coach audio \(what, privacy: .public)")
        save()
    }
    /// What the audio session actually looked like when the last clip started. See the note in
    /// playFile: this is the difference between this app owning the session and WebKit having taken it.
    private var dSessOpts = "-"
    private func describeOptions(_ o: AVAudioSession.CategoryOptions) -> String {
        var parts: [String] = []
        if o.contains(.duckOthers) { parts.append("duck") }
        if o.contains(.mixWithOthers) { parts.append("mix") }
        if o.contains(.interruptSpokenAudioAndMixWithOthers) { parts.append("interruptSpoken") }
        return parts.isEmpty ? "none" : parts.joined(separator: "+")
    }
    private func statusLine() -> String {
        "sched \(dScheduled) . played \(dFired) . stale \(dStale) . missing \(dMissing)"
            + " . failed \(dFailed) . wrist \(dWatchOK)/\(dWatchOK + dWatchMiss)"
            + " . interrupts \(dInterrupt) . session \(dSessOpts) . map \(cueMap.count) . last: \(dLast)"
    }
    private func save() {
        let line = statusLine()
        UserDefaults.standard.set(line, forKey: "interun_coach_audio_status")
        pushLineToPage(line)
    }
    static var lastStatus: String {
        UserDefaults.standard.string(forKey: "interun_coach_audio_status") ?? "no run recorded yet"
    }

    /// ⚠️ THE DIAGNOSTIC WAS STALE, AND THAT MADE EVERY MID-RUN "MAP 0" UNTRUSTWORTHY. `window.__interunCoachAudio`
    /// was written ONCE, by the page-load user script in WebHost, and never touched again — so the coach line
    /// in Support › Your data always showed the value from app LAUNCH, not the live run. The owner's mid-run
    /// "MAP 0" reading was therefore evidence of nothing. Every counter change now pushes the fresh line to
    /// the page: it lands when the page is alive (foreground, or the instant the screen comes back on), and
    /// while the phone is LOCKED the os_log trail (Console.app, subsystem com.interun.app) is the live source
    /// instead. syncStatusToPage() catches the page up on the next foreground.
    private func pushLineToPage(_ line: String) {
        let safe = line.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.__interunCoachAudio = \"\(safe)\";", completionHandler: nil)
        }
    }
    /// Re-assert the live line when the app returns to the front — called from InteRunApp's scenePhase hook,
    /// so Support reflects the run that just happened rather than the launch-time snapshot.
    @MainActor
    func syncStatusToPage() { pushLineToPage(statusLine()) }

    /// For diagnostics: which lifecycle state we are actually in when a clip is attempted. A silent coach on
    /// a locked phone and one on a foregrounded phone are entirely different faults, and the log has to say
    /// which. Read on the main actor, which this class always is.
    private var appStateWord: String {
        switch UIApplication.shared.applicationState {
        case .active: return "active"
        case .inactive: return "inactive"
        case .background: return "background"
        @unknown default: return "unknown"
        }
    }

    override init() {
        super.init()
        cueMap = (UserDefaults.standard.dictionary(forKey: Self.mapKey) as? [String: [String]]) ?? [:]
        configureSession()
        let nc = NotificationCenter.default
        // ⚠️ AN INTERRUPTION USED TO BE UNOBSERVED ANYWHERE IN THE APP. A call, Siri, an alarm or a
        // Clock timer deactivates our session; AVAudioPlayer re-activates implicitly on the next
        // play(), so it is not the permanent death it first looks like — but every cue whose moment
        // falls inside the interruption window is consumed by the scheduler and never heard, and
        // nothing anywhere recorded that it happened. Reactivating on .ended closes the window, and
        // counting them is what will settle the next report of a quiet coach.
        nc.addObserver(self, selector: #selector(interrupted(_:)),
                       name: AVAudioSession.interruptionNotification, object: nil)
        // ⚠️ A media-services reset drops the app's whole session configuration. Rare, but the symptom
        // is total silence for the rest of the run with no way to recover short of relaunching.
        nc.addObserver(self, selector: #selector(mediaReset),
                       name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
    }

    /// ⚠️ CONFIGURE HERE, NOT IN InteRunApp.init, AND DO NOT ACTIVATE. The session used to be activated
    /// once at app launch and never deactivated — and `.duckOthers` ducks for as long as the session is
    /// ACTIVE, not for as long as a clip plays. So the runner's music or podcast sat at reduced volume
    /// from the moment the app launched until it was force-quit: on Today, in Support, long after the
    /// run. Worse, `init()` runs on background wakes too, so it could start with the app never
    /// appearing on screen. This is the exact failure this file's own header refuses to introduce via a
    /// silent keep-alive track, arrived at by a different route.
    ///
    /// ⚠️ `.interruptSpokenAudioAndMixWithOthers` PAUSES a podcast for the cue rather than talking over
    /// it at duck volume — two voices at once is not intelligible, and a runner would fairly report
    /// that as "the coach went quiet". Music still merely ducks. It implies `.mixWithOthers`.
    func configureSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback, mode: .spokenAudio,
                options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
        } catch { note("configure failed: \(error.localizedDescription)") }
    }

    @objc private func interrupted(_ n: Notification) {
        guard let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .began {
            dInterrupt += 1
            note("interrupted")
        } else {
            // ⚠️ Reactivate even when shouldResume is absent. We are not resuming a track the runner
            // was listening to — we are making sure the NEXT cue can sound. Waiting for permission to
            // resume is the wrong question for spoken coaching.
            try? AVAudioSession.sharedInstance().setActive(true)
            note("interruption ended")
        }
    }

    @objc private func mediaReset() {
        player = nil
        configureSession()
        note("media services reset")
    }

    /// Play a cue the WATCH has asked for, without the page. Returns false when there is nothing to
    /// play, so the caller can fall back to the page rather than the runner getting silence.
    @discardableResult
    func playWatchCue(_ trigger: String) -> Bool {
        SelfCheck.logger.notice("coach wrist cue \(trigger, privacy: .public): map=\(self.cueMap.count) state=\(self.appStateWord, privacy: .public)")
        guard let files = cueMap[trigger], !files.isEmpty else {
            dWatchMiss += 1; note("no clip for wrist cue \(trigger) (map \(cueMap.count))"); return false
        }
        // The page's own catalogue enforces per-prompt repeat windows; this is the coarse version of
        // the same idea, so a wrist that re-sends a trigger cannot produce a stutter.
        if let last = lastCueAt[trigger], Date().timeIntervalSince(last) < 20 {
            SelfCheck.logger.notice("coach wrist cue \(trigger, privacy: .public): deduped (<20s window)")
            return true
        }
        // ⚠️ A STUCK PLAYER MUST NOT SILENCE THE WHOLE RUN. `audioPlayerDidFinishPlaying` clears the
        // player on completion, but if the app is suspended mid-clip that callback never fires and the
        // player is left claiming isPlaying forever — after which this guard would suppress EVERY later
        // cue with a "handled" answer, and the wrist, believing the phone had it, would stay silent too.
        // A clip is a few seconds at most, so a player still "playing" well beyond that is stuck: ignore
        // it and let the new cue replace it (assigning `player` in playFile deallocates the stuck one).
        if player?.isPlaying == true, Date().timeIntervalSince(playStartedAt) < 12 {
            SelfCheck.logger.notice("coach wrist cue \(trigger, privacy: .public): suppressed, already playing")
            return true
        }
        // ⚠️ ADVANCE THE ROTATION AND ARM THE DEDUPE ONLY ON A CLIP THAT ACTUALLY SOUNDED. Setting them
        // before playFile meant a FAILED play still poisoned the 20s window: the next same-trigger cue
        // was deduped and answered "handled" (return true), so nothing played natively AND the wrist did
        // not cover it — silence for the rest of the run after a single failure. On failure we return
        // false instead, which is the wrist's signal to speak the line itself.
        let i = (cueRotation[trigger] ?? 0) % files.count
        let ok = playFile(files[i])
        if ok {
            cueRotation[trigger] = i + 1
            lastCueAt[trigger] = Date()
            dWatchOK += 1
        } else {
            dWatchMiss += 1
        }
        return ok
    }

    /// A cue this far past its moment is not worth playing — the runner has moved on, and hearing
    /// "settle into the warm-up" ten minutes into the work is worse than hearing nothing.
    private let staleAfter: TimeInterval = 45

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "schedule":
            let list = (body["cues"] as? [[String: Any]]) ?? []
            let now = Date()
            cues = list.enumerated().compactMap { (idx, item) in
                guard let id = item["id"] as? String,
                      let file = item["file"] as? String,
                      let inMs = item["inMs"] as? Double else { return nil }
                return Cue(key: idx, id: id, fireAt: now.addingTimeInterval(inMs / 1000), file: file)
            }
            // A re-push replaces the schedule outright, so the slot keys start again from zero.
            played.removeAll()
            dScheduled = cues.count
            note("scheduled \(cues.count) cues")
            start()
        case "cuemap":
            // ⚠️ Sent once when a WRIST-recorded run starts. Without it the native side has no way to
            // know which clip a trigger means — the catalogue, the chosen coach and their wordings
            // all live in the page.
            // ⚠️ TOLERANT PARSE, NOT ONE STRICT DEEP CAST. `body["map"] as? [String: [String]]` casts the
            // whole nested structure at once: a single value that is not a homogeneous [String] fails the
            // ENTIRE cast and leaves an empty map — which is silence for the whole run AND indistinguishable
            // from "no map was ever sent". Parse per entry instead, keep every trigger whose value is an
            // array of strings, and log the raw bridged type plus the resulting count so a genuine receipt
            // can be told apart from a deserialize failure. (WKScriptMessage bridges a JS object to
            // NSDictionary and a JS array to NSArray; this copes whether the values arrive as [String] or
            // the looser [Any].)
            let rawMap = body["map"]
            var parsedMap: [String: [String]] = [:]
            if let dict = rawMap as? [String: Any] {
                for (k, v) in dict {
                    if let arr = v as? [String], !arr.isEmpty { parsedMap[k] = arr }
                    else if let arr = v as? [Any] {
                        let strs = arr.compactMap { $0 as? String }
                        if !strs.isEmpty { parsedMap[k] = strs }
                    }
                }
            }
            cueMap = parsedMap
            cueRotation = [:]
            lastCueAt = [:]
            let rawDesc = rawMap.map { String(describing: type(of: $0)) } ?? "absent"
            note("cuemap received: raw \(rawDesc), \(parsedMap.count) triggers")
            SelfCheck.logger.notice("coach cuemap keys=[\(parsedMap.keys.sorted().joined(separator: ","), privacy: .public)]")
        case "playPage":
            // ⚠️ THE PAGE'S OWN <audio> ELEMENT IS WHAT WAS STOPPING THE RUNNER'S MUSIC. Reported from a
            // real session on 2026-08-16, and corrected by the owner after a first wrong diagnosis: it
            // was the COACH's recorded voice that killed the music, not the device voice.
            //
            // WebKit manages the shared AVAudioSession itself. When an <audio> element starts, it sets
            // the category to plain `.playback` with NO options — clearing the `.duckOthers` /
            // `.mixWithOthers` this app configures at launch — which turns a cue into an exclusive
            // playback session that INTERRUPTS whatever else is sounding. And it never deactivates, so
            // nothing tells the music app it may resume. The runner has to go and press play.
            //
            // So a foreground cue is played HERE now, through the session this app owns: activated per
            // sentence, and released with `.notifyOthersOnDeactivation`, which is the thing that brings
            // the music back up by itself. The page keeps every decision — which clip, when, in what
            // order — and hands over only the playing of it.
            //
            // ⚠️ ONE FILE PER CALL, DELIBERATELY. The page already sequences a stitched pace sentence
            // with its own 25ms tail trim, and moving that logic here would be a second copy of it —
            // the exact fix-one-builder-not-the-other trap this file has been bitten by twice. The
            // deactivate is debounced instead, so five fragments duck the music once, not five times.
            if let file = body["file"] as? String {
                let token = (body["token"] as? Int) ?? 0
                let vol = Float((body["volume"] as? Double) ?? 1)
                pagePlay(file: file, volume: vol, token: token)
            }
        case "stopPage":
            stopPagePlayback()
        case "clearSchedule":
            // ⚠️ THE PHONE'S SCHEDULE ONLY. This used to also empty `cueMap`, which belongs to the
            // WRIST path — and it was not a theoretical overlap: `stopLive()` posts this, and every
            // bottom-nav button calls `stopLive()` whenever a run is not live, so tapping Today during
            // a watch-recorded run silenced its coach for the rest of the run.
            stop()
        case "clear":
            cueMap = [:]
            stop()
        default:
            break
        }
    }

    private func start() {
        guard timer == nil else { return }
        // One second is plenty: cues are separated by minutes, and a second of lateness is inaudible
        // against a spoken line. A tighter timer would only cost battery on a locked phone.
        let t = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func stop() {
        timer?.invalidate()
        timer = nil
        cues = []
        played.removeAll()
        player?.stop()
        player = nil
    }

    private func tick() {
        guard !cues.isEmpty else { return }
        // ⚠️ ONLY WHILE THE PAGE CANNOT DO IT ITSELF. With the app in front, the web layer's own loop is
        // running and owns the coach — playing here as well would say every line twice.
        // ⚠️ `== .background`, NOT `!= .active`. `.inactive` covers the app being ON SCREEN with the
        // page's timers fully alive: Control Centre pulled down, a notification banner, the moment
        // after unlocking. In every one of those both players would fire and the runner would hear the
        // same line twice, overlapping, from two different audio sessions. A locked screen reaches
        // `.background` within a fraction of a second, so nothing is lost by requiring it.
        guard UIApplication.shared.applicationState == .background else { return }
        // One at a time: a queue of overlapping voices is worse than a missed line.
        guard player?.isPlaying != true else { return }
        let now = Date()
        guard let next = cues.first(where: { !played.contains($0.key) && $0.fireAt <= now }) else { return }
        played.insert(next.key)
        guard now.timeIntervalSince(next.fireAt) <= staleAfter else {
            dStale += 1
            note("skipped a stale cue")
            report(next.id)   // tell the page it is spent, so it does not queue it on return
            return
        }
        play(next)
    }

    /// Play one clip by its manifest-relative path. Shared by the scheduled phone cues and the
    /// wrist-driven ones, so a change to how clips are found cannot fix one and miss the other.
    @discardableResult
    private func playFile(_ file: String, volume: Float = 1) -> Bool {
        guard let base = Bundle.main.resourceURL else { return false }
        let url = base.appendingPathComponent("web/").appendingPathComponent(file)
        let exists = FileManager.default.fileExists(atPath: url.path)
        SelfCheck.logger.notice("coach playFile \(file, privacy: .public) exists=\(exists) state=\(self.appStateWord, privacy: .public)")
        guard exists else {
            dMissing += 1; note("missing clip \(file)"); return false
        }
        // ⚠️ RE-ASSERT THE CATEGORY BEFORE EVERY CLIP, AND RECORD WHAT IT WAS. WebKit manages the
        // shared session for its own <audio> elements and sets plain `.playback` with NO options,
        // which drops the `.duckOthers`/`.mixWithOthers` configured at launch and makes a cue
        // interrupt the runner's music outright. Once the page hands its clips over to this service
        // that should stop happening — but "should" is what produced a wrong diagnosis on
        // 2026-08-16, so `dSessOpts` carries the options actually in force when a clip starts and
        // Support › Your data prints it. A reading of `none` here is somebody else owning the
        // session; `duck+mix` is this app owning it.
        let sess = AVAudioSession.sharedInstance()
        dSessOpts = describeOptions(sess.categoryOptions)
        if sess.category != .playback || sess.categoryOptions.isEmpty { configureSession() }
        do { try sess.setActive(true) }
        catch { dFailed += 1; note("activate failed [\(appStateWord)]: \(error.localizedDescription)"); return false }
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.delegate = self
            p.volume = max(0, min(1, volume))
            p.prepareToPlay()
            // ⚠️ HONOUR THE RETURN. It was discarded, so a play that produced no sound was
            // indistinguishable from one that did: the cue was marked spent, the page was told it had
            // been spoken so it would not repeat it, and on a wrist run the page fallback that exists
            // for exactly this case was skipped. Silence, with nothing anywhere to show for it.
            guard p.play() else {
                dFailed += 1; note("play refused for \(file) [\(appStateWord)]"); return false
            }
            player = p
            playStartedAt = Date()
            dFired += 1
            note("played \(file) [\(appStateWord)]")
            return true
        } catch {
            dFailed += 1; note("decode failed \(file): \(error.localizedDescription)")
            return false
        }
    }

    // ---- playing on the page's behalf, in the foreground -------------------------------------

    /// The token of the clip the page is currently waiting on, and the pending release of the audio
    /// session. Both exist so a stitched sentence reads as ONE piece of speech to the rest of iOS.
    private var pageToken = 0
    private var pageRelease: DispatchWorkItem?

    /// Play one clip for the page and tell it when the clip is done, so its own sequencing carries on
    /// exactly as it does in a browser. Returns nothing: a failure is reported to the page, which
    /// falls back to its own <audio> element rather than the runner getting silence.
    private func pagePlay(file: String, volume: Float, token: Int) {
        // A new clip cancels a pending release — this is what coalesces the fragments of one sentence
        // into a single duck of the runner's music instead of five.
        pageRelease?.cancel(); pageRelease = nil
        pageToken = token
        player?.delegate = nil          // the outgoing clip must not report an end the page has moved past
        player?.stop()
        player = nil
        guard playFile(file, volume: volume) else { pageDone(token, false); return }
    }

    /// Stop anything playing for the page and release the session at once — the runner has paused,
    /// finished, or a higher-priority cue has taken over.
    private func stopPagePlayback() {
        pageRelease?.cancel(); pageRelease = nil
        player?.delegate = nil
        player?.stop()
        player = nil
        releaseSession()
    }

    /// ⚠️ `.notifyOthersOnDeactivation` IS THE WHOLE POINT OF THIS FUNCTION. Without it the music app
    /// is never told it may come back up, and the runner's audio stays down until something else
    /// happens to reactivate it — which, on a run, is nothing.
    private func releaseSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Tell the page a clip finished (or failed), so its "ended"/"error" paths run as they always have.
    private func pageDone(_ token: Int, _ ok: Bool) {
        webView?.evaluateJavaScript(
            "window.__interunCoachClipEnded && window.__interunCoachClipEnded(\(token), \(ok ? "true" : "false"));",
            completionHandler: nil)
    }

    /// ⚠️ DEACTIVATE WHEN THE CLIP ENDS — this is what stops the ducking outliving the sentence.
    /// `.notifyOthersOnDeactivation` is what tells the music app it may come back up; without it the
    /// runner's audio stays quiet until something else happens to reactivate it.
    func audioPlayerDidFinishPlaying(_ p: AVAudioPlayer, successfully flag: Bool) {
        guard p === player else { return }
        player = nil
        let token = pageToken
        if token != 0 {
            pageToken = 0
            pageDone(token, flag)
            // ⚠️ HELD BRIEFLY, NOT RELEASED HERE. The next fragment of a stitched sentence arrives a
            // few milliseconds later; deactivating between each one would duck and unduck the runner's
            // music five times in four seconds, which is more distracting than the cue itself. A clip
            // that really is the last one releases 700ms later, which is inaudible.
            let w = DispatchWorkItem { [weak self] in self?.releaseSession() }
            pageRelease = w
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7, execute: w)
            return
        }
        releaseSession()
    }

    /// ⚠️ ONE PLAY PATH, NOT TWO. This used to be a second, near-identical copy of `playFile` — same
    /// bundle lookup, same AVAudioPlayer construction — and it is exactly the trap this project has
    /// recorded twice already: a fix applied to one builder and not the other. The activation check,
    /// the honoured `play()` return and the diagnostics all landed in `playFile` first, and every one
    /// of them would have missed the SCHEDULED cues, which are the whole locked-phone feature.
    ///
    /// ⚠️ The cue stays marked played whether or not it sounded. Deferring that until success would
    /// re-select a permanently-failing cue every second forever and block every later one — the
    /// schedule must never wedge. What is conditional is `report()`: telling the page a line was
    /// spoken when it was not is how the runner ends up with silence AND no repeat on unlock.
    private func play(_ cue: Cue) {
        if playFile(cue.file) { report(cue.id) }
    }

    /// Tell the page which line has been spoken, so its own history matches and it does not repeat the
    /// cue the moment the runner unlocks the phone.
    private func report(_ id: String) {
        let safe = id.replacingOccurrences(of: "\\", with: "").replacingOccurrences(of: "\"", with: "")
        webView?.evaluateJavaScript("window.__interunCoachPlayed && window.__interunCoachPlayed(\"\(safe)\");")
    }
}
