// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Clotch",
    platforms: [.macOS(.v14)],
    dependencies: [
        // Sparkle — auto-update framework. Pinned to 2.6+ for stable
        // SPUStandardUpdaterController + ed25519 signature verification.
        .package(url: "https://github.com/sparkle-project/Sparkle.git", from: "2.6.0"),
        .package(url: "https://github.com/jpsim/Yams.git", from: "5.0.0"),
    ],
    targets: [
        .target(
            name: "ClotchCore",
            path: "Sources/ClotchCore"
        ),
        .executableTarget(
            name: "Clotch",
            dependencies: [
                "ClotchCore",
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "Yams", package: "Yams"),
            ],
            path: "Sources/Clotch",
            resources: [
                .copy("Resources")
            ]
        ),
        .executableTarget(
            name: "clotch-bridge",
            dependencies: ["ClotchCore"],
            path: "Sources/ClotchBridge"
        ),
        // Resets the xctest runner's shared defaults domain when a test
        // bundle loads (see Tests/TestDefaultsReset/TestDefaultsReset.c).
        .target(
            name: "TestDefaultsReset",
            path: "Tests/TestDefaultsReset"
        ),
        .testTarget(
            name: "ClotchCoreTests",
            dependencies: ["ClotchCore", "TestDefaultsReset"],
            path: "Tests/ClotchCoreTests"
        ),
        .testTarget(
            name: "ClotchTests",
            dependencies: [
                "Clotch",
                "TestDefaultsReset",
                .product(name: "Yams", package: "Yams"),
            ],
            path: "Tests/ClotchTests"
        ),
    ]
)
