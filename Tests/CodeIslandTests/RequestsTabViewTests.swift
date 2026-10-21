import XCTest
import SwiftUI
@testable import CodeIsland
import CodeIslandCore

/// Fixture requests (0, 3, 9; mixed states) rendered to PNG: the preview of the «Richieste» tab.
/// Set REQUESTS_SNAPSHOT_DIR to keep the PNGs; the default is the temp folder.
@MainActor
final class RequestsTabViewTests: XCTestCase {
    private func request(_ n: Int, _ state: String) -> UserRequest {
        let json = #"{"id":"Q-\#(n)","t":\#(1_760_000_000 - n * 60),"testo":"Richiesta numero \#(n)","stato":"\#(state)","t_presa":1760000100}"#
        return GoalSources.parseRequest(Data(json.utf8))!
    }

    private func fixture(_ states: [String]) -> [UserRequest] {
        states.enumerated().map { request($0.offset, $0.element) }
    }

    func testMoreLabel() {
        XCTAssertEqual(RequestsTabView.moreLabel(page: 0, total: 9), "Altre 4")
        XCTAssertEqual(RequestsTabView.moreLabel(page: 1, total: 9), "Prime 5")
        XCTAssertEqual(RequestsTabView.moreLabel(page: 0, total: 12), "Altre 7")
        XCTAssertEqual(RequestsTabView.moreLabel(page: 1, total: 12), "Altre 2")
        XCTAssertEqual(RequestsTabView.moreLabel(page: 2, total: 12), "Prime 5")
    }

    func testFixturesRender() throws {
        let nine = fixture(["presa", "fatta", "presa", "nuova", "nuova", "nuova", "nuova", "nuova", "nuova"])
        let cases: [(String, [UserRequest], Int)] = [
            ("0", [], 0), ("3", fixture(["nuova", "presa", "fatta"]), 0), ("9-p1", nine, 0), ("9-p2", nine, 1),
        ]
        let dir = ProcessInfo.processInfo.environment["REQUESTS_SNAPSHOT_DIR"].map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.temporaryDirectory
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        for (name, requests, page) in cases {
            let view = RequestsTabView(requests: requests, active: true, page: page)
                .frame(width: 520).padding(24).background(Color.black)
                .environment(\.colorScheme, .dark).environment(\.notchSnapshot, true)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            let image = try XCTUnwrap(renderer.cgImage, "no image for \(name) requests")
            let png = try XCTUnwrap(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
            let url = dir.appendingPathComponent("richieste-\(name).png")
            try png.write(to: url)
            print("snapshot: \(url.path) \(image.width)x\(image.height)")
            XCTAssertGreaterThan(image.height, 100, name)
        }
    }
}
