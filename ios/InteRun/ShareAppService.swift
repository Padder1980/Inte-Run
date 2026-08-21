import Foundation
import MessageUI
import UIKit
import WebKit

/// HANDING THE FINISHED CARD STRAIGHT TO THE APP THE RUNNER PICKED.
///
/// The owner, 2026-08-21: "also I want the share to social media buttons to open in the actual apps".
/// Before this every tile opened the system share sheet, which reaches the same apps in one more tap —
/// so the tiles looked like direct handoffs and were not.
///
/// ⚠️ WHAT iOS ACTUALLY PERMITS IS NOT UNIFORM, AND THE TILES MUST NOT PRETEND OTHERWISE. Two of them
/// can be a true handoff and the rest cannot:
///  • INSTAGRAM STORIES — a documented URL scheme, with the picture passed on the pasteboard under
///    Instagram's own key. Opens straight into the story composer with the card already placed.
///  • MESSAGES — MFMessageComposeViewController with the card as an attachment. That is the real
///    Messages composer, in our app, with the picture attached; `sms:` carries no image at all.
///  • EVERYTHING ELSE — WhatsApp among them — has no sanctioned way to receive an image directly. The
///    share sheet is where those apps genuinely appear, so those tiles open it. A logo on a button that
///    cannot do what the logo implies is the looks-live-is-inert defect this project has shipped three
///    times, so the page is TOLD which are direct and says so.
///
/// ⚠️ THE PAGE LEARNS WHAT IS POSSIBLE FROM A CAPABILITY FLAG THIS FILE SETS, never from the existence
/// of the message handler. `docs/index.html` updates over the air and Swift does not, so a page asking
/// an older build to open Instagram would be discarded by `default: break` and the tile would do
/// nothing at all — silently, on a phone whose app looks up to date. Same rule as
/// `__interunCoachNativePlay`, and it exists because that exact hazard was caught minutes from shipping.
@MainActor
final class ShareAppService: NSObject, WKScriptMessageHandler {
    static let messageName = "interunShareApp"
    static let shared = ShareAppService()

    private static let instagramStory = "instagram-stories://share"

    /// Which destinations this device can genuinely open direct, as the page's capability flag.
    ///
    /// ⚠️ canOpenURL ANSWERS FALSE FOR ANY SCHEME NOT IN LSApplicationQueriesSchemes, whatever is
    /// installed — so this is a statement about the Info.plist as much as about the phone, and a
    /// destination added here without its scheme declared reports itself as unavailable for ever.
    static func capabilityJS() -> String {
        var direct: [String] = []
        if let u = URL(string: instagramStory), UIApplication.shared.canOpenURL(u) {
            direct.append("instagram")
        }
        // ⚠️ BOTH CHECKS, because a device can send a text and refuse an attachment (no iMessage
        // account, or a carrier with MMS off) — and a composer that silently drops the picture is
        // worse than a share sheet that keeps it.
        if MFMessageComposeViewController.canSendText(),
           MFMessageComposeViewController.canSendAttachments() {
            direct.append("messages")
        }
        return "window.__interunShareApps = \"\(direct.joined(separator: ","))\";"
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let dest = body["dest"] as? String,
              let b64 = body["data"] as? String,
              let data = Data(base64Encoded: b64) else { report(false, "bad payload"); return }
        let name = (body["name"] as? String) ?? "InteRun.jpg"
        switch dest {
        case "instagram": openInstagramStory(data)
        case "messages":  openMessages(data, name: name)
        default:          report(false, "no direct route for " + dest)
        }
    }

    // MARK: - Instagram

    private func openInstagramStory(_ data: Data) {
        guard let url = URL(string: Self.instagramStory + "?source_application=" +
                            (Bundle.main.bundleIdentifier ?? "")),
              UIApplication.shared.canOpenURL(url) else { report(false, "instagram not available"); return }
        // ⚠️ THE PASTEBOARD ITEM EXPIRES. Instagram reads it on launch; left without an expiry the
        // runner's card sits in their system clipboard indefinitely, so anything they paste next is a
        // picture of their run. Five minutes is Instagram's own documented window.
        UIPasteboard.general.setItems(
            [["com.instagram.sharedSticker.backgroundImage": data]],
            options: [.expirationDate: Date().addingTimeInterval(60 * 5)])
        UIApplication.shared.open(url, options: [:]) { [weak self] ok in
            // ⚠️ REPORTED FROM THE COMPLETION, NOT ASSUMED. A refused open leaves the page believing the
            // card was handed over, so its tile would show success over a phone that did nothing.
            self?.report(ok, ok ? "instagram" : "instagram refused the open")
        }
    }

    // MARK: - Messages

    private func openMessages(_ data: Data, name: String) {
        guard MFMessageComposeViewController.canSendAttachments() else {
            report(false, "this device cannot attach to a message"); return
        }
        let vc = MFMessageComposeViewController()
        vc.messageComposeDelegate = self
        // ⚠️ THE TYPE IS DECLARED, because Messages decides how to present an attachment from its UTI
        // and an unlabelled blob arrives as a file rather than as a picture.
        let type = name.lowercased().hasSuffix(".png") ? "public.png" : "public.jpeg"
        vc.addAttachmentData(data, typeIdentifier: type, filename: name)
        guard let top = Self.topViewController() else { report(false, "nothing to present from"); return }
        top.present(vc, animated: true) { [weak self] in self?.report(true, "messages") }
    }

    /// ⚠️ THE TOP-MOST PRESENTED CONTROLLER, NOT THE ROOT. The share studio is itself presented, so
    /// presenting from the root raises "already presenting" and the composer never appears.
    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
            ?? scenes.first?.windows.first
        var vc = window?.rootViewController
        while let next = vc?.presentedViewController { vc = next }
        return vc
    }

    // MARK: - Reporting back

    /// The page is told what happened, so a tile can fall back to the share sheet rather than looking
    /// as though it worked. Mirrors the coach bridge's ack, and for the same reason: a handoff that
    /// silently fails is indistinguishable from one that succeeded.
    private func report(_ ok: Bool, _ detail: String) {
        let js = "window.__interunShareAppResult && window.__interunShareAppResult(" +
            (ok ? "true" : "false") + ", \"" +
            detail.replacingOccurrences(of: "\"", with: "") + "\");"
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for w in scene.windows {
                Self.webViews(in: w).forEach { $0.evaluateJavaScript(js, completionHandler: nil) }
            }
        }
    }

    private static func webViews(in view: UIView) -> [WKWebView] {
        if let w = view as? WKWebView { return [w] }
        return view.subviews.flatMap { webViews(in: $0) }
    }
}

extension ShareAppService: MFMessageComposeViewControllerDelegate {
    func messageComposeViewController(_ controller: MFMessageComposeViewController,
                                     didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: true)
    }
}
