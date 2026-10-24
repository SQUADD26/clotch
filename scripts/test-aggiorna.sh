#!/bin/bash
# Prova di aggiorna.sh (#1119) con repo finto e HOME finta: installa solo un ref più nuovo, mai indietro, mai mentre Clotch parla.
set -euo pipefail
s=$(cd "$(dirname "$0")" && pwd)/aggiorna.sh t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
export HOME=$t/casa; mkdir -p "$HOME/Library/Application Support/Clotch" "$HOME/.config/voce"
g() { git -c user.name=t -c user.email=t@t "$@"; }
git init -q --bare "$t/origine.git"; git clone -q "$t/origine.git" "$t/repo" 2>/dev/null; cd "$t/repo"
mkdir scripts; echo 'echo "$(git rev-parse --short HEAD)" > "$HOME/installato"' > scripts/installa.sh
git add -A; g commit -qm A; a=$(git rev-parse --short HEAD)
g commit -q --allow-empty -m B; git push -q origin HEAD:canale; b=$(git rev-parse --short HEAD)
sup="$HOME/Library/Application Support/Clotch"
ok() { [ "$1" = "$2" ] || { echo "FALLITO: $3 (atteso «$2», trovato «$1»)"; exit 1; }; }
gira() { bash "$s" "$t/repo" origin/canale; }
echo "$b x" > "$sup/installata.txt"; gira >/dev/null; ok "$(cat "$HOME/installato" 2>/dev/null || true)" "" "stessa versione: niente"
echo "$a x" > "$sup/installata.txt"; echo '{"parla": true}' > "$HOME/.config/voce/stato.json"
gira | grep -q "Clotch parla" || { echo "FALLITO: mentre parla"; exit 1; }; ok "$(cat "$HOME/installato" 2>/dev/null || true)" "" "mentre parla: niente"
rm "$HOME/.config/voce/stato.json"; gira >/dev/null; ok "$(cat "$HOME/installato")" "$b" "più nuova: installa"
git checkout -q -b altro "$a"; g commit -q --allow-empty -m C; c=$(git rev-parse --short HEAD); rm "$HOME/installato"
echo "$c x" > "$sup/installata.txt"; gira | grep -q "non aggiorno" || { echo "FALLITO: indietro"; exit 1; }
ok "$(cat "$HOME/installato" 2>/dev/null || true)" "" "fuori dal canale: niente"
echo "test-aggiorna: 4 casi ok"
