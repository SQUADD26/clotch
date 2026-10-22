import AVFoundation
import FluidAudio

/// Parakeet TDT v3 on the Mac (#110), through FluidAudio's sliding-window streamer: the first use downloads the Core ML model
/// (~480 MB, Hugging Face), then everything stays on the Mac. Italian: 3.00 % WER on FLEURS (NVIDIA's card).
/// shortcut: FluidAudio's own language detection (no language hint); pass `SlidingWindowAsrConfig.applying(language:)` if it
/// ever mistakes Italian for another language. FluidAudio's API moved between 0.1x versions: pin it in Package.swift.
actor LocalTranscriber {
    private var models: AsrModels?  // loaded once per run of the app: the second utterance starts at once
    private var manager: SlidingWindowAsrManager?
    private var updates: Task<Void, Never>?

    /// False until the first use: the pill says the model is being downloaded.
    var isLoaded: Bool { models != nil }

    /// At launch (#174): the model loads while nobody waits. Loaded at the first press instead, the first utterance took 12 to 44 s.
    func preload() async throws {
        if models == nil { models = try await AsrModels.downloadAndLoad(version: .v3) }
    }

    /// `onText` gets the whole text so far (confirmed, then still changing) after every update.
    func start(onText: @escaping @Sendable (String) -> Void) async throws {
        let m = SlidingWindowAsrManager(config: .streaming)
        if models == nil { models = try await AsrModels.downloadAndLoad(version: .v3) }
        try await m.loadModels(models!)
        try await m.startStreaming(source: .microphone)
        manager = m
        updates = Task {
            for await _ in await m.transcriptionUpdates {
                let parts = [await m.confirmedTranscript, await m.volatileTranscript]
                onText(parts.filter { !$0.isEmpty }.joined(separator: " "))
            }
        }
    }

    func feed(_ buffer: AVAudioPCMBuffer) async { await manager?.streamAudio(buffer) }

    /// The final text of the utterance.
    func finish() async -> String {
        guard let m = manager else { return "" }
        let text = (try? await m.finish()) ?? ""
        updates?.cancel()
        manager = nil
        await m.cleanup()
        return text
    }

    func cancel() async {
        updates?.cancel()
        await manager?.cancel()
        manager = nil
    }
}
