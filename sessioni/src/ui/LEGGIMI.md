# Interfaccia di Sessioni: come ci si costruisce sopra

React + TypeScript, costruito da Vite in `renderer/`. Disegno: file Figma «Clotch», pagina «Sessioni». Prima il frame Figma, poi il codice (skill `figma-ui-design`, fase 10).

## Montare un pezzo

Ogni pezzo tocca solo la sua cartella: `barra/`, `chat/`, `pannello/`, `impostazioni/`, `clotch-ai/`. La cornice (`base/Cornice.tsx`) monta già il loro `index.tsx`:

| Pezzo | Export | Dove sta |
|---|---|---|
| `barra` | `default` | colonna «Barra laterale» (larga `misura-barra-laterale`, gap `spazio-0-5`) |
| `chat` | `Intestazione`, `default` | in cima alla «Superficie»; nella «Colonna» centrale (i figli sono larghi al massimo `misura-colonna`) |
| `pannello` | `default` | colonna destra (`misura-pannello`); se torna `null` la colonna centrale si allarga. Quando non c'è posto accanto alla colonna (frame 1024) si apre sopra, dal bottone dell'intestazione |
| `clotch-ai` | `Intestazione`, `default` | al posto della chat quando la vista è `clotch-ai`, senza pannello |
| `impostazioni` | `default` | tutto il corpo sotto la barra del titolo; usa `Superficie` da `base/Cornice` |

Il bottone «Pannello» della chat gira: pannello dell'obiettivo -> «Info sessione» (schede Ambiente, Contesto, Connettori, Modifiche; bottone premuto, `pannelloInfo`) -> chiuso. Contesto usato e file toccati vengono dal main (`api().info(id)`, `src/info-sessione.ts`); madre, PR, connettori e versione dal file `local_*.json` dell'app (`Sessione.app`, `src/desktop.ts`). Le figlie stanno sotto la madre nella barra (`barra/figlie.ts`). Finché l'elenco non arriva la cornice mostra «Avvio» (`base/Avvio.tsx`); una sessione aperta da una vista di clotch AI porta «Torna a clotch AI» nella barra del titolo (`daClotchAi`).

Navigazione condivisa: `useNavigazione()` da `base/navigazione` (vista, sessione scelta, sezione, `apri(vista, sessione?, sezione?)`, indietro/avanti, barra e pannello aperti). Viste: `sessione`, `clotch-ai`, `casella`, `decisioni`, `regole` (le quattro di clotch AI montano `clotch-ai/`), `impostazioni`.

Finestre (`base/layout.tsx`, frame 101:29280, 29399, 29552, 29770, 29971): sotto `LARGHEZZA_BARRA_FISSA` (la colonna non tiene più la bolla piena) la barra laterale non sta accanto alla colonna ma sopra, con il velo (`useNavigazione().sovrapposta`; chiude con clic sul velo, Esc, scelta di una sessione). Barra e pannello hanno uno stato per ogni misura (`barraAperta`/`pannelloAperto` sono quelli della misura di adesso). Sotto la bolla piena la casella è compatta: `.corpo[data-compatta]` nasconde `.chip .etichetta`, `.chip .livello` e `.contesto` della casella. La barra a finestra larga si allarga con la maniglia (`barraLarghezza` nelle impostazioni, doppio clic = misura del disegno). Misura minima della finestra: «Finestra 480».

Barra del titolo: dopo la navigazione la campana «Attività» della base (numero = sessioni che aspettano te, come «Casella»; il clic apre il popover). A destra, nei «comandi globali», la cornice monta `ComandiTitolo` se `pannello/` o `clotch-ai/` lo esportano con nome.

Prima riga di ogni file di interfaccia: `// figma: <node-id>` del frame approvato.

## Token e componenti

