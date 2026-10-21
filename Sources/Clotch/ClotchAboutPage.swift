import SwiftUI
import AppKit
import ClotchCore

/// «Informazioni» (Figma #95): logo, name, version, two lines, three links, then «Esporta diagnostica…» with its note.
struct ClotchAboutPage: View {
    @ObservedObject private var l10n = L10n.shared
    private let readOnly = UpdateChecker.shared.readOnlyInstallReason

    var body: some View {
        VStack(spacing: 6) {
            AppLogoView(size: 96)
            Text("clotch").font(.system(size: 20, weight: .semibold)).padding(.top, 12)
            Text(String(format: l10n["version_number"], AppVersion.current)).font(.system(size: 11)).foregroundStyle(.secondary)
            VStack(spacing: 6) {
                Text(l10n["about_desc1"])
                Text(l10n["about_desc2"])
            }
            .foregroundStyle(.secondary)
            .padding(.top, 6)
            HStack(spacing: 8) {
                link("GitHub", "https://github.com/SQUADD26/clotch")
                link(l10n["report_problem"], "https://github.com/SQUADD26/clotch/issues")
                link(l10n["whats_new"], ReleaseNotesLink.url(forVersion: AppVersion.current).absoluteString)
            }
            .padding(.top, 10)
            if let readOnly {
                // Clotch cannot update itself from here: say why, with the fix.
                Label(l10n[readOnlyKey(readOnly)], systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 11)).foregroundStyle(.orange).frame(width: 420).padding(.top, 10)
            }
            Divider().padding(.vertical, 12)
            Button(l10n["export_diagnostics"]) { DiagnosticsExporter.export() }
            Text(l10n["export_diagnostics_desc"])
                .font(.system(size: 11)).foregroundStyle(.secondary)
                .multilineTextAlignment(.center).frame(width: 360)
        }
        .padding(EdgeInsets(top: 28, leading: 32, bottom: 26, trailing: 32))
        .frame(width: ClotchSettingsWindow.width)
        .fixedSize(horizontal: false, vertical: true)
    }

    private func readOnlyKey(_ r: AppInstallLocation.ReadOnlyReason) -> String {
        switch r {
        case .translocated: return "readonly_location_translocated"
        case .diskImage: return "readonly_location_disk_image"
        case .readOnlyVolume: return "readonly_location_volume"
        }
    }

    private func link(_ title: String, _ url: String) -> some View {
        Button { URL(string: url).map { NSWorkspace.shared.open($0) } } label: {
            HStack(spacing: 5) {
                Text(title)
                Image(systemName: "arrow.up.right").font(.system(size: 8, weight: .semibold))
            }
        }
    }
}
