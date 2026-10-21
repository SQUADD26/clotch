import XCTest
import SwiftUI
@testable import CodeIsland
@testable import CodeIslandCore

/// Snapshot tests of the zone views on fixture data: each renders offscreen on black and the pixels are
/// checked (colours, and what sits where). Set NOTCH_SNAPSHOT_DIR to keep the PNGs for a look.
@MainActor
final class NotchZoneViewsTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_792_590_000)

    private func quota(_ email: String, five: Double, seven: Double, age: TimeInterval = 60) -> AccountQuota {
        let reset = now.addingTimeInterval(3600)
        return AccountQuota(email: email, at: now.addingTimeInterval(-age),
                            fiveHour: QuotaWindow(used: five, reset: reset), sevenDay: QuotaWindow(used: seven, reset: reset))
    }

    private func row(_ id: String, _ status: GoalStatus, done: Int, total: Int) -> GoalRow {
        GoalRow(id: id, title: "Notch: goal sul notch", goal: "g", proofsDone: done, proofsTotal: total,
                progress: total > 0 ? Double(done) / Double(total) : nil, status: status, lastActivity: now, pulses: [])
    }

    /// The three accounts of the Figma frames.
    private var data: NotchZoneData {
        NotchZoneData(
            rows: [row("a", .moving, done: 3, total: 4), row("b", .reached, done: 2, total: 2), row("c", .still(since: now), done: 0, total: 0)],
            accounts: [quota("claudesquadd1@x.it", five: 0, seven: 25), quota("amministrazione@x.it", five: 4, seven: 63),
                       quota("developer@x.it", five: 6, seven: 61), quota("supporto@x.it", five: 1, seven: 1)],
            inUse: ["claudesquadd1@x.it", "amministrazione@x.it", "developer@x.it"],
            requestsWaiting: 6, workingSessions: 2,
            workingSince: now.addingTimeInterval(-7457), now: now
        )
    }

    // MARK: Pure

    func testQuotaToneFollowsFigma() {
        XCTAssertEqual(NotchQuotaTone.tone(used: 25), .go)
        XCTAssertEqual(NotchQuotaTone.tone(used: 61), .wait)
        XCTAssertEqual(NotchQuotaTone.tone(used: 63), .wait)
        XCTAssertEqual(NotchQuotaTone.tone(used: 89), .wait)
        XCTAssertEqual(NotchQuotaTone.tone(used: 90), .stop)
        XCTAssertNil(NotchQuotaTone.tone(used: nil))
    }

    func testOnlyAccountsInUseAreListedInDashboardOrder() {
        XCTAssertEqual(data.accountsInUse.map(\.label), ["claudesquadd1", "amministrazione", "developer"])
    }

    func testSharedLabelShowsTheWholeEmail() {
        var d = data
        d.accounts.append(quota("developer@y.it", five: 0, seven: 0))
        XCTAssertEqual(d.name(of: d.accounts[2]), "developer@x.it")
        XCTAssertEqual(d.name(of: d.accounts[0]), "claudesquadd1")
    }

    func testIslandWidthGrowsFromTheNotchToMostOfTheScreen() {
        XCTAssertEqual(NotchLayoutMetrics.islandWidth(fraction: 0, screenWidth: 1512, notchWidth: 200), 200)
        XCTAssertEqual(NotchLayoutMetrics.islandWidth(fraction: 1, screenWidth: 1512, notchWidth: 200), 1512 * 0.9, accuracy: 0.01)
        XCTAssertEqual(NotchLayoutMetrics.islandWidth(fraction: 9, screenWidth: 1512, notchWidth: 200), 1512 * 0.9, accuracy: 0.01)
        XCTAssertEqual(NotchLayoutMetrics.islandWidth(fraction: 0.5, screenWidth: 100, notchWidth: 200), 200)
    }

    // MARK: Snapshots

    func testWideElementShowsTwoBarsPerAccountWithWeekInWarningColour() throws {
        let image = try render(AccountsWideElement(data: data).padding(10), named: "account-esteso")
        XCTAssertGreaterThan(image.count(green), 0, "25% week and the 5 hour bars are green")
        XCTAssertGreaterThan(image.count(yellow), 0, "63% and 61% weeks are yellow")
        XCTAssertEqual(image.count(red), 0)
    }

    func testHoverCardListsAccountsWithFiveHoursAndWeek() throws {
        let image = try render(AccountsDetailCard(data: data).padding(10), named: "account-dettaglio")
        XCTAssertGreaterThan(image.count(green), 0)
        XCTAssertGreaterThan(image.count(yellow), 0)
        XCTAssertGreaterThan(image.count(white), 100, "title, names and figures")
    }

    func testStaleAccountDrawsNoBars() throws {
        var d = data
        d.accounts = [quota("claudesquadd1@x.it", five: 50, seven: 90, age: 2 * 86_400)]
        d.inUse = ["claudesquadd1@x.it"]
        let image = try render(AccountsWideElement(data: d).padding(10), named: "account-vecchio")
        XCTAssertEqual(image.count(green) + image.count(yellow) + image.count(red), 0)
    }

    func testCentreIsUsedOnlyOnAScreenWithoutANotch() throws {
        let layout = NotchScreenLayout.standard(hasNotch: false)
        func zones(hasNotch: Bool) -> some View {
            NotchZonesView(layout: layout, hasNotch: hasNotch, notchWidth: 200, data: data)
                .frame(width: 900).background(Color.black)
        }
        let flat = try render(zones(hasNotch: false), named: "zone-senza-notch")
        let notched = try render(zones(hasNotch: true), named: "zone-con-notch")
        XCTAssertGreaterThan(flat.count(white, columns: 0.33..<0.67), 100, "the active goal sits in the centre")
        XCTAssertEqual(notched.count(white, columns: 0.42..<0.58), 0, "beside a notch the middle stays empty")
        XCTAssertGreaterThan(notched.count(white), 0, "the goal moved to the left side")
    }

    // MARK: Pixels

    private let green: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in g > 170 && r < 120 && b < 140 }
    private let yellow: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in r > 210 && g > 170 && b < 80 }
    private let red: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in r > 210 && g < 110 && b < 110 }
    private let white: (UInt8, UInt8, UInt8) -> Bool = { r, g, b in r > 200 && g > 200 && b > 200 }

    private struct Pixels {
        let width: Int, height: Int, bytes: [UInt8]

        func count(_ test: (UInt8, UInt8, UInt8) -> Bool, columns: Range<Double> = 0..<1) -> Int {
            let from = Int(Double(width) * columns.lowerBound), to = Int(Double(width) * columns.upperBound)
            var n = 0
            for y in 0..<height {
                for x in from..<to {
                    let i = (y * width + x) * 4
                    if test(bytes[i], bytes[i + 1], bytes[i + 2]) { n += 1 }
                }
            }
            return n
        }
    }

    private func render<V: View>(_ view: V, named name: String) throws -> Pixels {
        let image = try XCTUnwrap(OffscreenRender.rasterize(view.background(Color.black).environment(\.colorScheme, .dark), scale: 2))
        if let dir = ProcessInfo.processInfo.environment["NOTCH_SNAPSHOT_DIR"] {
            let rep = NSBitmapImageRep(cgImage: image)
            try rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dir).appendingPathComponent("zone-\(name).png"))
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
