import CoreLocation
import Foundation
import HealthKit
import UIKit
import WebKit

/// SAVING A PHONE-RECORDED RUN TO APPLE HEALTH.
///
/// The owner, 2026-08-21: "i would like the app to sync with apple health naturally like all running
/// apps do." Naturally means the run appears in Fitness and Health the way one recorded by any other
/// running app does — a real workout with its distance, its duration, its route and its heart rate —
/// rather than a row in this app that Health knows nothing about.
///
/// ⚠️⚠️ ONLY PHONE-RECORDED RUNS ARE WRITTEN, AND THIS IS THE MOST IMPORTANT RULE IN THE FILE. A run
/// recorded on the WATCH is already in Health: WorkoutManager runs a real HKWorkoutSession, and watchOS
/// saves that workout itself. Writing it again from the phone would give the runner two workouts for one
/// run — double distance in their week, double calories in their rings — and the duplicate would look
/// exactly as legitimate as the original. The page gates on the run's own source; this service refuses
/// anything it has already written.
///
/// ⚠️ AUTHORISATION IS ASKED FOR AT THE MOMENT IT IS NEEDED, never at launch. A Health prompt on first
/// open, before the runner has recorded anything, is a prompt with no context — and a refusal is
/// permanent from the app's point of view. The first save with the switch on is the moment it makes
/// sense to ask.
///
/// ⚠️ AND NOTHING IS EVER FABRICATED TO FILL A FIELD. No route means no route is written; no heart rate
/// means no samples; a treadmill run's distance is what the runner typed and nothing more. This app's
/// own Strava rule — never invent the missing half — applies here for the same reason: this data goes
/// into somebody's medical app, under their name.
@MainActor
final class HealthKitService: NSObject, WKScriptMessageHandler {
    static let messageName = "interunHealth"
    static let shared = HealthKitService()

    private let store = HKHealthStore()
    /// ⚠️ THE RUNS ALREADY WRITTEN, BY OUR OWN ID. HealthKit has no upsert and no "does this exist"
    /// query cheap enough to run on every save, so a second Save on the same run — which the finish
    /// screen allows, and which a re-render can produce — would write a second workout. Kept here and
    /// stamped into the workout's metadata as well, so a human looking at Health can see the pairing.
    private static let writtenKey = "InteRunHealthWritten"

    static func capabilityJS() -> String {
        HKHealthStore.isHealthDataAvailable() ? "window.__interunHealth = 1;" : ""
    }

