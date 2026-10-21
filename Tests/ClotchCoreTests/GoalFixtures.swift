import XCTest
@testable import ClotchCore

/// Fixtures are real-shaped JSON strings: the register as obiettivo_registro.py writes it,
/// desktop-app local_*.json, and handoff live/<cli>.json as live_state.py writes it.
class GoalTestCase: XCTestCase {
    let now = GoalSources.date("2026-10-21T14:00:00+0000")!

    // MARK: fixtures

    func minutesAgo(_ m: Double) -> Date { now.addingTimeInterval(-m * 60) }
    func ms(_ m: Double) -> Int { Int(minutesAgo(m).timeIntervalSince1970 * 1000) }
    func local(_ m: Double) -> String {  // live_state.now(): local time, no zone
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return f.string(from: minutesAgo(m))
    }

    func goalJSON(_ cli: String, stato: String = "aperto", prova: String = "", titolo: String = "", prove: String? = nil,
                          t: String = "2026-10-21T13:13:52+0000") -> Data {
        // Keys and indent as obiettivo_registro.scrivi (json.dump(ensure_ascii=False, indent=1)).
        let extra = prove.map { ",\n \"prove\": \($0)" } ?? ""
        return Data("""
        {
         "cli": "\(cli)",
         "storia": [
          {"obiettivo": "vecchio", "da": "roberto", "stato": "passato", "prova": "", "t": "2026-10-20T09:00:00+0200"}
         ],
         "obiettivo": "Fare  il\\n   dato   vivo",
         "da": "master",
         "stato": "\(stato)",
         "prova": "\(prova)",
         "t": "\(t)",
         "titolo": "\(titolo)",
         "visto": "ab12cd34ef"\(extra)
        }
        """.utf8)
    }

    func sessionJSON(_ local: String, cli: String, parent: String? = nil, running: Bool = false, archived: Bool = false,
                             ago: Double = 5, title: String = "") -> Data {
        Data("""
        {"sessionId": "\(local)", "cliSessionId": "\(cli)", "title": "\(title)", "isRunning": \(running), "isArchived": \(archived),
         "lastActivityAt": \(ms(ago)), "cwd": "/x"\(parent.map { ", \"spawnedFrom\": \($0)" } ?? "")}
        """.utf8)
    }

    func g(_ cli: String, stato: String = "aperto", prova: String = "", titolo: String = "", prove: String? = nil) -> GoalRecord {
        GoalSources.parseGoal(goalJSON(cli, stato: stato, prova: prova, titolo: titolo, prove: prove))!
    }

    func s(_ local: String, cli: String, parent: String? = nil, running: Bool = false, archived: Bool = false,
                   ago: Double = 5, title: String = "") -> DesktopSession {
        GoalSources.parseSession(sessionJSON(local, cli: cli, parent: parent, running: running, archived: archived, ago: ago, title: title),
                                 fileName: "\(local).json")!
    }

    func liveJSON(_ agents: String, transcript: String = "", updated: Double = 1) -> Data {
        Data("""
        {"aggiornato": "\(local(updated))", "transcript": "\(transcript)", "cwd": "/x", "agenti": \(agents)}
        """.utf8)
    }

    func rows(_ goals: [GoalRecord], _ sessions: [DesktopSession] = [], _ live: [LiveState] = []) -> [GoalRow] {
        GoalBoard.rows(goals: goals, sessions: sessions, live: live, now: now)
    }
}

extension DesktopSession {
    func withPrior(_ ids: [String]) -> DesktopSession { var s = self; s.priorCliIds = ids; return s }
}
