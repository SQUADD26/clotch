import SwiftUI
import ClotchCore

/// «Avvisami quando…» (#57): the custom alerts of `~/.config/voce/avvisi.json`, the same file claude-config's
/// `avvisami` writes. Each one is said once, when its fact happens (`VoiceAlertRule.fires`).
struct VoiceAlertsSection: View {
    let sessions: [DesktopSession]
    @Binding var note: String?
    @ObservedObject private var l10n = L10n.shared
    private let files = VoiceFiles()

    @State private var rules: [VoiceAlertRule] = []
    @State private var text = ""
    @State private var when = VoiceAlertRule.When.prMerged
    @State private var value = ""

    var body: some View {
        Section {
            if rules.isEmpty {
                Text(l10n["voice_alerts_empty"]).foregroundStyle(.secondary)
            }
            ForEach(rules) { r in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.text)
                        if let w = r.when { Text("\(label(w)): \(shown(r))").font(.system(size: 11)).foregroundStyle(.secondary) }
                    }
                    Spacer()
                    if r.fired { Text(l10n["voice_alert_fired"]).font(.system(size: 11)).foregroundStyle(.secondary) }
                    Button { save(VoiceAlertRule.removing(r.id, from: file()), done: "voice_alert_removed") } label: { Image(systemName: "trash") }
                        .buttonStyle(.borderless)
                        .help(l10n["voice_alert_remove"])
                        .accessibilityLabel(l10n["voice_alert_remove"])
                }
            }
            TextField(l10n["voice_alert_text"], text: $text, prompt: Text(l10n["voice_alert_text_prompt"]))
            Picker(l10n["voice_alert_when"], selection: $when) {
                ForEach(VoiceAlertRule.When.allCases, id: \.self) { Text(label($0)).tag($0) }
            }
            if when == .sessionStill {
                Picker(l10n["voice_alert_session"], selection: $value) {
                    if sessions.isEmpty { Text(l10n["voice_alert_no_sessions"]).tag("") }
                    ForEach(sessions, id: \.localId) { s in Text(s.title.isEmpty ? l10n["voice_alert_untitled"] : s.title).tag(s.localId) }
                }
            } else {
                TextField(l10n[valuePrompt], text: $value, prompt: Text(l10n[valuePrompt]))
                    .labelsHidden()
            }
            HStack {
                Spacer()
                Button(l10n["voice_alert_add"], action: add).disabled(!valid)
            }
        } header: {
            Text(l10n["voice_alerts"])
        } footer: {
            Text(l10n["voice_alerts_footer"])
        }
        .onAppear { rules = VoiceAlertRule.parse(file()) }
        .onChange(of: when) { value = "" }
    }

    private func label(_ w: VoiceAlertRule.When) -> String {
        l10n[[.prMerged: "voice_alert_when_pr", .sessionStill: "voice_alert_when_session", .file: "voice_alert_when_file",
              .time: "voice_alert_when_time", .word: "voice_alert_when_word"][w]!]
    }

    private var valuePrompt: String {
        [.prMerged: "voice_alert_value_pr", .file: "voice_alert_value_file", .time: "voice_alert_value_time"][when] ?? "voice_alert_value_word"
    }

    /// A session rule shows the session's title, not its id.
    private func shown(_ r: VoiceAlertRule) -> String {
        guard r.when == .sessionStill else { return r.value }
        return sessions.first { $0.localId == r.value || $0.cliId == r.value }?.title ?? r.value
    }

    private var valid: Bool {
        let v = value.trimmingCharacters(in: .whitespaces)
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty, !v.isEmpty else { return false }
        return when != .time || v.range(of: #"^([01]?\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) != nil
    }

    private func add() {
        let rule = VoiceAlertRule(id: VoiceAlertRule.newId(), text: text.trimmingCharacters(in: .whitespaces),
                                  when: when, value: value.trimmingCharacters(in: .whitespaces), created: Date())
        save(VoiceAlertRule.adding(rule, to: file()), done: "voice_alert_added")
        text = ""
        value = ""
    }

    /// Read again before each change: `avvisami` or the speaker may have written the file since the page opened.
    private func file() -> Data? { try? Data(contentsOf: files.alertsURL) }

    /// nil = the file is broken: never overwritten.
    private func save(_ next: Data?, done: String) {
        do {
            guard let next else { throw CocoaError(.fileReadCorruptFile) }
            try files.write(next, to: files.alertsURL)
            rules = VoiceAlertRule.parse(next)
            note = l10n[done]
        } catch {
            note = l10n["voice_alert_not_saved"]
        }
    }
}
