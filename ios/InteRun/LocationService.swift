import CoreLocation
import UIKit
import WebKit

/// Keeps GPS running with the phone locked or in a pocket.
///
/// A PWA cannot do this: WKWebView's own `navigator.geolocation` stops the moment the app leaves the
/// foreground, so a run tracked with the phone pocketed loses everything after the lock. This is the
/// headline reason InteRun is native at all.
///
/// Rather than change the web UI, this replaces `navigator.geolocation` with a shim backed by
/// `CLLocationManager`. `web/app.ts` keeps calling the ordinary Web API and behaves identically in a
/// browser — the shim only installs itself when the native message handler exists.
///
/// Two things the native manager gives us beyond survival: `activityType = .fitness` (so iOS tunes
/// its filtering for a runner, not a driver) and `bestForNavigation` accuracy.
///
/// **Fixes are buffered and replayed in order.** iOS may suspend the web content process even while
/// the app itself keeps running on the location background mode. Distance is accumulated
/// incrementally from consecutive fixes, so replaying a backlog in order yields the same total as
/// receiving them live — the run survives either way.
final class LocationService: NSObject {
    static let messageName = "interunGeo"

    private let manager = CLLocationManager()
    private weak var webView: WKWebView?
    private var buffer: [[String: Any]] = []
    private var watching = false
    private var wantsOneShot = false

    init(webView: WKWebView?) {
        self.webView = webView
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.activityType = .fitness
        // iOS will otherwise decide a runner has stopped and quietly pause updates for good.
        manager.pausesLocationUpdatesAutomatically = false
        NotificationCenter.default.addObserver(
            self, selector: #selector(flush),
            name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    // MARK: - Control

    private func begin(continuous: Bool) {
        switch manager.authorizationStatus {
        case .notDetermined:
            if continuous { watching = true } else { wantsOneShot = true }
            manager.requestWhenInUseAuthorization()
            return
        case .denied, .restricted:
            report(code: 1, message: "Location access is off for Inte-Run. Turn it on in Settings to track your run.")
            return
        default: break
        }
        startUpdates(continuous: continuous)
    }

    private func startUpdates(continuous: Bool) {
        if continuous {
            watching = true
            // Only claim the background entitlement while a run is actually being tracked.
            manager.allowsBackgroundLocationUpdates = true
            manager.showsBackgroundLocationIndicator = true
            manager.startUpdatingLocation()
        } else {
            wantsOneShot = true
            manager.requestLocation()
        }
    }

    func stopWatching() {
        watching = false
        manager.allowsBackgroundLocationUpdates = false
        manager.stopUpdatingLocation()
        flush()
    }

    // MARK: - Delivery

    @objc private func flush() {
        guard !buffer.isEmpty, let webView else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: buffer),
              let json = String(data: data, encoding: .utf8) else { buffer.removeAll(); return }
        buffer.removeAll()
        webView.evaluateJavaScript("window.__interunGeo && window.__interunGeo.deliver(\(json));")
    }

    private func report(code: Int, message: String) {
        let escaped = message.replacingOccurrences(of: "\"", with: "\\\"")
        webView?.evaluateJavaScript("window.__interunGeo && window.__interunGeo.fail(\(code), \"\(escaped)\");")
    }
}

extension LocationService: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for loc in locations {
            buffer.append([
                "lat": loc.coordinate.latitude,
                "lon": loc.coordinate.longitude,
                // A negative CoreLocation accuracy means "invalid"; the Web API says null.
                "acc": loc.horizontalAccuracy >= 0 ? loc.horizontalAccuracy : NSNull(),
                "alt": loc.verticalAccuracy >= 0 ? loc.altitude : NSNull(),
                "altAcc": loc.verticalAccuracy >= 0 ? loc.verticalAccuracy : NSNull(),
                "speed": loc.speed >= 0 ? loc.speed : NSNull(),
                "heading": loc.course >= 0 ? loc.course : NSNull(),
                "t": loc.timestamp.timeIntervalSince1970 * 1000,
            ])
        }
        // Deliver live when the web view can receive it; otherwise let the backlog build and replay.
        if UIApplication.shared.applicationState == .active { flush() }
        if wantsOneShot { wantsOneShot = false }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // A transient "unknown location" early in a fix is normal — do not surface it as a failure.
        if let clErr = error as? CLError, clErr.code == .locationUnknown { return }
        report(code: 2, message: error.localizedDescription)
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            if watching { startUpdates(continuous: true) }
            else if wantsOneShot { startUpdates(continuous: false) }
        case .denied, .restricted:
            watching = false
            wantsOneShot = false
            report(code: 1, message: "Location access is off for Inte-Run. Turn it on in Settings to track your run.")
        default: break
        }
    }
}

extension LocationService: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "once": begin(continuous: false)
        case "watch": begin(continuous: true)
        case "stopWatch": stopWatching()
        default: break
        }
    }
}
