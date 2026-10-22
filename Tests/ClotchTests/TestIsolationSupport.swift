import XCTest
@testable import Clotch
import ClotchCore

// Seams that keep tests off the machine they run on. In a test process the
// terminal-visibility probe answers "can't tell" and AppleScript goes nowhere
// (see RuntimeEnvironment); a test that needs another answer installs it here
// for its own duration.

extension XCTestCase {
    /// Uses `probe` for Smart Suppress, follow-ups and jump validation until
    /// this test ends, then puts the previous probe back.
    func installVisibilityProbe(_ probe: TerminalVisibilityDetector.Probe) {
        let saved = TerminalVisibilityDetector.probe
        TerminalVisibilityDetector.probe = probe
        addTeardownBlock { TerminalVisibilityDetector.probe = saved }
    }

    /// Sends the activator's and the detector's AppleScript to `runner` until
    /// this test ends, then puts the previous runner back.
    func installAppleScriptRunner(_ runner: AppleScriptRunner) {
        let saved = AppleScriptRunner.current
        AppleScriptRunner.current = runner
        addTeardownBlock { AppleScriptRunner.current = saved }
    }

    /// Turns on the notch opening by itself for questions and permissions until this test ends: since #207 it is off by
    /// default, and the card-flow tests check what happens once a card is up (#219).
    func optIntoAutoExpand() {
        for key in [SettingsKey.autoExpandOnQuestion, SettingsKey.autoExpandOnPermission] {
            let saved = UserDefaults.standard.object(forKey: key) as? Bool
            UserDefaults.standard.set(true, forKey: key)
            addTeardownBlock {
                if let saved { UserDefaults.standard.set(saved, forKey: key) } else { UserDefaults.standard.removeObject(forKey: key) }
            }
        }
    }
}

extension TerminalVisibilityDetector.Probe {
    /// The terminal of every session matching `isInFront` is the frontmost app
    /// with that session's tab showing; no other session's terminal is.
    static func terminalInFront(
        where isInFront: @escaping @Sendable (SessionSnapshot) -> Bool
    ) -> Self {
        Self(isTerminalFrontmost: isInFront, isSessionTabVisible: isInFront)
    }
}
