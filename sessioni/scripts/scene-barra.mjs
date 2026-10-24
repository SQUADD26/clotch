// Scene dei frame a tutta finestra che hanno la sessione aperta dietro (menu, ricerca, filtri, dialoghi, avvisi: #437): la stessa scena
// di 101-8036 (scritta da scene-chat.mjs); la barra e lo stato aperto del frame stanno in src/ui/barra/prova.ts.
// `node scripts/scene-barra.mjs` scrive design/scene/101-<id>.json; lanciarlo dopo scene-chat.mjs.
import { readFileSync, writeFileSync } from "node:fs";

const scena = (id) => new URL(`../design/scene/${id.includes("-") ? id : `101-${id}`}.json`, import.meta.url);
const base = readFileSync(scena("8036"));
for (const id of ["10017", "10297", "12118", "16818", "21061", "21257", "21376", "23003", "23248", "24127", "28289",
  "30238", "35109", "148-62026", "148-62191", "148-62379", "148-62621"]) writeFileSync(scena(id), base);

// 24007: gli avvisi a comparsa del disegno (uno per tipo) partono dalla sezione «avvisi»
const scena24007 = JSON.parse(base);
scena24007.navigazione.sezione = "avvisi";
writeFileSync(scena("24007"), JSON.stringify(scena24007, null, 1) + "\n");

// 9090: nessuna sessione si legge perché una cartella dà «permesso negato»: al centro l'errore con «Apri Impostazioni di Sistema» (la barra sta in prova.ts)
const scena9090 = JSON.parse(base);
scena9090.navigazione = { vista: "sessione" };
scena9090.elenco = { sessioni: [], errori: [{ percorso: "~/.claude-friday/projects", messaggio: "permesso negato" }] };
writeFileSync(scena("9090"), JSON.stringify(scena9090, null, 1) + "\n");

// 30172: la campana «Attività» con due sessioni che aspettano te (la scena vecchia aveva solo il registro, senza elenco né filo)
const ORA = Date.now();
const chat = (id, titolo, stato) => ({ chat: id, titolo, madre: null, progetto: null, account: null, sorgente: null, daHandoff: null, stato, dettaglio: null, aspetto: null,
  domanda: null, limite: null, richieste: [], battito: ORA, aiutanti: {}, compattazioni: 0, interrotta: null, coda: [], obiettivo: null, passi: [], visto: ORA,
  fine: null, chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0 });
const scena8036 = JSON.parse(base);
// popover «Con sessioni» 163:83903: le sei righe del frame (titolo, genere, minuti fa); nessuna è la sessione aperta (la sua chat mostrerebbe la richiesta), icone arancioni come nel disegno
const ATTESE = [["a1", "Backend: auth e RLS", "permesso", 12], ["a2", "Sessioni: disegno e app Electron con tutti gli stati", "domanda", 8], ["a3", "Figma: schermate app Sessioni", "piano", 5],
  ["a4", "Notch: avviso schermo", "permesso", 3], ["a5", "Voce: parole inglesi", "domanda", 2], ["a6", "squadd-v2: policy RLS", "piano", 1]];
const attesa = ([id, titolo, genere, min]) => [id, { ...chat(id, titolo, "serve_roberto"), progetto: "clotch",
  richieste: [{ rid: `r-${id}`, genere, strumento: null, ingresso: {}, t: ORA - min * 60_000, domande: [] }] }];
writeFileSync(scena("30172"), JSON.stringify({ ...scena8036, registro: { ...scena8036.registro, chat: Object.fromEntries(ATTESE.map(attesa)) },
  preferenze: { ...scena8036.preferenze, ...Object.fromEntries(ATTESE.map(([id]) => [id, { ...scena8036.preferenze?.[id], colore: "arancione" }])) } }, null, 1) + "\n");
