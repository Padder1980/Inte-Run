import SwiftUI

@main
struct InteRunWatchApp: App {
    @StateObject private var store = SessionStore()

    var body: some Scene {
        WindowGroup {
            TodayView()
                .environmentObject(store)
        }
    }
}
