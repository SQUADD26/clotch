import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// The judge before the voice speaks (#57, claude-config#1854 «Giudice»): Jev (typesafe.ai, system one) gets three blocks,
/// Roberto's requests on the subject word for word, the state now and the signal, and answers one question:
/// «is it necessary to tell the user now?». Same question, state and `giudizio` as claude-config's `voce_giudice.py`.
/// Without a key, on an error or past the timeout: nil, and the fixed rules decide (better one voice too many).
public enum VoiceJudge {
    public static let url = URL(string: "https://api.typesafe.ai/v1/systemone")!
    public static let model = "jev-1.13.0"
    public static let threshold = 0.5
    public static let seconds: TimeInterval = 5
    static let maxRequests = 5
    static let question = "`segnale` e' un cambio di stato del lavoro che un assistente sta facendo per l'utente. `richieste` sono le parole dell'utente sull'argomento, `stato` e' come stanno le cose adesso. "
        + "E' necessario avvisare l'utente adesso, a voce? Si' solo se gli serve per decidere o agire, se e' qualcosa che ha chiesto o aspettava, o se e' un rischio. "
        + "No se e' routine, un passaggio intermedio, o cio' che sa gia'."

    public struct Verdict: Equatable, Sendable {
        public var say: Bool?   // nil = the judge was not reached
        public var reason: String
        public var p: Double?
    }

    /// Only these kinds go to the judge; a risk, a custom alert and a question never do, nor an event already judged.
    public static func judges(_ e: VoiceEvent) -> Bool {
        !e.judged && [.requestDone, .goalReached, .goalBlocked, .endOfTurn].contains(e.kind)
    }

    /// The three blocks. (a) requests of the same session, taken by it, naming the same #N or sharing two long words with
    /// the subject: at most 5, the newest. (b) the session's goal. shortcut: no Overseer queue nor gh state, as the Mac
    /// app does not read them; add them if the judge says no too often.
    public static func state(_ e: VoiceEvent, requests: [UserRequest], goals: [GoalRecord]) -> [String: String] {
        let numbers = Set(matches(#"#(\d{2,5})"#, in: "\(e.text) \(e.subject)"))
        let words = Set(matches(#"\w{5,}"#, in: e.subject.lowercased()))
        let linked = requests.filter { r in
            let words2 = Set(matches(#"\w{5,}"#, in: r.original.lowercased()))
            return (!e.session.isEmpty && (r.session == e.session || r.takenBy == e.session))
                || numbers.contains { r.original.contains("#\($0)") || r.takenBy.contains("#\($0)") }
                || (words.count >= 2 && words.intersection(words2).count >= 2)
        }
        .sorted { ($0.at ?? .distantPast) > ($1.at ?? .distantPast) }.prefix(maxRequests)
        let asked = linked.map { r in
            "\(r.id) (\(r.state), presa da: \(r.takenBy.isEmpty ? "-" : r.takenBy)): "
                + String((r.original.isEmpty ? r.text : r.original).split(whereSeparator: \.isWhitespace).joined(separator: " ").prefix(500))
        }
        let goal = goals.first { !e.session.isEmpty && $0.cli == e.session }.map { "obiettivo (\($0.state)): " + String($0.goal.prefix(300)) }
        return ["richieste": asked.isEmpty ? "nessuna richiesta collegata" : asked.joined(separator: "\n"),
                "stato": goal ?? "nessuno stato noto",
                "segnale": "\(e.kind.rawValue): \(e.text.isEmpty ? e.subject : e.text)" + (e.proof.isEmpty ? "" : " (prova: \(e.proof))")]
    }

    public static func request(key: String, state: [String: String]) -> URLRequest {
        var r = URLRequest(url: url, timeoutInterval: seconds)
        r.httpMethod = "POST"
        r.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        r.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["model": model, "state": state, "questions": ["q": ["type": "noul", "instructions": question]]]
        r.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return r
    }

    /// Asks Jev. `ask` does the network (`URLSession` in the app, a fake in the tests); it never sees past `timeout`.
    public static func judge(state: [String: String], key: String?, timeout: TimeInterval = seconds,
                             ask: @escaping @Sendable (URLRequest) async throws -> Data) async -> Verdict {
        guard let key, !key.isEmpty else { return Verdict(say: nil, reason: "giudice non raggiunto: nessuna chiave") }
        let req = request(key: key, state: state)
        let data: Data? = await withTaskGroup(of: Data?.self) { g in
            g.addTask { try? await ask(req) }
            g.addTask { try? await Task.sleep(nanoseconds: UInt64(timeout * 1e9)); return nil }
            let first = await g.next() ?? nil
            g.cancelAll()
            return first
        }
        guard let data else { return Verdict(say: nil, reason: "giudice non raggiunto: errore o oltre \(Int(timeout)) secondi") }
        let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let q = (o?["answers"] as? [String: Any])?["q"] as? [String: Any]
        guard let p = (q?["noul"] as? NSNumber)?.doubleValue, (0...1).contains(p) else {
            return Verdict(say: nil, reason: "giudice non raggiunto: risposta di Jev non chiara")
        }
        return Verdict(say: p >= threshold, reason: String(format: "Jev: P=%.2f, soglia %.1f", p, threshold), p: p)
    }

    /// One line of `giudice-log.jsonl` (#1854): `{"t","tipo","soggetto","si","motivo","p"}`. Never the key.
    public static func logLine(_ e: VoiceEvent, _ v: Verdict, now: Date) -> Data {
        let o: [String: Any] = ["t": now.timeIntervalSince1970, "tipo": e.kind.rawValue, "soggetto": e.subject,
                                "si": v.say.map { $0 as Any } ?? NSNull(), "motivo": v.reason, "p": v.p.map { $0 as Any } ?? NSNull()]
        return ((try? JSONSerialization.data(withJSONObject: o, options: [.sortedKeys])) ?? Data()) + Data("\n".utf8)
    }

    static func matches(_ pattern: String, in s: String) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        return re.matches(in: s, range: NSRange(s.startIndex..., in: s)).compactMap { m in
            Range(m.range(at: m.numberOfRanges > 1 ? 1 : 0), in: s).map { String(s[$0]) }
        }
    }
}
