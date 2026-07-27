import UserNotifications
import WebKit

/// Real session reminders, scheduled by iOS rather than by a timer in the page.
///
/// A website cannot wake itself: the PWA can only arm a `setTimeout` that dies with the tab, which
/// is exactly why the calendar `.ics` export exists as a workaround. Worse, WKWebView has no
/// `Notification` API at all, so in the app the whole reminders feature was inert — the sheet just
/// said notifications were unsupported.
///
/// Here the page hands over a *schedule* — every upcoming session day at each configured time — and
/// `UNUserNotificationCenter` fires them whether or not InteRun is running. That is the thing
/// reminders were always supposed to do.
///
/// iOS keeps at most **64 pending local notifications per app** and silently drops the rest, so the
/// list is capped and re-synced on every launch and settings change.
final class NotificationService: NSObject {
    static let messageName = "interunNotify"
    /// Comfortably under the OS limit of 64, leaving headroom for anything else scheduled later.
    private static let maxPending = 60

    private weak var webView: WKWebView?

    init(webView: WKWebView?) {
        self.webView = webView
        super.init()
        // The centre holds this weakly; the Coordinator owns us, which is what keeps it alive.
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Permission

    private func reportStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let perm: String
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: perm = "granted"
            case .denied: perm = "denied"
            default: perm = "default"
            }
            DispatchQueue.main.async {
                self.webView?.evaluateJavaScript(
                    "window.__interunNotify && window.__interunNotify.status('\(perm)');")
            }
        }
    }

    private func requestPermission() {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] _, _ in
                self?.reportStatus()
            }
    }

    // MARK: - Scheduling

    private func schedule(_ items: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        // Replace wholesale rather than diffing: the plan, the times and the quotes can all change,
        // and a stale reminder for a session that no longer exists is worse than a missing one.
        center.removeAllPendingNotificationRequests()

        for item in items.prefix(Self.maxPending) {
            guard let title = item["title"] as? String,
                  let body = item["body"] as? String,
                  let year = item["y"] as? Int, let month = item["mo"] as? Int,
                  let day = item["d"] as? Int, let hour = item["h"] as? Int,
                  let minute = item["mi"] as? Int else { continue }

            var comps = DateComponents()
            comps.year = year; comps.month = month; comps.day = day
            comps.hour = hour; comps.minute = minute

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default

            let id = (item["id"] as? String) ?? UUID().uuidString
            center.add(UNNotificationRequest(
                identifier: id,
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)))
        }
    }

    private func clear() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    /// Debug hook for the smoke test: how many reminders the OS is actually holding.
    private func reportPending() {
        UNUserNotificationCenter.current().getPendingNotificationRequests { reqs in
            let next = reqs
                .compactMap { ($0.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() }
                .sorted()
                .first
            let iso = next.map { ISO8601DateFormatter().string(from: $0) } ?? ""
            DispatchQueue.main.async {
                self.webView?.evaluateJavaScript(
                    "window.__interunNotify && window.__interunNotify.pending(\(reqs.count), '\(iso)');")
            }
        }
    }
}

extension NotificationService: UNUserNotificationCenterDelegate {
    /// Show the reminder even when InteRun is open — otherwise iOS suppresses it and a runner
    /// staring at the app is the one person who never gets told.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler:
                                @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}

extension NotificationService: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "status": reportStatus()
        case "request": requestPermission()
        case "schedule": schedule((body["items"] as? [[String: Any]]) ?? [])
        case "clear": clear()
        case "pending": reportPending()
        default: break
        }
    }
}
