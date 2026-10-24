import Foundation

/// «Non disturbare» (clotch#266, claude-config#2207; one silence for notch and app, clotch#1110): the engine keeps `~/.claude/friday/silenzio.json`
/// (`FridayDoor.isSilent`: `zitto`, non disturbare, AFK) and `non-disturbare on|off` / `afk on|off` write it. Silent: Clotch does not speak and does not open the microphone.
/// Clotch only reads it. shortcut: with no `silenzio.json` yet (engine before contract v2) the old file `~/.config/voce/non-disturbare` still counts; drop it when every Mac has the new engine.
public struct DoNotDisturb {
    public let url: URL

    public init(home: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.home = home
        url = home.appendingPathComponent(".config/voce/non-disturbare")
    }

    private let home: URL

    public var isOn: Bool {
        let door = FridayDoor(home: home)
        return FileManager.default.fileExists(atPath: door.silenceURL.path) ? door.isSilent() : FileManager.default.fileExists(atPath: url.path)
    }
}
