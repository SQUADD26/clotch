import XCTest
import SwiftUI
@testable import Clotch
@testable import ClotchCore

/// The session strip (clotch#114): the mouse-over line, and the parity render against the Figma frame 58:56744 (508 × 40):
///
///     FIGMA_PARITA_DIR=$PWD/design/app swift test --filter SessionStripTests
///     node ~/.claude/skills/figma-ui-design/parita.mjs immagine design/figma/58-56744.png design/app/58-56744.png --soglia 0.08
///
/// Without FIGMA_PARITA_DIR the render test skips.
@MainActor
final class SessionStripTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)

    private func row(_ title: String, _ phase: SessionPhase, why: String = "") -> GoalRow {
        GoalRow(id: title, title: title, goal: "g", proofsDone: 0, proofsTotal: 0, progress: nil, status: .moving, lastActivity: now,
                pulses: [], motor: SessionMotor(cli: title, phase: phase, why: why))
    }

    func testHoverLineSaysWhy() {
        XCTAssertEqual(row("Setup", .aspettaRoberto, why: "scegliere come fare i test.").hoverLine(now: now),
                       "Setup aspetta te: scegliere come fare i test.")
        XCTAssertEqual(row("SEO", .problema, why: "il motore non risponde.").hoverLine(now: now),
                       "SEO ha un problema: il motore non risponde.")
        XCTAssertEqual(row("SEO", .problema).hoverLine(now: now), "SEO ha un problema.")
    }

    func testQuietSessionHasNoLine() {
        XCTAssertNil(row("Clotch", .lavora).hoverLine(now: now))
    }

    func testStripMatchesFigmaFrame() throws {
        guard let dir = ProcessInfo.processInfo.environment["FIGMA_PARITA_DIR"] else {
            throw XCTSkip("FIGMA_PARITA_DIR not set — parity render is opt-in")
        }
        let rows = [row("Clotch", .lavora), row("SEO", .lavora), row("Setup", .aspettaRoberto, why: "scegliere come fare i test."),
                    row("Friday", .lavora), row("dentalspace", .lavora)]
        let entries = rows.enumerated().map { k, r in
            SessionStrip.Entry(id: r.id, name: r.title, tone: r.tone, pages: k..<(k + 1), line: r.hoverLine(now: now))
        }
        let strip = SessionStrip(entries: entries, index: 9, summary: GoalBoard.sessionSummary(rows), go: { _ in }, hovered: "Setup")
            .frame(width: 508, height: 40, alignment: .topLeading)
            .environment(\.colorScheme, .dark)
        let image = try OffscreenRender.hosted(strip, size: CGSize(width: 508, height: 40), scale: 1)
        XCTAssertEqual(image.width, 508)
        XCTAssertEqual(image.height, 40)
        try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
        try OffscreenRender.writePNG(image, to: dir + "/58-56744.png")
    }
}
