import ClotchCore

/// The text of an utterance (#110, #174): the engines' live events, and the final text once the microphone is off.
extension VoiceInputController {
    func scribeEvent(_ event: VoiceInput.ScribeEvent, run me: Int) {
        guard me == run else { return }
        // #314: no audio at the commit after a real listen is a deaf microphone; after a quick double press it is a choice (#147)
        if case .failure(.nothingHeard) = event, listened < 1 { scribeCommitted = true; return }
        if case .failure(let why) = event { return fail(why, run: me) }
        // «No voice» answers the closing commit: the wait ends and the words already heard still go (#174); empty = folds quietly (#147).
        if case .quiet = event { scribeCommitted = true; return }
        if case .committed = event { scribeCommitted = true }
        dictation.take(event)
        publishText()
    }

    func localText(_ whole: String, run me: Int) {
        guard me == run else { return }
        dictation.replace(with: whole)
        publishText()
    }

    /// Scribe: the closing silence asks for the committed text, at most `commitWait` s. Local: the model finishes what it holds.
    func transcript() async -> String {
        switch config.engine {
        case .scribe:
            scribeCommitted = false  // only the answer to this commit closes the wait
            scribe?.commit()
            for _ in 0..<Int(VoiceInput.commitWait * 20) where !scribeCommitted && scribe != nil { try? await Task.sleep(nanoseconds: 50_000_000) }
            scribe?.close()
            scribe = nil
            return dictation.text
        case .local:
            // At most `localWait` s, as Scribe's commit: the words heard so far go, or the error says the model did not answer (#197).
            var final: String?
            Task { @MainActor [self] in
                await feeding?.value
                if let f = finishLocal { final = await f() } else { final = await local.finish() }
            }
            for _ in 0..<Int(localWait * 20) where final == nil { try? await Task.sleep(nanoseconds: 50_000_000) }
            guard let done = final else { return dictation.text.isEmpty ? failed() : dictation.text }
            return done.isEmpty ? dictation.text : done
        }
    }

    /// The engine never answered and nothing was heard: the bar says so instead of waiting on.
    private func failed() -> String {
        fail(.local, run: run)
        return ""
    }
}
