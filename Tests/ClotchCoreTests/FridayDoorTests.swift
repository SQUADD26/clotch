import XCTest
@testable import ClotchCore

final class FridayDoorTests: XCTestCase {
    private func home() -> URL { FileManager.default.temporaryDirectory.appendingPathComponent("door-\(UUID().uuidString)") }

    func testParlaIsAContractFile() throws {
        let h = home(); defer { try? FileManager.default.removeItem(at: h) }
        let door = FridayDoor(home: h)
        let id = try door.send("parla", args: ["testo": "apri una sessione"], now: Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertTrue(id.hasPrefix("c-") && id.count == 14)
        let names = try FileManager.default.contentsOfDirectory(atPath: door.commandsURL.path)
        XCTAssertEqual(names, ["20270115T080000-\(id).json"], "no .tmp left")
        let o = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: door.commandsURL.appendingPathComponent(names[0]))) as? [String: Any])
        XCTAssertEqual(o["cmd"] as? String, "parla"); XCTAssertEqual(o["da"] as? String, "clotch"); XCTAssertEqual(o["id"] as? String, id)
        XCTAssertEqual((o["args"] as? [String: String])?["testo"], "apri una sessione")
    }

    func testReceiptAndAnswerComeFromTheRegistry() throws {
        let h = home(); defer { try? FileManager.default.removeItem(at: h) }
        let door = FridayDoor(home: h)
        try FileManager.default.createDirectory(at: door.registryURL, withIntermediateDirectories: true)
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertNil(door.receipt(of: "c-1", now: now))
        let lines = [#"{"tipo":"comando_fatto","dati":{"comando":"c-1","esito":"ok","testo":"passato a Friday"}}"#,
                     #"{"tipo":"comando_fatto","dati":{"comando":"c-2","esito":"rifiutato","testo":"Troppo lungo"}}"#,
                     #"{"tipo":"avviso","dati":{"motivo":"risposta","rispondi_a":["c-1"],"testo":"Fatto.","detto_da":"clotch"}}"#]
        try Data((lines.joined(separator: "\n") + "\n").utf8).write(to: door.registryURL.appendingPathComponent("2027-01.jsonl"))
        XCTAssertEqual(door.receipt(of: "c-1", now: now), .ok("passato a Friday"))
        XCTAssertEqual(door.receipt(of: "c-2", now: now), .refused("Troppo lungo"))
        XCTAssertEqual(door.answer(to: "c-1", now: now), .init(text: "Fatto.", spokenByClotch: true))
        XCTAssertNil(door.answer(to: "c-2", now: now))
    }
}
