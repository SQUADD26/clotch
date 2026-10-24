# Copertura dei requisiti di Clotch

Fonte: `copertura.jsonl` (una riga per requisito, 215 su 215 della `matrice.jsonl`; nessun id mancante, quindi nessuna riga «non verificato» aggiunta: gli id mancanti restano com'erano, cioè nessuno).
Controllo: `node sessioni/scripts/copertura.mjs` (anche dentro `npm test`, `test/copertura.test.ts`). Stampa `COPERTURA_OK`.

## Conteggi (215 requisiti)

| Campo | sì | parziale | no | non serve | non verificabile |
|---|---|---|---|---|---|
| Disegnato | 152 | - | 54 | - | 9 |
| Implementato | 125 | 33 | 57 | - | - |
| Collegato | 128 | - | 40 | 47 | - |
| Provato | 99 | 58 | 58 | - | - |

Stato complessivo per requisito (derivato dai quattro campi):

| Stato | n |
|---|---|
| Completo (implementato sì, collegato sì o non serve, provato sì) | 92 |
| Implementato ma non collegato o non provato del tutto | 33 |
| Parziale (implementato parziale) | 33 |
| Mancante (implementato no) | 57 |

## Cosa è cambiato rispetto alla versione precedente

Versione precedente: Implementato 78 sì / 55 parziale / 82 no; Collegato 103 / 80 no / 32 non serve; Provato 6 sì / 85 parziale / 124 no; Disegnato 150 / 52 no / 13 non verificabile; completi 5.

- Implementato: 22 requisiti da no a sì (A12, A17, A19, A21, B4, B5, D12, D13, D17, E6, E9, E16, E17, F7, F9, G16, G21, K1, K3, K4, CL8, CL9) e 16 da parziale a sì (C2, D11, D14, D18, E7, E8, E12, E19, G5, G9, G15, G20, H11, FR4, FR6, CL6). Sei passano da no a parziale (D16, E18, I15, R2, CL3, CL12).
- Provato: 23 da no a sì e 19 da parziale a sì; 32 da no a parziale. Tornano indietro C5 e E13 (parziale a no) e F4, H3 (sì a parziale).
- Collegato: 29 da no a sì, 11 da no a «non serve» (solo struttura o escluso). Peggiorano CL1 e CL13 (sì a no): gli interruttori Clotch non arrivano a niente e il link all'app Claude si copia soltanto.
- Declassati a parziale perché la verifica ha trovato un pezzo spento o mancante: D7, F1, F4, F10. Declassati a no: E13, F8, CL13 (erano parziale).
- Disegnato: 6 requisiti da «non verificabile» a no (E10, E14, F5, F8, F11, F12), 4 da no a «non verificabile» (A24, A26, A27, C6), H40 e H43 da «non verificabile» a sì, B4 da no a sì, E13 da sì a no.
- Le prove file:riga sono state ricontrollate dallo script: tutte esistono, nessuna correzione necessaria.

## Mancanti (implementato no) e parziali, per area

Implementato no (57):

- A Struttura: A2 nuova scheda, A3 rail, A4 selettore Codex, A7 nuova chat, A22 barra di scorrimento (unico disegnato), A23 sfumatura, A24 tema chiaro, A28 finestra rapida e Mini, A29 mascotte, A30 PiP, A31 schede, A32 browser interno.
- C Sessione: C4 elimina, C5 condividi, C6 archivia con conferma, C9 configura ambiente.
- D Chat: D4 pollici, D5 rigenera, D6 modifica messaggio inviato, D19 canvas, D20 plugin nel +, D21 memorie.
- E Casella: E10 modelli bloccati, E13 scegli progetto, E14 rivedi gli hook.
- F Stati: F5 accedi, F8 uscire con chat attive, F11 build Intel, F12 riavvia per applicare.
- H Impostazioni: H4, H5, H9, H10, H13, H14, H15, H19 a H30 (importa, profilo web, parentali, contatto fidato, sandbox, personalizzazione, mini, plugin, password, uso del computer, appshot, browser, computer cloud, hook, connessioni, Codex Cloud, revisione codice, git, worktree).
- I Stati visivi: I2, I4, I5, I7 a I11. CL: CL13 apri nell'app Claude.

Implementato parziale (46):

- A: A6 popover fisso, A10 manca «…» sulla riga progetto, A16 nome fisso, A26 icona vuota nella barra dei menu, A27 menu nativi solo di serie, A33 niente terminale integrato.
- B: B3 azioni solo con testo digitato, B7 Ripristina spento. C: C7 prove in corso/fallita mai prodotte, C8 pannello senza file né differenze.
- D: D2 e D3 «Leggi con clotch AI» spento, D7 voce Leggi assente, D15 fonti non cliccabili, D16 manca il menu del link, D22 interrompi senza ascoltatore, D23 Detta spento nella casella.
- E: E11 microfono spento nella casella, E18 finestra contesto fissa a 200.000. F: F1 manca il vuoto al centro, F4 manca l'errore cartella al centro, F10 manca «Informazioni su» nel menu.
- G: G4 il › sostituisce il menu, G6 lingua non applicata, G7 popover a testo fisso, G19 nome fisso e «Info su clotch» apre Impostazioni.
- H: H2 lingua e cartella registro, H3 «Scegli le ore…» inerte, H8 Ripristina spento, H17 e H37 Andamento vuoto, H35 campo di sola lettura, H41 Novità sempre nulla. I: I15 manca :active.
- R: R1 contesto a finestra fissa 1M, R2 figlie e PR solo dall'app Claude desktop, R6 citazioni senza prove. FR: FR1 «Apri il registro» spento, FR2 microfono dell'app negato, FR7 clotch AI non avviata all'apertura.
- CL: CL1 «Scarica clotch» spento e interruttori inerti, CL2 interrompi senza ascoltatore, CL3 dettatura senza Clotch bloccata, CL5 ⌥Spazio promesso e non ascoltato, CL7 niente avvisi all'80% e 90%, CL12 solo l'ultima PR.

Funzioni spente o finte, da non scambiare per fatti: Ripristina archiviate (B7, H8), Detta nella casella (D23, E11), Leggi con clotch AI (D2, D3, D7), Andamento vuoto (H17, H37), Novità sempre nulla (H41), interruttori Clotch inerti (CL1), permessi e sforzo salvati ma non mandati al motore (E7, E9), lingua salvata senza effetto (G6, H2), nome utente fisso (A16, G19).

## Limiti della verifica

- Il controllo automatico verifica solo che ogni id della matrice sia una volta sola, che i valori dei quattro campi siano ammessi e che ogni `file:riga` (o `file:riga-riga`) citato nei campi `*_prova` esista nel repo. Non verifica che la riga contenga davvero ciò che la prova dice.
- Un file citato col solo nome (`Righe.tsx:25`) vale se almeno un file con quel nome ha quella riga: con nomi doppi (`Casella.tsx`, `index.tsx`, `Menu.tsx`) può dare un falso positivo.
- Le citazioni senza numero di riga, i frame Figma e le frasi «grep: 0 risultati» sono testo dei lettori e non sono rieseguiti dal controllo.
- Le prove con «non verificato» o «non letto» restano tali (per esempio A31, A32, C9, B8); 9 requisiti hanno «disegnato: non verificabile» perché serve guardare Figma.
- Lo stato complessivo è una regola meccanica sui quattro campi, non un giudizio sul valore del requisito.

## Unione dei rami qa/456 (collegamenti)

Aggiornati dopo l'unione di identita, interrompi, leggi, andamento, clotch-ai, pr-madre, novita: A16, G19, F10, A27 (profilo e menu), D2 (Leggi con clotch AI), H17, H37, H3 (Andamento, Scegli le ore), FR1, FR7, CL1 (collegamenti di clotch AI), B7, H8 (Ripristina), C7, CL12, R2 (PR e prove), CL2, D22, E12 (Interrompi con Clotch). Restano aperti con motivo nella colonna `mancante`: «manca-disegno» (A27, H3, FR1) e «manca-dato» (D2, CL1, CL2, CL7, CL12, R2, C7, D22).
