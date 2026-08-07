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
final class CoachAudioService: NSObject, WKScriptMessageHandler {
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
    private var cueMap: [String: [String]] = [:]
    private var cueRotation: [String: Int] = [:]
    private var lastCueAt: [String: Date] = [:]

    /// Play a cue the WATCH has asked for, without the page. Returns false when there is nothing to
    /// play, so the caller can fall back to the page rather than the runner getting silence.
    @discardableResult
    func playWatchCue(_ trigger: String) -> Bool {
        guard let files = cueMap[trigger], !files.isEmpty else { return false }
        // The page's own catalogue enforces per-prompt repeat windows; this is the coarse version of
        // the same idea, so a wrist that re-sends a trigger cannot produce a stutter.
        if let last = lastCueAt[trigger], Date().timeIntervalSince(last) < 20 { return true }
        guard player?.isPlaying != true else { return true }
        let i = (cueRotation[trigger] ?? 0) % files.count
        cueRotation[trigger] = i + 1
        lastCueAt[trigger] = Date()
        return playFile(files[i])
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
            start()
        case "cuemap":
            // ⚠️ Sent once when a WRIST-recorded run starts. Without it the native side has no way to
            // know which clip a trigger means — the catalogue, the chosen coach and their wordings
            // all live in the page.
            cueMap = (body["map"] as? [String: [String]]) ?? [:]
            cueRotation = [:]
            lastCueAt = [:]
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
        guard UIApplication.shared.applicationState != .active else { return }
        // One at a time: a queue of overlapping voices is worse than a missed line.
        guard player?.isPlaying != true else { return }
        let now = Date()
        guard let next = cues.first(where: { !played.contains($0.key) && $0.fireAt <= now }) else { return }
        played.insert(next.key)
        guard now.timeIntervalSince(next.fireAt) <= staleAfter else {
            report(next.id)   // tell the page it is spent, so it does not queue it on return
            return
        }
        play(next)
    }

    /// Play one clip by its manifest-relative path. Shared by the scheduled phone cues and the
    /// wrist-driven ones, so a change to how clips are found cannot fix one and miss the other.
    @discardableResult
    private func playFile(_ file: String) -> Bool {
        guard let base = Bundle.main.resourceURL else { return false }
        let url = base.appendingPathComponent("web/").appendingPathComponent(file)
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.prepareToPlay()
            p.play()
            player = p
            return true
        } catch { return false }
    }

    private func play(_ cue: Cue) {
        // The clips ride in the bundle exactly as the page sees them: `docs/` is embedded as `web/`, so a
        // manifest path of "voices/guide/prep_1.mp3" lives at "web/voices/guide/prep_1.mp3".
        guard let base = Bundle.main.resourceURL else { return }
        let url = base.appendingPathComponent("web/").appendingPathComponent(cue.file)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.prepareToPlay()
            p.play()
            player = p
            report(cue.id)
        } catch {
            // A clip that will not decode must not wedge the schedule; it is already marked played.
        }
    }

    /// Tell the page which line has been spoken, so its own history matches and it does not repeat the
    /// cue the moment the runner unlocks the phone.
    private func report(_ id: String) {
        let safe = id.replacingOccurrences(of: "\\", with: "").replacingOccurrences(of: "\"", with: "")
        webView?.evaluateJavaScript("window.__interunCoachPlayed && window.__interunCoachPlayed(\"\(safe)\");")
    }
}
