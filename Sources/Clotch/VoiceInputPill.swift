import SwiftUI
import ClotchCore

/// The pill under the notch while Roberto speaks to Clotch (#110): the level of his voice and his words as they come, then what
/// Clotch does with them. Same frame as a notch note (`NotchNotificationView`): mark, text up to three lines, label.
struct VoiceInputPill: View {
    @ObservedObject var input: VoiceInputController

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            mark
                .frame(width: 16)
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 5 }
            Text(line)
                .font(NotchType.note)
                .tracking(-0.14)
                .foregroundStyle(shown.isEmpty ? Color.white.opacity(0.5) : GoalInk.primary)
                .lineLimit(NotchEvents.noteLines)
                .truncationMode(.head)  // while speaking the newest words matter, not the first
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if label != nil {
                Text(label ?? "").font(NotchType.small).foregroundStyle(Color.white.opacity(0.5)).fixedSize()
            }
        }
        .padding(.leading, 20)
        .padding(.trailing, 24)
        .padding(.vertical, 12)
        .frame(minHeight: 42)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(line)
    }

    /// The words so far; a result line stands in for them once it arrives.
    private var shown: String {
        if case .result(let message) = input.phase { return message }
        return input.text
    }

    private var line: String {
        shown.isEmpty ? (input.phase == .finishing ? VoiceInputController.Copy.finishing : input.hint) : shown
    }

    /// While Clotch works on the words, what it does with them.
    private var label: String? {
        switch input.phase {
        case .finishing, .thinking: return input.phase == .thinking ? input.hint : VoiceInputController.Copy.finishing
        default: return nil
        }
    }

    @ViewBuilder private var mark: some View {
        switch input.phase {
        case .listening: LevelBars(level: input.level)
        case .finishing, .thinking: ProgressView().controlSize(.small).scaleEffect(0.7)
        default: Image(systemName: "waveform").font(.system(size: 15)).foregroundStyle(GoalInk.secondary)
        }
    }
}

/// Four bars that follow the microphone: each moves a little differently so a steady voice does not look frozen.
private struct LevelBars: View {
    let level: Double
    private static let shape: [Double] = [0.6, 1.0, 0.8, 0.5]

    var body: some View {
        HStack(spacing: 2) {
            ForEach(Self.shape.indices, id: \.self) { i in
                Capsule().fill(GoalInk.primary)
                    .frame(width: 2.5, height: 4 + 11 * level * Self.shape[i])
            }
        }
        .frame(height: 15)
        .animation(.easeOut(duration: 0.08), value: level)
    }
}
