import UIKit
import WebKit

/// Makes `<a download>` work inside the app.
///
/// The web UI produces files the ordinary web way — a Blob plus a `download` attribute — for the
/// data backup and the calendar `.ics` export. A plain WKWebView drops those silently: the tap
/// appears to do nothing at all. Routing them through `WKDownload` and then straight into the
/// system share sheet turns them into something a phone can actually act on — Save to Files,
/// AirDrop to another device, or mail it to yourself.
///
/// That share sheet is also the migration path: export in Safari, AirDrop to the phone, restore here.
extension WebHost.Coordinator: WKDownloadDelegate {
    func download(_ download: WKDownload,
                  decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        // A blob download can arrive with no usable name; fall back to something sensible.
        let name = suggestedFilename.isEmpty ? "interun-export" : suggestedFilename
        let url = dir.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: url) // WKDownload refuses to overwrite
        pendingDownload = url
        completionHandler(url)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = pendingDownload else { return }
        pendingDownload = nil
        presentShareSheet(for: url)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        pendingDownload = nil
        SelfCheck.logger.error("download failed: \(error.localizedDescription, privacy: .public)")
    }

    private func presentShareSheet(for url: URL) {
        guard let root = Self.topViewController() else { return }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        // iPad has no modal sheet without an anchor; give it the centre of the screen.
        if let pop = share.popoverPresentationController {
            pop.sourceView = root.view
            pop.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.midY, width: 0, height: 0)
            pop.permittedArrowDirections = []
        }
        root.present(share, animated: true)
    }

    static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
