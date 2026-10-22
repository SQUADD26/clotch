import Foundation

/// #264: the one place that names the log subsystem. The app logs under `com.squadd.clotch`; the test process
/// logs under a different one, so a log line cited as proof never comes from a test.
public enum ClotchLog {
    public static let appSubsystem = "com.squadd.clotch"
    public static let testSubsystem = "com.squadd.clotch.test"

    public static func subsystem(underTest: Bool) -> String { underTest ? testSubsystem : appSubsystem }

    /// `swift test` does not set XCTestConfigurationFilePath; XCTest being loaded is what tells a test process.
    public static let subsystem = subsystem(
        underTest: ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
            || NSClassFromString("XCTestCase") != nil)
}
