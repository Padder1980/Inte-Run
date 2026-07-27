import SwiftUI
import WebKit

/// Hosts the InteRun web app full-bleed. The page already handles its own safe-area insets
/// (`env(safe-area-inset-*)`) and its own light/dark theming, so the native side deliberately does
/// as little as possible: no chrome, no insets, no colour scheme forcing.
struct WebHost: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // persistent: the app's whole database is localStorage
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [] // coach audio is our own content

        if let root = BundleSchemeHandler.webRoot {
            config.setURLSchemeHandler(BundleSchemeHandler(root: root),
                                       forURLScheme: BundleSchemeHandler.scheme)
        }

        // Native GPS, injected before any app code runs so the web UI never knows the difference.
        config.userContentController.addUserScript(GeolocationShim.userScript)

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        let location = LocationService(webView: webView)
        context.coordinator.location = location
        config.userContentController.add(location, name: LocationService.messageName)

        let watch = WatchBridge(webView: webView)
        context.coordinator.watch = watch
        config.userContentController.add(watch, name: WatchBridge.messageName)

        config.userContentController.add(HapticService(), name: HapticService.messageName)

        let notifications = NotificationService(webView: webView)
        context.coordinator.notifications = notifications
        config.userContentController.add(notifications, name: NotificationService.messageName)
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.showsVerticalScrollIndicator = false

        // Match the splash so there is no white flash between the launch screen and the page.
        let launch = UIColor(named: "LaunchBackground") ?? .black
        webView.isOpaque = false
        webView.backgroundColor = launch
        webView.scrollView.backgroundColor = launch

        guard BundleSchemeHandler.webRoot != nil else {
            webView.loadHTMLString(Self.missingBundleNotice, baseURL: nil)
            return webView
        }
        webView.load(URLRequest(url: BundleSchemeHandler.startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    /// Shown only if the "Embed web app" build phase did not run — a build problem, not a user one,
    /// so it says exactly what is wrong rather than failing to a blank screen.
    private static let missingBundleNotice = """
    <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="font:15px -apple-system;background:#06110f;color:#e6efec;padding:32px">
    <h2 style="color:#16b7a4">Web bundle missing</h2>
    <p>No <code>web/</code> folder in the app bundle. The &ldquo;Embed web app&rdquo; build phase
    copies <code>docs/</code> into the app &mdash; check it ran, and that <code>docs/index.html</code>
    exists (rebuild it with <code>node web/app.ts</code>).</p>
    </body></html>
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        /// Where the in-flight `<a download>` is being written. See `Downloads.swift`.
        var pendingDownload: URL?
        /// Owns the WCSession delegate for the lifetime of the web view.
        var watch: WatchBridge?
        /// Owns the notification centre delegate, which the centre only holds weakly.
        var notifications: NotificationService?
        /// Owns the CLLocationManager for the lifetime of the web view. See `LocationService.swift`.
        var location: LocationService?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if SelfCheck.isEnabled { SelfCheck.run(on: webView) }
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        /// Keep the app an app: anything genuinely off-site opens in Safari rather than turning
        /// this window into an unbranded browser with no way back.
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // A `download` attribute (the backup + the .ics export) becomes a real file, not a
            // navigation. Without this the tap silently does nothing.
            if navigationAction.shouldPerformDownload { return decisionHandler(.download) }

            guard let url = navigationAction.request.url else { return decisionHandler(.allow) }

            if url.scheme == BundleSchemeHandler.scheme || url.scheme == "about" {
                return decisionHandler(.allow)
            }
            if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil {
                if UIApplication.shared.canOpenURL(url) { UIApplication.shared.open(url) }
                return decisionHandler(.cancel)
            }
            // Data/blob URLs are used in-page (share cards, the .ics export) — let them through.
            decisionHandler(url.scheme == "data" || url.scheme == "blob" ? .allow : .cancel)
        }

        /// `target="_blank"` has nowhere to go in a single-window app; send it to Safari instead.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url, UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
