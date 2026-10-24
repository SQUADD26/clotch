# Beta tester dell'app Electron (#518)

Clicca ogni elemento cliccabile di un'area dell'app vera, fotografa prima e dopo, prova Esc, frecce e Tab, lancia le sonde su ogni stato. Modello: skill `beta-tester` di squadd-v2 (`criteri.md`), adattato all'app Electron.

```bash
cd sessioni && npm ci && npm run build && npm run scene
node test/beta/clicca.mjs --area barra --matrice --video --out /tmp/beta-barra
node test/beta/giudica.mjs /tmp/beta-barra
```

- Aree: `barra`, `chat`, `nuova`, `friday`, `impostazioni`, `cornice`, `tutto` (scena e radice in `avvio.mjs`, `AREE`).
- Opzioni: `--tema chiaro|scuro`, `--misura min|grande` (min = «Finestra 480», grande = 1440×900), `--dati con|senza`, `--lungo` (titoli e nomi da 120 caratteri, messaggi da 600), `--ridotto` (prefers-reduced-motion), `--matrice` (tema × misura × dati × lungo, più un giro ridotto), `--video` (registra e misura ogni animazione), `--max N` (elementi per giro, 80).
- L'app parte con `--scena <file>` (src/main.ts): CLOTCH_TEST_SILENT=1, HOME temporanea copiata da `test/fixtures/home`, al massimo N Electron insieme sulla macchina (`scripts/posti.mjs`, `CLOTCH_BETA_POSTI`, se no un quarto dei core; posti di pid morti liberati da soli). Senza DISPLAY avvia un Xvfb suo. Nella sandbox prende le librerie GTK da `/work/r.bondici/gtk/root`.
- Uscita: `<out>/<area>/<config>/registro.json`, `foto/`, `<out>/<area>/video/`, `<out>/sommario.json`, e la riga «N elementi cliccati, M foto».

## Criteri delle sonde (campo `criterio` dei difetti)

| Criterio | Rotto quando |
|---|---|
| FUORI | un cliccabile (fuori da un contenitore che scorre) o un sovrapposto esce dalla finestra |
| TAGLIATO | un sovrapposto (menu, popover, tooltip, dialogo, avviso) è tagliato da un antenato con overflow |
| COPERTO | uno dei 5 punti del sovrapposto dà un altro elemento a `elementFromPoint` |
| TESTO | testo tagliato (overflow hidden o clip) senza ellissi voluta |
| COLORE, RAGGIO, SPAZIO | colore, raggio o padding/margin/gap che non è un valore di `src/ui/base/token.css` (uno spazio scritto con `var(--…)` o `auto` nel CSS vale) |
| FOCUS | con Tab: nessun anello del fuoco, o anello con un raggio diverso dalla forma che si vede |
| ESC, FUOCO-RITORNO | Esc non chiude il sovrapposto; dopo Esc il fuoco non torna al pulsante che l'ha aperto |
| HOVER, PREMUTO | col mouse sopra, o premuto, l'elemento non cambia di un pixel (foto `-hover`, `-premuto`; il fuoco da tastiera è nelle foto `tab<N>`) |
| STATO | un elemento disabilitato ha lo stesso aspetto di uno attivo della stessa classe |
| SPORGE | un elemento esce dal riquadro visibile (fondo o bordo) del genitore |
| CONSOLE | errore in console o eccezione della pagina |
| M2, M3, M5, M8, M10, M11, MLAYOUT | movimento, solo con `--video` (`movimento.mjs`): durata fuori dai token tempo/*, curva lineare, parte oltre 50 ms, si muove con movimento ridotto, salto se interrotta, fotogrammi persi, anima una proprietà di layout |

## Difetti noti e checklist

- `accettati.json`: `{ "voce": <criterio>, "area": <area o "*">, "dove"?: <pezzo del selettore>, "issue": N }`. Vale solo finché l'issue `beta-tester` N è aperta; chiusa, il difetto torna rosso.
- `checklist/<famiglia>.jsonl`: una voce per riga (`node test/beta/controlla-checklist.mjs`, `--prossimo SOV` per il prossimo id). Una PR che chiude un'issue `beta-tester` aggiunge una voce con `"origine":"bug #N"` (`voce-checklist.mjs`, in CI).
- CI: `.github/workflows/beta-tester.yml`, un job per area, artifact `beta-tester-<area>` con foto, video e registri.
