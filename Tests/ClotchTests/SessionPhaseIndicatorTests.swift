import AppKit
import SwiftUI
import XCTest
@testable import Clotch
@testable import ClotchCore

/// clotch#114: the five phases drawn side by side, «In lavorazione» in both variants. Set CLOTCH_SNAPSHOT_DIR to keep the PNG.
@MainActor
final class SessionPhaseIndicatorTests: XCTestCase {
    private struct Sheet: View {
        var body: some View {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(WorkingStyle.allCases, id: \.self) { style in
                    HStack(spacing: 22) {
                        ForEach(SessionPhase.allCases, id: \.self) { phase in
                            HStack(spacing: 6) {
                                PhaseIndicator(phase: phase, pulsing: phase.pulses, size: 18, style: style)
                                Text(phase.label).font(NotchType.caption).foregroundStyle(Color(phase.rgb))
                            }
                        }
                    }
                }
            }
        }
    }

    func testEveryPhaseAndBothWorkingStylesDraw() throws {
        let image = try XCTUnwrap(OffscreenRender.rasterize(
            Sheet().padding(24).background(Color.black).environment(\.colorScheme, .dark)))
        let png = NSBitmapImageRep(cgImage: image)
        XCTAssertGreaterThan(png.pixelsWide, 400)
        XCTAssertEqual(WorkingStyle.allCases.count, 2, "two variants to choose from")
        if let dir = ProcessInfo.processInfo.environment["CLOTCH_SNAPSHOT_DIR"], let data = png.representation(using: .png, properties: [:]) {
            try data.write(to: URL(fileURLWithPath: dir).appendingPathComponent("session-phases.png"))
        }
    }

    func testColourHelperMatchesTheCoreValues() throws {
        let c = NSColor(Color(SessionPhase.aspettaRoberto.rgb)).usingColorSpace(.sRGB)
        XCTAssertEqual(try XCTUnwrap(c).redComponent, 1, accuracy: 0.01)
        XCTAssertEqual(try XCTUnwrap(c).greenComponent, 159 / 255, accuracy: 0.01)
    }

    func testWordsAndMouseOverTextPerPhase() {
        func row(_ phase: SessionPhase, why: String = "", what: String = "") -> GoalRow {
            GoalRow(id: "m", title: "t", goal: "g", proofsDone: 0, proofsTotal: 0, progress: nil, status: .moving, lastActivity: nil,
                    pulses: [], motor: SessionMotor(cli: "m", phase: phase, why: why, what: what))
        }
        let now = Date()
        XCTAssertEqual(row(.lavora).statusLabel, "In lavorazione")
        XCTAssertEqual(row(.aspettaRoberto, why: "Ti chiede: A o B?").detail(now: now), "Ti chiede: A o B?")
        XCTAssertEqual(row(.aspettaAltro, why: "Aspetta 1 cosa in background", what: "la CI").detail(now: now),
                       "Aspetta 1 cosa in background: la CI", "waiting on something else: what, on mouse-over")
        XCTAssertEqual(row(.problema, why: "Si è fermata per un errore: 529").reason(now: now), "Si è fermata per un errore: 529")
        XCTAssertEqual(row(.ferma).detail(now: now), "Ferma")
        XCTAssertEqual(Color(SessionPhase.problema.rgb), GoalTone.stop.color, "the red is the notch's red")
    }

    func testPulseStopsOnceRobertoOpensTheSession() {
        let since = Date(timeIntervalSinceNow: -600)
        let row = GoalRow(id: "m", title: "t", goal: "g", proofsDone: 0, proofsTotal: 0, progress: nil, status: .moving,
                          lastActivity: nil, pulses: [], master: SessionTarget(localId: "local_00000000-0000-4000-8000-000000000001", profile: ""),
                          motor: SessionMotor(cli: "m", phase: .aspettaRoberto, why: "", since: since))
        let seen = SessionSeen()
        XCTAssertTrue(seen.needsEye(row), "waiting for Roberto and never opened")
        seen.markOpened(row.master!.localId)
        XCTAssertFalse(seen.needsEye(row), "opened after it started waiting")
        var later = row
        later.motor = SessionMotor(cli: "m", phase: .aspettaRoberto, why: "", since: Date().addingTimeInterval(60))
        XCTAssertTrue(seen.needsEye(later), "a new wait pulses again")
        var working = row
        working.motor = SessionMotor(cli: "m", phase: .lavora, why: "", since: since)
        XCTAssertFalse(SessionSeen().needsEye(working), "only a session waiting for Roberto pulses")
    }
}
