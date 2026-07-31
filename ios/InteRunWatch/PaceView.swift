import SwiftUI

/// The pace page: maps the live workout onto `PacePage`, which owns the whole layout and takes
/// plain values — see that file for the design and for why it is pure (short version: so
/// `WatchPreview` can render every state of the hardest screen without a workout running).
struct PaceView: View {
    @ObservedObject var workout: WorkoutManager

    var body: some View {
        let remaining = workout.stepRemaining
        let dist = workout.value(for: .distance)
        PacePage(
            // When a step is counting down, elapsed rides on top small; on a free run there is no
            // step, so elapsed IS the hero and would be silly twice.
            elapsed: remaining != nil ? workout.elapsedText : nil,
            hero: remaining.map { ($0.value, $0.unit) } ?? (workout.elapsedText, "ELAPSED"),
            band: workout.targetBand,
            verdict: workout.paceVerdict,
            currentSec: workout.paceSecPerKm,
            currentText: workout.paceText,
            lap: (workout.lapPaceText, "LAP PACE"),
            stepProgress: workout.stepProgress,
            totalDist: dist.value + " " + (dist.unit ?? "")
        )
    }
}
