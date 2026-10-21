import SwiftUI
import ClotchCore

/// «Avvisami quando…» (#57, #95): the list of `~/.config/voce/avvisi.json`, the file claude-config's `avvisami` writes.
/// Claude sets the alerts; the page only shows them and removes one (Roberto, #95: «Sarà il Claude dell'utente […] che imposta ste cose qui»).
/// Each one is said once, when its fact happens (`VoiceAlertRule.fires`).
struct VoiceAlertsSection: View {
    let sessions: [DesktopSession]
    @Binding var note: String?
    @ObservedObject private var l10n = L10n.shared
    private let files = VoiceFiles()

    @State private var rules: [VoiceAlertRule] = []

    var body: some View {
        SettingsRow(l10n["voice_alerts"]) {
            VStack(spacing: 0) {
                if rules.isEmpty {
                    Text(l10n["voice_alerts_empty"]).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(EdgeInsets(top: 7, leading: 10, bottom: 7, trailing: 10))
                }
                ForEach(Array(rules.enumerated()), id: \.element.id) { i, r in
                    if i > 0 { Divider() }
                    row(r)
                }
            }
            .background(RoundedRectangle(cornerRadius: 8).fill(Color(nsColor: .controlBackgroundColor)))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(nsColor: .separatorColor)))
            SettingsNote(l10n["voice_alerts_ask"] + " " + l10n["voice_alerts_footer"])
        }
        .onAppear { rules = VoiceAlertRule.parse(file()) }
    }

    private func row(_ r: VoiceAlertRule) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(r.when.map { "\(label($0)) · \(shown(r))" } ?? r.text)
                Text("\(l10n["voice_alert_text"]): \(r.text)" + (r.fired ? " · \(l10n["voice_alert_fired"])" : ""))
                    .font(.system(size: 11)).foregroundStyle(.secondary)
            }
            Spacer()
            Button { remove(r) } label: { Image(systemName: "trash") }
                .buttonStyle(.borderless)
                .foregroundStyle(.secondary)
                .help(l10n["voice_alert_remove"])
                .accessibilityLabel(l10n["voice_alert_remove"])
        }
        .padding(EdgeInsets(top: 7, leading: 10, bottom: 7, trailing: 10))
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
            guard let next = VoiceAlertRule.removing(r.id, from: file()) else { throw CocoaError(.fileReadCorruptFile) }
            try files.write(next, to: files.alertsURL)
            rules = VoiceAlertRule.parse(next)
            note = l10n["voice_alert_removed"]
        } catch {
            note = l10n["voice_alert_not_saved"]
        }
    }
}
