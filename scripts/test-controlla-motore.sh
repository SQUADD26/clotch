#!/bin/bash
# Prova di scripts/controlla-motore.sh (clotch#260) con motore, installa e repo finti: un motore più nuovo non si tocca mai.
set -u
root=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "${T:?}"' EXIT
mkdir "$T/fix" "$T/repo"
printf '3 impronta\n' > "$T/fix/VERSIONE"; echo '{"a": 1}' > "$T/fix/a.json"
HASH=$(cd "$T/fix" && for f in $(LC_ALL=C ls); do printf '%s\0' "$f"; cat "$f"; done | (shasum -a 256 2>/dev/null || sha256sum) | cut -c1-64)
printf '#!/bin/bash\n[ -f "$T_STATO" ] || exit 127\ncat "$T_STATO"\n' > "$T/motore"
printf '#!/bin/bash\necho chiamata >> "$T_LOG"\n[ -f "$T_DOPO" ] && cp "$T_DOPO" "$T_STATO"\nexit 0\n' > "$T/installa"
chmod +x "$T/motore" "$T/installa"
git -C "$T/repo" init -q && git -C "$T/repo" -c user.email=t@t -c user.name=t commit -q --allow-empty -m x
main() {  # claude-config origin/main con contratto-clotch/VERSIONE = $1
    mkdir -p "$T/repo/global/hooks/contratto-clotch"; echo "$1 x" > "$T/repo/global/hooks/contratto-clotch/VERSIONE"
    git -C "$T/repo" add -A && git -C "$T/repo" -c user.email=t@t -c user.name=t commit -q -m v && git -C "$T/repo" update-ref refs/remotes/origin/main HEAD
}
json() { echo "{\"completo\": ${3:-true}, \"mancanti\": [], \"contratto\": \"${2:-$HASH}\", \"versione\": $1}"; }
FALLITI=0
prova() {  # prova <nome> <chiamate attese a installa> <testo atteso nell'output> [stato installato | -] [stato dopo installa | -]
    rm -f "${T:?}/stato" "${T:?}/dopo"; : > "$T/log"
    [ "${4:--}" = - ] || echo "$4" > "$T/stato"; [ "${5:--}" = - ] || echo "$5" > "$T/dopo"
    out=$(T_STATO="$T/stato" T_DOPO="$T/dopo" T_LOG="$T/log" MOTORE="$T/motore" INSTALLA="$T/installa" CLAUDE_CONFIG_REPO="$T/repo" FIXTURES="$T/fix" bash "$root/scripts/controlla-motore.sh" 2>&1)
    n=$(wc -l < "$T/log"); n=${n// /}
    if [ "$n" = "$2" ] && printf %s "$out" | grep -q "$3"; then echo "ok   $1"; else echo "ROSSO $1: installa chiamato $n volte (atteso $2), cercavo «$3»"; echo "$out" | sed 's/^/     /'; FALLITI=1; fi
}
main 3
prova "uguale: non si installa" 0 "contratto v3, uguale" "$(json 3)"
prova "più nuovo: non si tocca" 0 "più nuovo di questa Clotch" "$(json 4)"
prova "più vecchio e main pronto: si aggiorna" 1 "contratto v3, uguale" "$(json 2)" "$(json 3)"
prova "più vecchio e l'installazione non cambia nulla: detto" 1 "ha ancora contratto v2" "$(json 2)"
prova "senza numero (motore vecchio): si aggiorna" 1 "contratto v3, uguale" '{"completo": true, "mancanti": [], "contratto": "x"}' "$(json 3)"
prova "motore assente: si installa" 1 "contratto v3, uguale" - "$(json 3)"
prova "stesso numero, impronta diversa: detto, non toccato" 0 "impronte sono diverse" "$(json 3 altra)"
prova "incompleto: detto, non toccato" 0 "incompleto" "$(json 3 "$HASH" false)"
main 2
prova "più vecchio e main indietro: non si tocca" 0 "NON lo tocco" "$(json 2)"
[ "$FALLITI" = 0 ] && echo "controlla-motore: tutto ok" || { echo "controlla-motore: ROSSO"; exit 1; }
