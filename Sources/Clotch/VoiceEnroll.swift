// figma: 168:99780
import SwiftUI
import ClotchCore

/// Registrare la voce una volta (#1120): three phrases read aloud, one embedding each, kept on this Mac (`VoiceTrust.Store`).
/// A take that does not sound like the others (a TV, someone else) makes him do it again; nothing is saved until all three agree.
@MainActor
final class VoiceEnroll: ObservableObject {
    static let phrases = [
        "Friday, controlla le sessioni aperte e dimmi a che punto siamo.",
        "Apri la richiesta, manda il rapporto a Marco e poi chiudi tutto.",
        "Oggi pomeriggio voglio vedere i numeri del mese, prima della riunione.",
    ]
    static let seconds = 7.0

    enum State: Equatable { case idle, recording(Int), working, done, failed(String) }
    @Published private(set) var state = State.idle
    @Published private(set) var taken = 0
    @Published private(set) var enrolled: Bool
    private var print: [[Float]] = []
    private let store: VoiceTrust.Store
    var microphone = ""

    init(store: VoiceTrust.Store = .init()) { self.store = store; enrolled = store.exists }

    func start() { print = []; taken = 0; state = .idle; Task { await next() } }

    func erase() { store.erase(); enrolled = false; taken = 0; state = .idle }

    /// Records the next phrase from the microphone, then adds it.
    private func next() async {
        let capture = VoiceCapture(microphone: microphone), samples = UtteranceSamples()
        guard await capture.authorized() else { return state = .failed("Clotch non può usare il microfono.") }
        capture.onAudio = { buffer, _ in samples.add(buffer) }
        do { try capture.start() } catch { return state = .failed("Il microfono non parte. Riprova.") }
        state = .recording(taken)
        try? await Task.sleep(nanoseconds: UInt64(Self.seconds * 1e9))
        capture.stop()
        if await add(samples.all) { await next() }
    }

    /// One take; true = another phrase is due. The third one closes the enrolment; a failure keeps the takes so far.
    @discardableResult func add(_ samples: [Float]) async -> Bool {
        state = .working
        guard let e = try? await SpeakerVerifier.shared.embedding(samples), samples.count >= Int(VoiceTrust.minSeconds * 16000) else {
            state = .failed("Non ho sentito abbastanza. Leggi la frase per intero."); return false
        }
        print.append(e)
        taken = print.count
        if taken < VoiceTrust.enrollPhrases { return true }
        guard VoiceTrust.consistent(print) else {
            print = []; taken = 0
            state = .failed("Le tre frasi non sembrano la stessa voce. Ripeti in un posto silenzioso.")
            return false
        }
        do { try store.save(print); enrolled = true; state = .done } catch { state = .failed("Non riesco a salvare l'impronta su questo Mac.") }
        return false
    }
}

/// The «La tua voce» group of «Dettatura».
struct VoiceprintSection: View {
    private typealias T = FigmaToken.MacOS27GoldenGate
    @StateObject private var enroll = VoiceEnroll()
    let microphone: String

    var body: some View {
        SettingsGroup(title: "La tua voce") {
            CardRow(title: "Impronta della voce", note: note) {
                if case .recording = enroll.state { ProgressView().controlSize(.small) }
                else {
                    CardButton(title: enroll.enrolled ? "Registra di nuovo" : "Registra la voce") { enroll.microphone = microphone; enroll.start() }
                    if enroll.enrolled { CardButton(title: "Cancella") { enroll.erase() } }
                }
            }
            if case .recording(let i) = enroll.state {
                CardDivider()
                CardRow(title: "Frase \(i + 1) di \(VoiceTrust.enrollPhrases)", note: "Leggi a voce alta:") {
                    Text(VoiceEnroll.phrases[i]).font(.settings(T.notchTesto11)).multilineTextAlignment(.trailing).frame(maxWidth: 260, alignment: .trailing)
                }
            }
        }
    }

    private var note: String {
        switch enroll.state {
        case .recording: return "Ti ascolto, sette secondi per frase."
        case .working: return "Un attimo…"
        case .failed(let why): return why
        case .done: return "Fatto. Gli ordini a voce ora valgono solo se sei tu."
        case .idle: return enroll.enrolled ? "Registrata. Resta solo su questo Mac." : "Senza la tua voce Friday non esegue ordini a voce. Tre frasi, una volta sola. Resta solo su questo Mac."
        }
    }
}
