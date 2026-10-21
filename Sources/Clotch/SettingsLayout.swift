import SwiftUI

/// The pieces of every «Impostazioni di Clotch» page, as the approved Figma (#95): label column 150 pt right-aligned,
/// controls 12 pt to its right, rows 14 pt apart, groups split by a line, notes 11 pt under their control.
struct SettingsPage<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) { content }
            .padding(EdgeInsets(top: 22, leading: 32, bottom: 26, trailing: 32))
            .frame(width: ClotchSettingsWindow.width, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// One row: label left, its controls stacked right, aligned on the first line of text.
struct SettingsRow<Controls: View>: View {
    let label: String
    var spacing: CGFloat = 8
    @ViewBuilder var controls: Controls

    init(_ label: String, spacing: CGFloat = 8, @ViewBuilder controls: () -> Controls) {
        self.label = label
        self.spacing = spacing
        self.controls = controls()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label).frame(width: 150, alignment: .trailing)
            VStack(alignment: .leading, spacing: spacing) { controls }
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// The small grey sentence under a control.
struct SettingsNote: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(.system(size: 11)).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }
}

/// A checkbox with its note lined up under the box's text.
struct SettingsCheckbox: View {
    let title: String
    var note: String?
    @Binding var isOn: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Toggle(title, isOn: $isOn).toggleStyle(.checkbox)
            if let note { SettingsNote(note).padding(.leading, 21) }
        }
    }
}

/// A slider with its ends written under it and the value on its right.
struct SettingsSlider: View {
    @Binding var value: Double
    let range: ClosedRange<Double>
    var step: Double?
    let ticks: [String]
    var shown: String?
    var width: CGFloat = 220
    var label: String
    var onEnd: () -> Void = {}

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(spacing: 3) {
                Group {
                    if let step {
                        Slider(value: $value, in: range, step: step, onEditingChanged: { if !$0 { onEnd() } })
                    } else {
                        Slider(value: $value, in: range, onEditingChanged: { if !$0 { onEnd() } })
                    }
                }
                .labelsHidden()
                .accessibilityLabel(Text(label))
                HStack {
                    ForEach(Array(ticks.enumerated()), id: \.offset) { i, t in
                        if i > 0 { Spacer(minLength: 0) }
                        Text(t)
                    }
                }
                .font(.system(size: 11)).foregroundStyle(.secondary)
            }
            .frame(width: width)
            .alignmentGuide(.firstTextBaseline) { $0[.top] + 14 }  // the label sits on the track, not on the ticks
            if let shown { Text(shown).foregroundStyle(.secondary).monospacedDigit() }
        }
    }
}

/// Decimal numbers as the Mac writes them («0,50 s» in Italian).
func settingsDecimal(_ value: Double, _ digits: Int = 2) -> String {
    String(format: "%.\(digits)f", locale: .current, value)
}
