import Foundation

/// Text made for the screen, made fit for the ear: Clean View's `riscrivi` and `parlata` (claude-config `voce.ts`), applied
/// to the report before Haiku and to Haiku's answer before ElevenLabs (#50). No keys, paths, links, hashes, PR or issue numbers, code.
public enum VoiceClean {
    /// A key, a token, a password in a link: never sent to Haiku, never said.
    static let secrets = [#"\b(?:sk|pk|rk)[-_][\w-]{8,}"#, #"\bgh[pousr]_\w{8,}"#, #"\beyJ[\w-]{10,}\.[\w.-]+"#, #"(?i)\bBearer\s+\S+"#,
                          #"(?i)\bxi-api-key\b"#, #"\b[A-Fa-f0-9]{32,}\b"#, #"\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{32,}\b"#,
                          #"(?i)[?&](?:token|key|api[_-]?key|secret|sig|signature|password|access_token|auth)="#,
                          #"://[^\s/@]+:[^\s/@]+@"#, #"-----BEGIN [A-Z ]*PRIVATE KEY-----"#]
    private static let path = #"(?<![\p{L}\p{N}_)])(?:~|\.{1,2})?/[\w.@-]+(?:/[\w.@-]*)*|\b(?:fix|feat|chore|docs|test|refactor|claude)/[\w./-]+|\b[\w.-]+/[\w.-]*\.\w+\b|\b(?:[\w.-]+/){2,}[\w.-]*"#
    private static let file = #"\b[\w-]+\.(?:tsx?|jsx?|py|md|json|sh|ya?ml|log|txt|plist|toml|html|css|mp3|swift)\b"#
    private static let operative = #"(?i)\b(?:terminale|terminal|shell|bash|zsh|sudo|comando|comandi|prompt|console|incolla\w*|copia\w*|apri\w*|lancia\w*|esegui\w*|digita\w*|premi\w*|clicca\w*|scrivi|inserisci\w*|installa\w*|avvia\w*)\b|(?:^|[.!?]\s*)prova\s*:"#

    public static func hasSecret(_ t: String) -> Bool { secrets.contains { t.range(of: $0, options: .regularExpression) != nil } }

    /// Text to say: a sentence with an order about hands or keyboard is dropped (#73: never a fixed line in its place);
    /// the rest is cleaned. "" = nothing left to say.
    public static func spoken(_ raw: String) -> String {
        let sentences = raw.replacingOccurrences(of: #"([.!?])\s+"#, with: "$1\n", options: .regularExpression).split(separator: "\n")
        return clean(sentences.filter { $0.range(of: operative, options: .regularExpression) == nil }.joined(separator: " "))
    }

    public static func clean(_ raw: String) -> String {
        var t = secrets.reduce(raw) { re($0, $1, "una chiave") }
        t = re(t, "```[\\s\\S]*?```", " ")
        t = re(t, #"\[([^\]]*)\]\([^)]*\)"#, "$1")
        t = re(t, #"(?i)https?://\S+|www\.\S+"#, " ")
        t = sub(t, "`([^`]*)`") { m in  // inline code: a plain word stays, a command, path or hash goes
            let c = String(m.dropFirst().dropLast())
            return c.range(of: #"^[A-Za-zÀ-ÿ' -]+$"#, options: .regularExpression) != nil ? c : " "
        }
        t = re(t, #"(?i)\b(?:PR|pull request)\s*#?\d+"#, "la modifica")
        t = re(t, #"(?i)\b(?:issue|ticket|richiesta)\s*#?\d+"#, "la richiesta")
        t = re(t, #"#\d+"#, " ")
        t = sub(t, path) { m in "un file" + (m.range(of: "[.,;:]+$", options: .regularExpression).map { String(m[$0]) } ?? "") }
        t = re(t, file, "un file")
        t = re(t, #"(?i)\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b"#, " ")
        t = re(t, #"\b\d{4,}\b"#, " ")
        t = re(t, #"\s*(?:→|->|=>)\s*"#, ", ")
        t = re(t, #"(?i)\s*\((?:sì|si)\)\s*$"#, " Io consiglio di sì.")
        t = re(t, #"(?i)\s*\(no\)\s*$"#, " Io consiglio di no.")
        t = re(t, #"(?i)\s*\(scegli tu\)\s*$"#, " Per me è uguale.")
        t = t.components(separatedBy: .newlines)
            .map { re($0, #"^[\s>*•-]+"#, "").trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .map { $0.range(of: "[.!?:;]$", options: .regularExpression) != nil ? $0 : $0 + "." }
            .joined(separator: " ")
        for (p, r) in [(#"[^\p{L}\p{N}\s.,;:!?'’"«»()\-–%€]"#, " "), (#"\(\s*\)"#, " "), (#"\(\s+"#, "("), (#"\s+\)"#, ")"),
                       (#"\s+([.,;:!?])"#, "$1"), (#"([.,;:!?])(?:\s*[.,;:])+"#, "$1"), (#"(un file)(?:[\s,]*un file)+"#, "$1"),
                       (#"\s+"#, " "), (#"^[\s.,;:!?-]+"#, "")] {
            t = re(t, p, r)
        }
        return t.trimmingCharacters(in: .whitespaces)
    }

    private static func re(_ s: String, _ pattern: String, _ template: String) -> String {
        s.replacingOccurrences(of: pattern, with: template, options: .regularExpression)
    }

    private static func sub(_ s: String, _ pattern: String, _ f: (String) -> String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return s }
        let ns = s as NSString
        var out = "", last = 0
        for m in regex.matches(in: s, range: NSRange(location: 0, length: ns.length)) {
            out += ns.substring(with: NSRange(location: last, length: m.range.location - last)) + f(ns.substring(with: m.range))
            last = m.range.location + m.range.length
        }
        return out + ns.substring(from: last)
    }
}
