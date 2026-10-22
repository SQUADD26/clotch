import XCTest
@testable import Clotch

/// The engine's door to the Mac (clotch#283): only allowed programs run, and the
/// reply carries exit code, stdout and stderr.
final class MacBridgeTests: XCTestCase {
    private func reply(_ data: Data) -> [String: Any] {
        (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    func testAllowedProgramRunsAndReportsOutput() {
        let r = reply(MacBridge.handle(Data(#"{"argv":["/bin/sh","-c","echo fuori; echo dentro >&2; exit 3"]}"#.utf8), allowed: ["/bin/sh"]))
        XCTAssertEqual(r["code"] as? Int, 3)
        XCTAssertEqual(r["out"] as? String, "fuori\n")
        XCTAssertEqual(r["err"] as? String, "dentro\n")
    }

    func testProgramNotAllowedIsRefused() {
        let r = reply(MacBridge.handle(Data(#"{"argv":["/bin/sh","-c","touch /tmp/no"]}"#.utf8), allowed: ["/usr/bin/osascript"]))
        XCTAssertEqual(r["code"] as? Int, -1)
        XCTAssertTrue((r["err"] as? String ?? "").contains("non ammesso"))
    }

    func testBadRequestIsRefused() {
        XCTAssertEqual(reply(MacBridge.handle(Data("ciao".utf8), allowed: ["/bin/sh"]))["code"] as? Int, -1)
    }

    func testTimeoutKillsTheChild() {
        let started = Date()
        let r = reply(MacBridge.handle(Data(#"{"argv":["/bin/sleep","20"],"timeout":0.5}"#.utf8), allowed: ["/bin/sleep"]))
        XCTAssertEqual(r["code"] as? Int, -1)
        XCTAssertLessThan(Date().timeIntervalSince(started), 5)
    }

    func testDefaultAllowListIsTheEnginePrograms() {
        XCTAssertEqual(MacBridge.allowed.count, 4)
        XCTAssertTrue(MacBridge.allowed.contains("/usr/bin/osascript"))
        XCTAssertTrue(MacBridge.allowed.contains { $0.hasSuffix("/.cache/apri-master/ax-premi") })
    }

    /// End to end over the real socket, as the engine's clotch_mac.py talks to it.
    @MainActor
    func testSocketRoundTrip() async throws {
        let path = "/tmp/clotch-mac-test-\(getpid()).sock"
        let bridge = MacBridge(path: path, allowed: ["/bin/echo"])
        bridge.start()
        defer { bridge.stop() }
        var attrs: [FileAttributeKey: Any] = [:]
        for _ in 0..<50 where attrs.isEmpty {
            try await Task.sleep(nanoseconds: 50_000_000)
            attrs = (try? FileManager.default.attributesOfItem(atPath: path)) ?? [:]
        }
        XCTAssertEqual((attrs[.posixPermissions] as? NSNumber)?.intValue, 0o700)
        let data = try await Task.detached { try Self.send(#"{"argv":["/bin/echo","ciao"]}"#, to: path) }.value
        XCTAssertEqual(reply(data)["out"] as? String, "ciao\n")
        XCTAssertEqual(reply(data)["code"] as? Int, 0)
    }

    private static func send(_ text: String, to path: String) throws -> Data {
        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        defer { close(fd) }
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &addr.sun_path) { buf in _ = path.utf8CString.withUnsafeBytes { buf.copyMemory(from: $0) } }
        let ok = withUnsafePointer(to: &addr) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { connect(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) } }
        guard ok == 0 else { throw POSIXError(.ECONNREFUSED) }
        _ = text.withCString { write(fd, $0, strlen($0)) }
        shutdown(fd, SHUT_WR)
        var out = Data(), buf = [UInt8](repeating: 0, count: 4096)
        while case let n = read(fd, &buf, buf.count), n > 0 { out.append(buf, count: n) }
        return out
    }
}
