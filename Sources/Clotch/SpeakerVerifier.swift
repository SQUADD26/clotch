import AVFoundation
import FluidAudio
import ClotchCore

/// Whose voice is it (#1120): FluidAudio's WeSpeaker embedding (Core ML, runs on the Mac; the first use downloads the model, the audio never leaves).
/// The voiceprint is `VoiceTrust.Store`; here only the maths of one utterance against it.
actor SpeakerVerifier {
    static let shared = SpeakerVerifier()
    private var manager: DiarizerManager?

    private func load() async throws -> DiarizerManager {
        if let manager { return manager }
        let m = DiarizerManager()
        m.initialize(models: try await DiarizerModels.downloadIfNeeded())
        manager = m
        return m
    }

    /// Warms the model while nobody waits (at launch, like the transcriber).
    func preload() async { _ = try? await load() }

    func embedding(_ samples: [Float]) async throws -> [Float] { try await load().extractSpeakerEmbedding(from: samples) }

    /// The verdict on one utterance. No print, a model that fails or too little sound: «uncertain», never «yes».
    func check(_ samples: [Float], store: VoiceTrust.Store = .init()) async -> (verdict: VoiceTrust.Verdict, distance: Float) {
        let print = store.load
        guard !print.isEmpty, let e = try? await embedding(samples) else { return (.uncertain, .infinity) }
        let d = VoiceTrust.distance(e, to: print)
        return (VoiceTrust.verdict(distance: d, seconds: Double(samples.count) / Double(VoiceInput.sampleRate)), d)
    }
}

/// The 16 kHz samples of one utterance, collected on the audio thread.
final class UtteranceSamples: @unchecked Sendable {
    private let lock = NSLock()
    private var samples: [Float] = []
    func add(_ b: AVAudioPCMBuffer) {
        guard let p = b.floatChannelData?[0] else { return }
        lock.lock(); samples.append(contentsOf: UnsafeBufferPointer(start: p, count: Int(b.frameLength))); lock.unlock()
    }
    var all: [Float] { lock.lock(); defer { lock.unlock() }; return samples }
    func clear() { lock.lock(); samples = []; lock.unlock() }
}
