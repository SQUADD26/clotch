#!/bin/bash
# clotch#260: Clotch e il motore (claude-config) hanno un numero di contratto in comune: `Tests/Fixtures/motore/VERSIONE` = claude-config
# `contratto-clotch/VERSIONE`, e `motore versione` lo stampa. Prima c'era solo un'impronta, senza ordine: `installa --mac` riportava a main un motore
# più nuovo (S-0224: `apri_master.py` tornato indietro). Ora il motore si installa solo se manca o è più vecchio E main ha già il numero giusto;
# un motore con numero uguale o più alto non si tocca mai. Non blocca l'installazione di Clotch: dice cosa non combacia e cosa fare.
# Prova: scripts/test-controlla-motore.sh. Variabili (solo per la prova): MOTORE, INSTALLA, CLAUDE_CONFIG_REPO, FIXTURES.
set -u
fix=${FIXTURES:-$(cd "$(dirname "$0")/.." && pwd)/Tests/Fixtures/motore}
m=${MOTORE:-$HOME/.claude/bin/motore}; inst=${INSTALLA:-$HOME/.claude/bin/installa}; repo=${CLAUDE_CONFIG_REPO:-$HOME/claude-config}
sha() { shasum -a 256 2>/dev/null || sha256sum; }
voglio=$(awk '{print $1; exit}' "$fix/VERSIONE" 2>/dev/null); voglio=${voglio:-0}
qui=$(cd "$fix" && for f in $(LC_ALL=C ls); do printf '%s\0' "$f"; cat "$f"; done | sha | cut -c1-64)
ha=; hash=; completo=1; mancanti=
leggi() {  # legge `motore versione`: vuoto in $ha = il motore non c'è o non risponde
    local v; ha=; v=$("$m" versione 2>/dev/null) || true
    [ -n "$v" ] || return 0
    eval "$(printf %s "$v" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ha=%d hash=%s completo=%d mancanti=\"%s\"" % (d.get("versione", 0), d.get("contratto", ""), d.get("completo", False), " ".join(d.get("mancanti", []))))' 2>/dev/null)" || ha=
}
su_main() {  # numero di contratto di claude-config origin/main (0 = non lo ha)
    git -C "$repo" fetch -q origin 2>/dev/null || true
    git -C "$repo" show origin/main:global/hooks/contratto-clotch/VERSIONE 2>/dev/null | awk '{print $1; exit}'
}
installa() {
    if [ ! -x "$inst" ]; then echo "ATTENZIONE: il motore non c'è e manca claude-config ($inst). Clotch parte senza dati." >&2; return 1; fi
    "$inst" --mac >/dev/null 2>&1 || { echo "ATTENZIONE: installazione del motore non riuscita: rilancia $inst --mac e leggi l'errore." >&2; return 1; }
}
leggi
if [ -z "$ha" ]; then
    echo "Motore: non c'è, lo installo da claude-config main." ; installa && leggi
elif [ "$ha" -lt "$voglio" ]; then
    main=$(su_main); main=${main:-0}
    if [ "$main" -ge "$voglio" ]; then
        echo "Motore: contratto v$ha, Clotch vuole v$voglio: lo aggiorno da claude-config main (v$main)."; installa && leggi
    else
        echo "ATTENZIONE: il motore ha contratto v$ha, Clotch vuole v$voglio, e claude-config main è a v$main. NON lo tocco (main lo riporterebbe indietro). Promuovi dev su main in claude-config, oppure: $inst --mac --ref origin/dev" >&2
        exit 0
    fi
fi
[ -n "$ha" ] || { echo "ATTENZIONE: motore non utilizzabile: Clotch parte senza dati." >&2; exit 0; }
[ "$completo" = 1 ] || echo "ATTENZIONE: motore incompleto, mancano: $mancanti. Rilancia $inst --mac." >&2
if [ "$ha" -gt "$voglio" ]; then
    echo "ATTENZIONE: il motore ha contratto v$ha, più nuovo di questa Clotch (v$voglio). Non lo tocco. Aggiorna Clotch: merge di origin/dev (Tests/Fixtures/motore/) e reinstalla." >&2
elif [ "$ha" -lt "$voglio" ]; then
    echo "ATTENZIONE: il motore ha ancora contratto v$ha, Clotch vuole v$voglio. Alcune schermate possono leggere male." >&2
elif [ "$hash" = "$qui" ]; then
    echo "Motore: contratto v$ha, uguale a questa Clotch."
else
    echo "ATTENZIONE: motore e Clotch dicono contratto v$ha ma le impronte sono diverse: il contratto è cambiato senza alzare il numero (claude-config contratto-clotch/ e Tests/Fixtures/motore/ vanno tenuti uguali)." >&2
fi
exit 0
