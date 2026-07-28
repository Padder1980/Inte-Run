import Foundation
import SwiftUI

/// What the runner wants on their wrist.
///
/// Every option here does something. A settings screen full of switches that quietly do nothing is
/// worse than no settings screen — the same rule the phone's Connections screen follows. So there is
/// no "start on motion" or "double-tap to end lap" until those are actually built.
@MainActor
final class WatchSettings: ObservableObject {
    static let shared = WatchSettings()

    /// A number that can appear on a run screen. Raw values are persisted — never renumber them.
    enum Metric: String, CaseIterable, Identifiable, Codable {
        case elapsed, distance, currentPace, lapPace, avgPace, heartRate, stepRemaining, lapNumber, calories

        var id: String { rawValue }
        var label: String {
            switch self {
            case .elapsed: return "Elapsed time"
            case .distance: return "Distance"
            case .currentPace: return "Current pace"
            case .lapPace: return "Lap pace"
            case .avgPace: return "Average pace"
            case .heartRate: return "Heart rate"
            case .stepRemaining: return "Step remaining"
            case .lapNumber: return "Lap number"
            case .calories: return "Calories"
            }
        }
        /// The small caption under the number on the run screen.
        var caption: String {
            switch self {
            case .elapsed: return "TIME"
            case .distance: return "DISTANCE"
            case .currentPace: return "CUR PACE"
            case .lapPace: return "LAP"
            case .avgPace: return "AVG PACE"
            case .heartRate: return "HEART"
            case .stepRemaining: return "TO GO"
            case .lapNumber: return "LAP"
            case .calories: return "CALORIES"
            }
        }
    }

    /// The metrics page, in order. Four or five is the honest maximum on a watch face at running
    /// cadence — the cap is enforced in the editor rather than left to the runner to discover.
    @Published var metrics: [Metric] { didSet { save() } }
    /// Pause automatically when the runner stops, and resume when they start again.
    @Published var autoPause: Bool { didSet { save() } }
    /// A tap on the wrist at each kilometre.
    @Published var hapticOnLap: Bool { didSet { save() } }
    /// Spoken cues during the run.
    @Published var voiceCues: Bool { didSet { save() } }
    /// Keep the screen on for the whole run rather than letting it dim between wrist raises.
    @Published var alwaysOn: Bool { didSet { save() } }
    /// Count three seconds down before the clock starts, so there is time to pocket the phone or
    /// get to the start line. Without it a run begun from the phone records you standing still.
    @Published var countdown: Bool { didSet { save() } }

    static let maxMetrics = 5
    static let defaultMetrics: [Metric] = [.elapsed, .distance, .currentPace, .lapPace, .avgPace]

    private static let key = "interun_watch_settings_v1"

    private struct Stored: Codable {
        var metrics: [Metric]
        var autoPause: Bool
        var hapticOnLap: Bool
        var voiceCues: Bool
        var alwaysOn: Bool
        var countdown: Bool?
    }

    private init() {
        let stored = (UserDefaults.standard.data(forKey: Self.key)).flatMap {
            try? JSONDecoder().decode(Stored.self, from: $0)
        }
        metrics = stored?.metrics ?? Self.defaultMetrics
        autoPause = stored?.autoPause ?? true
        hapticOnLap = stored?.hapticOnLap ?? true
        voiceCues = stored?.voiceCues ?? true
        alwaysOn = stored?.alwaysOn ?? true
        countdown = stored?.countdown ?? true
        if metrics.isEmpty { metrics = Self.defaultMetrics }
    }

    private func save() {
        let s = Stored(metrics: metrics, autoPause: autoPause, hapticOnLap: hapticOnLap,
                       voiceCues: voiceCues, alwaysOn: alwaysOn, countdown: countdown)
        if let data = try? JSONEncoder().encode(s) { UserDefaults.standard.set(data, forKey: Self.key) }
    }

    func toggle(_ m: Metric) {
        if let i = metrics.firstIndex(of: m) {
            // Never leave the run screen blank.
            if metrics.count > 1 { metrics.remove(at: i) }
        } else if metrics.count < Self.maxMetrics {
            metrics.append(m)
        }
    }

    func reset() { metrics = Self.defaultMetrics }
}
