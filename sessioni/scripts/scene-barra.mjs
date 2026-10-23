// Scene dei frame a tutta finestra che hanno la sessione aperta dietro (menu, ricerca, filtri, dialoghi, avvisi: #437): la stessa scena
// di 101-8036 (scritta da scene-chat.mjs); la barra e lo stato aperto del frame stanno in src/ui/barra/prova.ts.
// `node scripts/scene-barra.mjs` scrive design/scene/101-<id>.json; lanciarlo dopo scene-chat.mjs.
import { readFileSync, writeFileSync } from "node:fs";

const scena = (id) => new URL(`../design/scene/101-${id}.json`, import.meta.url);
const base = readFileSync(scena("8036"));
for (const id of ["10017", "10297", "12118", "16818", "21061", "21257", "21376", "23003", "23248", "24007", "24127", "28289",
  "30238", "35109", "48405"]) writeFileSync(scena(id), base);

// 30172: la campana «Attività» con due sessioni che aspettano te (la scena vecchia aveva solo il registro, senza elenco né filo)
const ORA = Date.now();
const chat = (id, titolo, stato) => ({ chat: id, titolo, madre: null, progetto: null, account: null, sorgente: null, daHandoff: null, stato, dettaglio: null, aspetto: null,
  domanda: null, limite: null, richieste: [], battito: ORA, aiutanti: {}, compattazioni: 0, interrotta: null, coda: [], obiettivo: null, passi: [], visto: ORA,
  fine: null, chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0 });
const scena8036 = JSON.parse(base);
writeFileSync(scena("30172"), JSON.stringify({ ...scena8036, registro: { ...scena8036.registro, chat: { a: chat("a", "Clotch: sessioni in Electron", "serve_roberto"),
  b: chat("b", "Clotch: notch", "serve_roberto") } } }, null, 1) + "\n");
