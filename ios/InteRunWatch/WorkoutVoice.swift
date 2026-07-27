import AVFoundation
import Foundation

/// Spoken cues on the wrist — version one: the system voice reading the session's own steps and
/// pace verdicts.
///
/// The four Kokoro coaches stay a phone feature for now: choosing the right clip lives in the TS
/// engine's catalogue logic, and watchOS has no JavaScriptCore to run it. A clear spoken cue today
/// beats a branded silence — and the wiring built here (when to speak, how often) is exactly what
/// the coach voices will slot into later.
///
/// Audio routes to AirPods when connected, otherwise the watch speaker. `.duckOthers` lowers music
/// under a cue rather than stopping it.
@MainActor
final class WorkoutVoice {
    private let synth = AVSpeechSynthesizer()
    private var lastPaceCue = Date.distantPast
    private var lastVerdict = ""
    private var verdictSince: Date?

    init() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)
    }

    func say(_ text: String) {
        guard !text.isEmpty else { return }
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.5
        synth.speak(utterance)
    }

    /// A step announcement: what to do, and the pace it wants.
    func announceStep(label: String, paceLow: Int?, paceHigh: Int?) {
        var text = label
        if let lo = paceLow, let hi = paceHigh {
            text += ". Target \(WorkoutManager.pace(Double(lo))) to \(WorkoutManager.pace(Double(hi))) per kilometre."
        }
        say(text)
    }

    /// Pace nudges speak only when the verdict has held for a few seconds AND the last nudge was
    /// a while ago — a coach who nags every stride gets muted in week one.
    func paceCue(_ verdict: String) {
        guard verdict == "fast" || verdict == "slow" else { lastVerdict = verdict; verdictSince = nil; return }
        if verdict != lastVerdict { lastVerdict = verdict; verdictSince = Date(); return }
        guard let since = verdictSince,
              Date().timeIntervalSince(since) > 6,
              Date().timeIntervalSince(lastPaceCue) > 45 else { return }
        lastPaceCue = Date()
        say(verdict == "fast" ? "Ease off a touch." : "Pick it up a little.")
    }
}
