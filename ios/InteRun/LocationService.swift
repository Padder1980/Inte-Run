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
    /// How old a fix may be and still be believed. iOS delivers a cached position on start, and a
    /// backlog replayed after a suspension is legitimately a few seconds old by the time it arrives —
    /// so this has to tolerate real lag while rejecting the minutes-old one that starts a run in the
    /// wrong place. Counted, not silently discarded: see `dropped`.
    private let staleFixSeconds: TimeInterval = 30
    /// Fixes refused as invalid or stale, surfaced to the page for Support › Your data. A silent drop
    /// and a GPS that never delivers look identical from the outside, which is how the last distance
    /// fault went unexplained for a week.
    private(set) var dropped = 0

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
        // ⚠️ The refusal count travels with the batch. A fix dropped here is invisible to the page's
        // own gpsDiag counters, and "the GPS is refusing everything" and "the GPS is delivering
        // nothing" look identical from the outside — which is exactly how the last distance fault
        // went a week without an explanation. Support › Your data reads this.
        webView.evaluateJavaScript(
            "window.__interunGeo && (window.__interunGeo.dropped = \(dropped), window.__interunGeo.deliver(\(json)));")
    }

    private func report(code: Int, message: String) {
        let escaped = message.replacingOccurrences(of: "\"", with: "\\\"")
        webView?.evaluateJavaScript("window.__interunGeo && window.__interunGeo.fail(\(code), \"\(escaped)\");")
    }
}

extension LocationService: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for loc in locations {
            // ⚠️ A NEGATIVE horizontalAccuracy MEANS THE COORDINATES ARE INVALID — CoreLocation is
            // telling us it could not work out where the phone is, and lat/lon are meaningless. These
            // used to be forwarded with accuracy: null (the Web API's "unknown"), and onGpsPos treats
            // unknown accuracy as GOOD and gives it the TIGHTEST leash — so the one kind of fix the
            // system explicitly disowns was the kind trusted most, and it could both credit distance
            // and move the anchor to a garbage position. Dropped at source: there is no position here
            // to pass on, in any unit, to any caller.
            if loc.horizontalAccuracy < 0 { dropped += 1; continue }
            // ⚠️ AND A FIX CAN BE OLD. iOS hands back a REMEMBERED position the moment tracking starts
            // — sometimes minutes stale and a long way away — which is what anchors a run to where you
            // were earlier and credits the jump back as your first distance. Nothing downstream reads
            // the timestamp, so the age check has to live here.
            if loc.timestamp.timeIntervalSinceNow < -staleFixSeconds { dropped += 1; continue }
            buffer.append([
                "lat": loc.coordinate.latitude,
                "lon": loc.coordinate.longitude,
                "acc": loc.horizontalAccuracy,
                "alt": loc.verticalAccuracy >= 0 ? loc.altitude : NSNull(),
                "altAcc": loc.verticalAccuracy >= 0 ? loc.verticalAccuracy : NSNull(),
                "speed": loc.speed >= 0 ? loc.speed : NSNull(),
                "heading": loc.course >= 0 ? loc.course : NSNull(),
                "t": loc.timestamp.timeIntervalSince1970 * 1000,
            ])
        }
        // ⚠️ THE CARD IS TOLD ABOUT THE NEWEST FIX WHETHER OR NOT THE PAGE CAN HEAR ABOUT IT, and that
        // asymmetry IS the fix: the buffer above exists precisely because the page cannot be reached
        // right now, which is exactly when the lock screen goes stale. CardDistance adds no distance of
        // its own — it measures a straight line from the last position the PAGE published — and does
        // nothing at all until the page has published one.
        // ⚠️ THE NEWEST, NOT EACH. Replaying a backlog through here would push the card once per fix
        // for no gain; only where the runner is NOW can move it.
        if let newest = locations.last, newest.horizontalAccuracy >= 0 {
            Task { @MainActor in CardDistance.shared.saw(newest) }
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
