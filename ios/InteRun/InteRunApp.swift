import SwiftUI
import AVFoundation

@main
struct InteRunApp: App {
    init() {
        // The whole reason for going native: a PWA's audio stops when the screen locks. Declaring
        // a `.playback` session (with the `audio` background mode in Info.plist) keeps the coach
        // talking with the phone in a pocket. `.duckOthers` drops music under a cue rather than
        // killing it, and `.mixWithOthers` means we never stop someone's podcast outright.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio,
                                 options: [.duckOthers, .mixWithOthers])
        try? session.setActive(true)
    }

    var body: some Scene {
        WindowGroup {
            WebHost()
                .ignoresSafeArea()
                .background(Color("LaunchBackground"))
                .statusBarHidden(false)
        }
    }
}
