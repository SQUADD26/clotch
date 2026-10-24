#!/bin/bash
# Compila e installa Clotch in /Applications, solo da un ramo che contiene origin/dev (#174): il 22/10 una build da main,
# installata sopra quella di dev, ha tolto la correzione #159 e la voce è rimasta muta.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin dev
# CLOTCH_AGGIORNA=1: lo lancia aggiorna.sh (#1119), che ha già controllato di non tornare indietro rispetto all'app installata.
if [ "${CLOTCH_AGGIORNA:-}" != 1 ] && ! git merge-base --is-ancestor origin/dev HEAD; then
    echo "NON installo: questo ramo non contiene origin/dev ($(git rev-parse --short origin/dev)). Fai il merge di origin/dev e riprova." >&2
    exit 1
fi
./build.sh
# claude-config#1998, clotch#260: il motore (registro richieste, obiettivi, eventi voce, Overseer) arriva con Clotch, ma mai sopra un motore più nuovo:
# si installa solo se manca o ha un numero di contratto più basso di questa Clotch (Tests/Fixtures/motore/VERSIONE = `motore versione`).
bash scripts/controlla-motore.sh
osascript -e 'quit app id "com.squadd.clotch"' 2>/dev/null || true
pkill -x Clotch 2>/dev/null || true
ditto .build/release/Clotch.app /Applications/Clotch.app.nuova
rm -rf /Applications/Clotch.app && mv /Applications/Clotch.app.nuova /Applications/Clotch.app
mkdir -p "$HOME/Library/Application Support/Clotch"
echo "$(git rev-parse --short HEAD) $(git branch --show-current) $(date '+%F %T')" > "$HOME/Library/Application Support/Clotch/installata.txt"
open /Applications/Clotch.app
# #1119: l'aggiornamento automatico (scripts/aggiorna.sh) gira da launchd ogni 30 minuti, sul repo di questa cartella.
sup="$HOME/Library/Application Support/Clotch" agente="$HOME/Library/LaunchAgents/com.squadd.clotch.aggiorna.plist"
cp scripts/aggiorna.sh "$sup/aggiorna.sh.nuovo" && mv "$sup/aggiorna.sh.nuovo" "$sup/aggiorna.sh"  # file nuovo: quello che gira ora resta intero
cat > "$agente" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.squadd.clotch.aggiorna</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$sup/aggiorna.sh</string><string>$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")</string></array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>StartInterval</key><integer>1800</integer>
<key>StandardOutPath</key><string>$sup/aggiorna.log</string><key>StandardErrorPath</key><string>$sup/aggiorna.log</string>
</dict></plist>
PLIST
if [ "${CLOTCH_AGGIORNA:-}" != 1 ]; then  # da aggiorna.sh no: bootout fermerebbe proprio questo processo
    launchctl bootout "gui/$(id -u)/com.squadd.clotch.aggiorna" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$agente"
fi
echo "Installata: $(cat "$HOME/Library/Application Support/Clotch/installata.txt")"
