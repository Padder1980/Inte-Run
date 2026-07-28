import AVFoundation
import Foundation

/// Spoken cues on the wrist — the system voice reading the session's own steps, pace verdicts, and,
/// deep into a hard run, the runner's own reasons for being out there.
///
/// The four ElevenLabs coaches stay a phone feature: choosing the right clip lives in the TS
/// engine's catalogue logic, and watchOS has no JavaScriptCore to run it. But live synthesis buys
/// the wrist something the phone cannot have — it can say ANY name aloud, with no recorded pack,
/// so "you're doing this for Alfie" works here for every runner rather than only for the one whose
/// pack was generated.
///
/// Audio routes to AirPods when connected, otherwise the watch speaker. `.duckOthers` lowers music
/// under a cue rather than stopping it.
@MainActor
final class WorkoutVoice {
    private let synth = AVSpeechSynthesizer()
    private var lastPaceCue = Date.distantPast
    private var lastVerdict = ""
    private var verdictSince: Date?

    /// The runner's answers, and the person behind them. Set once at the start of a session.
    private var why: [String: String] = [:]
    private var person: String?
    private var whySpoken = false
    private var lastKeepGoing = Date.distantPast

    init() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        // ⚠️ watchOS does not activate an audio session the way iOS does. `setActive(true)` returns
        // without error here and the speaker still stays silent — the wrist needs
        // `activate(options:)`, which claims the route (speaker, or AirPods if connected) and only
        // then permits playback. This is why the watch had no spoken cues at all.
        session.activate(options: []) { _, _ in }
    }

    func loadWhy(_ answers: [String: String], person: String?) {
        why = answers.filter { !$0.value.trimmingCharacters(in: .whitespaces).isEmpty }
        let p = (person ?? "").trimmingCharacters(in: .whitespaces)
        self.person = p.isEmpty ? nil : p
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

    /// The why moment: once per run, late on, in a session long enough for it to mean something.
    ///
    /// Rarity is the whole point. A reminder of why you run, delivered every session, becomes
    /// wallpaper; delivered once at the point it actually hurts, it lands. Mirrors the phone's
    /// `coachWhyTick` — same 70% threshold, same 15-minute floor, same once-per-run rule.
    func whyMoment(elapsed: TimeInterval, target: TimeInterval, hard: Bool) {
        guard !whySpoken, !why.isEmpty, target >= 900 else { return }
        let through = target > 0 ? elapsed / target : 0
        guard through >= (hard ? 0.66 : 0.70) else { return }
        guard let (key, answer) = why.randomElement() else { return }
        whySpoken = true
        say(frame(key: key, answer: answer))
    }

    /// Wrap the runner's own words in the coach's. Their sentence is the payload; ours is the
    /// setting — and where they named someone, the name goes in, because a live voice can say it.
    private func frame(key: String, answer: String) -> String {
        let words = answer.trimmingCharacters(in: .whitespacesAndNewlines)
        let named = person.map { " Do this one for \($0)." } ?? ""
        switch key {
        case "inspire":  return "Remember who inspires you. You said: \(words).\(named)"
        case "reason":   return "This is why you run. You said: \(words).\(named)"
        case "goal":     return "Your goal has a reason behind it. You said: \(words).\(named)"
        default:         return "It's tough now. This is what keeps you going: \(words).\(named)"
        }
    }

    /// Encouragement in the closing stretch of hard or long work, at most once every few minutes.
    func keepGoing(elapsed: TimeInterval, target: TimeInterval, hard: Bool) {
        guard hard, target > 0, elapsed / target >= 0.80 else { return }
        guard Date().timeIntervalSince(lastKeepGoing) > 240 else { return }
        lastKeepGoing = Date()
        if let p = person, Bool.random() {
            say("Nearly there. Finish this one for \(p).")
        } else {
            say(["Stay with it. This is the part that counts.",
                 "Hold this. You're closer than it feels.",
                 "Keep going. Strong to the end."].randomElement()!)
        }
    }
}
