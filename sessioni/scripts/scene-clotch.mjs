// Scene di prova «Con e senza Clotch» (#437): `node scripts/scene-clotch.mjs` scrive design/scene/101-<id>.json per voce, dettatura,
// avvisi, via dal Mac e schermo occupato. Parte dalle scene già scritte (chat clotch AI 16432, Casella 35494, sessione 8036) e le porta
// ad adesso: stesso intervallo tra i tempi, l'ultimo evento è «adesso». Si rilancia prima di `npm run parita`.
import { readFileSync, writeFileSync } from "node:fs";

const ORA = Date.now(), MIN = 60_000, DIR = new URL("../design/scene/", import.meta.url);
const leggi = (id) => JSON.parse(readFileSync(new URL(`101-${id}.json`, DIR), "utf8"));
const scrivi = (id, s) => writeFileSync(new URL(`101-${id}.json`, DIR), JSON.stringify(s, null, 1) + "\n");

/** Ogni tempo assoluto (ms 2026) della scena slitta di quanto serve perché il più recente sia adesso. */
const èTempo = (v) => typeof v === "number" && v > 1.7e12 && v < 1.9e12;
function adesso(s) {
  const tempi = [];
  JSON.stringify(s, (_k, v) => { if (èTempo(v)) tempi.push(v); return v; });
  const d = ORA - Math.max(...tempi);
  return JSON.parse(JSON.stringify(s, (_k, v) => (èTempo(v) ? v + d : v)));
}

const CLOTCH = { voce: "accesa", parla: false, ascolta: false, versione: "2.4", t: -MIN };
const con = (s, registro, navigazione = {}) => ({ ...s, navigazione: { ...s.navigazione, ...navigazione }, registro: { ...s.registro, ...registro } });
const DETTATO = "Ferma la sessione del backend e dimmi perché aspettava…";

const clotchAi = adesso(leggi("16432")), casella = adesso(leggi("35494")), sessione = adesso(leggi("8036"));

scrivi("46268", con(clotchAi, { clotch: { ...CLOTCH, parla: true } }));
scrivi("46308", con(clotchAi, { voceApp: true }));
scrivi("46701", con(clotchAi, { clotch: { ...CLOTCH, ascolta: true } }, { sezione: `dettatura:${DETTATO}` }));
scrivi("46741", con(clotchAi, {}, { sezione: `dettatura:${DETTATO}` }));

// 48368: clotch AI avvisa che «Backend: auth e RLS» aspetta un permesso; Clotch l'ha detto, l'app lo mostra e la sessione chiede il permesso
const backend = {
  chat: "c-backend", titolo: "Backend: auth e RLS", madre: null, progetto: "squadd-v2", account: ".claude-accountmanager", sorgente: "claude-code", daHandoff: null,
  stato: "serve_roberto", dettaglio: null, aspetto: null, domanda: null, limite: null, battito: ORA - 20_000, aiutanti: {}, compattazioni: 0, interrotta: null,
  coda: [], obiettivo: null, passi: [], visto: ORA - 2 * MIN, fine: null, chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0,
  richieste: [{ rid: "p1", genere: "permesso", strumento: "Bash", t: ORA - 2 * MIN, domande: [],
    ingresso: { command: "supabase db push --db-url $DEV", description: "Porta su dev la migrazione 0042 delle policy." } }],
};
scrivi("48368", con(clotchAi, {
  clotch: CLOTCH, comandi: [], chat: { ...clotchAi.registro.chat, "c-backend": backend },
  avvisi: [{ id: "a0", t: ORA - 12 * MIN, testo: "«Backend: auth e RLS» aspetta un tuo permesso da 12 minuti.", livello: "normale", motivo: "chiesto", dettoDa: "clotch", sessioni: [] }],
}, { sezione: "avviso-notch" }));

// 49067: AFK acceso da 20 min con 4 cose registrate; 49194: senza Clotch (3 sessioni aspettano te)
scrivi("49067", con(casella, { clotch: CLOTCH, afk: { da: -20 * MIN, avvisi: 4 } }));
scrivi("49194", con(casella, {}));

// 49592: uno script usa lo schermo da 42 s (pillola in barra); 49632: senza Clotch, la nota nel filo
scrivi("49592", con(sessione, { clotch: CLOTCH, schermo: { da: -42_000 } }));
scrivi("49632", con(sessione, {}));
// 47850 e 47883: la domanda per te di 13896, con Clotch installato e senza
const domanda = adesso(leggi("13896"));
scrivi("47850", con(domanda, { clotch: CLOTCH }));
scrivi("47883", con(domanda, {}));
console.log("scene Clotch: 11 in design/scene");
