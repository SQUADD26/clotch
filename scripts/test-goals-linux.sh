#!/usr/bin/env bash
# Runs the goal-notch logic tests without macOS: a throwaway SwiftPM package under
# .build/goals-linux that symlinks the two Core goal files and the test file.
set -euo pipefail
bash "$(dirname "$0")/check-hover.sh"
root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$root/.build/goals-linux"
rm -rf "$pkg"
mkdir -p "$pkg/Sources/CodeIslandCore" "$pkg/Tests/CodeIslandCoreTests"
# Every pure goal-notch file: the Goal*, Notch*, Account* and Pull* sources (with the session target they use), their tests and fixtures.
for f in "$root"/Sources/CodeIslandCore/{Goal,Notch,Account,Pull,SessionTarget,ClaudeDesktopCodeSession}*.swift; do ln -s "$f" "$pkg/Sources/CodeIslandCore/"; done
for f in "$root"/Tests/CodeIslandCoreTests/{Goal,Notch,Account,Pull,SessionTarget,ClaudeDesktopCodeSession}*.swift; do ln -s "$f" "$pkg/Tests/CodeIslandCoreTests/"; done
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
