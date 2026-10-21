import AudioToolbox
import CoreAudio
import Foundation
import ClotchCore

/// Lowers the audio of every OTHER app while the voice speaks (#83), with a Core Audio process tap (macOS 14.2+).
/// The tap takes the other apps' audio out of the speakers (`mutedWhenTapped`) and a private aggregate device plays it back
/// scaled by a gain that ramps. Clotch's own voice is not in the tap, so it stays at full volume; the system volume is never
/// touched, so «back as before» is exact (the tap goes away) and a volume change by Roberto during the speech applies to both.
/// If the process dies the tap dies with it. Nothing here runs unless `VoiceDuck.around` calls `begin()`.
final class AudioDucker: DuckBackend {
    private var tap = AudioObjectID(kAudioObjectUnknown)
    private var aggregate = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    private var sampleRate = 48000.0
    private let level: Double
    /// Shared with the audio thread: current gain, target, step per frame. Plain floats, one writer each.
    private let gain = UnsafeMutablePointer<Float>.allocate(capacity: 3)

    init(level: Double) {
        self.level = level
        gain.initialize(repeating: 1, count: 3)
    }

    deinit {
        end()
        gain.deallocate()
    }

    func begin() -> Bool {
        guard #available(macOS 14.2, *), tap == kAudioObjectUnknown else { return false }
        let others = Self.otherProcesses()
        guard !others.isEmpty, let output = Self.defaultOutputUID() else { return false }
        let description = CATapDescription(stereoMixdownOfProcesses: others)
        description.uuid = UUID()
        description.muteBehavior = .mutedWhenTapped
        description.isPrivate = true
        guard AudioHardwareCreateProcessTap(description, &tap) == noErr else { tap = AudioObjectID(kAudioObjectUnknown); return false }
        guard let format = Self.tapFormat(tap), format.mFormatID == kAudioFormatLinearPCM, format.mBitsPerChannel == 32,
              format.mFormatFlags & kAudioFormatFlagIsFloat != 0, format.mFormatFlags & kAudioFormatFlagIsNonInterleaved == 0 else {
            end()
            return false
        }
        sampleRate = format.mSampleRate
        let aggregateUID = UUID().uuidString
        let dictionary: [String: Any] = [
            kAudioAggregateDeviceNameKey: "Clotch voce",
            kAudioAggregateDeviceUIDKey: aggregateUID,
            kAudioAggregateDeviceMainSubDeviceKey: output,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: output]],
            kAudioAggregateDeviceTapListKey: [[kAudioSubTapUIDKey: description.uuid.uuidString, kAudioSubTapDriftCompensationKey: true]],
        ]
        gain.initialize(repeating: 1, count: 3)
        let state = gain
        let io: AudioDeviceIOBlock = { _, input, _, output, _ in Self.render(input, output, state) }
        guard AudioHardwareCreateAggregateDevice(dictionary as CFDictionary, &aggregate) == noErr,
              AudioDeviceCreateIOProcIDWithBlock(&procID, aggregate, DispatchQueue(label: "clotch.duck", qos: .userInteractive), io) == noErr,
              AudioDeviceStart(aggregate, procID) == noErr else {
            end()
            return false
        }
        return true
    }

    func fade(to target: Double, over seconds: TimeInterval) {
        guard tap != kAudioObjectUnknown else { return }
        gain[1] = Float(target)
        gain[2] = Float(abs(1 - level) / max(seconds * sampleRate, 1))
    }

    /// Stops the playback, then destroys the tap: the others are on the speakers again, at their own volume.
    func end() {
        if let procID, aggregate != kAudioObjectUnknown {
            AudioDeviceStop(aggregate, procID)
            AudioDeviceDestroyIOProcID(aggregate, procID)
        }
        procID = nil
        if aggregate != kAudioObjectUnknown { AudioHardwareDestroyAggregateDevice(aggregate) }
        aggregate = AudioObjectID(kAudioObjectUnknown)
        if tap != kAudioObjectUnknown, #available(macOS 14.2, *) { AudioHardwareDestroyProcessTap(tap) }
        tap = AudioObjectID(kAudioObjectUnknown)
    }

    // MARK: - Audio thread

    /// Copies the tap's stereo to the output, frame by frame, with the gain moving toward its target. The tap is the LAST input
    /// stream: a headset output device puts its own microphone first. No allocation, no lock.
    private static func render(_ input: UnsafePointer<AudioBufferList>, _ output: UnsafeMutablePointer<AudioBufferList>,
                               _ state: UnsafeMutablePointer<Float>) {
        let ins = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: input))
        let outs = UnsafeMutableAudioBufferListPointer(output)
        guard let out = outs.first, let outData = out.mData?.assumingMemoryBound(to: Float.self) else { return }
        let outChannels = Int(out.mNumberChannels)
        let outFrames = Int(out.mDataByteSize) / (outChannels * 4)
        let tap = ins.last
        let inChannels = Int(tap?.mNumberChannels ?? 0)
        let inData = tap?.mData?.assumingMemoryBound(to: Float.self)
        let inFrames = inData == nil || inChannels == 0 ? 0 : Int(tap!.mDataByteSize) / (inChannels * 4)
        var g = state[0]
        let target = state[1], step = state[2]
        for f in 0..<outFrames {
            g = g < target ? min(target, g + step) : max(target, g - step)
            for c in 0..<outChannels {
                outData[f * outChannels + c] = f < inFrames && c < inChannels ? inData![f * inChannels + c] * g : 0
            }
        }
        state[0] = g
    }

    // MARK: - Core Audio reads

    private static func read<T>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, _ value: inout T) -> Bool {
        var address = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var size = UInt32(MemoryLayout<T>.size)
        return AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value) == noErr
    }

    /// Every process Core Audio knows except Clotch: found by list, so the voice is never in the tap even before it has played.
    /// shortcut: an app that starts playing after the lowering began keeps full volume until the next speech.
    private static func otherProcesses() -> [AudioObjectID] {
        var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyProcessObjectList, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var size: UInt32 = 0
        let system = AudioObjectID(kAudioObjectSystemObject)
        guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr, size > 0 else { return [] }
        var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
        guard AudioObjectGetPropertyData(system, &address, 0, nil, &size, &ids) == noErr else { return [] }
        return ids.filter { id in
            var pid: pid_t = 0
            return read(id, kAudioProcessPropertyPID, &pid) && pid != getpid()
        }
    }

    private static func defaultOutputUID() -> String? {
        var device = AudioObjectID(kAudioObjectUnknown)
        var uid: CFString = "" as CFString
        guard read(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDefaultOutputDevice, &device), device != kAudioObjectUnknown,
              read(device, kAudioDevicePropertyDeviceUID, &uid) else { return nil }
        return uid as String
    }

    private static func tapFormat(_ tap: AudioObjectID) -> AudioStreamBasicDescription? {
        var format = AudioStreamBasicDescription()
        return read(tap, kAudioTapPropertyFormat, &format) ? format : nil
    }
}
