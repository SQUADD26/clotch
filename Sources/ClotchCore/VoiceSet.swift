import Foundation

/// clotch#1130: «usa questa voce» from Friday. The engine only posts the request; Clotch is the one writer of `voice_id` (claude-config#2199).
public enum VoiceSet {
    public enum Outcome: Equatable {
        case set(String)
        case rejected(String)
    }

    /// `asked` is an ElevenLabs id or a voice name. `voices` = (name, id) of Roberto's account, loaded only when the ask is a name.
    /// An id (one token, no spaces) is taken as is, a name is matched exactly without case, then by prefix; no match = rejected.
    public static func resolve(_ asked: String, voices: () async -> [(name: String, id: String)]) async -> Outcome {
        let ask = asked.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !ask.isEmpty, ask.count <= 100 else { return .rejected("Voce non valida.") }
        let list = await voices()
        let key = ask.lowercased()
        if let hit = list.first(where: { $0.id == ask }) ?? list.first(where: { $0.name.lowercased() == key })
            ?? list.first(where: { $0.name.lowercased().hasPrefix(key) }) { return .set(hit.id) }
        // shortcut: an id the account list does not show (shared-library voice) is trusted when it looks like an id, not a name.
        let looksLikeId = ask.count >= 15 && ask.allSatisfy { $0.isLetter || $0.isNumber } && ask.contains { $0.isNumber }
        return looksLikeId ? .set(ask) : .rejected("Non trovo la voce \(ask).")
    }

    /// Writes the voice; returns the outcome. A wrong ask leaves config.json untouched.
    public static func apply(_ asked: String, files: VoiceFiles, voices: () async -> [(name: String, id: String)]) async -> Outcome {
        let outcome = await resolve(asked, voices: voices)
        if case .set(let id) = outcome {
            do { try files.updateConfig(["voice_id": id]) } catch { return .rejected("Impostazioni non salvate.") }
        }
        return outcome
    }
}
