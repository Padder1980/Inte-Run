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
            TodayView(autoStart: launch.pending)
                .environmentObject(store)
                .onAppear { delegate.launch = launch }
        }
    }
}

/// Set when the phone launches this app to begin a run, so `TodayView` starts today's session
/// rather than sitting on its start button waiting for a second tap on a wrist that is already
/// moving. Cleared as soon as it is honoured — a relaunch later must not silently start a run.
@MainActor
final class LaunchRequest: ObservableObject {
    static let shared = LaunchRequest()
    @Published var pending = false
    func request() { pending = true }
    func consume() { pending = false }
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
