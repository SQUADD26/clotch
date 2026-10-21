import XCTest
import SwiftUI
@testable import CodeIsland
@testable import CodeIslandCore

/// The Account tab on the four accounts of the Figma frame (one near its week limit, none stale) and a stale one.
@MainActor
final class NotchAccountsTabTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)

    private func quota(_ email: String, five: Double, seven: Double, age: TimeInterval = 60) -> AccountQuota {
        let reset = now.addingTimeInterval(3600)
        return AccountQuota(email: email, at: now.addingTimeInterval(-age),
                            fiveHour: QuotaWindow(used: five, reset: reset), sevenDay: QuotaWindow(used: seven, reset: reset))
    }

    private var figma: [AccountQuota] {
        [quota("claudesquadd1@x.it", five: 0, seven: 25), quota("amministrazione@x.it", five: 4, seven: 63),
         quota("developer@x.it", five: 6, seven: 61), quota("supporto@x.it", five: 35, seven: 97)]
    }

    func testInUseText() {
        XCTAssertEqual(AccountsTab.inUseText(0), "Nessuno in uso su questo Mac")
        XCTAssertEqual(AccountsTab.inUseText(3), "3 in uso su questo Mac")
    }

    private let green: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in g > 170 && r < 120 && b < 140 }
    private let yellow: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in r > 210 && g > 170 && b < 80 }
    private let red: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in r > 210 && g < 110 && b < 110 }

    func testTabShowsToneColoursAndRedWeekFigure() throws {
        let tab = AccountsTab(accounts: figma, inUse: ["claudesquadd1@x.it", "amministrazione@x.it", "developer@x.it"], now: now)
        let pixels = try render(tab.frame(width: 520), named: "tab-account")
        XCTAssertGreaterThan(pixels.count(green), 0, "green bars")
        XCTAssertGreaterThan(pixels.count(yellow), 0, "yellow week bars")
        XCTAssertGreaterThan(pixels.count(red), 0, "97% week is red")
    }

    func testStaleAccountIsMutedAndDrawsNoBars() throws {
        let tab = AccountsTab(accounts: [quota("a@x.it", five: 50, seven: 97, age: 3 * 86_400)], inUse: [], now: now)
        let pixels = try render(tab.frame(width: 520), named: "tab-account-vecchio")
        XCTAssertEqual(pixels.count(red), 0, "no red for a stale account")
    }

    func testStaleAgeSaysDays() {
        let stale = quota("a@x.it", five: 1, seven: 1, age: 3 * 86_400)
        XCTAssertEqual(stale.at.map { "Nessun dato da " + GoalRow.elapsed(from: $0, to: now) }, "Nessun dato da 3 g")
    }

    // MARK: Pixels

    private struct Pixels {
        let width: Int, height: Int, bytes: [UInt8]

        func count(_ test: (UInt8, UInt8, UInt8) -> Bool) -> Int {
            stride(from: 0, to: bytes.count, by: 4).filter { test(bytes[$0], bytes[$0 + 1], bytes[$0 + 2]) }.count
        }
    }

    private func render<V: View>(_ view: V, named name: String) throws -> Pixels {
        let image = try XCTUnwrap(OffscreenRender.rasterize(view.background(Color.black).environment(\.colorScheme, .dark), scale: 2))
        if let dir = ProcessInfo.processInfo.environment["NOTCH_SNAPSHOT_DIR"] {
            try NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])?
                .write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
        let w = image.width, h = image.height
        var bytes = [UInt8](repeating: 0, count: w * h * 4)
        let ctx = try XCTUnwrap(CGContext(data: &bytes, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                          space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        return Pixels(width: w, height: h, bytes: bytes)
    }
}
