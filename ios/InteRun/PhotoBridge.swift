import Foundation
import Photos
import UIKit
import WebKit

/// The bridge between the in-app camera-roll grid and PhotoKit.
///
/// ⚠️ THE BYTES DO NOT COME BACK THROUGH `evaluateJavaScript`. A base64 string is roughly a third
/// bigger than the data it carries and has to be built, escaped, parsed and decoded — for a thumbnail
/// that is wasteful and for a thirty-megabyte video it is a stall the runner watches. So this handler
/// answers only with SMALL JSON — the list of what is there — and the pixels are fetched by the page
/// itself over the app's own `interun://app/__photo/...` scheme, which streams and is cached by
/// WebKit exactly like any other resource.
///
/// ⚠️ AND THE SCHEME IS THE APP'S OWN, NOT A NEW ONE. `localStorage` is keyed to `interun://app`, so
/// serving photographs from a second origin would put them outside everything else and mean two
/// scheme handlers to keep in step. A path prefix on the existing one costs nothing.
final class PhotoBridge: NSObject, WKScriptMessageHandler {
    static let shared = PhotoBridge()
    static let messageName = "interunPhotos"
    /// The path the scheme handler recognises. One constant, read by both sides.
    static let pathPrefix = "/__photo/"

    private weak var web: WKWebView?
    func attach(_ webView: WKWebView) { web = webView }

    /// ⚠️ A CAPABILITY FLAG, NOT A HANDLER-EXISTS TEST. This project has already nearly shipped a silent
    /// coach by asking whether a message handler was registered: the name had existed for weeks while
    /// the action behind it had not, so the guard passed and the page's request fell into `default`.
    /// The page must be able to tell an OLD build from a new one, so the flag is bumped when the
    /// contract changes and never widened back to a name check.
    static func capabilityJS() -> String {
        "window.__interunPhotoLibrary = 1;"
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "status":
            reply(body, ["status": PhotoLibraryService.status()])
        case "authorize":
            PhotoLibraryService.authorize { st in
                PhotoLibraryService.invalidate()
                self.reply(body, ["status": st])
            }
        case "list":
            let offset = (body["offset"] as? Int) ?? 0
            let limit = min(300, max(1, (body["limit"] as? Int) ?? 90))
            let page = PhotoLibraryService.page(offset: offset, limit: limit)
            reply(body, [
                "status": PhotoLibraryService.status(),
                "total": page.total,
                "offset": offset,
                // ⚠️ THE SECONDS COME WITH THE ROW so the grid can badge a video with its length without
                // loading it. Asking for that later would be a second round trip per cell.
                "items": page.items.map { ["id": $0.id, "video": $0.isVideo,
                                          "seconds": $0.seconds, "w": $0.width, "h": $0.height] },
            ])
        case "refresh":
            PhotoLibraryService.invalidate()
            reply(body, ["ok": true])
        case "manage":
            // ⚠️ THE SYSTEM SHEET FOR A LIMITED GRANT. Somebody who chose "selected photos" is not
            // refusing — they are curating — and this is the only way to widen that choice.
            // ⚠️ PhotoKit's own picker for widening a limited grant lives on PHPhotoLibrary as an
            // ObjC-only selector on this SDK, so it is called through the runtime rather than named
            // directly — and if it is not there, the reply below still comes back and the page falls
            // back to telling the runner where the setting is. A missing selector must not be a
            // request that never answers.
            if let root = Self.topController() {
                let lib = PHPhotoLibrary.shared()
                let sel = NSSelectorFromString("presentLimitedLibraryPickerFromViewController:")
                if lib.responds(to: sel) { _ = lib.perform(sel, with: root) }
            }
            reply(body, ["ok": true])
        default:
            // ⚠️ AN UNKNOWN ACTION IS ANSWERED, NOT DROPPED. A page waiting on a reply that never comes
            // is a grid that spins forever, which is the failure this project already records for the
            // coach's own bridge.
            reply(body, ["error": "unknown action"])
        }
    }

    private func reply(_ body: [String: Any], _ payload: [String: Any]) {
        guard let token = body["token"] as? String else { return }
        var out = payload
        out["token"] = token
        guard let data = try? JSONSerialization.data(withJSONObject: out),
              let json = String(data: data, encoding: .utf8) else { return }
        let js = "window.__interunPhotosReply && window.__interunPhotosReply(\(json));"
        DispatchQueue.main.async { self.web?.evaluateJavaScript(js, completionHandler: nil) }
    }

    private static func topController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let root = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }?.rootViewController
        var top = root
        while let next = top?.presentedViewController { top = next }
        return top
    }

    /// Serving one photograph or video for the scheme handler.
    ///
    /// ⚠️ TWO SIZES ONLY: a square thumbnail for the grid, and the original for the post. Anything in
    /// between would be a third rendering of the same asset with nothing asking for it.
    static func serve(path: String, done: @escaping (Data?, String) -> Void) {
        // /__photo/<thumb|full>/<url-encoded local identifier>
        let rest = String(path.dropFirst(pathPrefix.count))
        let parts = rest.split(separator: "/", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2,
              let id = String(parts[1]).removingPercentEncoding, !id.isEmpty else {
            done(nil, "text/plain"); return
        }
        if parts[0] == "thumb" {
            PhotoLibraryService.thumbnail(id, side: 320) { data in done(data, "image/jpeg") }
        } else if parts[0] == "full" {
            PhotoLibraryService.original(id) { data, mime in done(data, mime ?? "application/octet-stream") }
        } else {
            done(nil, "text/plain")
        }
    }
}
