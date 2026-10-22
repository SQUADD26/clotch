import AVFoundation
import FluidAudio

/// Parakeet TDT v3 on the Mac (#110), through FluidAudio's sliding-window streamer: the first use downloads the Core ML model
/// (~480 MB, Hugging Face), then everything stays on the Mac. Italian: 3.00 % WER on FLEURS (NVIDIA's card).
/// The language chosen on the «Voce» page goes to FluidAudio as a hint (script filter of the v3 decoder; «auto» = no hint).
/// FluidAudio's API moved between 0.1x versions: pin it in Package.swift.
actor LocalTranscriber {
    private var models: AsrModels?  // loaded once per run of the app: the second utterance starts at once
    private var manager: SlidingWindowAsrManager?
    private var updates: Task<Void, Never>?
    private var loading: Task<AsrModels, Error>?  // a press during the preload waits for it instead of loading a second time (#197)

    /// False until the first use: the pill says the model is being downloaded.
    var isLoaded: Bool { models != nil }

    /// At launch (#174): the model loads while nobody waits. Loaded at the first press instead, the first utterance took 12 to 44 s.
    func preload() async throws { _ = try await load() }

    private func load() async throws -> AsrModels {
        if let models { return models }
        let task = loading ?? Task { try await AsrModels.downloadAndLoad(version: .v3) }
        loading = task
        defer { loading = nil }  // an error leaves nothing behind: the next press tries again
        let loaded = try await task.value
        models = loaded
        return loaded
    }

    /// `onText` gets the whole text so far (confirmed, then still changing) after every update.
    func start(language: String, onText: @escaping @Sendable (String) -> Void) async throws {
        let m = SlidingWindowAsrManager(config: SlidingWindowAsrConfig.streaming.applying(language: Language(rawValue: language)))
        try await m.loadModels(try await load())
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
        // Taken before the first await: a new `start` while this finish is slow must not lose its own manager to it.
        let mine = updates
        manager = nil
        updates = nil
        let text = (try? await m.finish()) ?? ""
        mine?.cancel()
        await m.cleanup()
        return text
    }

    func cancel() async {
        updates?.cancel()
        await manager?.cancel()
        manager = nil
    }
}
