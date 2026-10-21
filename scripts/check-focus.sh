#!/usr/bin/env bash
# #117: the notch never opens by itself and never takes the keyboard unasked. The panel is non-activating and
# becomes key only for a text field; nothing outside Roberto's own windows activates Clotch; no automatic event opens it.
set -euo pipefail
cd "${1:-$(dirname "$0")/..}/Sources/Clotch"
bad=0
fail() { echo "FAIL $1"; bad=1; }
grep -q 'styleMask: \[.borderless, .nonactivatingPanel\]' PanelWindowController.swift || fail "PanelWindowController.swift: panel is not .nonactivatingPanel"
grep -q 'panel.becomesKeyOnlyIfNeeded = true' PanelWindowController.swift || fail "PanelWindowController.swift: a click on a button makes the panel key"
# makeKey() only in takeKeyboard (the goal editor asks for it)
{ [ "$(grep -rn 'makeKey()' . | wc -l)" = 1 ] && grep -A1 'func takeKeyboard' PanelWindowController.swift | grep -q 'makeKey()'; } \
  || { grep -rn 'makeKey()' . || true; fail "makeKey() outside PanelWindowController.takeKeyboard"; }
{ grep -q 'takeKeyboard()' GoalEditor.swift && grep -q 'giveBackKeyboard()' GoalEditor.swift; } || fail "GoalEditor.swift: keyboard not taken and given back with the field"
# activating Clotch: only the windows Roberto opens (settings, notch customise)
if grep -rnE 'NSApp\.activate|makeKeyAndOrderFront' . | grep -vE '^\./(SettingsWindowController|NotchCustomizeView)\.swift:'; then
  fail "a window outside the settings activates Clotch"; fi
# a hover-enter counts only when the pointer moved (a still pointer under a growing island is not Roberto)
grep -q 'hoverGate.enter(at: NSEvent.mouseLocation, secondsSincePointerMoved:' NotchPanelView.swift || fail "NotchPanelView.swift: hover opens with a still pointer"
# …and a real move of a pointer resting on the island opens it, without leaving and coming back
grep -q 'hoverGate.move(to: NSEvent.mouseLocation) { handleHover(true) }' NotchPanelView.swift || fail "NotchPanelView.swift: a move inside the island does not open it"
# automatic events (feeds, alerts, voice, screens, notifications) never open the notch or activate
events="NotchNotifier GoalStore PullRequestFeed AccountQuotaFeed AccountsInUseFeed VoiceStore VoiceSpeaker VoiceAlertCenter ScreenDetector PanelWindowController StatusItemController"
for f in $events; do
  if grep -nE 'surface = \.(sessionList|approvalCard|questionCard|completionCard)|\.activate\(|[^a-zA-Z]orderFront\(|makeKeyAndOrderFront' "$f.swift"; then
    fail "$f.swift: an automatic event opens the notch or activates"; fi
done
# AppDelegate opens the notch only from the shortcut (and the DEBUG preview): no boot expand
[ "$(grep -c 'surface = \.sessionList' AppDelegate.swift)" = 2 ] || fail "AppDelegate.swift: the notch opens by itself at launch"
[ "$bad" = 0 ] && echo "focus check OK: non-activating panel, key only for a text field, hover only with a moving pointer, no event opens the notch"
exit $bad
