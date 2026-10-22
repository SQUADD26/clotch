import Foundation

/// What the line under the notch writes for an event the voice said (#235, #236; Figma 78-61664): who and what in small grey,
/// the thing in white, an optional detail, and the one button that acts on it. Only the three kinds that need Roberto have a line.
public struct VoiceAlertText: Equatable, Sendable {
    public enum Action: Equatable, Sendable { case giveOk, openChat, openAdhd }

    /// The session, in plain words («Setup»); "" for an ADHD answer.
    public let who: String
    public let label: String
    public let text: String
    public let detail: String
    public let actions: [Action]
    /// The Claude session the buttons reach; "" = none (an ADHD answer).
    public let localId: String

    /// `question`/`answer`: the ADHD row with the event's `prova` id, when the tab has it (the event's `soggetto` is cut at 80).
    public init?(_ e: VoiceEvent, question: String? = nil, answer: String? = nil) {
        // The engine's `soggetto` is the session in plain words; the title may carry the session's icon («⌘ Clotch: …»).
        let name = e.subject.isEmpty ? String(e.title.drop { !$0.isLetter && !$0.isNumber }) : e.subject
        who = e.kind == .adhdAnswer ? "" : (name.isEmpty ? "Una sessione" : name)
        switch e.kind {
        case .waitsForOk:
            // dipendenze.py: «<sessione> aspetta un tuo ok per <cosa>: vuoi che glielo dia io?»; `prova` = local_id
            label = "\(who) aspetta il tuo ok"
            text = Self.sentence(Self.between(e.text, after: "aspetta un tuo ok per ", before: ": vuoi") ?? e.text)
            detail = ""
            actions = [.giveOk, .openChat]
            localId = e.localId.isEmpty ? e.proof : e.localId
        case .stalledDependency:
            // dipendenze.py: «Una sessione aspetta te da troppo: <cosa>.»; `soggetto` = titolo
            label = "\(who) aspetta te"
            text = Self.sentence(Self.between(e.text, after: "da troppo: ", before: nil) ?? e.text)
            detail = ""
            actions = [.openChat]
            localId = e.localId
        case .adhdAnswer:
            // richieste_adhd.py: «Risposta a: <domanda chiara> <risposta>»; `soggetto` = la domanda, cut at 80; `prova` = Q-id
            label = "Risposta alla tua domanda"
            var said = e.text
            if said.hasPrefix("Risposta a: ") { said.removeFirst("Risposta a: ".count) }
            if let question, let answer {
                text = question; detail = answer
            } else if e.subject.count < Self.subjectCut, said.hasPrefix(e.subject) {
                text = e.subject; detail = String(said.dropFirst(e.subject.count)).trimmingCharacters(in: .whitespaces)
            } else {
                text = said; detail = ""  // the cut question cannot be told from the answer: the whole sentence, once
            }
            actions = [.openAdhd]
            localId = ""
        default:
            return nil
        }
    }

    /// eventi_voce.py cuts `soggetto` at this length.
    static let subjectCut = 80

    private static func between(_ s: String, after: String, before: String?) -> String? {
        guard let a = s.range(of: after) else { return nil }
        var rest = s[a.upperBound...]
        if let before, let b = rest.range(of: before) { rest = rest[..<b.lowerBound] }
        let out = rest.trimmingCharacters(in: .whitespacesAndNewlines)
        return out.isEmpty ? nil : out
    }

    /// Capital first letter and a final full stop: the line reads as a sentence.
    private static func sentence(_ s: String) -> String {
        var t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let f = t.first else { return t }
        t = f.uppercased() + t.dropFirst()
        return ".?!".contains(t.last!) ? t : t + "."
    }
}
