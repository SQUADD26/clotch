// Scene delle risposte formattate (#466): `node scripts/scene-markdown.mjs` scrive design/scene/<id>.json per i quattro frame
// 131-59690 «Risposta formattata · Scuro», 140-60134 «· Chiaro», 140-60491 «Tabella larga e lunga · Scuro», 140-62309 «· Chiaro».
// Parte dalla scena 101-8036 (stessa finestra, stessa barra), da rifare con scene-chat.mjs se cambia. Il testo è quello dei frame.
import { readFileSync, writeFileSync } from "node:fs";

const base = JSON.parse(readFileSync(new URL("../design/scene/101-8036.json", import.meta.url), "utf8"));
const T = base.messaggi.s1.at(-1).t;

const RIEPILOGO = `# Verifica delle sessioni

Ho controllato i tre percorsi della pagina Sessioni, in chiaro e in scuro. I dettagli sono nella [prova eseguita](https://example.com/prova); qui sotto trovi il riepilogo.

## Cosa è stato verificato

- Ogni bozza resta nella sua chat.
- Le risposte tardive non cambiano conversazione.
- Il testo selezionato resta visibile dopo ogni aggiornamento.
  - Anche con la barra laterale chiusa.
  - Anche con la finestra stretta a 480 punti.

### Per ripetere la prova

1. Apri la sessione dalla barra laterale.
2. Scrivi nella casella e premi Invio.
3. Controlla che la risposta resti nel filo.

Per i controlli da terminale usa \`npm test\` dal ramo \`design/332-sessioni-figma\`.

\`\`\`sh
npm test
swift test --filter Sessioni
printf "ok"
\`\`\`

> Prova eseguita su dati fittizi: i numeri veri arrivano con la prossima sessione.

---

## Risultati per percorso

| Percorso | Schermate | Tempo (s) | Esito |
| --- | ---: | ---: | --- |
| Chat | 14 | 1,8 | Verificata |
| Impostazioni | 22 | 2,4 | Verificate |
| clotch AI | 9 | 0,9 | Verificata |
| Notch | 6 | 1,1 | Da rivedere |
| **Totale** | **51** | **6,2** | **1 da rivedere** |

*Tempi misurati sulla stessa macchina, media di tre esecuzioni.*`;

// sessione, progetto, ramo, modello, token in, token out, costo, durata, esito
const RIGHE = [
  ["Clotch: sessioni in Electron", "clotch", "design/332-sessioni-figma", "Opus 5.5", "184.200", "21.450", "3,42", "14 min", "Finita"],
  ["Sessioni: lettura dal disco", "clotch", "feat/437-lettura", "Sonnet 5.5", "96.730", "12.080", "0,81", "8 min", "Finita"],
  ["Notch: avviso schermo", "clotch", "feat/440-avviso-schermo", "Opus 5.5", "142.560", "18.900", "2,67", "11 min", "Finita"],
  ["Voce: parole inglesi", "clotch", "fix/38-voce-inglese", "Haiku 4.5", "41.320", "5.210", "0,09", "3 min", "In pausa"],
  ["Fatture: esportazione", "squadd-v2", "feat/812-fatture", "Opus 5.5", "233.870", "30.440", "4,95", "22 min", "Finita"],
  ["Agenda: fusi orari", "dentalspace", "fix/204-fusi", "Sonnet 5.5", "78.410", "9.760", "0,66", "7 min", "Finita"],
  ["Pazienti: ricerca veloce", "dentalspace", "feat/219-ricerca", "Sonnet 5.5", "112.050", "14.330", "0,94", "9 min", "Da rivedere"],
  ["Magazzino: soglie minime", "squadd-v2", "feat/830-soglie", "Haiku 4.5", "35.900", "4.120", "0,07", "2 min", "Finita"],
  ["clotch AI: avvio lento", "clotch-ai-mac-v2", "fix/91-avvio", "Opus 5.5", "301.640", "38.200", "6,18", "31 min", "Da rivedere"],
  ["Report: PDF mensile", "squadd-v2", "feat/845-report", "Sonnet 5.5", "88.200", "11.940", "0,74", "8 min", "Finita"],
  ["Login: sessione scaduta", "dentalspace", "fix/231-login", "Sonnet 5.5", "64.310", "7.850", "0,53", "5 min", "Finita"],
  ["Impostazioni: tema", "clotch", "feat/441-tema", "Haiku 4.5", "29.870", "3.640", "0,05", "2 min", "Finita"],
  ["Notifiche: raggruppamento", "clotch-ai-mac-v2", "feat/97-notifiche", "Opus 5.5", "157.400", "19.300", "3,01", "13 min", "In corso"],
  ["Backup: verifica notturna", "squadd-v2", "fix/851-backup", "Sonnet 5.5", "52.760", "6.470", "0,44", "4 min", "Finita"],
];
const TABELLA = `Ecco le ultime 14 sessioni con costi e durate. Due vanno riviste: Pazienti: ricerca veloce e clotch AI: avvio lento.

| Sessione | Progetto | Ramo | Modello | Token in | Token out | Costo (€) | Durata | Esito |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${RIGHE.map(([s, p, r, m, ...n]) => `| ${s} | ${p} | \`${r}\` | ${m} | ${n.join(" | ")} |`).join("\n")}

*14 sessioni · costi in euro, durata in minuti.*`;

// come 25542: contesto al 62%, permessi «Chiedi approvazione», clotch acceso (niente nota «Senza clotch»), «File toccati» del pannello
const info = { s1: { contesto: 124_000, file: { quanti: 3, aggiunte: 214, tolte: 12 } } };
const elenco = structuredClone(base.elenco);
Object.assign(elenco.sessioni[0], { permessi: "default", contesto: 124_000 });
const registro = { ...base.registro, clotch: { voce: "accesa", parla: false, ascolta: false, versione: "2.4", t: -60_000 } };
const scena = (id, domanda, risposta, { sezione } = {}) => writeFileSync(new URL(`../design/scene/${id}.json`, import.meta.url), JSON.stringify({
  ...base, info, elenco, registro,
  navigazione: { ...base.navigazione, ...(sezione ? { sezione } : {}) },
  messaggi: { s1: [{ tipo: "utente", testo: domanda, t: T - 5_000 }, { tipo: "assistente", testo: risposta, modello: "claude-opus-5-5", t: T }] },
}, null, 1) + "\n");

const D1 = "Mostrami il riepilogo con elenco, tabella e codice.", D2 = "Mostrami le ultime sessioni con costi e durate.";
// la tabella larga parte scorsa di 244 px: la colonna «Sessione» resta ferma e «Progetto» sparisce sotto di lei
scena("131-59690", D1, RIEPILOGO);
scena("140-60491", D2, TABELLA, { sezione: "tabella:244" });
