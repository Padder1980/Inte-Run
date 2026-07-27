import UIKit
import WebKit

/// Real haptics for the web layer.
///
/// `navigator.vibrate` does not exist in WKWebView, so gestures the page builds — like dragging a
/// session to another day — feel dead in the native app. The page posts a kind; the shell plays
/// the matching generator.
final class HapticService: NSObject, WKScriptMessageHandler {
    static let messageName = "interunHaptic"

    private let impact = UIImpactFeedbackGenerator(style: .medium)
    private let selection = UISelectionFeedbackGenerator()
    private let notify = UINotificationFeedbackGenerator()

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let kind = body["kind"] as? String else { return }
        switch kind {
        case "lift": impact.impactOccurred()
        case "tick": selection.selectionChanged()
        case "success": notify.notificationOccurred(.success)
        case "warn": notify.notificationOccurred(.warning)
        default: break
        }
    }
}
