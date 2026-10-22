import Foundation

/// Roberto's answer to a proposed goal, from the notch (#20): `obiettivo-guard.py conferma | rifiuta`
/// (claude-config#1807). «Accetta» makes the proposal the fixed goal, signed «da roberto»; «Rifiuta» sets it
/// «rifiutato» (never shown) or drops a proposal beside the open goal. Exit 0 = written, 1 = nothing pending.
/// The notch keeps no memory of a refusal: the proposal leaves when the register drops it (#171).
public enum GoalDecision {
    /// `python3` arguments; nil when the row proposes nothing. Run them without CLAUDE_CODE_SESSION_ID:
    /// with it the command takes the caller for a master and refuses (exit 3).
    public static func acceptArguments(_ row: GoalRow, home: String) -> [String]? { arguments("conferma", row, home) }
    public static func rejectArguments(_ row: GoalRow, home: String) -> [String]? { arguments("rifiuta", row, home) }

    /// Roberto writes the goal himself (#36): `conferma --sessione ID "testo"` makes the text the fixed goal, signed
    /// «da roberto», no proposal first. nil when there is nothing new to write.
    public static func writeArguments(_ row: GoalRow, text: String, home: String) -> [String]? {
        let t = text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return t.isEmpty || (t == row.goal && !row.proposed) ? nil : [home + "/.claude/hooks/obiettivo-guard.py", "conferma", "--sessione", row.id, t]
    }

    /// Roberto ticks a proof that has no command (#237): `prove --sessione ID fatta N`. From a terminal with no session the engine
    /// lets him tick his own. nil for a proof that is not his to tick or not read from a file.
    public static func proofArguments(_ row: GoalRow, proof: GoalProof, home: String) -> [String]? {
        proof.waitsForRoberto && proof.index > 0 ? [home + "/.claude/hooks/obiettivo-guard.py", "prove", "--sessione", row.id, "fatta", String(proof.index)] : nil
    }

    private static func arguments(_ command: String, _ row: GoalRow, _ home: String) -> [String]? {
        row.proposal.map { _ in [home + "/.claude/hooks/obiettivo-guard.py", command, "--sessione", row.id] }
    }
}
