// Scene di prova di «Info e avvio» (#437): Info sessione 101:33775 e 101:34190, Sessioni figlie e PR 101:34605, Avvio 101:30345.
// Parte da design/scene/101-8036.json (la sessione aperta, scritta da scene-chat.mjs): `node scripts/scene-chat.mjs` prima di questo.
import { readFileSync, writeFileSync } from "node:fs";

const scena = (id) => new URL(`../design/scene/101-${id}.json`, import.meta.url);
const base = JSON.parse(readFileSync(scena("8036"), "utf8"));
const scrivi = (id, d) => writeFileSync(scena(id), JSON.stringify(d, null, 1) + "\n");

const CONNETTORI = ["Claude Docs", "Google Drive", "Linear", "Notion", "visualize", "Figma Console", "Apify", "Cloudflare", "Claude in Chrome", "Motion", "Computer Use"];
const app = { padre: null, prs: [{ numero: 336, stato: "aperta", verso: "dev", url: "https://github.com/SQUADD26/clotch/pull/336" }],
  connettori: CONNETTORI, strumentiMcp: 859, cli: "2.1.299", ospite: null, remoto: true };
const FINESTRA = { chat: { s1: { chat: "s1", coda: [], richieste: [], aiutanti: {}, passi: [], contestoMax: 1_000_000 } } }; // «345,5k / 1M»: la finestra la dà il motore (contesto_max, #475)
const INFO = { contesto: 346_000, file: { quanti: 3, aggiunte: 214, tolte: 12 } };
const conSessione = (x, sezione, extra = {}) => ({ ...base, navigazione: { ...base.navigazione, sezione },
  elenco: { ...base.elenco, sessioni: base.elenco.sessioni.map((s) => ({ ...s, ...x })) }, ...extra });

// Info sessione: il bottone «Pannello» premuto e le schede sotto l'obiettivo; «scorrendo» = il pannello portato in fondo (988 − 790 px)
const cartella = "/Users/privato/Documents/Repos/goal-notch";
scrivi("33775", conSessione({ cartella, app }, "info", { info: { s1: INFO }, registro: { ...base.registro, ...FINESTRA } }));
scrivi("34190", conSessione({ cartella, app }, "info|scorri:198", { info: { s1: INFO }, registro: { ...base.registro, ...FINESTRA } }));
// Sessioni figlie e PR: la barra la disegna barra/prova.ts; qui la sessione aperta e i file toccati del pannello
scrivi("34605", conSessione({ titolo: "Sessioni: disegno e app Electron" }, undefined, { info: { s1: { contesto: null, file: INFO.file } } }));
// Avvio: l'elenco non arriva, la finestra resta sul logo
scrivi("30345", { navigazione: base.navigazione, avvio: true, registro: base.registro });
