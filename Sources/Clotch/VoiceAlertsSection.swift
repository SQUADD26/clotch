// figma: 91-64814
import SwiftUI
import ClotchCore

/// «Avvisami quando…» (#57, #95): the list of `~/.config/voce/avvisi.json`, the file claude-config's `avvisami` writes.
/// Claude sets the alerts; the page only shows them and removes one (Roberto, #95: «Sarà il Claude dell'utente […] che imposta ste cose qui»).
/// Each one is said once, when its fact happens (`VoiceAlertRule.fires`).
struct VoiceAlertsSection: View {
    private typealias T = FigmaToken.MacOS27GoldenGate
    let sessions: [DesktopSession]
    @Binding var note: String?
    @ObservedObject private var l10n = L10n.shared
    var files = VoiceFiles()

    @State private var rules: [VoiceAlertRule] = []

    var body: some View {
        CardStackRow(title: l10n["voice_alerts"], note: l10n["voice_alerts_ask"] + " " + l10n["voice_alerts_footer"]) {
            VStack(spacing: 0) {
                if rules.isEmpty {
                    Text(l10n["voice_alerts_empty"]).font(.settings(T.notchTesto13)).foregroundStyle(T.testoSecondario)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, T.notchSpazio10).padding(.vertical, T.impostazioniSpazio7)
                }
                ForEach(Array(rules.enumerated()), id: \.element.id) { i, r in
                    if i > 0 { Rectangle().fill(T.lineaSeparatore).frame(height: T.notchSpessore1) }
                    row(r)
                }
            }
            .background(RoundedRectangle(cornerRadius: T.impostazioniRaggio8).fill(T.campoFondo))
            .overlay(RoundedRectangle(cornerRadius: T.impostazioniRaggio8).strokeBorder(T.campoBordo, lineWidth: T.notchSpessore1))
        }
        .onAppear { rules = VoiceAlertRule.parse(file()) }
    }

    private func row(_ r: VoiceAlertRule) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: T.notchSpazio1) {
                Text(r.when.map { "\(label($0)) · \(shown(r))" } ?? r.text).font(.settings(T.notchTesto13)).foregroundStyle(T.testoPrimario)
                    .frame(height: T.notchInterlinea17)
                Text("\(l10n["voice_alert_text"]): \(r.text)" + (r.fired ? " · \(l10n["voice_alert_fired"])" : ""))
                    .font(.settings(T.notchTesto11)).foregroundStyle(T.testoSecondario).frame(height: T.impostazioniInterlinea15)
            }
            Spacer()
            Button { remove(r) } label: { Image(systemName: "trash").font(.settings(T.notchTesto12)).foregroundStyle(T.icona) }
                .buttonStyle(.plain)
                .help(l10n["voice_alert_remove"])
                .accessibilityLabel(l10n["voice_alert_remove"])
        }
        .padding(.horizontal, T.notchSpazio10).padding(.vertical, T.impostazioniSpazio7)
    }

    private func label(_ w: VoiceAlertRule.When) -> String {
        l10n[[.prMerged: "voice_alert_when_pr", .sessionStill: "voice_alert_when_session", .file: "voice_alert_when_file",
              .time: "voice_alert_when_time", .word: "voice_alert_when_word"][w]!]
    }

    /// A session rule shows the session's title, not its id.
    private func shown(_ r: VoiceAlertRule) -> String {
        guard r.when == .sessionStill else { return r.value }
        return sessions.first { $0.localId == r.value || $0.cliId == r.value }?.title ?? r.value
    }

    /// Read again before the change: `avvisami` or the speaker may have written the file since the page opened.
    private func file() -> Data? { try? Data(contentsOf: files.alertsURL) }

    /// nil = the file is broken: never overwritten.
    private func remove(_ r: VoiceAlertRule) {
        do {
            guard let next = try files.modify(files.alertsURL, lock: "avvisi.lock", { VoiceAlertRule.removing(r.id, from: $0) }) else { throw CocoaError(.fileReadCorruptFile) }
            rules = VoiceAlertRule.parse(next)
            note = l10n["voice_alert_removed"]
        } catch {
            note = l10n["voice_alert_not_saved"]
        }
    }
}
