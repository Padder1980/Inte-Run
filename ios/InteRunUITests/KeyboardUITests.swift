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

    /// THE REGRESSION TEST. Focus a field on the profile/setup screen with the software keyboard
    /// and assert the layout held together:
    ///  1. the bottom nav sits just above the keyboard — no dead band between them, and
    ///  2. the nav has not been shoved off the top half of the screen.
    /// The broken state this encodes: app shoved up under the status bar, nav floating mid-screen,
    /// a black void between nav and keyboard for as long as the keyboard stays up.
    func testKeyboardKeepsLayout() throws {
        let app = XCUIApplication()
        app.launch()
        dismissWelcome(app)
        shoot(app, "before-focus")

        // First text field on the setup screen ("What should we call you?").
        let field = app.webViews.textFields.firstMatch
        guard field.waitForExistence(timeout: 8) else {
            shoot(app, "no-field-found")
            XCTFail("no text field exposed on the setup screen")
            return
        }
        field.tap()

        let keyboard = app.keyboards.firstMatch
        guard keyboard.waitForExistence(timeout: 5) else {
            // No software keyboard — almost always ConnectHardwareKeyboard=true. A skip, not a
            // pass: this test proves nothing without the real keyboard.
            throw XCTSkip("software keyboard did not appear — disconnect the hardware keyboard")
        }
        // iOS pans a beat AFTER the keyboard finishes animating; wait out both, then measure the
        // settled state, and again a second later to catch late reassertion.
        Thread.sleep(forTimeInterval: 1.5)
        shoot(app, "keyboard-up")
        try assertLayoutHolds(app, keyboard: keyboard, at: "1.5s")
        Thread.sleep(forTimeInterval: 1.5)
        try assertLayoutHolds(app, keyboard: keyboard, at: "3.0s")

        // And the way back: dismissing the keyboard must restore the full-height layout.
        // ⚠️ Tapping empty page does NOT blur a WKWebView field — measured: focus stayed in s_name
        // and the keyboard stayed up, failing this check against a healthy app. The accessory bar's
        // own Done control is the reliable dismissal.
        let done = app.buttons["Done"].firstMatch
        if done.exists { done.tap() } else { tapNorm(app, 0.92, 0.56) }
        Thread.sleep(forTimeInterval: 1.5)
        shoot(app, "keyboard-down")
        let nav = app.webViews.buttons["Today"].firstMatch
        if nav.exists {
            let screenH = app.frame.height
            XCTAssertGreaterThan(nav.frame.maxY, screenH * 0.85,
                                 "after the keyboard closed, the bottom nav did not return to the bottom of the screen")
        }
    }

    private func assertLayoutHolds(_ app: XCUIApplication, keyboard: XCUIElement, at label: String) throws {
        let nav = app.webViews.buttons["Today"].firstMatch
        guard nav.exists else {
            // Nav not exposed to accessibility — cannot measure. Fail loudly rather than skip:
            // the whole point of this test is the measurement.
            shoot(app, "nav-not-exposed-\(label)")
            XCTFail("bottom nav not visible to accessibility at \(label)")
            return
        }
        let gap = keyboard.frame.minY - nav.frame.maxY
        // ⚠️ THE THRESHOLD ENCODES MEASURED CHROME, NOT A GUESS. keyboard.frame.minY is the QWERTY
        // block, which sits BELOW WebKit's input-accessory bar (~55pt) and the predictive row —
        // and nav.frame.maxY is the label's bottom, above the nav's own padding. Measured healthy
        // on the 26.5 simulator: ~110-150pt of purely legitimate chrome. Measured broken (the pan
        // glitch on the owner's phone): 300pt+ of dead page background. 200 separates them.
        XCTAssertLessThan(gap, 200,
                          "at \(label): \(Int(gap))pt between the bottom nav and the keyboard — the dead-band glitch")
        XCTAssertGreaterThan(gap, -keyboard.frame.height,
                             "at \(label): the nav is underneath the keyboard entirely")
        // And the OTHER half of the broken screenshot: the app shoved up under the status bar. The
        // top bar title must still sit in the top tenth of the screen.
        let title = app.webViews.staticTexts["Your profile"].firstMatch
        if title.exists {
            XCTAssertGreaterThan(title.frame.minY, -2, "at \(label): the top bar is shoved off the top")
            XCTAssertLessThan(title.frame.minY, app.frame.height * 0.12,
                              "at \(label): the top bar has drifted down the screen")
        }
    }
}
