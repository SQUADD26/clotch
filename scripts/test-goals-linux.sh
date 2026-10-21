#!/usr/bin/env bash
# Runs the ClotchCore tests without macOS: a throwaway SwiftPM package under
# .build/goals-linux that symlinks the Core sources and tests Linux can build.
set -euo pipefail
bash "$(dirname "$0")/check-hover.sh"
bash "$(dirname "$0")/check-windows.sh"
bash "$(dirname "$0")/check-focus.sh"
root="$(cd "$(dirname "$0")/.." && pwd)"
pkg="$root/.build/goals-linux"
rm -rf "$pkg"
mkdir -p "$pkg/Sources/ClotchCore" "$pkg/Tests/ClotchCoreTests"
# Every Core source and test Linux can build, chosen by rule (scripts/linux-buildable.py): a new Core
# file joins by itself.
python3 "$root/scripts/linux-buildable.py" "$root" | while read -r f; do
  ln -s "$f" "$pkg/${f#"$root"/}"
done
cat > "$pkg/Package.swift" <<'EOF'
// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "GoalsLinux",
    targets: [
        .target(name: "ClotchCore", path: "Sources/ClotchCore"),
        .testTarget(name: "ClotchCoreTests", dependencies: ["ClotchCore"], path: "Tests/ClotchCoreTests"),
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
