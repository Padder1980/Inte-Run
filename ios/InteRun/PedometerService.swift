import Foundation
import CoreMotion
import WebKit

/// THE STEP COUNTER — the thing every serious iOS running app uses and this one did not.
///
/// Every iPhone since the 5S carries a motion coprocessor that counts steps and estimates distance
/// from stride length, and iOS quietly calibrates that stride against GPS whenever the signal is good.
/// It costs almost no battery, it keeps working in tunnels, under trees, between tall buildings and on
/// a treadmill, and it is most of why Strava, Nike Run Club and Apple's own Fitness app agree with each
/// other about how far somebody ran.
///
/// ⚠️ IT IS A GAP FILLER HERE, NOT A SECOND OPINION. GPS remains the source of truth outdoors: it
/// measures the ground the runner actually covered, while the pedometer measures strides and infers
/// distance from them. Blending the two continuously means two numbers arguing all run and a distance
/// that jumps whenever the weighting shifts. This streams the pedometer to the page and the page
/// credits it ONLY across stretches where GPS has gone quiet — which is exactly where the accuracy is
/// lost today, and nowhere else.
///
/// ⚠️ THE PAGE OWNS THE FUSION, DELIBERATELY. Distance is accumulated in `onGpsPos`, with its
/// diagnostics and its tests; a second accumulator in Swift would be a second definition of how far
/// somebody ran, and this project has paid for duplicate definitions repeatedly. Swift reports, the
/// page decides.
///
/// ⚠️ Requires `NSMotionUsageDescription`. Without it the app is terminated on first access, not
/// merely refused — so the Info.plist entry is load-bearing, not paperwork.
final class PedometerService: NSObject {
    static let messageName = "interunPedometer"

    private let pedometer = CMPedometer()
    private weak var webView: WKWebView?
    private var running = false
    /// The moment counting began. CMPedometer reports cumulatively from this date, so it is the
    /// origin for every figure the page sees.
    private var since: Date?

    init(webView: WKWebView?) {
        self.webView = webView
        super.init()
    }

    // MARK: - Control

    func start() {
        guard !running, CMPedometer.isStepCountingAvailable() else {
            // Not every device has the hardware (and the Simulator has none). Say so once rather than
            // leaving the page waiting for updates that can never arrive.
            post(["available": false])
            return
        }
        running = true
        let from = Date()
        since = from
        pedometer.startUpdates(from: from) { [weak self] data, error in
            guard let self, let data, error == nil else { return }
            // ⚠️ distance is OPTIONAL and nil on hardware that cannot estimate it. Steps are always
            // available when step counting is; distance is not, and treating a missing distance as
            // zero would tell the page the runner had stopped moving.
            var payload: [String: Any] = [
                "available": true,
                "steps": data.numberOfSteps.intValue,
                "t": Date().timeIntervalSince1970 * 1000,
            ]
            if let m = data.distance?.doubleValue, m >= 0 { payload["metres"] = m }
            // Steps per MINUTE, which is how runners talk about cadence. CoreMotion reports per second.
            if let c = data.currentCadence?.doubleValue, c > 0 { payload["cadence"] = c * 60 }
            self.post(payload)
        }
    }

    func stop() {
        guard running else { return }
        running = false
        since = nil
        pedometer.stopUpdates()
    }

    // MARK: - Delivery

    private func post(_ payload: [String: Any]) {
        guard let webView,
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.__interunPedometer && window.__interunPedometer(\(json));")
        }
    }
}

extension PedometerService: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "start": start()
        case "stop": stop()
        default: break
        }
    }
}
