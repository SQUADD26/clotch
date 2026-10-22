#!/bin/bash
# Compila e installa Clotch in /Applications, solo da un ramo che contiene origin/dev (#174): il 22/10 una build da main,
# installata sopra quella di dev, ha tolto la correzione #159 e la voce è rimasta muta.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin dev
if ! git merge-base --is-ancestor origin/dev HEAD; then
    echo "NON installo: questo ramo non contiene origin/dev ($(git rev-parse --short origin/dev)). Fai il merge di origin/dev e riprova." >&2
    exit 1
fi
./build.sh
osascript -e 'quit app id "com.squadd.clotch"' 2>/dev/null || true
pkill -x Clotch 2>/dev/null || true
ditto .build/release/Clotch.app /Applications/Clotch.app.nuova
rm -rf /Applications/Clotch.app && mv /Applications/Clotch.app.nuova /Applications/Clotch.app
mkdir -p "$HOME/Library/Application Support/Clotch"
echo "$(git rev-parse --short HEAD) $(git branch --show-current) $(date '+%F %T')" > "$HOME/Library/Application Support/Clotch/installata.txt"
open /Applications/Clotch.app
echo "Installata: $(cat "$HOME/Library/Application Support/Clotch/installata.txt")"