- Mai un valore a mano: solo `var(--nome)` (CSS) o `t("nome")` (`base/token.ts`). I nomi sono quelli di Figma con `-`: `colore/fondo/cornice` diventa `--colore-fondo-cornice`.
- Un valore che manca: prima la variabile in Figma, poi si riesporta `design/tokens.json` e si lancia `npm run token`. I file generati non si toccano.
- Componenti in `base/`: `Bottone`, `BottoneIcona`, `Pillola` (Bottone.tsx), `Icona` (le icone «Icona/*» di Figma), `Campo`, `Menu` (voci, `testata`, voce `pericolo`, voci con `scelta` e spunta), `IconaSessione` (icona e colore di una sessione, dalle preferenze), `Glifo` (icona in un colore token qualunque), `SegnoStato`, `MessaggioAlCentro` e `StatoErrore` (vuoto ed errore), `Sagome` (caricamento), avvisi a comparsa.
- Avviso a comparsa, uno solo per tutta l'app: `avvisa({ tipo: "info" | "successo" | "errore" | "caricamento", messaggio, azione? })`, poi `aggiornaAvviso(id, …)` o `chiudiAvviso(id)`. La pila sta in basso al centro della colonna; la chat la alza sopra la casella con `--avvisi-basso` sulla colonna.
- Classi di testo in `base/stile.css`: `t-xs`…`t-xl`, `medio`, `codice`, `secondario`, `terziario`.

## Dati dal processo main

Un solo modo: `base/dati.ts`. `useElenco()`, `useMessaggi(id)` (con `totale`: messaggi di tutta la sessione, null finché l'indice non la conosce), `useAggiornamenti(cb)`, `usePreferenze()` (icona, colore, fissa, non letta per sessione), `useImpostazioni()` (impostazioni dell'app: `dati`, `imposta(parte)`, null toglie), `useChiamata(fn, deps)`. Azioni su una sessione: `api().azione(id, "nuova-finestra" | "copia-id" | "copia-cartella" | "copia-link" | "mostra-nel-finder" | "apri-terminale")`. Ricerca e spazio hanno un solo indice e una sola cache, nel main: `api().cerca(testo)` (al massimo 50 `RisultatoRicerca`: `id`, `titolo`, `frammento`, `t`, `nelTitolo`; prima i titoli, poi i più recenti), `api().spazio()` (byte di indice, cache e `altro`, il resto della cartella dell'app), `api().ricostruisci()`, `api().svuota()`; `PaginaMessaggi.totale` = messaggi di tutta la sessione (null finché l'indice non la conosce). Menu della casella: `api().comandi(id)` (comandi con «/» di base, dell'account e del progetto: `commands/*.md`, `skills/*/SKILL.md`) e `api().file(id, testo)` (file della cartella della sessione per «@», con git se c'è). Scelte per chat nelle preferenze della sessione: `modello` (id CLI, lo manda `manda`), `sforzo`, `rapida`, `permessi`; la sessione dà `permessi` (`permissionMode` della trascrizione) e `contesto` (token all'ultima risposta). Nessun pezzo tiene un suo indice o un suo file di impostazioni. Danno `stato` (`carica` | `pronto` | `errore`), `errore` e `riprova()`; gli aggiornamenti dal vivo ricaricano senza svuotare lo schermo. Allegati, immagini del filo e skill della casella: `window.casella` (`CasellaApi` in `src/tipi.ts`, `chat/percorsi.ts` per le parti pure): `scegli`, `descrivi`, `percorso(file)` (file trascinato), `immagine`, `copiaImmagine`, `salvaImmagine`, `skill`. Un file allegato va in fondo al testo come riga `@percorso`; l'immagine di una riga della trascrizione si rilegge per `uuid` e posizione (`RifImmagine`), mai nel messaggio. Un canale nuovo del main va in `src/tipi.ts` (`SessioniApi`), `src/preload.ts` e `src/main.ts`, una riga per file.

## Con e senza Clotch (#437)

`useClotchAcceso()` (`pannello/Pillole`) dice se Clotch è acceso. Il registro che arriva da `useRegistro()` porta anche, dal main (`src/stato-app.ts`): `schermo` (uno script usa lo schermo, pillola in barra), `afk` (sei via dal Mac, banda sotto Regole), `voceApp` (l'app sta dicendo un avviso con `say`). `clotch-ai/dettatura.ts`: `useVoce()` = chi parla o ascolta (Clotch dal registro, altrimenti l'app); `CasellaVoce` prende il posto della casella di clotch AI. Comandi locali dell'app (`voce_ferma`, `clotch_dettatura`, `clotch_interrompi_voce`): stesso `clotchAi().comando(...)`, ma `src/comandi-app.ts` non li scrive nella casella. Scene di prova: `node scripts/scene-clotch.mjs`; `sezione` = `dettatura:<testo>` apre il microfono con quel testo, `avviso-notch` mostra l'avviso a comparsa; nel registro della scena `schermo.da` e `afk.da` ≤ 0 sono «ms fa».

## Prova di parità

```bash
npm run parita -- 101-8036
P=~/.claude/skills/figma-ui-design/parita.mjs
node $P token design/figma/101-8036.json design/tokens.json $(grep -rl "figma:" src/ui --include=*.tsx --include=*.css)
node $P immagine design/figma/101-8036.png design/app/101-8036.png --soglia 0.08
```

Scena di prova: `design/scene/<node-id>.json` = `{ navigazione?: { vista, sessione?, sezione? }, elenco?, messaggi?: { <id sessione>: [...] }, preferenze?, impostazioni?, registro? }` (tipo `Scena` in `src/scena.ts`). Se c'è, in parità il main risponde coi suoi dati al posto di quelli del Mac e la finestra parte da quella vista. Un file per frame; un canale nuovo del main aggiunge la sua chiave in `src/scena.ts`. Un frame che non è una finestra (foglio di stati di un pezzo): il pezzo esporta `scene: { "<node-id>": () => <... /> }` dal suo `index.tsx` e la parità disegna quella al posto della cornice, sul fondo del riquadro.

`npm run parita -- <node-id>` disegna la pagina a scala 1 alla misura del frame `design/figma/<node-id>.json` e salva `design/app/<node-id>.png`. Il frame si legge prima con `leggi-frame.js` e il suo PNG si esporta da Figma a scala 1 (skill `figma-ui-design`). Per la sola cornice: `design/figma/101-8036-cornice.png` e `101-8610-cornice.png` (frame con i pezzi nascosti).
