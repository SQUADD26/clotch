#!/bin/bash
# Aggiornamento automatico di Clotch (#1119), al posto di Sparkle: launchd (com.squadd.clotch.aggiorna, messo da installa.sh) lo lancia
# ogni 30 minuti. Uso: aggiorna.sh <cartella del repo> [ref, default origin/main]
# Compila il ref in una cartella sua e lo installa con installa.sh (stessa firma), solo se è più nuovo dell'app installata:
# mai indietro (#174), quindi una build di dev non ancora in main resta finché main non la contiene. Mai mentre Clotch parla.
set -euo pipefail
repo=$1 ref=${2:-origin/main}
sup="$HOME/Library/Application Support/Clotch" dir="$HOME/Library/Caches/clotch-aggiorna"
log() { echo "$(date '+%F %T') $*"; }
mkdir "$sup/aggiorna.lock" 2>/dev/null || { log "già in corso"; exit 0; }
trap 'rmdir "$sup/aggiorna.lock"' EXIT
git -C "$repo" fetch -q origin
nuovo=$(git -C "$repo" rev-parse "$ref")
ora=$(cut -d' ' -f1 "$sup/installata.txt" 2>/dev/null || true)
if [ -n "$ora" ] && [ "$(git -C "$repo" rev-parse "$ora" 2>/dev/null)" = "$nuovo" ]; then exit 0; fi
# «dentro» = antenato, oppure le sue modifiche ci sono già: una PR fusa con squash non lascia il commit installato nella storia di main.
dentro() { git -C "$repo" merge-base --is-ancestor "$1" "$2" 2>/dev/null ||
    [ "$(git -C "$repo" merge-tree --write-tree "$2" "$1" 2>/dev/null | head -1)" = "$(git -C "$repo" rev-parse "$2^{tree}")" ]; }
if [ -n "$ora" ] && ! dentro "$ora" "$nuovo"; then
    log "non aggiorno: l'app installata ($ora) non è dentro $ref"; exit 0
fi
if grep -q '"parla" *: *true' "$HOME/.config/voce/stato.json" 2>/dev/null; then log "Clotch parla: riprovo al prossimo giro"; exit 0; fi
[ -d "$dir/.git" ] || [ -f "$dir/.git" ] || git -C "$repo" worktree add -q --detach "$dir" "$nuovo"
git -C "$dir" checkout -q --detach "$nuovo"
log "aggiorno a $ref $(git -C "$dir" rev-parse --short HEAD)"
cd "$dir" && CLOTCH_AGGIORNA=1 bash scripts/installa.sh
