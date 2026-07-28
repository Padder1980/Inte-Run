import ActivityKit
import SwiftUI
import WidgetKit

/// The run, on the lock screen and in the Dynamic Island.
///
/// This is what a runner actually looks at mid-session with the phone in an armband, or glances at
/// on a locked screen — so it is the numbers and nothing else. Tapping it opens InteRun, which lands
/// straight on the live session screen (see `replayLiveOnActivate` on the app side).
struct RunLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunActivityAttributes.self) { context in
            lockScreen(context)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(Brand.accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    stat(context.state.elapsedText, "TIME")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    stat(context.state.distanceText + " km", "DISTANCE")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        stat(context.state.paceText, "PACE")
                        Spacer()
                        if let hr = context.state.heartRate {
                            stat("\(hr)", "BPM")
                        }
                        Spacer()
                        Text(context.state.onWatch ? "ON WATCH" : "ON PHONE")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Brand.accent)
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.paused ? "pause.fill" : "figure.run")
                    .foregroundStyle(Brand.accent)
            } compactTrailing: {
                Text(context.state.elapsedText)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Brand.accent)
            } minimal: {
                Image(systemName: "figure.run").foregroundStyle(Brand.accent)
            }
            .keylineTint(Brand.accent)
        }
    }

    // MARK: - Lock screen

    private func lockScreen(_ context: ActivityViewContext<RunActivityAttributes>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text("Inte").foregroundStyle(.white) + Text("Run").foregroundStyle(Brand.mark)
                Spacer(minLength: 0)
                if context.state.paused {
                    Text("PAUSED")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Brand.ease)
                } else {
                    HStack(spacing: 4) {
                        Circle().fill(Brand.accent).frame(width: 6, height: 6)
                        Text(context.state.onWatch ? "ON YOUR WATCH" : "RECORDING")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Brand.accent)
                    }
                }
            }
            .font(.system(size: 13, weight: .heavy, design: .rounded))

            Text(context.state.step ?? context.attributes.title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.75))
                .lineLimit(1)

            HStack(alignment: .firstTextBaseline, spacing: 0) {
                stat(context.state.elapsedText, "TIME", big: true)
                Spacer(minLength: 8)
                stat(context.state.distanceText, "KM", big: true)
                Spacer(minLength: 8)
                stat(context.state.paceText, "PACE", big: true)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
    }

    private func stat(_ value: String, _ label: String, big: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.system(size: big ? 26 : 15, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 8.5, weight: .bold))
                .foregroundStyle(.white.opacity(0.5))
        }
    }
}

/// The brand colours the widget needs. Kept local: the extension is a separate binary and cannot
/// reach the watch app's Brand, and pulling in an asset catalogue for three colours is not worth it.
enum Brand {
    static let accent = Color(red: 0.169, green: 0.702, blue: 0.639)   // #2BB3A3
    static let mark = Color(red: 0.086, green: 0.718, blue: 0.643)     // #16B7A4
    static let ease = Color(red: 0.922, green: 0.592, blue: 0.282)     // #EB9748
}

@main
struct InteRunWidgetBundle: WidgetBundle {
    var body: some Widget { RunLiveActivity() }
}
