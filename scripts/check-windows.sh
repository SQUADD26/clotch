#!/usr/bin/env bash
# #82: no window opens unasked. The app has no SwiftUI scene that makes a window (the settings are one
# AppKit window, SettingsWindowController), and no test puts a window in front (the settings test swaps `present`).
set -euo pipefail
cd "$(dirname "$0")/.."
bad=0
if grep -rnE '^\s*(Settings|WindowGroup|Window|DocumentGroup|UtilityWindow)\s*[({]' Sources/Clotch; then
  echo "FAIL Sources/Clotch: a SwiftUI scene opens its own window"; bad=1; fi
if grep -rnE 'makeKeyAndOrderFront|\.show\(\)|NSApp\.activate' Tests; then
  echo "FAIL Tests: a test brings a window to the front"; bad=1; fi
grep -q 'present = { $0.alphaValue = 0' Tests/ClotchTests/NotchZoneViewsTests.swift || { echo "FAIL settings test does not draw transparent"; bad=1; }
[ "$bad" = 0 ] && echo "window check OK: no window scene in the app, no test brings a window to the front"
exit $bad
