import ClotchCore

/// The text of an utterance (#110, #174): the engines' live events, and the final text once the microphone is off.
extension VoiceInputController {
    func scribeEvent(_ event: VoiceInput.ScribeEvent, run me: Int) {
        guard me == run else { return }
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
            await feeding?.value
            let final = await local.finish()
            return final.isEmpty ? dictation.text : final
        }
    }
}
