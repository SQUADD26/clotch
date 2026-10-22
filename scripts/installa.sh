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
# claude-config#1998: il motore (registro richieste, obiettivi, eventi voce, Overseer) arriva con Clotch. Lo installa claude-config, la sua origine
# (le VPS ne usano una parte), poi si controlla che parli il contratto di questa Clotch: l'impronta di Tests/Fixtures/motore = `motore versione`.
motore() {
    local inst="$HOME/.claude/bin/installa" m="$HOME/.claude/bin/motore" v qui
    [ -x "$inst" ] || { echo "ATTENZIONE: il motore non c'è: manca claude-config ($inst). Clotch parte senza dati." >&2; return 0; }
    "$inst" --mac >/dev/null 2>&1 || echo "ATTENZIONE: installazione del motore non riuscita: rilancia $inst --mac e leggi l'errore." >&2
    v=$("$m" versione 2>/dev/null) || { echo "ATTENZIONE: motore incompleto: ${v:-$m manca}" >&2; return 0; }
    qui=$(cd Tests/Fixtures/motore && for f in $(LC_ALL=C ls); do printf '%s\0' "$f"; cat "$f"; done | shasum -a 256 | cut -c1-64)
    case $v in
        *"\"contratto\": \"$qui\""*) echo "Motore: installato, contratto uguale a questa Clotch." ;;
        *) echo "ATTENZIONE: il motore installato non parla il contratto di questa Clotch (Tests/Fixtures/motore diverse da contratto-clotch di claude-config main): alcune schermate possono leggere male." >&2 ;;
    esac
}
motore
osascript -e 'quit app id "com.squadd.clotch"' 2>/dev/null || true
pkill -x Clotch 2>/dev/null || true
ditto .build/release/Clotch.app /Applications/Clotch.app.nuova
rm -rf /Applications/Clotch.app && mv /Applications/Clotch.app.nuova /Applications/Clotch.app
mkdir -p "$HOME/Library/Application Support/Clotch"
echo "$(git rev-parse --short HEAD) $(git branch --show-current) $(date '+%F %T')" > "$HOME/Library/Application Support/Clotch/installata.txt"
open /Applications/Clotch.app
echo "Installata: $(cat "$HOME/Library/Application Support/Clotch/installata.txt")"
