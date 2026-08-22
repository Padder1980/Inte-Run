import Foundation
import WebKit
import UniformTypeIdentifiers

/// Serves the bundled web app over a private `interun://app/…` origin.
///
/// Why not plain `file://`: WKWebView blocks `fetch()` against file URLs, and the app fetches
/// `voices/manifest.json` to discover which coach clips exist. A custom scheme gives the page a
/// real origin, so `fetch` and `localStorage` behave exactly as they do on the web — which matters
/// because every scrap of user data (profile, plan, logged runs) lives in `localStorage`.
///
/// The origin string is load-bearing: `localStorage` is keyed by it, so changing the scheme or host
/// later would orphan every existing user's data. Fix it once, never touch it.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "interun"
    static let host = "app"
    static var startURL: URL { URL(string: "\(scheme)://\(host)/index.html")! }

    /// The bundled copy of `docs/`, laid down by the "Embed web app" build phase.
    static var webRoot: URL? { Bundle.main.url(forResource: "web", withExtension: nil) }

    private let root: URL
    /// Tasks WebKit has not yet stopped. Touched only on the main thread; replying to a stopped
    /// task is a hard crash, so every async completion re-checks membership here first.
    private var live = Set<ObjectIdentifier>()

    init(root: URL) {
        self.root = root.standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let key = ObjectIdentifier(task)
        live.insert(key)

        // The one file that travels over the air: if a newer, boot-proven index.html was downloaded,
        // serve it in place of the bundled copy. Everything else flows through the bundle unchanged.
        if let url = task.request.url, Self.isIndexRequest(url),
           let data = WebUpdateService.shared.activeIndexData {
            respond(task, key: key, status: 200, headers: [
                "Content-Type": "text/html; charset=utf-8",
                "Content-Length": String(data.count),
                "Cache-Control": "no-cache",
            ], body: data)
            return
        }

        // ⚠️ THE CAMERA ROLL IS SERVED THROUGH THIS SCHEME, on a path prefix, rather than through a
        // second handler on a second origin. localStorage is keyed to interun://app, so a photograph
        // arriving from anywhere else would sit outside everything the app owns — and two handlers is
        // two places the live-task bookkeeping below has to be right. Checked BEFORE resolve(), which
        // would otherwise look for a file of that name in the bundle and 404.
        if let url = task.request.url, url.path.hasPrefix(PhotoBridge.pathPrefix) {
            PhotoBridge.serve(path: url.path) { data, mime in
                DispatchQueue.main.async {
                    guard let data = data else {
                        self.respond(task, key: key, status: 404, headers: [:], body: Data())
                        return
                    }
                    self.respond(task, key: key, status: 200, headers: [
                        "Content-Type": mime,
                        "Content-Length": String(data.count),
                        // ⚠️ NO-STORE. A photograph is served by identifier, and an identifier outlives
                        // an edit: crop a picture in Photos and the same identifier now names different
                        // pixels. A cached copy would show the runner the version before they changed it.
                        "Cache-Control": "no-store",
                    ], body: data)
                }
            }
            return
        }

        guard let url = task.request.url, let file = resolve(url) else {
            respond(task, key: key, status: 404, headers: [:], body: Data())
            return
        }
        let rangeHeader = task.request.value(forHTTPHeaderField: "Range")

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let outcome = Self.read(file: file, rangeHeader: rangeHeader)
            DispatchQueue.main.async {
                guard let self, self.live.contains(key) else { return }
                switch outcome {
                case let .success(status, headers, body):
                    self.respond(task, key: key, status: status, headers: headers, body: body)
                case .failure:
                    self.respond(task, key: key, status: 404, headers: [:], body: Data())
                }
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        live.remove(ObjectIdentifier(task))
    }

    /// The root document — the only request the over-the-air copy answers. `voices/`, icons and the
    /// peripheral pages are always bundle-served.
    private static func isIndexRequest(_ url: URL) -> Bool {
        let p = url.path
        return p.isEmpty || p == "/" || p == "/index.html"
    }

    // MARK: - Path resolution

    /// Map a request path to a file inside the bundled web root, refusing anything that escapes it.
    private func resolve(_ url: URL) -> URL? {
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        guard let decoded = path.removingPercentEncoding else { return nil }

        let candidate = root.appendingPathComponent(String(decoded.dropFirst())).standardizedFileURL
        // Directory traversal guard: the resolved file must still sit under the web root.
        guard candidate.path == root.path || candidate.path.hasPrefix(root.path + "/") else { return nil }

        var isDir: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDir) else { return nil }
        if isDir.boolValue {
            let index = candidate.appendingPathComponent("index.html")
            return FileManager.default.fileExists(atPath: index.path) ? index : nil
        }
        return candidate
    }

    // MARK: - Reading

    private enum Outcome {
        case success(status: Int, headers: [String: String], body: Data)
        case failure
    }

    /// Read a file, honouring a byte range when one is asked for. Range support is not optional
    /// here: `<audio>` will not play a clip the handler cannot serve a 206 for.
    private static func read(file: URL, rangeHeader: String?) -> Outcome {
        guard let handle = try? FileHandle(forReadingFrom: file) else { return .failure }
        defer { try? handle.close() }

        let attrs = try? FileManager.default.attributesOfItem(atPath: file.path)
        let total = (attrs?[.size] as? NSNumber)?.intValue ?? 0
        let type = mimeType(for: file)

        guard let range = rangeHeader, let (start, end) = parseRange(range, total: total) else {
            guard let body = try? handle.readToEnd() ?? Data() else { return .failure }
            return .success(status: 200, headers: [
                "Content-Type": type,
                "Content-Length": String(body.count),
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache",
            ], body: body)
        }

        do {
            try handle.seek(toOffset: UInt64(start))
            let body = try handle.read(upToCount: end - start + 1) ?? Data()
            return .success(status: 206, headers: [
                "Content-Type": type,
                "Content-Length": String(body.count),
                "Content-Range": "bytes \(start)-\(end)/\(total)",
                "Accept-Ranges": "bytes",
            ], body: body)
        } catch {
            return .failure
        }
    }

    /// Parse `bytes=start-end`, with either side optional (`bytes=500-`, `bytes=-500`).
    private static func parseRange(_ header: String, total: Int) -> (Int, Int)? {
        guard total > 0, header.hasPrefix("bytes=") else { return nil }
        let spec = header.dropFirst("bytes=".count)
        guard !spec.contains(","), let dash = spec.firstIndex(of: "-") else { return nil }

        let lhs = String(spec[spec.startIndex..<dash])
        let rhs = String(spec[spec.index(after: dash)...])
        var start: Int
        var end: Int

        if lhs.isEmpty {
            guard let suffix = Int(rhs), suffix > 0 else { return nil }
            start = max(0, total - suffix)
            end = total - 1
        } else {
            guard let s = Int(lhs) else { return nil }
            start = s
            end = rhs.isEmpty ? total - 1 : (Int(rhs) ?? total - 1)
        }
        end = min(end, total - 1)
        guard start >= 0, start <= end else { return nil }
        return (start, end)
    }

    private static func mimeType(for file: URL) -> String {
        // An explicit table for the types the app actually serves — `UTType` disagrees with the web
        // on a couple of these, and a wrong Content-Type fails silently in the page.
        switch file.pathExtension.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "webmanifest": return "application/manifest+json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "mp3": return "audio/mpeg"
        case "ics": return "text/calendar; charset=utf-8"
        default:
            return UTType(filenameExtension: file.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream"
        }
    }

    // MARK: - Replying

    private func respond(_ task: WKURLSchemeTask, key: ObjectIdentifier,
                         status: Int, headers: [String: String], body: Data) {
        guard live.contains(key), let url = task.request.url else { return }
        let response = HTTPURLResponse(url: url, statusCode: status,
                                       httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        if !body.isEmpty { task.didReceive(body) }
        task.didFinish()
        live.remove(key)
    }
}
