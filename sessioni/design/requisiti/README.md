# App intera: requisiti e prove (#437)

Obiettivo originale di Roberto:

> Crea l'app intera, in ogni suo punto, come ChatGPT. Riferimenti in vault obsidian squaddv2. Figma dato, segui le indicazioni UI e riempi tutti i buchi mancanti (anche quelli che potenzialmnete ci siamo persi).

## Fonti

- Figma Clotch, file `gayvkX0IaLjZghH2otVbJt`, pagina Sessioni `101:6839`.
- Vault squadd-v2, `Research/App/ChatGPT` e `Research/UI/Catalogo decisioni UI`.
- Inventario precedente: `../inventario-chatgpt.md`.
- Base letta per l'audit iniziale: `2b9673e`.

## Matrici

`matrice.jsonl` conserva una riga per ciascuno dei 215 elementi storici. Conserva anche le 70 esclusioni: devono essere riesaminate, non scompaiono dal nuovo obiettivo. Lo stato storico non prova implementazione, approvazione o funzionamento. Le evidenze iniziano vuote; ogni riga richiede una verifica attuale prima di cambiare stato.

`schermate-figma.jsonl` conserva le 160 schermate e stati letti dal ponte Figma. La presenza nel file non prova parità dell'app, approvazione di aggiunte nuove o funzionamento dei controlli.

## Condizioni di fine

Ogni elemento richiede: fonte; disegno; decisione dove necessaria; componente reale; collegamento al motore; prova del percorso; stati di errore e recupero; verifica visiva attuale. Ogni esclusione richiede una decisione umana applicabile. Un controllo spento, un handler vuoto o un messaggio di successo senza effetto non soddisfano il requisito.

I test di regressione e i confronti immagine accompagnano queste prove. Non sostituiscono il controllo di ogni requisito. Le correzioni singole non chiudono l'obiettivo dell'app intera.

## Prime cause accertate

- #438: risposte asincrone di altre chat e caricamenti superati.
- #439: bozze e modifica coda senza identità di conversazione.
- #440: risposte Markdown stampate grezze; nuovo disegno da verificare.
- #441: resize non osservato dopo il ritorno dalle impostazioni.

Restano da provare e completare, fra le altre: paginazione stabile durante nuovi messaggi, ricerca fino al messaggio trovato, azioni con esito reale, richieste collegate per identità, voce, allegati, capacità del motore, tutte le impostazioni, schermate strette, tastiera e focus, contenuti ricchi, distribuzione e aggiornamenti. Nessuna di queste famiglie è esclusa da questo documento.
