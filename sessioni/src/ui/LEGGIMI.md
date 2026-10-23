# Interfaccia di Sessioni: come ci si costruisce sopra

React + TypeScript, costruito da Vite in `renderer/`. Disegno: file Figma «Clotch», pagina «Sessioni». Prima il frame Figma, poi il codice (skill `figma-ui-design`, fase 10).

## Montare un pezzo

Ogni pezzo tocca solo la sua cartella: `barra/`, `chat/`, `pannello/`, `impostazioni/`, `friday/`. La cornice (`base/Cornice.tsx`) monta già il loro `index.tsx`:

| Pezzo | Export | Dove sta |
|---|---|---|
| `barra` | `default` | colonna «Barra laterale» (larga `misura-barra-laterale`, gap `spazio-0-5`) |
| `chat` | `Intestazione`, `default` | in cima alla «Superficie»; nella «Colonna» centrale (i figli sono larghi al massimo `misura-colonna`) |
| `pannello` | `default` | colonna destra (`misura-pannello`); se torna `null` la colonna centrale si allarga. Sparisce da sola quando non c'è posto (frame 1024) |
| `friday` | `Intestazione`, `default` | al posto della chat quando la vista è `friday`, senza pannello |
| `impostazioni` | `default` | tutto il corpo sotto la barra del titolo; usa `Superficie` da `base/Cornice` |

Navigazione condivisa: `useNavigazione()` da `base/navigazione` (vista, sessione scelta, sezione, `apri(vista, sessione?, sezione?)`, indietro/avanti, barra e pannello aperti). Viste: `sessione`, `friday`, `casella`, `decisioni`, `regole` (le quattro di Friday montano `friday/`), `impostazioni`.

Barra del titolo: a destra, nei «comandi globali», la cornice monta `ComandiTitolo` se `pannello/` o `friday/` lo esportano con nome.

Prima riga di ogni file di interfaccia: `// figma: <node-id>` del frame approvato.

## Token e componenti

- Mai un valore a mano: solo `var(--nome)` (CSS) o `t("nome")` (`base/token.ts`). I nomi sono quelli di Figma con `-`: `colore/fondo/cornice` diventa `--colore-fondo-cornice`.
- Un valore che manca: prima la variabile in Figma, poi si riesporta `design/tokens.json` e si lancia `npm run token`. I file generati non si toccano.
- Componenti in `base/`: `Bottone`, `BottoneIcona`, `Pillola` (Bottone.tsx), `Icona` (le icone «Icona/*» di Figma), `Campo`, `Menu`, `SegnoStato`, `MessaggioAlCentro` e `StatoErrore` (vuoto ed errore), `Sagome` (caricamento), avvisi a comparsa.
- Avviso a comparsa, uno solo per tutta l'app: `avvisa({ tipo: "info" | "successo" | "errore" | "caricamento", messaggio, azione? })`, poi `aggiornaAvviso(id, …)` o `chiudiAvviso(id)`. La pila sta in basso al centro della colonna; la chat la alza sopra la casella con `--avvisi-basso` sulla colonna.
- Classi di testo in `base/stile.css`: `t-xs`…`t-xl`, `medio`, `codice`, `secondario`, `terziario`.

## Dati dal processo main

Un solo modo: `base/dati.ts`. `useElenco()`, `useMessaggi(id)`, `useAggiornamenti(cb)`, `usePreferenze()` (icona, colore, fissa, non letta per sessione), `useChiamata(fn, deps)`. Azioni su una sessione: `api().azione(id, "nuova-finestra" | "copia-id" | "copia-cartella" | "copia-link" | "mostra-nel-finder")`. Danno `stato` (`carica` | `pronto` | `errore`), `errore` e `riprova()`; gli aggiornamenti dal vivo ricaricano senza svuotare lo schermo. Un canale nuovo del main va in `src/tipi.ts` (`SessioniApi`), `src/preload.ts` e `src/main.ts`, una riga per file.

## Prova di parità

```bash
npm run parita -- 101-8036
P=~/.claude/skills/figma-ui-design/parita.mjs
node $P token design/figma/101-8036.json design/tokens.json $(grep -rl "figma:" src/ui --include=*.tsx --include=*.css)
node $P immagine design/figma/101-8036.png design/app/101-8036.png --soglia 0.08
```

Scena di prova: `design/scene/<node-id>.json` = `{ navigazione?: { vista, sessione?, sezione? }, elenco?, messaggi?: { <id sessione>: [...] }, preferenze?, registro? }` (tipo `Scena` in `src/scena.ts`). Se c'è, in parità il main risponde coi suoi dati al posto di quelli del Mac e la finestra parte da quella vista. Un file per frame; un canale nuovo del main aggiunge la sua chiave in `src/scena.ts`. Un frame che non è una finestra (foglio di stati di un pezzo): il pezzo esporta `scene: { "<node-id>": () => <... /> }` dal suo `index.tsx` e la parità disegna quella al posto della cornice, sul fondo del riquadro.

`npm run parita -- <node-id>` disegna la pagina a scala 1 alla misura del frame `design/figma/<node-id>.json` e salva `design/app/<node-id>.png`. Il frame si legge prima con `leggi-frame.js` e il suo PNG si esporta da Figma a scala 1 (skill `figma-ui-design`). Per la sola cornice: `design/figma/101-8036-cornice.png` e `101-8610-cornice.png` (frame con i pezzi nascosti).
