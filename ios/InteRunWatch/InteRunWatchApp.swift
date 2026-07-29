import HealthKit
import SwiftUI
import WatchKit

@main
struct InteRunWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var delegate
    @StateObject private var store = SessionStore()
    @StateObject private var launch = LaunchRequest.shared

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            // A run screen can only be reached with a real workout, GPS and a plan, and simctl cannot
            // tap a watch simulator — so a DEBUG launch argument renders one directly. See WatchPreview.
            if let scene = WatchPreview.requested {
                WatchPreview.view(scene)
                    .background(Brand.bg.ignoresSafeArea())
            } else {
                root
            }
            #else
            root
            #endif
        }
    }

    private var root: some View {
        TodayView(autoStart: launch.pending)
            .environmentObject(store)
            .onAppear { delegate.launch = launch }
    }
}

/// Set when the phone launches this app to begin a run, so `TodayView` starts today's session
/// rather than sitting on its start button waiting for a second tap on a wrist that is already
/// moving. Cleared as soon as it is honoured — a relaunch later must not silently start a run.
@MainActor
final class LaunchRequest: ObservableObject {
    static let shared = LaunchRequest()
    @Published var pending = false
    /// True when the phone is recording and the watch was launched only to show it. ⚠️ A companion
    /// must NOT start a workout of its own: two recorders double-count and log the outing twice,
    /// which is the one failure this whole design exists to avoid.
    @Published var companionOnly = false
    func request() { pending = true }
    func requestCompanion() { companionOnly = true }
    func consume() { pending = false }
    func endCompanion() { companionOnly = false }
}

/// The delegate exists solely for `handle(_ workoutConfiguration:)`.
///
/// That is the callback for `HKHealthStore.startWatchApp(with:)` on the phone — the only supported
/// way to wake a watchOS app from iOS. Without it the app launches and simply shows Today, which
/// looks like the "start on my watch" button did nothing.
final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    @MainActor var launch: LaunchRequest?

    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        Task { @MainActor in (launch ?? LaunchRequest.shared).request() }
    }
}
