import AVFoundation
import Foundation

/// The wrist's rendering of the coach the runner picked on the phone.
///
/// ⚠️ The watch does NOT play the recorded ElevenLabs clips, and this is a decision rather than an
/// omission. The wrist's most frequent cue is the step announcement, and that carries the runner's
/// own pace numbers — "target four fifty-five to five oh-eight per kilometre". No pre-generated clip
/// can ever say those; the catalogue forbids digits outright for that reason. Playing clips for the
/// fixed lines and synthesising the rest would swap timbre mid-run, several times a kilometre,
/// which sounds broken rather than premium.
///
/// So the wrist synthesises everything, and what it borrows from the phone is the coach's IDENTITY:
/// a voice matched to their character, their pace of speech, and their actual wordings pulled from
/// the same catalogue the phone plays. The runner hears the coach they chose saying the coach's
/// lines — just not the recorded actor.
struct CoachVoice {
    /// How a coach should sound, independent of which voices this watch happens to have installed.
    struct Character {
        let name: String
        let feminine: Bool
        /// Preferred system voices, best first. Availability varies by watchOS version and by what
        /// the runner has downloaded, so this is a wish-list, not a guarantee.
        let preferred: [String]
        let rate: Float      // AVSpeechUtteranceDefaultSpeechRate is 0.5
        let pitch: Float     // 1.0 is neutral
    }

    /// Matched to the four coaches as cast on the phone: Holly, Philip, Hope, Lucy.
    /// The three feminine coaches get deliberately DIFFERENT preferred voices — picking the same
    /// system voice for all of them would make the choice on the phone meaningless out here.
    static let characters: [String: Character] = [
        "guide": Character(name: "The Guide", feminine: true,
                           preferred: ["Serena", "Kate", "Martha", "Samantha"],
                           rate: 0.48, pitch: 1.03),
        "pacer": Character(name: "The Pacer", feminine: false,
                           preferred: ["Daniel", "Oliver", "Arthur", "Alex"],
                           rate: 0.46, pitch: 0.96),
        "motivator": Character(name: "The Motivator", feminine: true,
                               preferred: ["Karen", "Moira", "Samantha", "Tessa"],
                               rate: 0.55, pitch: 1.09),
        "technician": Character(name: "The Technician", feminine: true,
                                preferred: ["Kate", "Fiona", "Tessa", "Serena"],
                                rate: 0.50, pitch: 0.99),
    ]

    static func character(for coach: String?) -> Character {
        characters[coach ?? ""] ?? Character(name: "Coach", feminine: true,
                                             preferred: ["Serena", "Samantha"],
                                             rate: 0.5, pitch: 1.0)
    }

    /// The best installed voice for a character.
    ///
    /// Named voices first, then anything of the right gender in the runner's own language, then
    /// whatever the system default is. Quality is preferred at every step — an enhanced voice is a
    /// noticeably better companion for an hour than the compact one.
    static func voice(for c: Character) -> AVSpeechSynthesisVoice? {
        let all = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }
        guard !all.isEmpty else { return nil }

        func best(_ pool: [AVSpeechSynthesisVoice]) -> AVSpeechSynthesisVoice? {
            pool.max { rank($0) < rank($1) }
        }
        // Prefer the runner's own region, then quality.
        let region = String(Locale.current.identifier.suffix(2))
        func rank(_ v: AVSpeechSynthesisVoice) -> Int {
            var n = 0
            switch v.quality {
            case .premium: n += 6
            case .enhanced: n += 4
            default: n += 1
            }
            if v.language.hasSuffix(region) { n += 3 }
            if v.language == "en-GB" { n += 1 }   // the app's own voice is British
            return n
        }

        for name in c.preferred {
            if let hit = best(all.filter { $0.name.localizedCaseInsensitiveContains(name) }) { return hit }
        }
        let wanted: AVSpeechSynthesisVoiceGender = c.feminine ? .female : .male
        if let hit = best(all.filter { $0.gender == wanted }) { return hit }
        return best(all)
    }

    /// Build the utterance for a line, in this coach's manner.
    static func utterance(_ text: String, coach: String?) -> AVSpeechUtterance {
        let c = character(for: coach)
        let u = AVSpeechUtterance(string: text)
        u.voice = voice(for: c)
        u.rate = c.rate
        u.pitchMultiplier = c.pitch
        // A breath before and after, so a cue does not collide with the tail of a music track or
        // with the next cue in a queue.
        u.preUtteranceDelay = 0.05
        u.postUtteranceDelay = 0.1
        return u
    }
}
