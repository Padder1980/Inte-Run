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
        // Bring the watch bridge up now, not when the web view happens to be built. iOS can wake
        // this app in the background purely to answer the watch, and at that point there is no page.
        _ = WatchBridge.shared
        // A card left over from a crash or a force-quit mid-run would otherwise sit there looking
        // live with nothing able to update or dismiss it.
        Task { @MainActor in LiveActivityService.shared.reattach() }
    }

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            WebHost()
                .ignoresSafeArea()
                .background(Color("LaunchBackground"))
                .statusBarHidden(false)
        }
        .onChange(of: scenePhase) { _, phase in
            // Coming back to the app while the wrist is mid-run should land on the live screen, not
            // on Today two seconds before jumping there.
            if phase == .active { WatchBridge.shared.replayLiveOnActivate() }
        }
    }
}
