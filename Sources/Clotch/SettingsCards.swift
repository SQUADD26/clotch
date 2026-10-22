// figma: 91-64184
import SwiftUI
import AppKit

private typealias T = FigmaToken.MacOS27GoldenGate

extension Font {
    /// The system font at a Figma size: SF Pro, regular or semibold.
    static func settings(_ size: CGFloat, semibold: Bool = false) -> Font {
        Font(NSFont.systemFont(ofSize: size, weight: semibold ? .semibold : .regular))
    }
}

extension View {
    /// SwiftUI sets 11 and 12 pt text one point taller per line than the Figma line height (13 and 14): take it back.
    func figmaLineHeight() -> some View {
        lineSpacing(-FigmaToken.MacOS27GoldenGate.notchSpazio1).padding(.bottom, -FigmaToken.MacOS27GoldenGate.notchSpazio1)
    }
}

/// A page of «Impostazioni di Clotch» in the approved style (Figma 91-64184 and its siblings): coloured icon, title and
/// description on top, then groups of cards. The window decides the width; the parity test draws it at the Figma width.
struct SettingsCardPage<Content: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    let summary: String
    var width: CGFloat = ClotchSettingsWindow.width
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio20) {
            VStack(spacing: T.notchSpazio8) {
                RoundedRectangle(cornerRadius: T.notchRaggio14).fill(tint)
                    .frame(width: T.impostazioniMisura56, height: T.impostazioniMisura56)
                    .overlay(Image(systemName: symbol).font(.settings(T.notchTesto30)).foregroundStyle(T.notchBianco))
                Text(title).font(.settings(T.impostazioniTesto22, semibold: true)).foregroundStyle(T.testoPrimario)
                Text(summary).font(.settings(T.notchTesto12)).foregroundStyle(T.testoSecondario)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true).figmaLineHeight()
            }
            .frame(maxWidth: .infinity)
            content
        }
        .padding(.horizontal, T.notchSpazio24)
        .padding(.vertical, T.impostazioniSpazio28)
        .frame(width: width, alignment: .top)
        .fixedSize(horizontal: false, vertical: true)
        .background(T.finestraFondo)
    }
}

/// An optional small title and one card; the rows inside are split by `CardDivider`.
struct SettingsGroup<Content: View>: View {
    var title: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio6) {
            if let title {
                Text(title).font(.settings(T.notchTesto12, semibold: true)).foregroundStyle(T.testoSecondario)
                    .figmaLineHeight().accessibilityAddTraits(.isHeader)
            }
            VStack(spacing: 0) { content }
                .frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: T.notchRaggio10).fill(T.campoFondo))
        }
    }
}

struct CardDivider: View {
    var body: some View {
        Rectangle().fill(T.lineaSeparatore).frame(height: T.notchSpessore1).padding(.leading, T.notchSpazio16)
    }
}

/// The label and its small grey note; shared by the two row shapes.
private struct CardLabel: View {
    let title: String
    let note: String?

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio2) {
            Text(title).font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
            if let note {
                Text(note).font(.settings(T.notchTesto11)).foregroundStyle(T.testoSecondario)
                    .fixedSize(horizontal: false, vertical: true).figmaLineHeight()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Label and note on the left, the control on the right.
struct CardRow<Control: View>: View {
    let title: String
    var note: String?
    @ViewBuilder var control: Control

    var body: some View {
        HStack(spacing: T.notchSpazio16) {
            CardLabel(title: title, note: note)
            control
        }
        .padding(.horizontal, T.notchSpazio16).padding(.vertical, T.notchSpazio10)
    }
}

/// Label and note on top, the content under them, full width.
struct CardStackRow<Content: View>: View {
    let title: String
    var note: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio10) {
            CardLabel(title: title, note: note)
            content
        }
        .padding(.horizontal, T.notchSpazio16).padding(.vertical, T.notchSpazio10)
    }
}

struct CardSwitchStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            RoundedRectangle(cornerRadius: T.notchRaggio11).fill(configuration.isOn ? T.accento : T.traccia)
                .frame(width: T.notchMisura38, height: T.notchMisura22)
                .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                    Circle().fill(T.manopola).frame(width: T.impostazioniMisura18, height: T.impostazioniMisura18)
                        .padding(T.notchSpazio2)
                }
        }
        .buttonStyle(.plain)
        .accessibilityRepresentation { Toggle(isOn: configuration.$isOn) { configuration.label } }
    }
}

