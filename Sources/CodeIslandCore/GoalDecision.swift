import Foundation

/// Roberto's answer to a proposed goal, from the notch (#20): `obiettivo-guard.py conferma | rifiuta`
/// (claude-config#1807). «Accetta» makes the proposal the fixed goal, signed «da roberto»; «Rifiuta» sets it
/// «rifiutato» (never shown) or drops a proposal beside the open goal. Exit 0 = written, 1 = nothing pending.
/// The notch also hides a rejected proposal at once, so the click shows before the register changes.
public enum GoalDecision {
    /// `python3` arguments; nil when the row proposes nothing. Run them without CLAUDE_CODE_SESSION_ID:
    /// with it the command takes the caller for a master and refuses (exit 3).
    public static func acceptArguments(_ row: GoalRow, home: String) -> [String]? { arguments("conferma", row, home) }
    public static func rejectArguments(_ row: GoalRow, home: String) -> [String]? { arguments("rifiuta", row, home) }

    private static func arguments(_ command: String, _ row: GoalRow, _ home: String) -> [String]? {
        row.proposal.map { _ in [home + "/.claude/hooks/obiettivo-guard.py", command, "--sessione", row.id] }
    }

    /// One proposal: a new text from the same session is a new proposal, shown again after a refusal.
    public static func key(cli: String, text: String) -> String { cli + "\n" + text }
}
