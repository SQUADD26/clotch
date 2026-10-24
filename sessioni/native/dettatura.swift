// Dettatura dell'app (#470, Clotch spento): microfono del Mac -> riconoscimento vocale di sistema (it-IT, sul Mac se possibile).
// Scrive su stdout il testo capito finora, una riga per aggiornamento. Si ferma con SIGTERM; errori su stderr, in italiano, uscita 1.
import AVFoundation
import Foundation
import Speech

func esci(_ messaggio: String, _ codice: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data((messaggio + "\n").utf8))
    exit(codice)
}

var ultimo = ""
let motore = AVAudioEngine()
var attivita: SFSpeechRecognitionTask?

func avvia() {
    guard let r = SFSpeechRecognizer(locale: Locale(identifier: "it-IT")), r.isAvailable else { esci("Riconoscimento vocale italiano non disponibile") }
    let richiesta = SFSpeechAudioBufferRecognitionRequest()
    richiesta.shouldReportPartialResults = true
    richiesta.requiresOnDeviceRecognition = r.supportsOnDeviceRecognition
    let ingresso = motore.inputNode
    ingresso.installTap(onBus: 0, bufferSize: 1024, format: ingresso.outputFormat(forBus: 0)) { buffer, _ in richiesta.append(buffer) }
    attivita = r.recognitionTask(with: richiesta) { risultato, errore in
        if let t = risultato?.bestTranscription.formattedString.replacingOccurrences(of: "\n", with: " ") {
            ultimo = t
            print(t)
            fflush(stdout)
        }
        if risultato?.isFinal == true { exit(0) }
        if errore != nil { ultimo.isEmpty ? esci("Non ho sentito niente") : exit(0) }
    }
    do { try motore.start() } catch { esci("Microfono non disponibile") }
}

SFSpeechRecognizer.requestAuthorization { stato in
    guard stato == .authorized else { esci("Riconoscimento vocale non consentito: Impostazioni di Sistema > Privacy e sicurezza") }
    AVCaptureDevice.requestAccess(for: .audio) { ok in
        guard ok else { esci("Microfono non consentito: Impostazioni di Sistema > Privacy e sicurezza") }
        DispatchQueue.main.async(execute: avvia)
    }
}
dispatchMain()
