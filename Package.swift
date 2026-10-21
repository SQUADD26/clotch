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
        // Parakeet TDT v3 on the Mac for the voice in (#110). Its manifest is swift-tools 6.0: Xcode 16+.
        .package(url: "https://github.com/FluidInference/FluidAudio.git", from: "0.17.7"),
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
                .product(name: "FluidAudio", package: "FluidAudio"),
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
