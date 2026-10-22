import AppKit
import SwiftUI
import XCTest
@testable import Clotch
import ClotchCore

/// #314 (and #146 before it): every button the closed notch shows under its bar answers a real click. The whole notch is hosted
/// in a window far off every display, and a mouse down and up go to every point under the bar.
@MainActor
final class NotchPillClickTests: XCTestCase {
    private let suiteName = "NotchPillClickTests"

    override func setUp() async throws {
        _ = NSApplication.shared
        UserDefaults(suiteName: suiteName)?.removePersistentDomain(forName: suiteName)
        MascotAnimationGate.shared.setPanelVisible(false)
    }

    override func tearDown() async throws {
        UserDefaults(suiteName: suiteName)?.removePersistentDomain(forName: suiteName)
        MascotAnimationGate.shared.setPanelVisible(true)
    }

    func testEveryErrorButtonAnswersAClick() throws {
        let failures: [VoiceInput.Failure] = [.mic, .key, .credits, .network, .local, .off, .shortcut, .doNotDisturb, .nothingHeard, .service, .audio]
        for why in failures {
            let input = VoiceInputController.still(.failure(why), files: VoiceFiles(home: emptyHome()))
            var clicked: [VoiceInput.Action] = []
            input.act = { if !clicked.contains($0) { clicked.append($0) } }
            try clickAll(on: input) { clicked.count == why.actions.count }
            XCTAssertEqual(Set(clicked.map(\.label)), Set(why.actions.map(\.label)), "buttons under «\(why.title)» that did not answer a click")
        }
    }

    func testCancelButtonsAnswerAClick() throws {
        for phase in [VoiceInputController.Phase.ready, .sending] {
            let input = VoiceInputController.still(phase, files: VoiceFiles(home: emptyHome()), sure: "prova di dettatura")
            try clickAll(on: input) { input.phase == .idle }
            XCTAssertEqual(input.phase, .idle, "«annulla» under \(phase) did not answer a click")
        }
    }

    // MARK: - Rig

    private func emptyHome() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("clotch-click-\(UUID().uuidString)") }

    /// The closed notch with `input`'s pill under the bar; real left clicks (down and up) on every point under the bar, 4 pt apart,
    /// until `done`. Only the pill is there, so only its buttons can answer.
    private func clickAll(on input: VoiceInputController, until done: () -> Bool) throws {
        let suite = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        let view = NotchPanelView(appState: AppState(), hasNotch: true, notchHeight: 32, notchW: 200, screenWidth: 1512, voiceInput: input)
            .environment(\.mascotStaticTime, 5)
            .defaultAppStorage(suite)
        let size = NSSize(width: 620, height: 260)
        let host = NSHostingView(rootView: view)
        host.frame = NSRect(origin: .zero, size: size)
        let window = NSWindow(contentRect: host.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = host
        // AppKit hands clicks to SwiftUI only in a window on screen: this one is ordered in far off every display, never seen.
        window.setFrameOrigin(NSPoint(x: -20_000, y: -20_000))
        window.orderFrontRegardless()
        defer { window.orderOut(nil); window.contentView = nil }
        for _ in 0..<4 {
            host.layoutSubtreeIfNeeded()
            RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        }
        // Window coordinates grow upward: under the 32 pt bar is y < height - 32.
        for y in stride(from: size.height - 36, through: 4, by: -4) {
            for x in stride(from: CGFloat(4), to: size.width, by: 4) {
                for type in [NSEvent.EventType.leftMouseDown, .leftMouseUp] {
                    let event = try XCTUnwrap(NSEvent.mouseEvent(with: type, location: NSPoint(x: x, y: y), modifierFlags: [],
                                                                 timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
                                                                 context: nil, eventNumber: 0, clickCount: 1, pressure: 1))
                    window.sendEvent(event)
                }
                if done() { return }
            }
            RunLoop.main.run(until: Date().addingTimeInterval(0.001))
        }
    }
}
