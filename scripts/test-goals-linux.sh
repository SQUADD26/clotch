#!/usr/bin/env bash
# Runs the goal-notch logic tests without macOS: a throwaway SwiftPM package under
# .build/goals-linux that symlinks the two Core goal files and the test file.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$root/.build/goals-linux"
rm -rf "$pkg"
mkdir -p "$pkg/Sources/CodeIslandCore" "$pkg/Tests/CodeIslandCoreTests"
ln -s "$root/Sources/CodeIslandCore/GoalBoard.swift" "$pkg/Sources/CodeIslandCore/GoalBoard.swift"
ln -s "$root/Sources/CodeIslandCore/GoalSources.swift" "$pkg/Sources/CodeIslandCore/GoalSources.swift"
ln -s "$root/Tests/CodeIslandCoreTests/GoalBoardTests.swift" "$pkg/Tests/CodeIslandCoreTests/GoalBoardTests.swift"
cat > "$pkg/Package.swift" <<'EOF'
// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "GoalsLinux",
    targets: [
        .target(name: "CodeIslandCore", path: "Sources/CodeIslandCore"),
        .testTarget(name: "CodeIslandCoreTests", dependencies: ["CodeIslandCore"], path: "Tests/CodeIslandCoreTests"),
    ]
)
EOF
cd "$pkg"
if [ -f "$HOME/swift/env.sh" ]; then
  . "$HOME/swift/env.sh"
  R="$HOME/swift/deps/root"
  swift test --sdk "$R" -Xmanifest -sdk -Xmanifest "$R" -Xswiftc -sdk -Xswiftc "$R"
else
  swift test
fi
