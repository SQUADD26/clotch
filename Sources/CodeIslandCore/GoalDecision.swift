import Foundation

/// Roberto's answer to a proposed goal, from the notch (#20). «Accetta» runs the register's own `conferma`
/// (claude-config `obiettivo_registro.py`, the function behind his «sì» in a prompt): the goal becomes fixed,
/// signed «da roberto». The register has no refusal yet: «Rifiuta» only hides the proposal in the notch.
public enum GoalDecision {
    static let acceptScript = "import os, sys; sys.path.insert(0, os.path.expanduser('~/.claude/hooks')); "
        + "import obiettivo_registro as r; sys.exit(0 if r.conferma(sys.argv[1], sys.argv[2]) else 1)"

    /// `python3` arguments that confirm exactly the text Roberto read; nil when the row proposes nothing.
    public static func acceptArguments(_ row: GoalRow) -> [String]? {
        row.proposal.map { ["-c", acceptScript, row.id, $0] }
    }

    /// One proposal: a new text from the same session is a new proposal, shown again after a refusal.
    public static func key(cli: String, text: String) -> String { cli + "\n" + text }
}
