import SwiftUI
import CodeIslandCore

/// The three design directions of issue #3, side by side until Roberto picks one.
/// shortcut: chosen by `defaults write com.squadd.goalnotch goalDesign A|B|C`; this file and the
/// two losing directions are deleted once the choice is made.
enum GoalDesign: String, CaseIterable {
    case a = "A", b = "B", c = "C"

    static var current: GoalDesign {
        GoalDesign(rawValue: UserDefaults.standard.string(forKey: "goalDesign") ?? "") ?? .a
    }

    /// Width of each collapsed wing beside the notch: content + 8pt to the notch + 10pt outer margin.
    var wing: CGFloat {
        switch self {
        case .a: return 50
        case .b: return 46
        case .c: return 52
        }
    }

    @MainActor @ViewBuilder
    func collapsedLeading(_ rows: [GoalRow]) -> some View {
        switch self {
        case .a: GoalDesignA.Leading(rows: rows)
        case .b: GoalDesignB.Leading(rows: rows)
        case .c: GoalDesignC.Leading(rows: rows)
        }
    }

    @MainActor @ViewBuilder
    func collapsedTrailing(_ rows: [GoalRow]) -> some View {
        switch self {
        case .a: GoalDesignA.Trailing(rows: rows)
        case .b: GoalDesignB.Trailing(rows: rows)
        case .c: GoalDesignC.Trailing(rows: rows)
        }
    }

    @MainActor @ViewBuilder
    func rows(_ rows: [GoalRow], now: Date, hovered: Binding<String?>) -> some View {
        switch self {
        case .a: GoalDesignA.Rows(rows: rows, now: now, hovered: hovered)
        case .b: GoalDesignB.Rows(rows: rows, now: now, hovered: hovered)
        case .c: GoalDesignC.Rows(rows: rows, now: now, hovered: hovered)
        }
    }
}
