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
        case "clear":
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
