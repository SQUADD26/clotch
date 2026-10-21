#!/usr/bin/env bash
# #47: every clickable thing of the notch and of the settings uses the shared hover (NotchHover.swift).
# A plain Button style, an onTapGesture without the hover a few lines on, or a hand-made cursor push fails.
set -euo pipefail
<<<<<<< HEAD
cd "$(dirname "$0")/../Sources/Clotch"
files="GoalEditor ClotchNotchPage NotchElementViews NotchNotificationView NotchSections NotchPager NotchProposals NotchRequestsPlate NotchGoalPlate NotchAccountsViews NotchAccountsPlate GoalsNotchView GoalPRRow SessionOpener NotchCustomizeView SettingsView"
=======
cd "$(dirname "$0")/../Sources/CodeIsland"
files="GoalEditor ClotchNotchPage NotchElementViews NotchNotificationView NotchSections NotchPager NotchProposals NotchRequestsPlate NotchGoalPlate NotchAccountsViews NotchAccountsPlate GoalsNotchView GoalPRRow SessionOpener NotchCustomizeView SettingsView NotchPanelView AgentTaskProgressView MarkdownReplyView PushSettingsView VoiceSettingsPage"
>>>>>>> origin/dev
bad=0; buttons=0
for f in $files; do
  p="$f.swift"
  buttons=$((buttons + $(grep -cE 'Button[ ({]' "$p" || true)))
  if grep -nE '\.buttonStyle\(\.(plain|borderless)\)|NSCursor\.pointingHand' "$p"; then echo "FAIL $p: plain/borderless button or hand-made cursor"; bad=1; fi
  # each onTapGesture needs .notchHover within the next 2 lines (or on its own line)
  while IFS=: read -r n _; do
    if ! sed -n "${n},$((n + 2))p" "$p" | grep -q 'notchHover'; then echo "FAIL $p:$n onTapGesture without notchHover"; bad=1; fi
  done < <(grep -n 'onTapGesture' "$p" || true)
done
# #65: Rifiuta and Accetta are the same tone pill, red and green
grep -q 'Button("Rifiuta").*\.buttonStyle(\.tone(\.stop))' NotchProposals.swift || { echo "FAIL NotchProposals.swift: Rifiuta is not the red tone pill"; bad=1; }
grep -q 'Button("Accetta").*\.buttonStyle(\.tone(\.go))' NotchProposals.swift || { echo "FAIL NotchProposals.swift: Accetta is not the green tone pill"; bad=1; }
grep -q 'lit && !reduceMotion ? 1.03' NotchHover.swift || { echo "FAIL NotchHover.swift: tone pill scale not gated by Reduce Motion"; bad=1; }
# the style itself must exist and keep Reduce Motion = colour only
grep -q 'lit && small && !reduceMotion' NotchHover.swift || { echo "FAIL NotchHover.swift: scale not gated by Reduce Motion"; bad=1; }
[ "$bad" = 0 ] && echo "hover check OK: $buttons buttons in $(echo $files | wc -w) files, no plain style, every tap gesture hovers (system bordered buttons keep the macOS look)"
exit $bad
