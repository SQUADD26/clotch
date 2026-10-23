# Copertura dei requisiti di Clotch

Fonte: `copertura.jsonl` (una riga per requisito, 215 su 215 della `matrice.jsonl`; nessun id mancante, quindi nessuna riga «non verificato» aggiunta).
Controllo: `node sessioni/scripts/copertura.mjs` (anche dentro `npm test`, `test/copertura.test.ts`).

## Conteggi (215 requisiti)

| Campo | sì | parziale | no | non serve | non verificabile |
|---|---|---|---|---|---|
| Disegnato | 150 | - | 52 | - | 13 |
| Implementato | 78 | 55 | 82 | - | - |
| Collegato | 103 | - | 80 | 32 | - |
| Provato | 6 | 85 | 124 | - | - |

Stato complessivo per requisito (derivato dai quattro campi):

| Stato | n |
|---|---|
| Completo (implementato, collegato o non serve, provato sì) | 5 |
| Implementato ma non provato o provato solo in parte | 73 |
| Parziale (implementato parziale) | 55 |
| Mancante (implementato no) | 82 |

## Mancanti, per area

Disegnati ma non costruiti (da fare):

- A Struttura: A12 indicatore PR/ramo sulla riga, A17 larghezza regolabile, A19 barra sopra sotto 768, A21 layout 600 e 480, A22 barra di scorrimento.
- B Ricerca: B5 Trova nella chat.
- D Chat: D12 immagini e visore, D13 allegati nel messaggio, D16 link e menu del link, D17 menu testo selezionato.
- E Casella: E6 menu +, E9 slider potenza, E16 menu / e @, E17 trascina file, E18 finestra di contesto.
- F Stati: F7 avvio con logo, F9 aggiornare ora.
- G Componenti: G16 Rinomina, G21 elenco scorciatoie.
- I Stati visivi: I15 bottone premuto.
- K Filo: K1 vai in fondo, K3 separatore di data, K4 output lungo.
- R Nuovi: R2 sessioni figlie e PR.
- CL Clotch: CL3 dettatura, CL8 via dal Mac, CL9 schermo occupato.

Non disegnati e non costruiti (esclusi o fuori ambito; serve una decisione di Roberto solo se si vogliono):

- A: A2 nuova scheda, A3 rail, A4 selettore Codex, A7 nuova chat, A23 sfumatura, A24 tema chiaro, A28 finestra rapida e Mini, A29 mascotte, A30 PiP, A31 schede, A32 browser interno.
- B: B4 cerca file. C: C4 elimina, C5 condividi, C6 archivia con conferma, C9 configura ambiente.
- D: D4 pollici, D5 rigenera, D6 modifica messaggio inviato, D19 canvas, D20 plugin nel +, D21 memorie.
- E: E10 modelli bloccati, E14 rivedi gli hook. F: F5 accedi, F11 build Intel, F12 riavvia per applicare.
- H Impostazioni: H4, H5, H9, H10, H13, H14, H15, H19 a H30 (importa, profilo web, parentali, contatto fidato, sandbox, personalizzazione, mini, plugin, password, uso del computer, appshot, browser, computer cloud, hook, connessioni, Codex Cloud, revisione codice, git, worktree).
- I: I2, I4, I5, I7 a I11. CL: CL12 stato delle PR.

Parziali con funzione spenta o finta, da non scambiare per fatti: Ripristina archiviate (B7, H8), Allega e Detta disabilitati (D14, D23, E11), Andamento vuoto (H17, H37), Novità sempre nulla (H41), interruttori Clotch inerti (CL1, CL3, CL4, CL6), lingua e modello salvati senza effetto (G6, H2), nome utente fisso (A16, G19).

## Limiti della verifica

- Il controllo automatico verifica solo che ogni id della matrice sia una volta sola, che i valori dei quattro campi siano ammessi e che ogni `file:riga` (o `file:riga-riga`) citato nei campi `*_prova` esista nel repo. Non verifica che la riga contenga davvero ciò che la prova dice.
- Un file citato col solo nome (`Righe.tsx:25`) vale se almeno un file con quel nome ha quella riga: con nomi doppi (`Casella.tsx`, `index.tsx`, `Menu.tsx`) può dare un falso positivo.
- Le citazioni senza numero di riga, i frame Figma e le frasi «grep: 0 risultati» sono testo dei lettori e non sono rieseguiti dal controllo.
- Le prove con «non verificato» o «non letto» restano tali; 13 requisiti hanno «disegnato: non verificabile» perché serve guardare Figma.
- «Provato: sì» vale solo per 6 requisiti; molti test sono sulla logica (backend o funzioni pure), quasi nessuno sul DOM dei componenti.
- Lo stato complessivo è una regola meccanica sui quattro campi, non un giudizio sul valore del requisito.
