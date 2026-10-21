#!/usr/bin/env bash
# #47: every clickable thing of the notch and of the settings uses the shared hover (NotchHover.swift).
# A plain Button style, an onTapGesture without the hover a few lines on, or a hand-made cursor push fails.
set -euo pipefail
cd "$(dirname "$0")/../Sources/Clotch"
files="GoalEditor ClotchNotchPage NotchElementViews NotchNotificationView NotchSections NotchPager NotchProposals NotchRequestsPlate NotchGoalPlate NotchAccountsViews NotchAccountsPlate GoalsNotchView GoalPRRow SessionOpener NotchCustomizeView SettingsView"
bad=0; buttons=0
for f in $files; do
  p="$f.swift"
  buttons=$((buttons + $(grep -cE 'Button[ ({]' "$p" || true)))
  if grep -nE '\.buttonStyle\(\.plain\)|NSCursor\.pointingHand' "$p"; then echo "FAIL $p: plain button or hand-made cursor"; bad=1; fi
  # each onTapGesture needs .notchHover within the next 2 lines (or on its own line)
  while IFS=: read -r n _; do
    if ! sed -n "${n},$((n + 2))p" "$p" | grep -q 'notchHover'; then echo "FAIL $p:$n onTapGesture without notchHover"; bad=1; fi
  done < <(grep -n 'onTapGesture' "$p" || true)
done
# the style itself must exist and keep Reduce Motion = colour only
grep -q 'lit && small && !reduceMotion' NotchHover.swift || { echo "FAIL NotchHover.swift: scale not gated by Reduce Motion"; bad=1; }
[ "$bad" = 0 ] && echo "hover check OK: $buttons buttons in $(echo $files | wc -w) files, no plain style, every tap gesture hovers (system bordered buttons keep the macOS look)"
exit $bad
