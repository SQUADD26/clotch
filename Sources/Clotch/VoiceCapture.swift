import AVFoundation
import AudioToolbox
import CoreAudio
import ClotchCore

/// The microphone as 16 kHz mono (#110): every tap buffer is converted once and handed over both as the buffer (the local
/// model takes it as is) and as 16-bit PCM (Scribe's socket and the level meter). `onAudio` runs on the audio thread.
/// Not final: the tests feed a recorded voice through a subclass.
class VoiceCapture: @unchecked Sendable {
    private(set) var engine = AVAudioEngine()
    private let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Double(VoiceInput.sampleRate), channels: 1, interleaved: false)!
    private var converter: AVAudioConverter?
    var onAudio: ((AVAudioPCMBuffer, Data) -> Void)?
    /// Unique id of the input device chosen in «Dettatura»; "" = the system's. A device that is gone falls back to the system's.
    let microphone: String
    private var prepared = false
    private var preparedAt = Date()
    private var observer: NSObjectProtocol?
    /// When macOS last moved the audio setup (a device came, went or became the default, input or output). A prepared engine made before it hears nothing.
    nonisolated(unsafe) private(set) static var audioChangedAt = Date.distantPast
    static let audioChanged = Notification.Name("ClotchAudioChanged")
    private static let watching: Void = {
        for selector in [kAudioHardwarePropertyDefaultInputDevice, kAudioHardwarePropertyDefaultOutputDevice, kAudioHardwarePropertyDevices] {
            var address = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
            AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &address, .main) { _, _ in
                VoiceCapture.audioChangedAt = Date()
                NotificationCenter.default.post(name: VoiceCapture.audioChanged, object: nil)
            }
        }
    }()
    /// Starts listening to the system's audio changes (once, whoever asks).
    static func watchAudioChanges() { _ = watching }

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
        preparedAt = Date()
        let input = engine.inputNode
        if !microphone.isEmpty, var device = Self.deviceID(uid: microphone), let unit = input.audioUnit {
            AudioUnitSetProperty(unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &device, UInt32(MemoryLayout<AudioDeviceID>.size))
        }
        engine.prepare()
    }

    func start() throws {
        guard !DoNotDisturb().isOn else { throw CocoaError(.userCancelled) }  // clotch#266: the one place the microphone turns on
        // A device came or went while the key was not down (or while macOS asked for a permission): the prepared engine hears the old one.
        if Self.audioChangedAt > preparedAt { rebuild() }
        try run()
        // AirPods, headphones or the default input changing under an open microphone stops the engine: start it again on the new one.
        observer = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            self?.recover()
        }
    }

    func run() throws {
        prepare()
        // The device's own format, read now: after `prepare` the node's output format can follow the speakers (96 kHz against a
        // 48 kHz microphone), and a tap that does not match the hardware throws and leaves the bar stuck (#174).
        let format = engine.inputNode.inputFormat(forBus: 0)
        guard format.sampleRate > 0 else { throw CocoaError(.featureUnsupported) }
        engine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in self?.convert(buffer) }
        try engine.start()
    }

    /// A fresh engine bound to whatever the system's audio setup is now.
    private func rebuild() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        engine = AVAudioEngine()
        prepared = false
    }

    func recover() {
        guard observer != nil else { return }
        NotificationCenter.default.removeObserver(observer!)
        rebuild()
        converter = nil
        try? run()
        observer = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            self?.recover()
        }
    }

    func stop() {
        observer.map(NotificationCenter.default.removeObserver)
        observer = nil
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
