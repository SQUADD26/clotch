import Foundation

/// The one door into the engine (clotch#1110, claude-config#2771 contract v2): everything Roberto says becomes a `parla` command in
/// `~/.claude/casella/comandi/`, the same file the app writes. Friday decides: answers, acts, or passes it to the Overseer.
/// Receipt = a `comando_fatto` event in the registry with `dati.comando == id`; the answer = an `avviso` `motivo: risposta` with `rispondi_a` listing the id.
public struct FridayDoor {
    public enum Receipt: Equatable, Sendable { case ok(String), refused(String) }
    public struct Answer: Equatable, Sendable { public let text: String; public let spokenByClotch: Bool }

    public let home: URL
    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser) { self.home = home }

    var commandsURL: URL { home.appendingPathComponent(".claude/casella/comandi") }
    var registryURL: URL { home.appendingPathComponent(".claude/registro") }
    /// `{"fine", "interrotto"}`: the engine's turns of speech (claude-config#2777).
    public var turnsURL: URL { home.appendingPathComponent(".claude/friday/parla.json") }
    /// The one silence the engine keeps (claude-config#2777): `zitto_fino` in the future, `acceso` with `fino` null or future, or `lontano`.
    public var silenceURL: URL { home.appendingPathComponent(".claude/friday/silenzio.json") }

    /// Writes the command (`.tmp` then rename, folders 0700) and returns its id.
    @discardableResult
    public func send(_ cmd: String, args: [String: Any] = [:], now: Date = Date()) throws -> String {
        let id = "c-" + String(UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(12)).lowercased()
        let utc = ISO8601DateFormatter(); utc.timeZone = TimeZone(identifier: "UTC")
        let stamp = DateFormatter(); stamp.dateFormat = "yyyyMMdd'T'HHmmss"; stamp.timeZone = TimeZone(identifier: "UTC"); stamp.locale = Locale(identifier: "en_US_POSIX")
        let body = try JSONSerialization.data(withJSONObject: ["v": 1, "id": id, "t": utc.string(from: now), "da": "clotch", "cmd": cmd, "args": args] as [String: Any], options: [.sortedKeys])
        try FileManager.default.createDirectory(at: commandsURL, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let file = commandsURL.appendingPathComponent("\(stamp.string(from: now))-\(id).json")
        let tmp = file.appendingPathExtension("tmp")
        try body.write(to: tmp)
        try FileManager.default.moveItem(at: tmp, to: file)
        return id
    }

    /// The registry lines of this and last month's file, newest last (the tail is enough: a receipt comes seconds after the command).
    private func events(of type: String, now: Date) -> [[String: Any]] {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM"; f.timeZone = TimeZone(identifier: "UTC"); f.locale = Locale(identifier: "en_US_POSIX")
        let month = registryURL.appendingPathComponent(f.string(from: now) + ".jsonl")
        guard let h = try? FileHandle(forReadingFrom: month) else { return [] }
        defer { try? h.close() }
        let size = (try? h.seekToEnd()) ?? 0
        try? h.seek(toOffset: size > 400_000 ? size - 400_000 : 0)
        let text = String(decoding: (try? h.readToEnd()) ?? Data(), as: UTF8.self)
        return text.split(separator: "\n").compactMap { line in
            guard let o = (try? JSONSerialization.jsonObject(with: Data(line.utf8))) as? [String: Any], o["tipo"] as? String == type else { return nil }
            return o["dati"] as? [String: Any]
        }
    }

    public func receipt(of id: String, now: Date = Date()) -> Receipt? {
        guard let d = events(of: "comando_fatto", now: now).last(where: { $0["comando"] as? String == id }) else { return nil }
        let text = d["testo"] as? String ?? ""
        return d["esito"] as? String == "ok" ? .ok(text) : .refused(text)
    }

    public func answer(to id: String, now: Date = Date()) -> Answer? {
        guard let d = events(of: "avviso", now: now).last(where: { $0["motivo"] as? String == "risposta" && ($0["rispondi_a"] as? [String])?.contains(id) == true }),
              let text = d["testo"] as? String else { return nil }
        return Answer(text: text, spokenByClotch: d["detto_da"] as? String == "clotch")
    }

    /// The silence file, read the way the contract says (every reader, one rule).
    public func isSilent(now: Date = Date()) -> Bool {
        guard let o = (try? JSONSerialization.jsonObject(with: Data(contentsOf: silenceURL))) as? [String: Any] else { return false }
        let utc = ISO8601DateFormatter(); utc.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        func future(_ key: String) -> Bool { (o[key] as? String).flatMap { utc.date(from: $0) ?? ISO8601DateFormatter().date(from: $0) }.map { $0 > now } ?? false }
        return future("zitto_fino") || (o["acceso"] as? Bool == true && (o["fino"] is NSNull || o["fino"] == nil || future("fino"))) || o["lontano"] as? Bool == true
    }
}
