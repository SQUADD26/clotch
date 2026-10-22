import XCTest
import SwiftUI
import ClotchCore
@testable import Clotch

/// Roberto's requests are shown whole wherever Clotch shows them (#156): the notice under the notch, the Requests tab and
/// the ADHD tab wrap to as many lines as the text needs, never «…». A text of 60 characters is rendered into
/// `CLOTCH_FOTO_DIR` when set (offscreen, the app is not launched). Heights: a longer text must make the view taller.
@MainActor
final class RequestTextWholeTests: XCTestCase {
    private func request(_ id: String, _ text: String) -> UserRequest {
        GoalSources.parseRequest(Data(#"{"id": "\#(id)", "testo": "\#(text)", "stato": "presa", "titolo_sessione": "Clotch"}"#.utf8))!
    }

    private func words(_ n: Int) -> String { String(String(repeating: "parola ", count: n / 7 + 1).prefix(n)).trimmingCharacters(in: .whitespaces) }

    private func render<V: View>(_ view: V, _ name: String) throws -> CGImage {
        let image = try XCTUnwrap(OffscreenRender.rasterize(view.environment(\.colorScheme, .dark).background(Color.black), scale: 2))
        if let dir = ProcessInfo.processInfo.environment["CLOTCH_FOTO_DIR"] {
            try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try OffscreenRender.writePNG(image, to: dir + "/" + name + ".png")
        }
        return image
    }

    private func notice(_ text: String, _ name: String) throws -> CGImage {
        let r = request("Q-1", text)
        return try render(NotchNotificationView(event: NotchEvent(kind: .requestTaken, subject: "Q-1", count: 0), phase: .settle,
                                                 rows: [], requests: [r]).frame(width: 440), name)
    }

    func testNoticeGrowsPastThreeLines() throws {
        _ = try notice(words(60), "avviso-60-caratteri")
        XCTAssertGreaterThan(try notice(words(400), "avviso-400").height, try notice(words(200), "avviso-200").height,
                             "200 characters already fill 5+ lines: the longer text must be taller, not clipped at 3 lines")
    }

    func testRequestsTabWrapsLongTexts() throws {
        func tab(_ text: String, _ name: String) throws -> CGImage {
            let all = (1...5).map { request("Q-\($0)", text) }.map { r -> UserRequest in
                GoalSources.parseRequest(Data(#"{"id": "\#(r.id)", "testo": "\#(text)", "stato": "nuova"}"#.utf8))!
            }
            return try render(RequestsTab(requests: all, active: true).frame(width: 460), name)
        }
        _ = try tab(words(60), "scheda-richieste-60-caratteri")
        XCTAssertGreaterThan(try tab(words(160), "scheda-richieste-160").height, try tab(words(60), "scheda-richieste-60").height,
                             "a 160-character request wraps instead of being cut to one line")
    }

    func testAdhdTabWrapsLongQuestions() throws {
        func tab(_ text: String, _ name: String) throws -> CGImage {
            let items = GoalSources.parseAdhd(Data(#"[{"id":"Q-1","domanda_chiara":"\#(text)","responsabile":"Clotch","volte":1}]"#.utf8))
            return try render(AdhdTab(items: items).frame(width: 460), name)
        }
        _ = try tab(words(60), "adhd-60-caratteri")
        XCTAssertGreaterThan(try tab(words(160), "adhd-160").height, try tab(words(60), "adhd-60").height)
    }
}
