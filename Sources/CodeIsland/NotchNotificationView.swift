import SwiftUI
import CodeIslandCore

/// One notification: a line under the closed notch. It arrives in its old state, the change lands
/// (the request is struck through and turns green, the goal's ring fills, the PR turns «Unita»), then the
/// line folds back into the notch and only the result symbol stays a moment (`ResultMark`).
struct NotchNotificationView: View {
    let event: NotchEvent
    let phase: NotePhase
    let rows: [GoalRow]
    let requests: [UserRequest]

    var body: some View {
        if let note = Note(event: event, rows: rows, requests: requests) {
            let done = phase >= .settle
            HStack(spacing: 10) {
                Group {
                    if let row = note.row {
                        GoalRing(progress: done ? row.progress : note.before, color: row.ink, size: 15, line: 2.5)
                    } else {
                        Image(systemName: done ? note.symbol : note.startSymbol)
                            .font(.system(size: 15))
                            .foregroundStyle(done ? note.color : GoalInk.secondary)
                            .contentTransition(.symbolEffect(.replace))
                    }
                }
                .frame(width: 16)
                Text(note.text)
                    .font(NotchType.bodyEmphasis)
                    .strikethrough(done && note.strikes, color: GoalInk.secondary)
                    .foregroundStyle(done && note.strikes ? GoalInk.secondary : GoalInk.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(done ? note.label : note.startLabel)
                    .font(NotchType.caption)
                    .foregroundStyle(done ? note.color : GoalInk.secondary)
                    .contentTransition(.interpolate)
            }
            .padding(.horizontal, 18)
            .frame(height: 36)
            .padding(.bottom, 4)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(note.text + ". " + note.label)
        }
    }
}

/// The result symbol left in the closed notch while the line folds away.
struct ResultMark: View {
    let event: NotchEvent
    let rows: [GoalRow]

    var body: some View {
        let color = event.kind == .prMerged ? NoteColor.merged
            : rows.first { $0.id == event.subject }.map(\.ink) ?? GoalTone.go.color
        Image(systemName: event.kind == .prMerged ? "arrow.triangle.merge" : "checkmark.circle.fill")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(color)
    }
}

enum NoteColor {
    /// GitHub's merged purple, lifted for black.
    static let merged = Color(red: 191 / 255, green: 90 / 255, blue: 242 / 255)
}

/// What a notification says, read from the live data at display time.
private struct Note {
    let text: String
    let startLabel: String
    let label: String
    let startSymbol: String
    let symbol: String
    let color: Color
    let strikes: Bool
    let row: GoalRow?
    let before: Double?

    init?(event: NotchEvent, rows: [GoalRow], requests: [UserRequest]) {
        switch event.kind {
        case .requestTaken:
            guard let request = requests.first(where: { $0.id == event.subject }) else { return nil }
            self.init(text: request.text, startLabel: "In attesa", label: "Presa in carico", startSymbol: "circle",
                      symbol: "checkmark.circle.fill", color: GoalTone.go.color, strikes: true, row: nil, before: nil)
        case .prMerged:
            let title = event.text.isEmpty ? "Pull request #\(event.count)" : "#\(event.count) \(event.text)"
            self.init(text: title, startLabel: "In corso", label: "Unita", startSymbol: "arrow.triangle.pull",
                      symbol: "arrow.triangle.merge", color: NoteColor.merged, strikes: false, row: nil, before: nil)
        case .proofDone, .still, .blocked, .reached:
            guard let row = rows.first(where: { $0.id == event.subject }) else { return nil }
            // The ring starts from the count before this proof, so the fill is the news.
            let before = event.kind == .proofDone && row.proofsTotal > 0
                ? Double(max(row.proofsDone - 1, 0)) / Double(row.proofsTotal) : row.progress
            let label = event.kind == .proofDone ? "Prova fatta, \(row.proofsDone) su \(row.proofsTotal)" : row.statusLabel
            self.init(text: row.title, startLabel: row.proofsSentence, label: label, startSymbol: "", symbol: "",
                      color: row.ink, strikes: false, row: row, before: before)
        }
    }

    private init(text: String, startLabel: String, label: String, startSymbol: String, symbol: String, color: Color,
                 strikes: Bool, row: GoalRow?, before: Double?) {
        self.text = text
        self.startLabel = startLabel
        self.label = label
        self.startSymbol = startSymbol
        self.symbol = symbol
        self.color = color
        self.strikes = strikes
        self.row = row
        self.before = before
    }
}
