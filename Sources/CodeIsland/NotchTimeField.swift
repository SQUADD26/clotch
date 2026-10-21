import CodeIslandCore
import SwiftUI

/// One of the notch's two times, in ms (#68): a number field with a stepper, held in range.
struct NotchTimeField: View {
    let title: String
    @Binding var ms: Int

    var body: some View {
        let value = Binding(get: { NotchTiming.clamped(ms) }, set: { ms = NotchTiming.clamped($0) })
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField(title, value: value, format: .number.grouping(.never))
                    .labelsHidden()
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                    .frame(width: 56)
                Text("ms").foregroundStyle(.secondary)
                Stepper(title, value: value, in: NotchTiming.range, step: NotchTiming.step)
                    .labelsHidden()
            }
        }
    }
}
