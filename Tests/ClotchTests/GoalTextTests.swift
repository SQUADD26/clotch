import AppKit
import SwiftUI
import XCTest
@testable import Clotch

/// A goal's text in the notch (#20): closed it is cut to two lines, open (after a click) it is whole.
@MainActor
final class GoalTextTests: XCTestCase {
    private let long = Array(repeating: "Il notch separa gli obiettivi proposti da quelli confermati, con Accetta e Rifiuta che scrivono nel registro.", count: 4)
        .joined(separator: " ")

    private func height<V: View>(_ view: V) throws -> Int {
        try XCTUnwrap(OffscreenRender.rasterize(view.frame(width: 400, alignment: .topLeading).background(Color.black))).height
    }

    func testClosedIsCutOpenIsWhole() throws {
        let twoLines = try height(Text(long).font(NotchType.body).lineLimit(2))
        let whole = try height(Text(long).font(NotchType.body).fixedSize(horizontal: false, vertical: true))
        XCTAssertGreaterThan(whole, twoLines, "the fixture must be longer than two lines")
        XCTAssertEqual(try height(GoalText(text: long)), twoLines, "closed: two lines with «…»")
        XCTAssertEqual(try height(GoalText(text: long, expanded: true)), whole, "open: the whole text")
    }

    func testShortTextIsTheSameOpenOrClosed() throws {
        XCTAssertEqual(try height(GoalText(text: "Obiettivo corto")), try height(GoalText(text: "Obiettivo corto", expanded: true)))
    }
}
