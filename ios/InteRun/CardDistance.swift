import CoreLocation
import Foundation

/// KEEPING THE LOCK-SCREEN CARD'S DISTANCE MOVING WHILE THE PAGE IS ASLEEP.
///
/// Asked for by the owner (2026-08-22) after a phone-recorded run: *"The distance needs to keep going
/// on the lock screen if the user has decided to use the phone to run… i don't know why the distance
/// cant keep tracking, in fact when i was looking at the card on the lock screen, it does change but
/// just not accurately."* That observation is the whole diagnosis: the card DOES update, because iOS
/// throttles the web content process rather than stopping it dead, so `pushLiveActivity` runs
/// whenever the page happens to wake. Between those wakes every number stands still, and the figure
/// on the card is however far behind the runner the backlog happens to be.
///
/// ⚠️⚠️ **THE PAGE REMAINS THE SOLE AUTHOR OF THE RUN, AND THAT IS WHAT MAKES THIS SAFE.** This is not
/// a second distance accumulator. It never adds up anything, it never feeds back, and nothing it
/// computes is ever stored, logged, sent to Strava or written to Health. It answers one question for
/// one pixel: *given the last figure the page published and where the runner was standing when it was
/// true, how far have they got since?*
///
/// ⚠️ **A CHORD FROM A KNOWN POINT, NEVER A SUM OF DELTAS, AND THE DIFFERENCE IS THE WHOLE DESIGN.**
/// Summing per-fix deltas is what `onGpsPos`'s anchor-and-leash exists to prevent: noise is positive
/// on every reading and haversine is always positive, so a sum runs long — measured on the page's own
/// harness, 124 m of walking came out as 215 m. Worse, that error ACCUMULATES for as long as the page
/// is asleep, so the longer the lock the wronger the card, in the direction that flatters the runner.
/// A single straight line from the page's own anchor to the newest fix cannot accumulate anything: the
/// moment the page speaks again, both the total and the anchor are replaced. Its only error is that a
/// chord across a bend is shorter than the path, so it UNDER-reads slightly — the safe direction, and
/// the card never claims more ground than was covered.
///
/// ⚠️ **IT IS THE SAME QUANTITY THE PAGE ITSELF DISPLAYS.** The page shows `LIVE.dist + LIVE.pendM`,
/// where `pendM` is the uncommitted leg measured from that same anchor. So while the page is awake the
/// two agree to the metre; while it is asleep this one keeps going and the page's stands still. That
/// is why the base figure pushed here is the COMMITTED total and not the displayed one — adding a
/// chord to a total that already contains part of it would count the same metres twice.
@MainActor
final class CardDistance {
    static let shared = CardDistance()

    /// The page's own gate for a usable fix. Same number, same meaning: `onGpsPos` calls a fix `good`
    /// at 35 m or better and ignores it otherwise.
    private let maxAccuracy: CLLocationDistance = 35
    /// Faster than any pace this app prescribes (the engine refuses a derived pace under 150 s/km,
    /// i.e. 6.67 m/s). A chord implying more than this is a bad fix rather than a runner, so it is
    /// CLAMPED rather than dropped — the card keeps moving at a believable rate instead of freezing.
    private let maxSpeed: CLLocationDistance = 7
    /// Ten metres is about the width of the leash the page itself credits in, so anything smaller is
    /// not yet a different reading. It also does the work an application-state check would do and
    /// cannot get wrong: in the foreground the page resets the base every couple of seconds, so the
    /// gap never reaches ten metres and nothing is pushed at all.
    private let minChange: CLLocationDistance = 10

    private var baseMeters: CLLocationDistance = 0
    private var anchor: CLLocation?
    private var anchorAt: Date?
    private var lastShown: CLLocationDistance = 0
    private var live = false
    private var paused = false
    /// The rest of the card, held so a location can redraw it without inventing any of it.
    private var state: RunActivityAttributes.ContentState?

    private init() {}

