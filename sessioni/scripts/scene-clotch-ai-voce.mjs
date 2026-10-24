#!/usr/bin/env node
// Scene di prova degli stati di clotch AI (101-36642, 36832, 37055, 37278, 37492): un registro nella forma del contratto v1 con i dati dei
// frame Figma, letto col lettore vero e salvato in design/scene/<id>.json. Solo dati finti: nessun microfono, nessuna voce.
// Le ore sono relative ad adesso: si rilancia subito prima della parità. Uso: npm run build && node scripts/scene-clotch-ai-voce.mjs
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";

const radice = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);
const { leggiRegistro } = require(path.join(radice, "dist/src/clotch-ai.js"));
const { piano } = require(path.join(radice, "dist/src/clotch-ai-ipc.js"));

const ora = Date.now(), MIN = 60_000;
const fa = (min) => new Date(ora - min * MIN).toISOString();
const chat = (id, titolo, progetto, stato, extra = []) => [
  [fa(90), id, "inizio", { titolo, madre: "", progetto, cwd: "", modo: "app", figlia_friday: false, account: ".claude", sorgente: "app", da_handoff: "" }], // nome del protocollo del motore
  [fa(2), id, stato === "lavora" ? "battito" : "stato", { stato }],
  ...extra.map(([tipo, dati]) => [fa(3), id, tipo, dati]),
];
const permesso = ["richiesta", { genere: "permesso", rid: "q1", strumento: "Bash", ingresso: { command: "supabase db push --db-url $DEV", description: "Porta su dev la migrazione 0042 delle policy." }, domande: [] }];
// Casella 3: tre sessioni aspettano Roberto
const base = [ // senza «Backend»: lo aggiunge ogni scena, con o senza il permesso aperto
  [fa(0.5), "friday", "battito", { stato: "lavora" }], // nome del protocollo del motore
  ...chat("c-elettron", "Clotch: sessioni in Electron", "clotch", "lavora"),
  ...chat("c-lettura", "Sessioni: lettura dal disco", "clotch", "lavora"),
  ...chat("c-notch", "Notch: avviso schermo", "clotch", "finito"),
  ...chat("c-voce", "Voce: parole inglesi", "clotch", "aspetta"),
  ...chat("c-rls", "Squadd: policy RLS", "squadd-v2", "serve_roberto"),
  ...chat("c-figma", "Figma: schermate app Sessioni", "squadd-v2", "serve_roberto"),
];
const backend = (extra = []) => chat("c-backend", "Backend: auth e RLS", "squadd-v2", "serve_roberto", extra);
const parla = (min, id, testo) => [fa(min), "friday", "comando", { id, cmd: "parla", da: "app", args: { testo } }]; // nome del protocollo del motore
const risponde = (min, testo, motivo = "risposta") => [fa(min), "friday", "avviso", { testo, livello: "normale", motivo }]; // nome del protocollo del motore
const filo = [
  parla(10, "p1", "Com’è messa la sessione del backend?"),
  risponde(9.5, "«Backend: auth e RLS» aspetta un tuo permesso da 12 minuti: vuole lanciare la migrazione su dev."),
  parla(9, "p2", "Consentila tu."),
  risponde(8.5, "Fatto. La migrazione è partita; ti avviso quando finisce."),
];
const clotch = (ascolta, parlaClotch) => [[fa(0.2), "clotch", "clotch", { voce: "accesa", parla: parlaClotch, ascolta }]];
const senzaMicrofoni = [[fa(5), "friday", "impostazioni", { attiva: true, microfono: "", voce: "Italiana", account: "", puo_dare_permessi: true, legge_ad_alta_voce: "solo_quando_le_parli", microfoni_disponibili: [], voci_disponibili: ["Italiana"] }]]; // nome del protocollo del motore

const sessione = (id, titolo, progetto, stato, min = 3, i = 0) => ({
  // sei account su quattro sorgenti: il piede della barra dice «6 account · 4 sorgenti» (101-36642)
  id, sorgente: ["claude-code", "claude-desktop", "codex", "cursor", "claude-code", "claude-desktop"][i % 6], account: [".claude", ".claude-roberto", "codex", "cursor", ".claude-squadd", ".claude-clotch-ai"][i % 6], email: null, idApp: null, titolo, progetto, cartella: "", ramo: null, modello: "claude-opus-5-5",
  stato, perche: null, ultimaAttivita: ora - min * MIN, obiettivo: null, situazione: { adesso: stato === "lavora" ? "lavora" : "turno_finito", strumento: null, inCoda: 0, segni: [] }, file: "",
});
const riempi = (progetto, n) => Array.from({ length: n }, (_, i) => sessione(`${progetto}-${i}`, `${progetto}: sessione ${i + 1}`, progetto, "finita", 600 + i, i));
const elenco = [
  sessione("c-elettron", "Clotch: sessioni in Electron", "clotch", "lavora"), sessione("c-lettura", "Sessioni: lettura dal disco", "clotch", "lavora"),
  sessione("c-notch", "Notch: avviso schermo", "clotch", "finita"), sessione("c-voce", "Voce: parole inglesi", "clotch", "ferma"),
  sessione("c-backend", "Backend: auth e RLS", "squadd-v2", "aspetta", 2), ...riempi("squadd-v2", 22), ...riempi("dentalspace", 9), ...riempi("clotch-ai-mac-v2", 14),
];

// id del frame -> [righe del registro, la voce dell'app sta parlando]
const SCENE = {
  "101-36642": [[...base, ...backend()], false],
  "101-36832": [[...base, ...backend(), ...filo, ...clotch(true, false)], false],
  // Clotch assente: parla l'app (`say`), quindi «Interrompi» ferma davvero
  "101-37055": [[...base, ...backend(), ...filo], true],
  "101-37278": [[...base, ...backend(), ...filo, ...senzaMicrofoni], false],
  "101-37492": [[...base, ...backend([permesso]),
    risponde(2, "«Backend: auth e RLS» aspetta un tuo permesso da 12 minuti.", "domanda")], false],
};

const dir = path.join(radice, "design", "scene");
fs.mkdirSync(dir, { recursive: true });
for (const [id, [righe, voce]] of Object.entries(SCENE)) {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), "scena-voce-"));
  const reg = path.join(casa, ".claude", "registro");
  fs.mkdirSync(reg, { recursive: true });
  const n = new Map();
  const testo = [...righe].sort((a, b) => a[0].localeCompare(b[0])).map(([t, c, tipo, dati], i) => {
    n.set(c, (n.get(c) ?? 0) + 1);
    return JSON.stringify({ v: 1, id: `r-${String(i).padStart(12, "0")}`, t, n: n.get(c), chat: c, macchina: "mac", hook_v: "scena", tipo, dati });
  }).join("\n") + "\n";
  fs.writeFileSync(path.join(reg, `${new Date(ora).toISOString().slice(0, 7)}.jsonl`), testo);
  const registro = piano(leggiRegistro(casa));
  fs.rmSync(casa, { recursive: true });
  const scena = { navigazione: { vista: "clotch-ai" }, elenco: { sessioni: elenco, errori: [] }, messaggi: {}, preferenze: {}, registro, ...(voce ? { voce } : {}) };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(scena, null, 1) + "\n");
}
console.log(`scene voce di clotch AI: ${Object.keys(SCENE).length} in ${dir}`);
