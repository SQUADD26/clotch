import Foundation

/// «Non disturbare» (clotch#266, claude-config#2207): `non-disturbare on|off|stato` is the only writer of `~/.config/voce/non-disturbare`.
/// The file exists = on: Clotch does not speak and does not open the microphone. Clotch only reads it.
public struct DoNotDisturb {
    public let url: URL

    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        url = home.appendingPathComponent(".config/voce/non-disturbare")
    }

    public var isOn: Bool { FileManager.default.fileExists(atPath: url.path) }
}
