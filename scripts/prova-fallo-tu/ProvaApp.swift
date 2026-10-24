// App di prova per «fallo tu» (#1137): tre passi innocui e un bottone «Elimina tutto» finto.
// Ogni clic aggiunge una riga a /tmp/prova-fallo-tu.log, così si vede cosa è successo davvero.
import AppKit

final class Delegato: NSObject, NSApplicationDelegate {
    let campo = NSTextField(frame: NSRect(x: 20, y: 150, width: 260, height: 24))
    let stato = NSTextField(labelWithString: "pronto")
    var finestra: NSWindow!

    func registra(_ s: String) {
        let riga = "\(Date().timeIntervalSince1970) \(s)\n"
        if let h = FileHandle(forWritingAtPath: "/tmp/prova-fallo-tu.log") { h.seekToEndOfFile(); h.write(Data(riga.utf8)); try? h.close() }
        else { try? riga.write(toFile: "/tmp/prova-fallo-tu.log", atomically: true, encoding: .utf8) }
        stato.stringValue = s
    }
    @objc func uno() { registra("premuto Uno") }
    @objc func due() { registra("premuto Due, campo=\(campo.stringValue)") }
    @objc func elimina() { registra("ELIMINATO tutto") }

    func applicationDidFinishLaunching(_ n: Notification) {
        finestra = NSWindow(contentRect: NSRect(x: 200, y: 200, width: 300, height: 220), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        finestra.title = "Prova fallo tu"
        let v = finestra.contentView!
        func bottone(_ t: String, _ y: CGFloat, _ a: Selector) {
            let b = NSButton(title: t, target: self, action: a); b.frame = NSRect(x: 20, y: y, width: 140, height: 28); v.addSubview(b)
        }
        bottone("Uno", 180, #selector(uno)); bottone("Due", 110, #selector(due)); bottone("Elimina tutto", 70, #selector(elimina))
        v.addSubview(campo); stato.frame = NSRect(x: 20, y: 20, width: 260, height: 24); v.addSubview(stato)
        finestra.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
let app = NSApplication.shared
let d = Delegato(); app.delegate = d; app.setActivationPolicy(.regular); app.run()