    private var written: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: Self.writtenKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue.prefix(500)), forKey: Self.writtenKey) }
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let b = message.body as? [String: Any] else { report(false, "bad payload"); return }
        switch b["action"] as? String ?? "save" {
        case "save": save(b)
        default: report(false, "unknown action")
        }
    }

    // MARK: - Saving

    private func save(_ b: [String: Any]) {
        guard HKHealthStore.isHealthDataAvailable() else { report(false, "no health data on this device"); return }
        guard let id = b["id"] as? String, !id.isEmpty else { report(false, "no run id"); return }
        if written.contains(id) { report(true, "already in Health"); return }

        let startMs = (b["startMs"] as? Double) ?? 0
        let sec = (b["sec"] as? Double) ?? 0
        guard startMs > 0, sec > 0 else { report(false, "no start or duration"); return }
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = start.addingTimeInterval(sec)

        let types: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKSeriesType.workoutRoute(),
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
        ]
        // ⚠️ REQUESTED EVERY TIME, NOT CACHED. authorizationStatus answers only for types the app WRITES,
        // and a runner can change their mind in Settings at any point — so the honest thing is to ask and
        // let HealthKit answer instantly when it has already been granted.
        store.requestAuthorization(toShare: types, read: []) { [weak self] ok, err in
            Task { @MainActor in
                guard let self else { return }
                guard ok else {
                    self.report(false, "permission refused" + (err.map { ": " + $0.localizedDescription } ?? ""))
                    return
                }
                self.write(b, id: id, start: start, end: end)
            }
        }
    }

    private func write(_ b: [String: Any], id: String, start: Date, end: Date) {
        let cfg = HKWorkoutConfiguration()
        cfg.activityType = .running
        // ⚠️ INDOOR IS DECLARED, because Health treats a treadmill run differently and a run with no
        // route claiming to be outdoors is a claim the data does not support.
        let indoor = (b["indoor"] as? Bool) ?? false
        cfg.locationType = indoor ? .indoor : .outdoor

        let builder = HKWorkoutBuilder(healthStore: store, configuration: cfg, device: .local())
        var samples: [HKSample] = []

        // Distance. ⚠️ ABSENT RATHER THAN ZERO when there is none — a treadmill run whose distance the
        // runner never typed has no distance, and a zero would be a measurement.
        if let km = b["distKm"] as? Double, km > 0 {
            samples.append(HKQuantitySample(
                type: HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
                quantity: HKQuantity(unit: .meterUnit(with: .kilo), doubleValue: km),
                start: start, end: end))
        }
        if let kcal = b["kcal"] as? Double, kcal > 0 {
            samples.append(HKQuantitySample(
                type: HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
                quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kcal),
                start: start, end: end))
        }
        // Heart rate, as real samples at their own moments.
        // ⚠️ THE PAGE SENDS [seconds, bpm], NOT ITS OWN [metres, bpm]. In the app the series is paired
        // with DISTANCE on purpose — on a time axis every pause is a plateau — but Health stores samples
        // against a clock, so the page converts using the route's own times. Doing that here would be a
        // second copy of an arithmetic the page already had to get right for the Strava GPX.
        if let hr = b["hr"] as? [[Double]] {
            let t = HKQuantityType.quantityType(forIdentifier: .heartRate)!
            let unit = HKUnit.count().unitDivided(by: .minute())
            for p in hr where p.count >= 2 && p[1] > 0 {
                let at = start.addingTimeInterval(p[0])
                guard at >= start, at <= end else { continue }
                samples.append(HKQuantitySample(type: t, quantity: HKQuantity(unit: unit, doubleValue: p[1]),
                                                start: at, end: at))
            }
        }

        // ⚠️ OUR OWN ID TRAVELS WITH THE WORKOUT. It is how a human can pair what they see in Health with
        // the run in the Logbook, and it is what makes a duplicate identifiable rather than merely
        // suspected.
        let meta: [String: Any] = [
            HKMetadataKeyExternalUUID: id,
            HKMetadataKeyIndoorWorkout: (b["indoor"] as? Bool) ?? false,
        ]

        builder.beginCollection(withStart: start) { [weak self] ok, err in
            guard let self else { return }
            guard ok else { Task { @MainActor in self.report(false, "could not begin: " + (err?.localizedDescription ?? "")) }; return }
            let finish = {
                builder.addMetadata(meta) { _, _ in
                    builder.endCollection(withEnd: end) { _, err2 in
                        guard err2 == nil else {
                            Task { @MainActor in self.report(false, "could not end: " + (err2?.localizedDescription ?? "")) }
                            return
                        }
                        builder.finishWorkout { workout, err3 in
                            Task { @MainActor in
                                guard let workout, err3 == nil else {
                                    self.report(false, "could not save: " + (err3?.localizedDescription ?? "unknown"))
                                    return
                                }
                                var w = self.written; w.insert(id); self.written = w
                                self.addRoute(b, to: workout)
                                self.report(true, "saved to Health")
                            }
                        }
                    }
                }
            }
            if samples.isEmpty { finish() } else { builder.add(samples) { _, _ in finish() } }
        }
    }

    /// The route, attached after the workout exists — which is the order HealthKit requires.
    /// ⚠️ NO ROUTE MEANS NO ROUTE. A treadmill run, a refused GPS, or a runner who hid their route all
    /// arrive here with nothing, and the workout is saved without one rather than with a straight line.
    private func addRoute(_ b: [String: Any], to workout: HKWorkout) {
        guard let pts = b["route"] as? [[Double]], pts.count >= 2 else { return }
        let start = workout.startDate
        var locs: [CLLocation] = []
        for p in pts where p.count >= 3 {
            locs.append(CLLocation(
                coordinate: CLLocationCoordinate2D(latitude: p[0], longitude: p[1]),
                altitude: 0, horizontalAccuracy: 5, verticalAccuracy: -1,
                timestamp: start.addingTimeInterval(p[2])))
        }
        guard locs.count >= 2 else { return }
        let rb = HKWorkoutRouteBuilder(healthStore: store, device: .local())
        rb.insertRouteData(locs) { ok, _ in
            guard ok else { return }
            rb.finishRoute(with: workout, metadata: nil) { _, _ in }
        }
    }

    // MARK: - Reporting back

    /// ⚠️ THE PAGE IS TOLD WHAT HAPPENED, because a silent failure here is indistinguishable from a
    /// success and the runner would believe their run is in Health when it is not. Same ack as the coach
    /// and share bridges, for the same reason.
    private func report(_ ok: Bool, _ detail: String) {
        let js = "window.__interunHealthResult && window.__interunHealthResult(" + (ok ? "true" : "false") +
            ", \"" + detail.replacingOccurrences(of: "\"", with: "") + "\");"
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for w in scene.windows { Self.webViews(in: w).forEach { $0.evaluateJavaScript(js, completionHandler: nil) } }
        }
    }

    private static func webViews(in view: UIView) -> [WKWebView] {
        if let w = view as? WKWebView { return [w] }
        return view.subviews.flatMap { webViews(in: $0) }
    }
}
