import XCTest

/// Keyboard-layout tests, driven against the REAL software keyboard in the simulator.
///
/// This target exists because the keyboard-pan bug class cannot be reproduced any other way:
/// iOS pans the WKWebView's content the instant a REAL tap focuses a field the keyboard would
/// cover, and neither a desktop browser nor a programmatic focus() raises the software keyboard.
/// Before this target, every keyboard fix shipped blind and was proven (or disproven) on the
/// owner's phone — twice, expensively.
///
/// ⚠️ The software keyboard must be CONNECTED in the simulator, or every one of these tests skips:
///   defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false
/// (and restart Simulator.app if it was open). A hardware keyboard means no on-screen keyboard,
/// which means no pan, which means a test that passes while the bug lives.
final class KeyboardUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// Attach a named screenshot to the result bundle (extract with xcresulttool).
    private func shoot(_ app: XCUIApplication, _ name: String) {
        let att = XCTAttachment(screenshot: app.screenshot())
        att.name = name
        att.lifetime = .keepAlways
        add(att)
    }

    /// Tap by normalized coordinates — works whether or not the web content exposes accessibility.
    private func tapNorm(_ app: XCUIApplication, _ x: Double, _ y: Double) {
        app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)).tap()
    }

    /// Dismiss the first-run welcome if it is showing. The button is web content, so try the
    /// accessibility label first and fall back to its known position.
    private func dismissWelcome(_ app: XCUIApplication) {
        // First-run says "Get started"; a returning user's welcome says "Let's go".
        let go = app.webViews.buttons.matching(
            NSPredicate(format: "label CONTAINS 'started' OR label BEGINSWITH 'Let'")).firstMatch
        if go.waitForExistence(timeout: 8) {
            go.tap()
        } else {
            // Welcome CTA sits centered, just below two-thirds height.
            tapNorm(app, 0.5, 0.64)
        }
        // The welcome fades; give the next screen a beat to render.
        Thread.sleep(forTimeInterval: 2.0)
    }

    /// Free-form driver: TEST_RUNNER_TAPS="x,y,waitMs;x,y,waitMs;..." (normalized coordinates).
    /// Lets a session iterate on choreography without recompiling — each step screenshots after
    /// its wait, and the attachments carry the numbers.
    func testDriver() throws {
        guard let script = ProcessInfo.processInfo.environment["TAPS"], !script.isEmpty else {
            throw XCTSkip("no TAPS script provided")
        }
        let app = XCUIApplication()
        app.launch()
        Thread.sleep(forTimeInterval: 3.0)
        shoot(app, "step0-launch")
        for (i, step) in script.split(separator: ";").enumerated() {
            let parts = step.split(separator: ",").compactMap { Double($0) }
            guard parts.count >= 2 else { continue }
            tapNorm(app, parts[0], parts[1])
            let waitMs = parts.count > 2 ? parts[2] : 800
            Thread.sleep(forTimeInterval: waitMs / 1000.0)
            shoot(app, "step\(i + 1)-tap-\(parts[0])-\(parts[1])")
        }
        // Leave the final state on screen long enough for an outside simctl screenshot too.
        Thread.sleep(forTimeInterval: 3.0)
        shoot(app, "final")
    }

    /// THE REGRESSION TEST, encoding the owner's sentence verbatim: "surely the keyboard just
    /// overlays the screen and it doesn't move it anywhere". Keyboard up: the top bar has not
    /// moved, the focused field sits above the keyboard, and the bottom nav has NOT ridden up the
    /// screen (it is simply covered). Keyboard down: everything is back exactly where it was.
    func testKeyboardKeepsLayout() throws {
        let app = XCUIApplication()
        app.launch()
        dismissWelcome(app)
        shoot(app, "before-focus")

        let title = app.webViews.staticTexts["Your profile"].firstMatch
        let nav = app.webViews.buttons["Today"].firstMatch
        guard title.waitForExistence(timeout: 8), nav.exists else {
            XCTFail("top bar or bottom nav not exposed before focusing")
            return
        }
        let titleBefore = title.frame
        let navBefore = nav.frame
        XCTAssertGreaterThan(navBefore.maxY, app.frame.height * 0.85,
                             "precondition: the nav starts at the bottom of the screen")

        // First text field on the setup screen ("What should we call you?").
        let field = app.webViews.textFields.firstMatch
        guard field.waitForExistence(timeout: 8) else {
            shoot(app, "no-field-found")
            XCTFail("no text field exposed on the setup screen")
            return
        }
        field.tap()

        // ⚠️ WATCH THE TRANSITION, NOT JUST THE DESTINATION. The bump the owner reported twice is
        // iOS shoving the whole view the instant the keyboard starts opening, then the app pulling
        // it back — the settled state passes every assertion while the journey is a visible jolt.
        // Sample the top bar through the whole keyboard animation: it must never move at all.
        var maxShift: CGFloat = 0
        for _ in 0..<12 {
            Thread.sleep(forTimeInterval: 0.1)
            if title.exists { maxShift = max(maxShift, abs(title.frame.minY - titleBefore.minY)) }
        }
        XCTAssertLessThan(maxShift, 4,
                          "the view bumped by \(Int(maxShift))pt while the keyboard opened")

        let keyboard = app.keyboards.firstMatch
        guard keyboard.waitForExistence(timeout: 5) else {
            throw XCTSkip("software keyboard did not appear — disconnect the hardware keyboard")
        }
        // iOS pans a beat AFTER the keyboard finishes animating; wait out both, measure the
        // settled state, then again to catch late reassertion.
        for pause in [1.5, 1.5] {
            Thread.sleep(forTimeInterval: pause)
            shoot(app, "keyboard-up")

            // 1. The top bar has not moved: the pan glitch shoved it off the top of the screen.
            XCTAssertLessThan(abs(title.frame.minY - titleBefore.minY), 3,
                              "the top bar moved when the keyboard opened")

            // 2. The field being typed into sits above the keyboard.
            XCTAssertLessThan(field.frame.maxY, keyboard.frame.minY + 1,
                              "the focused field is underneath the keyboard")
            XCTAssertGreaterThan(field.frame.minY, titleBefore.maxY - 1,
                                 "the focused field has been shoved under the top bar")

            // 3. The nav has NOT ridden up the screen. Under the overlay design it stays where it
            //    was (covered by the keyboard); accessibility may hide it entirely, which is fine.
            //    What must never happen again is the nav floating in the middle of the screen.
            if nav.exists && nav.isHittable {
                XCTAssertGreaterThan(nav.frame.maxY, app.frame.height * 0.85,
                                     "the bottom nav rode up the screen with the keyboard")
            }
        }

        // The way back: dismiss via the accessory bar's Done — tapping empty page does NOT blur a
        // WKWebView field (measured: focus stayed put and the keyboard stayed up).
        let done = app.buttons["Done"].firstMatch
        if done.exists { done.tap() } else { tapNorm(app, 0.92, 0.56) }
        Thread.sleep(forTimeInterval: 1.5)
        shoot(app, "keyboard-down")
        XCTAssertLessThan(abs(title.frame.minY - titleBefore.minY), 3,
                          "the top bar did not return after the keyboard closed")
        XCTAssertGreaterThan(nav.frame.maxY, app.frame.height * 0.85,
                             "the bottom nav did not return to the bottom after the keyboard closed")
        XCTAssertLessThan(abs(nav.frame.minY - navBefore.minY), 3,
                          "the bottom nav settled somewhere new after the keyboard closed")

        // ⚠️ ROUND TWO, ON A FIELD LOW ON THE SCREEN — the case where iOS has a real reason to
        // shove: the tapped field sits where the keyboard is about to land. The name field at the
        // top never triggers the shove, which is how a passing test coexisted with a bumping phone.
        app.swipeUp()
        Thread.sleep(forTimeInterval: 1.0)
        let fields = app.webViews.textFields
        var low: XCUIElement? = nil
        for i in 0..<min(fields.count, 8) {
            let f = fields.element(boundBy: i)
            if f.isHittable && f.frame.midY > app.frame.height * 0.55 { low = f }
        }
        guard let lowField = low else {
            shoot(app, "no-low-field")
            return // nothing low enough on this screen size — the top-field pass stands
        }
        let titleBefore2 = title.exists ? title.frame : titleBefore
        lowField.tap()
        var maxShift2: CGFloat = 0
        for _ in 0..<12 {
            Thread.sleep(forTimeInterval: 0.1)
            if title.exists { maxShift2 = max(maxShift2, abs(title.frame.minY - titleBefore2.minY)) }
        }
        shoot(app, "low-field-keyboard")
        XCTAssertLessThan(maxShift2, 4,
                          "the view bumped by \(Int(maxShift2))pt when a LOW field was focused")
        if keyboard.exists {
            XCTAssertLessThan(lowField.frame.maxY, keyboard.frame.minY + 1,
                              "the low field is underneath the keyboard")
        }
    }
}
