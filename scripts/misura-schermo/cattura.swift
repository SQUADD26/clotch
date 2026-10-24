// Cattura per la misura #1134: `cattura elenco` | `cattura <windowID> <cartella>` -> schermo.png, ritaglio.png, ax.txt
// ScreenCaptureKit per la finestra, albero di accessibilità per il testo. Servono i permessi Registrazione schermo e Accessibilità.
import Foundation
import ScreenCaptureKit
import AppKit
import ApplicationServices

func finestre() async throws -> [SCWindow] {
    try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true).windows
        .filter { $0.windowLayer == 0 && $0.frame.width > 400 && $0.frame.height > 300 && $0.owningApplication != nil }
}

func scatta(_ w: SCWindow, _ c: SCStreamConfiguration) async throws -> CGImage {
    try await withCheckedThrowingContinuation { k in
        SCScreenshotManager.captureImage(contentFilter: SCContentFilter(desktopIndependentWindow: w), configuration: c) { i, e in
            if let i { k.resume(returning: i) } else { k.resume(throwing: e ?? NSError(domain: "scatta", code: 1)) }
        }
    }
}

func png(_ img: CGImage, _ url: URL) {
    let d = NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])!
    try! d.write(to: url)
}

func ax(_ e: AXUIElement, _ depth: Int, _ out: inout [String]) {
    guard depth < 12, out.count < 400 else { return }
    func s(_ k: String) -> String? { var v: CFTypeRef?; AXUIElementCopyAttributeValue(e, k as CFString, &v); return v as? String }
    let role = s("AXRole") ?? "?"
    let txt = [s("AXTitle"), s("AXDescription"), s("AXValue"), s("AXPlaceholderValue")].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " | ")
    var pos: CFTypeRef?, size: CFTypeRef?
    AXUIElementCopyAttributeValue(e, "AXPosition" as CFString, &pos); AXUIElementCopyAttributeValue(e, "AXSize" as CFString, &size)
    var p = CGPoint.zero, z = CGSize.zero
    if let pos { AXValueGetValue(pos as! AXValue, .cgPoint, &p) }
    if let size { AXValueGetValue(size as! AXValue, .cgSize, &z) }
    if !txt.isEmpty || ["AXButton", "AXTextField", "AXCheckBox", "AXRadioButton", "AXPopUpButton", "AXMenuItem", "AXLink"].contains(role) {
        out.append(String(repeating: " ", count: depth) + "\(role) \"\(String(txt.prefix(80)))\" @\(Int(p.x)),\(Int(p.y)) \(Int(z.width))x\(Int(z.height))")
    }
    var kids: CFTypeRef?
    AXUIElementCopyAttributeValue(e, "AXChildren" as CFString, &kids)
    for k in (kids as? [AXUIElement]) ?? [] { ax(k, depth + 1, &out) }
}

let a = CommandLine.arguments
let ws = try await finestre()
if a.count < 3 {
    for w in ws { print("\(w.windowID)\t\(w.owningApplication!.applicationName)\t\(w.title ?? "")\t\(Int(w.frame.width))x\(Int(w.frame.height))") }
    exit(0)
}
guard let w = ws.first(where: { $0.windowID == UInt32(a[1]) }) else { print("finestra non trovata"); exit(1) }
let dir = URL(fileURLWithPath: a[2]); try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
let cfg = SCStreamConfiguration()
let k = min(1280 / w.frame.width, 720 / w.frame.height)
cfg.width = Int(w.frame.width * k); cfg.height = Int(w.frame.height * k)
let full = try await scatta(w, cfg)
png(full, dir.appendingPathComponent("schermo.png"))
// ritaglio 320x240 punti attorno al mouse (se è fuori dalla finestra, attorno al centro), coordinate dello schermo con origine in alto a sinistra
let mouse = NSEvent.mouseLocation, h = NSScreen.screens[0].frame.height
var m = CGPoint(x: mouse.x, y: h - mouse.y)
if !w.frame.contains(m) { m = CGPoint(x: w.frame.midX, y: w.frame.midY) }
let r = CGRect(x: m.x - 160, y: m.y - 120, width: 320, height: 240).intersection(w.frame)
let big = SCStreamConfiguration(); big.width = Int(w.frame.width * 2); big.height = Int(w.frame.height * 2)
let hi = try await scatta(w, big)
let crop = CGRect(x: (r.minX - w.frame.minX) * 2, y: (r.minY - w.frame.minY) * 2, width: r.width * 2, height: r.height * 2)
png(hi.cropping(to: crop)!, dir.appendingPathComponent("ritaglio.png"))
var out: [String] = []
ax(AXUIElementCreateApplication(w.owningApplication!.processID), 0, &out)
try out.joined(separator: "\n").write(to: dir.appendingPathComponent("ax.txt"), atomically: true, encoding: .utf8)
print("ok \(w.owningApplication!.applicationName) ax=\(out.count) righe mouse=\(Int(m.x)),\(Int(m.y))")