struct CardSwitch: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(label, isOn: $isOn).toggleStyle(CardSwitchStyle()).labelsHidden()
    }
}

/// A pop-up menu drawn as the Figma «Menu a comparsa»; the native menu opens under it.
struct CardMenu<Value: Hashable>: View {
    let label: String
    @Binding var selection: Value
    let options: [(Value, String)]
    var width: CGFloat = T.impostazioniMisura180
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Menu {
            Picker(label, selection: $selection) { ForEach(options, id: \.0) { Text($0.1).tag($0.0) } }
                .pickerStyle(.inline).labelsHidden()
        } label: {
            HStack {
                Text(options.first { $0.0 == selection }?.1 ?? "").font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down").font(.settings(T.notchTesto9, semibold: true)).foregroundStyle(T.icona)
            }
            .padding(.leading, T.notchSpazio10).padding(.trailing, T.notchSpazio8).padding(.vertical, T.notchSpazio4)
            .frame(width: width, height: T.impostazioniMisura26)
            .background(RoundedRectangle(cornerRadius: T.notchRaggio6).fill(T.segmentoFondo))
        }
        .menuStyle(.button).buttonStyle(.plain).menuIndicator(.hidden).fixedSize()
        .opacity(isEnabled ? 1 : T.impostazioniOpacita40 / 100)
        .accessibilityLabel(label)
    }
}

/// The «Campo»: a value or a text field on a small rounded well.
struct CardField<Content: View>: View {
    var width: CGFloat
    var fill: Color = T.selezioneFondo
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(.horizontal, T.notchSpazio10).padding(.vertical, T.notchSpazio4)
            .frame(width: width, height: T.impostazioniMisura26, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: T.notchRaggio6).fill(fill))
    }
}

struct CardButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
                .padding(.horizontal, T.notchSpazio12).padding(.vertical, T.notchSpazio4)
                .background(RoundedRectangle(cornerRadius: T.notchRaggio6).fill(T.segmentoFondo))
        }
        .buttonStyle(.plain)
    }
}

/// A coloured dot and a word: the state of a key or of a permission.
struct CardStatus: View {
    let ok: Bool
    let text: String

    var body: some View {
        HStack(spacing: T.notchSpazio6) {
            Circle().fill(ok ? T.statoOk : T.errore).frame(width: T.impostazioniMisura8, height: T.impostazioniMisura8)
            Text(text).font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
        }
    }
}

/// The «Cursore»: a 4 pt track, the filled part in the accent, a round knob with a thin ring.
struct CardSlider: View {
    @Binding var value: Double
    let range: ClosedRange<Double>
    var step: Double
    let label: String
    var onEnd: () -> Void = {}

    var body: some View {
        let knob = T.impostazioniMisura16, width = T.impostazioniMisura186
        let fraction = (value - range.lowerBound) / (range.upperBound - range.lowerBound)
        let filled = CGFloat(fraction) * (width - knob)
        let half = knob / 2
        ZStack(alignment: .leading) {
            HStack(spacing: 0) {
                Rectangle().fill(T.accento).frame(width: filled + half, height: T.impostazioniMisura4)
                Rectangle().fill(T.traccia).frame(height: T.impostazioniMisura4)
            }
            .clipShape(RoundedRectangle(cornerRadius: T.notchRaggio2))
            Circle().fill(T.manopola).overlay(Circle().strokeBorder(T.traccia, lineWidth: T.notchSpessore1))
                .frame(width: knob, height: knob).offset(x: filled)
        }
        .frame(width: width, height: knob)
        .contentShape(Rectangle())
        .gesture(DragGesture(minimumDistance: 0).onChanged { g in
            let f = min(max(Double((g.location.x - half) / (width - knob)), 0), 1)
            let raw = range.lowerBound + f * (range.upperBound - range.lowerBound)
            value = min(max((raw / step).rounded() * step, range.lowerBound), range.upperBound)
        }.onEnded { _ in onEnd() })
        .accessibilityElement().accessibilityLabel(label).accessibilityValue(Text(value, format: .number))
        .accessibilityAdjustableAction { direction in
            value = min(max(value + (direction == .increment ? step : -step), range.lowerBound), range.upperBound)
            onEnd()
        }
    }
}
