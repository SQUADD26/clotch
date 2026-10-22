import XCTest
import SwiftUI
@testable import ClotchCore
@testable import Clotch

/// Banco del pilota (black team, P4-P5): disegna a PNG (scala 2) le viste vere del notch aperto con i dati veri di oggi e passa gli
/// eventi veri nel motore degli avvisi, scrivendo un diario di cosa Roberto vedrebbe e sentirebbe. Registra, non giudica: non
/// fallisce perché l'app sbaglia. Solo lettura: ~/.claude/richieste, `richieste.py adhd`, copie in una home temporanea di
/// ~/.config/voce; nessuna finestra, nessun suono, nessuna rete.
///
///     PILOTA_DIR=$PWD/pilota swift test --filter PilotScreensTests
///
/// Senza PILOTA_DIR si salta.
@MainActor
final class PilotScreensTests: XCTestCase {
    private var out = ""
    private let shortTime: DateFormatter = { let f = DateFormatter(); f.dateFormat = "dd/MM HH:mm:ss"; return f }()
    /// NotchSections passa maxHeight 300 quando non conosce la finestra: l'altezza «visibile» di questo banco.
    private let visibleHeight: CGFloat = 300
    /// Ipotesi del banco: una frase detta occupa la voce per tanto (Haiku + ElevenLabs + audio).
    private let speakSeconds: TimeInterval = 15

    func testPilotScreens() throws {
        guard let path = ProcessInfo.processInfo.environment["PILOTA_DIR"] else { throw XCTSkip("PILOTA_DIR not set") }
        let dir = URL(fileURLWithPath: path, isDirectory: true), png = dir.appendingPathComponent("png", isDirectory: true)
        try FileManager.default.createDirectory(at: png, withIntermediateDirectories: true)
        GoalStore.shared.loadNow()  // come `--snapshot`: i registri veri, un colpo solo, nessun watcher
        let adhd = adhdList()
        add("Banco del pilota — \(shortTime.string(from: Date())) — dati veri in sola lettura\n")
        richieste(png)
        adhdSection(adhd.items, note: adhd.note, png)
        notch(png)
        avvisi(png)
        try out.write(to: dir.appendingPathComponent("schede-diario.txt"), atomically: true, encoding: .utf8)
        print("pilota: diario e PNG in \(dir.path)")
    }

    private func add(_ s: String = "") { out += s + "\n" }
    private func head(_ s: String) { add("\n=== \(s) ===") }
    private func ago(_ d: Date?) -> String { d.map { shortTime.string(from: $0) + " (\(GoalRow.elapsed(from: $0, to: Date())) fa)" } ?? "tempo sconosciuto" }

    // MARK: Viste

    /// Il notch aperto come lo disegna il pannello: barra delle schede + scheda, alta al massimo `height` (nil = tutta).
    private func open<B: View>(_ tab: NotchTab, adhdCount: Int = 0, height: CGFloat? = nil, @ViewBuilder _ body: () -> B) -> some View {
        GoalSnapshot.island(width: NotchSize.open, radius: NotchSpace.radius, expanded: true) {
            VStack(spacing: NotchSpace.section) {
                TabBar(tab: .constant(tab), badge: GoalStore.shared.newAnswerCount > 0 ? (.requests, GoalStore.shared.newAnswerCount) : nil, adhdCount: adhdCount)
                body().frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, NotchSpace.side).padding(.top, 10).padding(.bottom, NotchSpace.bottom)
            .hugging(maxHeight: height ?? .infinity).clipped()
        }
    }

