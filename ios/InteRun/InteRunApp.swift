import SwiftUI
import AVFoundation

@main
struct InteRunApp: App {
    init() {
        // The whole reason for going native: a PWA's audio stops when the screen locks. Declaring
        // a `.playback` session (with the `audio` background mode in Info.plist) keeps the coach
        // talking with the phone in a pocket. `.duckOthers` drops music under a cue rather than
        // killing it, and `.mixWithOthers` means we never stop someone's podcast outright.
        // ⚠️ CONFIGURED, NOT ACTIVATED, and the audio session now belongs to CoachAudioService alone.
        // `setActive(true)` used to live here, at launch, and was never balanced by a deactivate — and
        // `.duckOthers` ducks while the session is ACTIVE, not while a clip plays. The runner's music
        // therefore sat at reduced volume from launch until force-quit, and since init() also runs on
        // background wakes it could start with the app never appearing on screen. One owner, one place,
        // activated around each clip.
        _ = CoachAudioService.shared
        // Bring the watch bridge up now, not when the web view happens to be built. iOS can wake
        // this app in the background purely to answer the watch, and at that point there is no page.
        _ = WatchBridge.shared
        // A card left over from a crash or a force-quit mid-run would otherwise sit there looking
        // live with nothing able to update or dismiss it.
        Task { @MainActor in LiveActivityService.shared.reattach() }
        // ⚠️ Must be installed on EVERY launch, promptly — including the background launch HealthKit
        // performs when a mirrored workout starts. That launch is the only context in which iOS will
        // let us raise a Live Activity for a run begun on the wrist.
        MirroredWorkoutService.shared.begin()
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
            if phase == .active {
                // Foregrounding is the only event that can change ActivityKit's answer.
                Task { @MainActor in LiveActivityService.shared.clearRefusals() }
                WatchBridge.shared.replayLiveOnActivate()
                // Look for a newer web layer while the runner is here (throttled inside). A build found
                // now is adopted on the NEXT launch, never under a live session.
                WebUpdateService.shared.checkForUpdate()
            }
        }
    }
}
