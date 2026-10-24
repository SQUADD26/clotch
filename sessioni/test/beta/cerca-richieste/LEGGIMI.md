# Richieste nel filo (cercatrice #523)
Scene `design/scene/cri-*.json` (permessi, domande, domanda-senza-rid, piano, piano-senza-rid, esiti), generate da `scene.py` (da `sessioni/`: `python3 test/beta/cerca-richieste/scene.py`).
Giro: `SCENE=permessi,domande AREA=cri-permessi node test/beta/cerca-richieste/giro.mjs --out /tmp/cri --matrice --video`. `giro.mjs` aggiunge le scene `cri-*` alle aree del cliccatore, senza toccare `avvio.mjs`.