    /// The whole arithmetic, as a pure function, so it can be RUN rather than only read.
    ///
    /// ⚠️ SEPARATED OUT DELIBERATELY. The claims that matter here are behavioural — a chord under-reads
    /// a bend rather than over-reading it, a jittering phone at a standstill gains nothing, a wild fix
    /// is clamped instead of jumping the card — and a structural test of a Swift file can only ever
    /// prove the code says what it says. `test/card-distance.test.ts` compiles and drives this.
    ///
    /// @param baseMeters  the page's own COMMITTED total.
    /// @param anchor      the position that total was true at (`LIVE.anchorLat`/`anchorLon`).
    /// @param fix         the newest usable fix.
    /// @param age         seconds since the page published that pair.
    /// @returns the metres to show, or nil when the fix cannot be used at all.
    static func project(baseMeters: CLLocationDistance, anchor: CLLocation, fix: CLLocation,
                        age: TimeInterval,
                        maxAccuracy: CLLocationDistance = 35,
                        maxSpeed: CLLocationDistance = 7) -> CLLocationDistance? {
        guard fix.horizontalAccuracy >= 0, fix.horizontalAccuracy <= maxAccuracy else { return nil }
        let chord = min(fix.distance(from: anchor), maxSpeed * max(1, age))
        return baseMeters + chord
    }

    /// The page has spoken: adopt its figure and its anchor, and forget whatever was extrapolated.
    ///
    /// ⚠️ `anchorLat`/`anchorLon` are `LIVE.anchorLat`/`LIVE.anchorLon` — the position the committed
    /// total was true at. Without them there is nothing to measure from and this does nothing at all,
    /// which is the correct behaviour for an older page: the card simply behaves as it always has.
    func adopt(state: RunActivityAttributes.ContentState, committedKm: Double?,
               anchorLat: Double?, anchorLon: Double?, ended: Bool) {
        self.state = state
        self.paused = state.paused
        if ended {
            live = false
            anchor = nil
            return
        }
        lastShown = state.distanceKm * 1000
        guard let km = committedKm, let lat = anchorLat, let lon = anchorLon,
              CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: lat, longitude: lon)) else {
            live = false
            anchor = nil
            return
        }
        live = true
        baseMeters = km * 1000
        anchor = CLLocation(latitude: lat, longitude: lon)
        anchorAt = Date()
    }

    /// Stop extrapolating. Called when the run ends and when the recorder is not the phone.
    func stop() {
        live = false
        anchor = nil
        state = nil
    }

    /// A fix arrived. If the page has gone quiet, move the card on.
    ///
    /// ⚠️ NOTHING IS PUSHED WHILE PAUSED. A paused run is not covering ground, and a card whose
    /// distance crept up while the runner stood still would be worse than one that stood still with
    /// them.
    func saw(_ loc: CLLocation) {
        guard live, !paused, let a = anchor, let at = anchorAt, var s = state else { return }
        guard let shown = Self.project(baseMeters: baseMeters, anchor: a, fix: loc,
                                       age: Date().timeIntervalSince(at),
                                       maxAccuracy: maxAccuracy, maxSpeed: maxSpeed) else { return }
        guard shown - lastShown >= minChange else { return }
        lastShown = shown
        s.distanceKm = shown / 1000
        // ⚠️ THE PACE IS NEITHER RECOMPUTED NOR DROPPED, AND BOTH ALTERNATIVES ARE WORSE.
        // Recomputing it means dividing this chord by a wall clock, which is the "arithmetic on a
        // lump" the page's own pace window exists to refuse: it derives pace across credited fixes
        // each stamped with its OWN clock precisely so a replayed backlog cannot read as a sprint.
        // Dropping it to "--:--" would take away a figure the runner already had before this change,
        // which is a regression wearing honesty's clothes. So the page's last judgement stands until
        // the page makes a new one — no staler than it was, beside a distance that is now fresh.
        // ⚠️ NOTHING ON THE CARD CONTRADICTS ANYTHING ELSE AS A RESULT: it shows CURRENT pace, not
        // average, so there is no distance-over-time relationship for a fresher distance to break.
        state = s
        LiveActivityService.shared.update(s)
    }
}
