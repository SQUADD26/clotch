// figma: 78-61703
// figma: 78-62207
import SwiftUI
import ClotchCore

private typealias T = FigmaToken.MacOS27GoldenGate

/// The line under the closed notch while the voice says something that needs Roberto (#235, #236), Figma 78-61703 (and the
/// error 78-61932): who and what, the thing, and the button that acts. A click on the line does what its last button does.
struct NotchAlertNote: View {
    let event: VoiceEvent
    let state: VoiceAlertBar.State
    var act: (VoiceAlertText.Action) -> Void = { _ in }
    @ObservedObject private var adhd = AdhdStore.shared

    var body: some View {
        let row = adhd.items.first { $0.id == event.proof && $0.answered }
        if let t = VoiceAlertText(event, question: row?.question, answer: row?.answer) {
            VStack(alignment: .leading, spacing: T.notchSpazio6) {
                switch state {
                case .failed(let reason):
                    AlertLine("Ok non dato", size: T.notchTesto14, weight: .semibold, color: T.notchBianco)
                    AlertLine(reason, size: T.notchTesto12, weight: .medium, color: T.notchBiancoA60)
                    AlertButtons(items: [("Riprova", true, .giveOk), ("Apri chat", false, .openChat)], act: act)
                case .done:
                    AlertLine("Ok dato", size: T.notchTesto11, weight: .semibold, color: T.notchVerde)
                    AlertLine("\(t.who) è ripartita.", size: T.notchTesto14, weight: .medium, color: T.notchBiancoA92)
                case .shown, .sending:
                    AlertLine(t.label, size: T.notchTesto11, weight: .semibold, color: T.notchBiancoA60)
                    AlertLine(t.text, size: T.notchTesto14, weight: .medium, color: T.notchBiancoA92)
                    if !t.detail.isEmpty { AlertLine(t.detail, size: T.notchTesto12, weight: .medium, color: T.notchBiancoA60) }
                    if state == .sending {
                        AlertButtons(items: [("Inviando l’ok…", false, nil)], act: act)
                    } else {
                        AlertButtons(items: t.actions.enumerated().map { ($0.element.title, $0.offset == 0, $0.element) }, act: act)
                    }
                }
            }
            .padding(.horizontal, T.notchSpazio20)
            .padding(.top, T.notchSpazio4)
            .padding(.bottom, T.notchSpazio16)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
            .onTapGesture { if state == .shown, let last = t.actions.last { act(last) } }
        }
    }
}

/// In the open notch, above the tab: the oks and the stuck sessions still waiting for Roberto (#236, Figma 78-62207).
struct NotchAlertInbox: View {
    let items: [VoiceEvent]
    let sending: VoiceEvent?
    let failed: (VoiceEvent, String)?
    var act: (VoiceEvent, VoiceAlertText.Action) -> Void = { _, _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: T.notchSpazio12) {
            ForEach(items, id: \.id) { e in
                if let t = VoiceAlertText(e) {
                    HStack(alignment: .center, spacing: T.notchSpazio16) {
                        VStack(alignment: .leading, spacing: T.notchSpazio4) {
                            AlertLine(t.label, size: T.notchTesto14, weight: .medium, color: T.notchBiancoA92)
                            if let f = failed, f.0 == e {
                                AlertLine(f.1, size: T.notchTesto12, weight: .medium, color: T.notchRosso)
                            } else {
                                AlertLine(t.text, size: T.notchTesto12, weight: .medium, color: T.notchBiancoA60)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        AlertButtons(items: sending == e ? [("Inviando l’ok…", false, nil)]
                                     : t.actions.map { ($0.title, $0 == .giveOk, $0) }, top: 0, act: { act(e, $0) })
                    }
                }
            }
        }
        .padding(.vertical, T.notchSpazio12)
        .padding(.horizontal, T.notchSpazio16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: T.notchRaggio14).fill(T.notchBiancoA7))
    }
}

extension VoiceAlertText.Action {
    var title: String {
        switch self {
        case .giveOk: return "Dai l’ok"
        case .openChat: return "Apri chat"
        case .openAdhd: return "Apri ADHD"
        }
    }
}

private struct AlertLine: View {
    let text: String
    let size: CGFloat
    let weight: Font.Weight
    let color: Color
    init(_ text: String, size: CGFloat, weight: Font.Weight, color: Color) {
        self.text = text; self.size = size; self.weight = weight; self.color = color
    }

    var body: some View {
        Text(text).font(.system(size: size, weight: weight)).foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The white button first (the move), the grey ones after; nil action = a label that cannot be pressed (sending).
private struct AlertButtons: View {
    let items: [(String, Bool, VoiceAlertText.Action?)]
    var top: CGFloat = T.notchSpazio4
    let act: (VoiceAlertText.Action) -> Void

    var body: some View {
        HStack(spacing: T.notchSpazio8) {
            ForEach(items.indices, id: \.self) { i in
                let (title, primary, action) = items[i]
                Button { if let action { act(action) } } label: {
                    Text(title).font(.system(size: T.notchTesto11, weight: .semibold))
                        .foregroundStyle(primary ? T.notchNero : T.notchBiancoA92)
                        .padding(.horizontal, T.notchSpazio10)
                        .frame(height: T.notchMisura22)
                        .background(RoundedRectangle(cornerRadius: T.notchRaggio11).fill(primary ? T.notchBiancoA94 : T.notchBiancoA12))
                }
                .buttonStyle(.plain)
                .disabled(action == nil)
            }
        }
        .padding(.top, top)
    }
}
