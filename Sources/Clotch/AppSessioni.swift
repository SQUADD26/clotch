import AppKit

/// L'app «clotch» (sessioni, Electron) viaggia dentro Clotch.app (#465). Il notch non la avvia mai da solo: questa è l'unica porta, chiamata solo su richiesta.
enum AppSessioni {
    /// Helpers/ è dove codesign si aspetta codice annidato (come clotch-bridge); Resources/ no, e il Gatekeeper non lo firma.
    static func url(in bundle: Bundle = .main) -> URL? {
        let app = bundle.bundleURL.appendingPathComponent("Contents/Helpers/clotch.app", isDirectory: true)
        return FileManager.default.fileExists(atPath: app.path) ? app : nil
    }

    /// Apre l'app incorporata; se è già aperta la porta davanti (activates). False se questo Clotch non la contiene (build da `swift run`).
    @discardableResult
    static func apri(in bundle: Bundle = .main) -> Bool {
        guard let app = url(in: bundle) else { return false }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.openApplication(at: app, configuration: configuration)
        return true
    }
}
