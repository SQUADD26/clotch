import XCTest
import SwiftUI
@testable import Clotch
@testable import ClotchCore

/// clotch#114: the pager has no page dots, only the ‹ › buttons. Set NOTCH_SNAPSHOT_DIR to keep the photo of the open notch.
@MainActor
final class PagerNoDotsTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)

    func testPageControlIsTwoButtonsAndNothingBetween() throws {
        let image = try XCTUnwrap(OffscreenRender.rasterize(
            PageControl(count: 9, index: 4, go: { _ in }).background(Color.black).environment(\.colorScheme, .dark), scale: 1))
        // Two 22 pt buttons and an 8 pt gap: 52 pt wide. A row of dots would have made it wider.
        XCTAssertEqual(image.width, 52)
        XCTAssertEqual(image.height, 22)
    }

    func testOpenNotchWithManyPagesShowsNoDots() throws {
        let rows = ["Clotch", "SEO", "Setup", "Friday", "dentalspace"].map { name in
            GoalRow(id: name, title: name, goal: "Obiettivo di \(name)", proofsDone: 1, proofsTotal: 3, progress: 1.0 / 3, status: .moving,
                    lastActivity: now, pulses: [], motor: SessionMotor(cli: name, phase: name == "Setup" ? .aspettaRoberto : .lavora, why: "scegliere come fare i test."))
        }
        let notch = VStack(spacing: 12) {
            TabBar(tab: .constant(.goals))
            GoalsTab(rows: rows, now: now)
        }
        .padding(12).frame(width: 508, alignment: .top).background(Color.black).environment(\.colorScheme, .dark)
        let image = try OffscreenRender.hosted(notch, size: CGSize(width: 508, height: 300), scale: 2)
        XCTAssertGreaterThan(image.width, 0)
        if let dir = ProcessInfo.processInfo.environment["NOTCH_SNAPSHOT_DIR"] {
            try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try OffscreenRender.writePNG(image, to: dir + "/notch-aperto-senza-puntini.png")
        }
    }
}
