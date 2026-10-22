import AVFoundation
import AudioToolbox
import CoreAudio
import ClotchCore

/// The microphone as 16 kHz mono (#110): every tap buffer is converted once and handed over both as the buffer (the local
/// model takes it as is) and as 16-bit PCM (Scribe's socket and the level meter). `onAudio` runs on the audio thread.
/// `prepare` does the slow part (the input unit, the device) before the key is pressed, so `start` only turns the microphone on (#174).
/// Not final: the tests feed a recorded voice through a subclass.
class VoiceCapture: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Double(VoiceInput.sampleRate), channels: 1, interleaved: false)!
    private var converter: AVAudioConverter?
    var onAudio: ((AVAudioPCMBuffer, Data) -> Void)?
    /// Unique id of the input device chosen in «Dettatura»; "" = the system's. A device that is gone falls back to the system's.
    let microphone: String
    private var prepared = false

    init(microphone: String = "") { self.microphone = microphone }

    /// The input devices Roberto can pick, by unique id (the same id Core Audio uses).
    static func inputs() -> [(id: String, name: String)] {
        AVCaptureDevice.DiscoverySession(deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified)
            .devices.map { ($0.uniqueID, $0.localizedName) }
    }

    private static func deviceID(uid: String) -> AudioDeviceID? {
        var uidRef = uid as CFString
        var device = AudioDeviceID(0)
        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
        var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyTranslateUIDToDevice,
                                                 mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        let status = withUnsafeMutablePointer(to: &uidRef) {
            AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, UInt32(MemoryLayout<CFString>.size), $0, &size, &device)
        }
        return status == noErr && device != 0 ? device : nil
    }

    /// Asks macOS the first time; false = refused, nothing to listen with.
    func authorized() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
        default: return false
        }
    }

    /// The input unit and the chosen device, without turning the microphone on (no orange dot).
    func prepare() {
        guard !prepared else { return }
        prepared = true
        let input = engine.inputNode
        if !microphone.isEmpty, var device = Self.deviceID(uid: microphone), let unit = input.audioUnit {
            AudioUnitSetProperty(unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &device, UInt32(MemoryLayout<AudioDeviceID>.size))
        }
        engine.prepare()
    }

    func start() throws {
        prepare()
        guard engine.inputNode.outputFormat(forBus: 0).sampleRate > 0 else { throw CocoaError(.featureUnsupported) }
        // nil = the device's format now: a device switched since `prepare` never trips the tap's format check.
        engine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: nil) { [weak self] buffer, _ in self?.convert(buffer) }
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        converter = nil
    }

    private func convert(_ buffer: AVAudioPCMBuffer) {
        if converter?.inputFormat != buffer.format { converter = AVAudioConverter(from: buffer.format, to: target) }
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
