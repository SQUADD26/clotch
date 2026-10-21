import AVFoundation
import ClotchCore

/// The microphone as 16 kHz mono (#110): every tap buffer is converted once and handed over both as the buffer (the local
/// model takes it as is) and as 16-bit PCM (Scribe's socket and the level meter). `onAudio` runs on the audio thread.
final class VoiceCapture: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Double(VoiceInput.sampleRate), channels: 1, interleaved: false)!
    private var converter: AVAudioConverter?
    var onAudio: ((AVAudioPCMBuffer, Data) -> Void)?

    /// Asks macOS the first time; false = refused, nothing to listen with.
    static func authorized() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
        default: return false
        }
    }

    func start() throws {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, let converter = AVAudioConverter(from: format, to: target) else { throw CocoaError(.featureUnsupported) }
        self.converter = converter
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in self?.convert(buffer) }
        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        converter = nil
    }

    private func convert(_ buffer: AVAudioPCMBuffer) {
        guard let converter else { return }
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * target.sampleRate / buffer.format.sampleRate) + 16
        guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
        var given = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if given { status.pointee = .noDataNow; return nil }
            given = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, out.frameLength > 0, let samples = out.floatChannelData?[0] else { return }
        onAudio?(out, VoiceInput.pcm16(Array(UnsafeBufferPointer(start: samples, count: Int(out.frameLength)))))
    }
}
