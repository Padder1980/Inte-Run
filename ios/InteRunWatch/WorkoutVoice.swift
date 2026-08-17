import AVFoundation
import Foundation

/// Spoken cues on the wrist: the session's own steps, pace verdicts, and — deep into a hard run —
/// the runner's own reasons for being out there.
///
/// It speaks as the coach chosen on the phone. Not the recorded clips (see CoachVoice for why that
/// cannot work out here) but the coach's identity: a matched voice, their pace of speech, and their
/// actual wordings pulled from the same catalogue the phone plays.
///
/// Live synthesis also buys the wrist something the phone cannot have — it can say ANY name aloud,
/// with no recorded pack, so "you're doing this for Alfie" works here for every runner rather than
/// only for the one whose pack was generated.
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
    /// The coach chosen on the phone, and that coach's own wordings. See CoachVoice for why the
    /// wrist synthesises rather than playing the recorded clips.
    private var coach: String?
    private var lines: [String: String] = [:]
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

    /// Adopt the coach the runner picked on the phone: their voice, their pace of speech, and their
    /// words. Called once when a run starts.
    func loadCoach(_ id: String?, lines: [String: String]) {
        coach = id
        self.lines = lines
    }

    /// A coach's own wording for a moment, or the plain fallback when the phone has not sent one
    /// (voice coaching off, or an older phone build).
    private func line(_ key: String, _ fallback: String) -> String {
        let v = lines[key]?.trimmingCharacters(in: .whitespaces)
        return (v?.isEmpty == false) ? v! : fallback
    }

    func loadWhy(_ answers: [String: String], person: String?) {
        why = answers.filter { !$0.value.trimmingCharacters(in: .whitespaces).isEmpty }
        let p = (person ?? "").trimmingCharacters(in: .whitespaces)
        self.person = p.isEmpty ? nil : p
    }

    func say(_ text: String) {
        guard !text.isEmpty else { return }
        synth.speak(CoachVoice.utterance(text, coach: coach))
    }

    /// The wrist speaking a line the PHONE was asked for and did not play.
    ///
    /// ⚠️ THIS IS THE ONLY THING THAT MAKES THE HANDOVER SAFE. Every caller of `speakOnPhone` reads its
    /// Bool as "the phone has this, stay quiet" — so any failure on the far side used to be silence
    /// with nobody aware of it. The phone now replies whether it actually SOUNDED a clip, and when it
    /// did not, this speaks. A synthesised line arriving a second late is a poor coach; a whole run
    /// with no coach at all is not one.
    ///
    /// ⚠️ Deliberately terse and generic. The recorded clip is the good version; this exists so the
    /// runner knows the moment happened, not to reproduce it. `text` is passed through when the caller
    /// had real words (the step announcement and the pace corrections carry the runner's own numbers,
    /// which no pre-recorded clip may contain).
    func fallback(for trigger: String, text: String?) {
        if let text, !text.isEmpty { say(text); return }
        switch trigger {
        case "countdown":        return   // the beats have passed; a late "three, two, one" is worse than nothing
        case "session-start":    sayStart()
        case "session-complete": sayComplete()
        case "paused":           sayPaused()
        case "resumed":          sayResumed()
        case "warmup-start":     say(line("warmup-start", "Warm-up. Start gently."))
        case "interval-start":   say(line("interval-start", "Next effort."))
        case "recovery-start":   say(line("recovery-start", "Recover."))
        case "cooldown-start":   say(line("cooldown-start", "Ease down."))
        case "tempo-start":      say(line("tempo-start", "Lift it here."))
        case "easy-settle", "long-run-settle": say(line(trigger, "Settle in."))
        case "milestone-distance", "keep-going": return   // encouragement is not worth a robot
        default: return
        }
    }

    // The fixed moments, in the chosen coach's words.
    func sayStart() { say(line("start", "Here we go.")) }
    func sayPaused() { say(line("paused", "Paused.")) }
    func sayResumed() { say(line("resumed", "And we're back.")) }
    func sayComplete() { say(line("complete", "Session complete. Well done.")) }

    /// A step announcement: what to do, and the pace it wants.
    /// A step change, in the coach's real recorded voice.
    ///
    /// ⚠️ It does NOT read the label or the pace numbers aloud. Doing so meant synthesising, and a
    /// robot arriving three seconds after the coach counted you in is worse than saying less — the
    /// pace band is on both screens anyway. Instead the step's KIND picks a catalogue trigger, and
    /// the phone plays the real clip for it.
    func announceStep(kind: String, via manager: WorkoutManager?) {
        let trigger: String
        switch kind {
        case "warmup": trigger = "warmup-start"
        case "rep": trigger = "interval-start"
        case "recovery": trigger = "recovery-start"
        case "cooldown": trigger = "cooldown-start"
        default: trigger = "easy-settle"
        }
        // ⚠️ The `false` branch is now only "WatchConnectivity is not even available". Everything else
        // — unreachable, reachable-but-silent — comes back through the reply handler as `fallback`,
        // which is the only path that can tell the difference between the phone speaking and the phone
        // merely receiving. Keeping a second fallback here as well would double-speak.
        if manager?.speakOnPhone(trigger) == true { return }
        say(line(trigger, kind == "rep" ? "Next effort." : "Next section."))
    }

    /// Pace nudges speak only when the verdict has held for a few seconds AND the last nudge was
    /// a while ago — a coach who nags every stride gets muted in week one.
    ///
    /// ⚠️ Spoken by the WRIST, never forwarded to the phone's recorded clips — the owner's spec is
    /// the full sentence with the actual numbers ("Speed up a little, your current pace is …, your
    /// target pace is …"), and no pre-generated clip can say a number. Same rule, same synthesised
    /// coach voice as the step announcements' fallback.
    func paceCue(_ verdict: String, currentSecPerKm: Double?, band: (low: Int, high: Int)?) {
        guard verdict == "fast" || verdict == "slow" else { lastVerdict = verdict; verdictSince = nil; return }
        if verdict != lastVerdict { lastVerdict = verdict; verdictSince = Date(); return }
        guard let since = verdictSince,
              Date().timeIntervalSince(since) > 6,
              Date().timeIntervalSince(lastPaceCue) > 45,
              let cur = currentSecPerKm, cur.isFinite, cur > 0,
              let band else { return }
        lastPaceCue = Date()
        let lead = verdict == "fast" ? "Slow down a little." : "Speed up a little."
        say(lead
            + " Your current pace is \(Self.spokenPace(Int(cur.rounded()))) per kilometre."
            + " Your target pace is \(Self.spokenPace(band.low)) to \(Self.spokenPace(band.high)).")
    }

    /// Forget any accrued verdict hold. Called on pause AND resume: while paused the tick that
    /// resets the hold never runs, but GPS keeps updating pace from walking speed — without this,
    /// the first tick after resuming could pass the "sustained for 6s" guard on pause wall-time
    /// alone and speak a numbered cue quoting the WALK, straight over the "resumed" clip.
    func resetPaceHold() {
        lastVerdict = ""
        verdictSince = nil
    }

    /// "5:43" the way a person says it — "5 minutes 43". Spelling it out matters: a synthesiser
    /// reading "5:43" aloud can render it as a clock time or a ratio. Pure and static so it can be
    /// verified off-device.
    static func spokenPace(_ secPerKm: Int) -> String {
        let m = secPerKm / 60, s = secPerKm % 60
        // Grammar mirrors the phone's paceWords (web/app.ts) exactly — one product, one wording.
        // "1 minutes 1" was real output before the singular rule.
        let unit = m == 1 ? "minute" : "minutes"
        if m <= 0 { return "\(s) seconds" }
        if s == 0 { return "\(m) \(unit)" }
        return "\(m) \(unit) \(s)"
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
            say(line("keepGoing", "Stay with it. This is the part that counts."))
        }
    }
}