    @discardableResult
    private func save<V: View>(_ view: V, _ name: String, _ dir: URL, _ what: String) -> String {
        let image = OffscreenRender.rasterize(view.environment(\.colorScheme, .dark), scale: 2)
        guard let image, let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]),
              (try? data.write(to: dir.appendingPathComponent(name + ".png"))) != nil else {
            add("PNG \(name).png: NON disegnato (\(what))"); return ""
        }
        add("PNG \(name).png: \(image.width)×\(image.height) px — \(what)")
        return name
    }

    // MARK: Cose di sistema

    /// Euristica del banco, non del motore: testo che sa di macchina (handoff, messaggio tra sessioni, system-reminder).
    private func systemKind(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.contains("<system-reminder") { return "system-reminder" }
        if t.range(of: #"^<[A-Za-z_]"#, options: .regularExpression) != nil { return "tag grezzo" }
        if t.hasPrefix("Background (from the session") || t.contains("The session \"") { return "messaggio tra sessioni" }
        if t.range(of: "handoff", options: .caseInsensitive) != nil { return "parla di handoff" }
        if t.hasPrefix("Avvio:") || t.hasPrefix("[Request interrupted") { return "avvio/interruzione" }
        return nil
    }

    // MARK: P4 Richieste

    private func richieste(_ dir: URL) {
        let store = GoalStore.shared, all = store.requests, now = Date()
        let listed = UserRequest.listed(all, now: now), pages = (listed.count + RequestsTab.perPage - 1) / RequestsTab.perPage
        head("P4-richieste")
        let byState = Dictionary(grouping: all, by: { "\($0.state)/\($0.kind)" }).mapValues(\.count).sorted { $0.key < $1.key }
        add("registro: \(all.count) richieste (cartella \(store.requestsFolderExists ? "presente" : "assente")); per stato/tipo: "
            + byState.map { "\($0.key)=\($0.value)" }.joined(separator: ", "))
        add("«In lavorazione» (stato presa, non fatta): \(all.filter { $0.look == .working }.count) nel registro, \(listed.filter { $0.look == .working }.count) nella scheda (una presa senza risposta esce dalla lista, con risposta resta 48 h)")
        add("Nella scheda: \(listed.count) righe in \(pages) pagine da \(RequestsTab.perPage); intestazione «\(listed.filter { !$0.answered }.count) in attesa»; "
            + "righe con uno stato che l'app non conosce (letto come «In attesa»): \(listed.filter { !["nuova", "presa", "fatta"].contains($0.state) }.count)")
        add("Ogni riga mostra: testo, stato, e sotto la risposta se c'è. NON mostra chi la fa né da quanto tempo.")
        add("Le 5 più vecchie tra le mostrate:")
        for r in listed.sorted(by: { ($0.at ?? .distantFuture) < ($1.at ?? .distantFuture) }).prefix(5) { add("  \(r.id) \(ago(r.at)) «\(r.text)»") }
        let sys = listed.compactMap { r in systemKind(r.original).map { (r, $0) } ?? systemKind(r.text).map { (r, $0) } }
        add("Cose di sistema tra le mostrate (euristica del banco): \(sys.count) su \(listed.count)")
        for (r, k) in sys.prefix(30) { add("  \(r.id) [\(k)] «\(r.text.prefix(80))»") }
        add("\nRighe, nell'ordine della scheda:")
        for (i, r) in listed.enumerated() {
            add("  \(i + 1). (pag \(i / RequestsTab.perPage + 1)) «\(r.text)» · stato mostrato: \(r.statusLabel) · stato registro: \(r.state)/\(r.kind) · "
                + "chi (non mostrato): \(r.sessionTitle.isEmpty ? "?" : r.sessionTitle) · tempo (non mostrato): \(ago(r.at))"
                + (r.answered ? " · risposta mostrata: «\(r.answer)»" : "") + (systemKind(r.original) != nil ? " · DI SISTEMA" : ""))
        }
        add("")
        save(open(.requests) { RequestsTab(requests: all, active: store.requestsFolderExists, now: now) }, "richieste-pagina1-come-la-vede-roberto", dir, "prima pagina")
        save(open(.requests, height: visibleHeight) { RequestsTab(requests: all, active: store.requestsFolderExists, now: now) },
             "richieste-altezza-visibile", dir, "tagliata a \(Int(visibleHeight)) pt come NotchSections")
        save(open(.requests) {
            VStack(alignment: .leading, spacing: 12) { ForEach(listed) { RequestLine(request: $0, isNew: false) } }
        }, "richieste-lista-intera", dir, "tutte le \(listed.count) righe, senza paginare")
    }

    // MARK: P4 ADHD

    /// Come `AdhdStore.run`: lo stesso comando, in sola lettura, senza CLAUDE_CODE_SESSION_ID.
    private func adhdList() -> (items: [AdhdRequest], note: String) {
        guard let py = ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"].first(where: FileManager.default.isExecutableFile(atPath:))
        else { return ([], "python3 non trovato") }
        let p = Process(), pipe = Pipe()
        p.executableURL = URL(fileURLWithPath: py)
        p.arguments = [FileManager.default.homeDirectoryForCurrentUser.path + "/.claude/hooks/richieste.py", "adhd"]
        var env = ProcessInfo.processInfo.environment
        env["CLAUDE_CODE_SESSION_ID"] = nil
        p.environment = env
        (p.standardInput, p.standardOutput, p.standardError) = (FileHandle.nullDevice, pipe, FileHandle.nullDevice)
        guard (try? p.run()) != nil else { return ([], "richieste.py non parte") }
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        return p.terminationStatus == 0 ? (GoalSources.parseAdhd(data), "") : ([], "richieste.py adhd uscito con \(p.terminationStatus)")
    }

    private func adhdSection(_ items: [AdhdRequest], note: String, _ dir: URL) {
        head("P4-adhd")
        if !note.isEmpty { add("ATTENZIONE: \(note)") }
        let unanswered = items.filter { !$0.answered }
        add("lista: \(items.count) voci; senza risposta \(unanswered.count) (numero giallo nella scheda), con risposta \(items.count - unanswered.count); "
            + "da smistare \(unanswered.filter(\.toSort).count), sollecitate \(unanswered.filter(\.nudged).count), con un responsabile/origine \(unanswered.filter { !$0.responsible.isEmpty || !$0.origin.isEmpty }.count)")
        add("La scheda mostra TUTTE le voci in una colonna (nessuna pagina): per ognuna domanda, risposta o riga gialla, e a destra «Sollecita»/«Sollecitata»/«×N».")
        add("Le 5 più vecchie:")
        for r in items.sorted(by: { ($0.at ?? .distantFuture) < ($1.at ?? .distantFuture) }).prefix(5) { add("  \(r.id) \(ago(r.at)) «\(r.question)»") }
        let sys = items.compactMap { r in systemKind(r.question).map { (r, $0) } ?? systemKind(r.answer).map { (r, $0) } }
        add("Cose di sistema (euristica del banco): \(sys.count) su \(items.count)")
        for (r, k) in sys.prefix(30) { add("  \(r.id) [\(k)] «\(r.question.prefix(80))»") }
        add("\nRighe, nell'ordine della scheda:")
        for (i, r) in items.enumerated() {
            let trailing = r.answered ? (r.times > 1 ? "×\(r.times)" : "—") : (r.nudged ? "Sollecitata" : "Sollecita")
            add("  \(i + 1). «\(r.question)» · sotto: «\(r.answered ? r.answer : r.waitingLabel)»" + (r.answerNote.map { " (nota: \($0))" } ?? "")
                + " · a destra: \(trailing) · chi: \(r.sessionTitle.isEmpty ? (r.origin.isEmpty ? "?" : r.origin) : r.sessionTitle) · tempo (non mostrato): \(ago(r.at))")
        }
        add("")
        let tab = { AdhdTab(items: items) }
        save(open(.adhd, adhdCount: AdhdRequest.unansweredCount(items), tab), "adhd-intera-come-la-vede-roberto", dir, "tutte le \(items.count) voci")
        save(open(.adhd, adhdCount: AdhdRequest.unansweredCount(items), height: visibleHeight, tab), "adhd-altezza-visibile", dir, "tagliata a \(Int(visibleHeight)) pt come NotchSections")
    }

    // MARK: P4 Notch (chiuso, aperto, obiettivi)

    private func notch(_ dir: URL) {
        let store = GoalStore.shared, rows = store.rows, pages = rows.pages
        head("P4-notch")
        var layout = NotchScreenLayout.standard(hasNotch: true)
        layout.width = 0  // come `--snapshot`: MacBook Pro 14", 185 pt di notch
        let closed = NotchLayoutMetrics.closedWidth(layout, hasNotch: true, notchWidth: 185, minWing: 0, maxWidth: NotchWidth.window(screenWidth: 1512))
        save(GoalSnapshot.island(width: closed, radius: 12) { EmptyView() }, "notch-chiuso", dir, "chiuso, dati veri")
        save(open(.goals) { GoalsTab(rows: rows, now: store.now) }, "notch-aperto-obiettivi", dir, "aperto sulla scheda Obiettivi (pagina in primo piano)")
        save(open(.goals) {
            VStack(alignment: .leading, spacing: 18) { ForEach(Array(pages.enumerated()), id: \.element.id) { GoalPage(row: $0.element, position: $0.offset + 1, of: pages.count, now: store.now) } }
        }, "obiettivi-tutte-le-pagine", dir, "le \(pages.count) pagine una sotto l'altra")
        add("\nObiettivi: \(rows.count) righe vive, \(pages.count) pagine nel notch aperto; in primo piano: «\(rows.hero?.title ?? "nessuno")»")
        add("Sessioni al lavoro contate dal notch chiuso: \(rows.reduce(0) { $0 + $1.workingSessions })")
        for (i, r) in pages.enumerated() {
            let m = r.motor
            add("  \(i + 1). «\(r.title)» · stato mostrato: \(r.statusLabel) · motore: \(m.map { "\($0.phase.rawValue) da \(ago($0.since))" } ?? "nessun file di stato")"
                + " · perché: «\(r.reason(now: store.now) ?? "-")» · \(r.sessionsText) · \(r.proofsSentence)")
        }
    }

    // MARK: P5 Avvisi

    private struct Fate { var voice = "", judge = "", spoken = "" }

    private func avvisi(_ dir: URL) {
        head("P5-avvisi")
        let fm = FileManager.default, real = fm.homeDirectoryForCurrentUser
        let tmp = fm.temporaryDirectory.appendingPathComponent("pilota-home-\(UUID().uuidString)")
        defer { try? fm.removeItem(at: tmp) }
        let voce = tmp.appendingPathComponent(".config/voce")
        try? fm.createDirectory(at: voce, withIntermediateDirectories: true)
        for n in ["eventi.jsonl", "config.json", "giudice-log.jsonl"] { try? fm.copyItem(at: real.appendingPathComponent(".config/voce/" + n), to: voce.appendingPathComponent(n)) }
        for n in ((try? fm.contentsOfDirectory(atPath: real.appendingPathComponent(".config/voce").path)) ?? []) where n == "spento" || n.hasPrefix("muto-") {
            fm.createFile(atPath: voce.appendingPathComponent(n).path, contents: Data())
        }
        let files = VoiceFiles(home: tmp), now = Date()
        let loader = GoalLoader(paths: GoalSources.defaultPaths(home: real), index: nil)  // niente indice scritto in Library
        _ = loader.load(changed: nil)
        let config = VoiceTurn.Config((try? files.readConfig()) ?? [:])
        var items: [(e: VoiceEvent, titolo: String, giudizio: String)] = [], unknown: [String] = []
        for l in String(decoding: (try? Data(contentsOf: files.eventsURL)) ?? Data(), as: UTF8.self).split(separator: "\n") {
            guard let o = (try? JSONSerialization.jsonObject(with: Data(l.utf8))) as? [String: Any], let at = GoalSources.date(o["t"]),
                  at >= now.addingTimeInterval(-6 * 3600) else { continue }
            if let e = VoiceEvents.parse(line: l) { items.append((e, (o["sessione"] as? [String: Any])?["titolo"] as? String ?? "", o["giudizio"].flatMap { try? JSONSerialization.data(withJSONObject: $0, options: [.sortedKeys]) }.map { String(decoding: $0, as: UTF8.self) } ?? "")) } else { unknown.append(o["tipo"] as? String ?? "?") }
        }
        items.sort { $0.e.at < $1.e.at }
        let judged: [[String: Any]] = String(decoding: (try? Data(contentsOf: files.judgeLogURL)) ?? Data(), as: UTF8.self).split(separator: "\n")
            .compactMap { (try? JSONSerialization.jsonObject(with: Data($0.utf8))) as? [String: Any] }
        add("eventi.jsonl: \(items.count) eventi nelle ultime 6 ore" + (unknown.isEmpty ? "" : "; tipi che la voce non conosce (mai detti): \(unknown.joined(separator: ", "))")
            + "; voce \(files.isOn ? "accesa" : "SPENTA (file «spento»)"); «Parla per»: \(config.audience.rawValue); tetto \(config.maxCalls) chiamate al giorno")
        add("Ipotesi del banco: la chiave ElevenLabs c'è (non letta), il giudice risponde come nel suo log vero, una frase occupa la voce \(Int(speakSeconds)) s, il giorno parte da zero.")
        var engine = VoiceAlertEngine(), day = VoiceTurn.Day.load(nil, now: now), busy = Date.distantPast, clock = Date.distantPast
        var fates: [String: Fate] = [:], queued: Set<String> = []
        func tag(_ e: VoiceEvent) -> String { "\(e.id)@\(e.at.timeIntervalSince1970)" }
        func reconcile(_ why: String) {
            for t in queued where !engine.waiting.contains(where: { tag($0) == t }) && fates[t]?.spoken.isEmpty != false { fates[t]?.spoken = why }
            queued = queued.filter { fates[$0]?.spoken.isEmpty != false }
        }
        func pump(until t: Date) {
            while !engine.waiting.isEmpty {
                let start = max(busy, clock)
                guard start <= t else { break }
                guard let n = engine.next(now: start) else { return reconcile("NON detto: vecchio in coda (oltre 5 min)") }
                queued.remove(tag(n))
                let why = VoiceTurn.refusal(isOn: files.isOn, hasKey: true, muted: files.isMuted(session: n.session), day: day, config: config)
                fates[tag(n)]?.spoken = why.map { "NON detto: \($0)" } ?? "DETTO alle \(shortTime.string(from: start))"
                if why == nil { day.chiamate += 1; busy = start + speakSeconds }
            }
            reconcile("NON detto: vecchio in coda (oltre 5 min)")
        }
        for (e, _, giudizio) in items {
            pump(until: e.at); clock = e.at
            var f = Fate()
            let v = judged.last { $0["tipo"] as? String == e.kind.rawValue && $0["soggetto"] as? String == e.subject && abs((GoalSources.date($0["t"]) ?? .distantPast).timeIntervalSince(e.at)) < 120 }
            if VoiceJudge.judges(e) { f.judge = v.map { "giudice (log vero): \($0["si"] as? Bool == false ? "NO" : "sì") — \($0["motivo"] as? String ?? "")" } ?? "giudice interpellato, nessun verdetto nel log" } else { f.judge = e.judged ? "giudizio già scritto dal motore nel file: \(giudizio.prefix(120))" : "giudice: non interpellato (tipo che non passa dal giudice)" }
            if !files.isOn { f.voice = "NON detto: voce spenta" }
            else if v?["si"] as? Bool == false, VoiceJudge.judges(e) { f.voice = "NON detto: scartato dal giudice" }
            else if let why = engine.offer(e, config: config, sessions: loader.allSessions, now: e.at) { f.voice = "NON detto: \(why)" }
            else { f.voice = "in coda"; queued.insert(tag(e)) }
            fates[tag(e)] = f
            reconcile("NON detto: coda piena (un avviso più importante ha preso il posto)")
            pump(until: e.at)
        }
        pump(until: .distantFuture)
        let keyOf = { (e: VoiceEvent) in VoiceAlertEngine.key(e) }
        let counts = Dictionary(grouping: items, by: { keyOf($0.e) }).mapValues(\.count)
        var seen: [String: Int] = [:]
        for (e, titolo, _) in items {
            seen[keyOf(e), default: 0] += 1
            let f = fates[tag(e)] ?? Fate(), n = seen[keyOf(e)]!, total = counts[keyOf(e)]!
            add("[\(shortTime.string(from: e.at))] \(e.kind.rawValue) (\(e.level))\(e.kind == .risk ? "  <<< RISCHIO" : "")\(n > 1 ? "  <<< RIPETUTO \(n)ª di \(total)" : total > 1 ? "  (primo di \(total) stesso soggetto)" : "") «\(e.subject)»")
            add("    sessione: \(titolo.isEmpty ? "nessuna" : titolo) (\(e.role.isEmpty ? "ruolo ?" : e.role)) · testo: «\(e.text)»")
            add("    voce: \(f.voice == "in coda" ? f.spoken : f.voice) · \(f.judge)")
            if f.voice == "in coda" && f.spoken.hasPrefix("DETTO") { add("    al parlatore (Haiku) va: «\(e.report)»") }
            add("    notifica sotto il notch: nessuna (eventi.jsonl non passa dal NotchNotifier, che legge solo obiettivi, richieste prese, PR unite e passi del battito)")
        }
        let said = items.filter { fates[tag($0.e)]?.spoken.hasPrefix("DETTO") == true }
        add("\nRiepilogo: \(items.count) eventi, \(said.count) detti a voce, \(items.count - said.count) no. Per tipo: "
            + Dictionary(grouping: items, by: { $0.e.kind.rawValue }).sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value.count)" }.joined(separator: ", "))
        add("Soggetti ripetuti (nelle 6 ore), con quante volte sono passati a voce:")
        for (k, n) in counts.sorted(by: { $0.value > $1.value }) where n > 1 {
            add("  \(n)× «\(k)» — a voce \(said.filter { keyOf($0.e) == k }.count)×")
        }
        add("Rischi:")
        for (e, _, _) in items where e.kind == .risk { let f = fates[tag(e)] ?? Fate(); add("  [\(shortTime.string(from: e.at))] «\(e.text)» — \(f.voice == "in coda" ? f.spoken : f.voice)") }
        add("«segnalazioni» in tutto eventi.jsonl (anche fuori dalle 6 ore): " + String(decoding: (try? Data(contentsOf: files.eventsURL)) ?? Data(), as: UTF8.self)
            .split(separator: "\n").filter { $0.localizedCaseInsensitiveContains("segnalazion") }.count.description + " righe")
        battito(real, dir)
    }

    /// L'unica fonte di notifiche sotto il notch che si legge da un file: i passi fermi del battito dell'Overseer (#184).
    private func battito(_ real: URL, _ dir: URL) {
        add("\nNotifiche sotto il notch dal battito (passi.json vero, come a un avvio):")
        let steps = (try? Data(contentsOf: real.appendingPathComponent(".config/coda-overseer/battito/passi.json"))).flatMap(HeartbeatSteps.parse) ?? [:]
        let stuck = HeartbeatSteps.stuck(old: [:], new: steps)
        add("  \(steps.count) passi letti, \(stuck.count) fermi da \(HeartbeatSteps.stuckAfter) giri o più" + (stuck.isEmpty ? "" : ":"))
        for e in stuck {
            let note = Note(event: e, rows: [], requests: [])
            add("  «\(note?.text ?? e.text)» · resta su \(String(format: "%.1f", NotchEvents.hold(forText: e.text))) s · errore: «\(steps[e.subject]?.error ?? "")»")
            save(GoalSnapshot.island(width: NotchSize.note, radius: NotchSpace.noteRadius) {
                NotchNotificationView(event: e, phase: .settle, rows: [], requests: [])
            }, "avviso-passo-fermo-\(e.subject.filter { $0.isLetter || $0.isNumber || $0 == "_" })", dir, "notifica sotto il notch")
        }
        add("  Le altre notifiche (obiettivo cambiato, richiesta presa, PR unita) nascono dal confronto di due letture: una lettura sola non le produce.")
    }
}
