#!/usr/bin/env node
// Scene di prova dei frame Friday (#352): un registro nella forma del contratto v1 con i dati scritti nei frame Figma,
// letto col lettore vero e salvato in design/scene/<id>.json. Le ore sono relative ad adesso (Friday «Attiva» = battito
// recente): si rilancia subito prima di `npm run parita`. Uso: npm run build && node scripts/scene-friday.mjs
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";

const radice = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);
const { leggiRegistro } = require(path.join(radice, "dist/src/friday.js"));
const { piano } = require(path.join(radice, "dist/src/friday-ipc.js"));

const ora = Date.now();
const alle = (h, m, giorni = 0) => { const d = new Date(ora); d.setDate(d.getDate() - giorni); d.setHours(h, m, 0, 0); return d.toISOString(); };
const fa = (min) => new Date(ora - min * 60_000).toISOString();
const giorno = (g, m) => { const d = new Date(ora); d.setMonth(m - 1, g); d.setHours(10, 0, 0, 0); return d.toISOString(); };

const passi = (fatti, inCorso, attesa) => [...fatti.map((testo) => ({ testo, stato: "completed" })), ...inCorso.map((testo) => ({ testo, stato: "in_progress" })), ...attesa.map((testo) => ({ testo, stato: "pending" }))];
const chat = (id, titolo, progetto, madre, stato, extra = []) => [
  [fa(90), id, "inizio", { titolo, madre, progetto, cwd: "", modo: "app", figlia_friday: false, account: ".claude", sorgente: "app", da_handoff: "" }],
  [fa(2), id, stato === "lavora" ? "battito" : "stato", { stato }],
  ...extra.map(([tipo, dati]) => [fa(3), id, tipo, dati]),
];

// Casella 101-35494: tre progetti, 3 aspettano te, 5 al lavoro, fatto oggi 4 / 2 / 1
const casella = [
  ...chat("m-clotch", "Clotch: sessioni in Electron", "clotch", "", "lavora", [
    ["obiettivo", { stato: "aperto", testo: "App Sessioni pari al disegno", versione: 1 }],
    ["passi", { agente: "", passi: passi(["Disegno in Figma", "Lettura delle sessioni dal disco"], ["Barra laterale e conversazione"], ["Prova di parità a scala 1", "PR verso dev"]) }],
  ]),
  ...chat("c-disegno", "Sessioni: disegno e app Electron", "clotch", "m-clotch", "aspetta", [["richiesta", { genere: "permesso", rid: "q1", strumento: "Bash", ingresso: {}, domande: [] }]]),
  ...chat("c-figma", "Figma: schermate app Sessioni", "clotch", "m-clotch", "serve_roberto"),
  ...chat("c-lettura", "Sessioni: lettura dal disco", "clotch", "m-clotch", "lavora"),
  ...["Notch: avviso schermo", "Voce: parole inglesi", "Clotch: prova 1", "Clotch: prova 2"].flatMap((t, i) => chat(`c-fatta-${i}`, t, "clotch", "m-clotch", "finito")),
  ...chat("m-squadd", "Squadd: policy RLS", "squadd-v2", "", "aspetta", [
    ["obiettivo", { stato: "aperto", testo: "Policy RLS su «sessioni» in produzione", versione: 1 }],
    ["passi", { agente: "", passi: passi(["a", "b", "c", "d"], [], ["e"]) }],
  ]),
  ...chat("c-backend", "Backend: auth e RLS", "squadd-v2", "m-squadd", "aspetta", [["richiesta", { genere: "piano", rid: "q2", strumento: "ExitPlanMode", ingresso: {}, domande: [] }]]),
  ...["Squadd: fatta 1", "Squadd: fatta 2"].flatMap((t, i) => chat(`s-fatta-${i}`, t, "squadd-v2", "m-squadd", "finito")),
  ...chat("m-friday", "Friday: casella unica", "friday-mac-v2", "", "lavora", [
    ["obiettivo", { stato: "aperto", testo: "Casella unica e sandbox", versione: 1 }],
    ["passi", { agente: "", passi: passi(["a", "b"], ["Registro unico delle sessioni"], ["Stati e piano", "e", "f", "g"]) }],
  ]),
  ...chat("f-lavora-1", "Friday: lavoro 1", "friday-mac-v2", "m-friday", "lavora"),
  ...chat("f-lavora-2", "Friday: lavoro 2", "friday-mac-v2", "m-friday", "lavora"),
  ...chat("f-fatta", "Friday: fatta", "friday-mac-v2", "m-friday", "finito"),
];

// Decisioni 101-39266 e Regole 101-40473
const decisioni = [
  [alle(18, 20, 1), "friday", "decisione", { cosa: "Archiviate 4 sessioni finite", perche: "", inverso: ["friday", "archivia"], chat: "m-squadd", genere: "archivio" }],
  [alle(11, 30), "friday", "decisione", { cosa: "Promosso dev a main", perche: "", inverso: null, chat: "m-clotch", genere: "promozione", non_annullabile: "Già su main: non si annulla" }],
  [alle(12, 5), "friday", "decisione", { cosa: "Risposto alla domanda: «Nel repo, in sessioni/design/app»", perche: "", inverso: ["x"], chat: "c-figma", genere: "risposta" }],
  [alle(13, 40), "friday", "decisione", { cosa: "Fermata la sessione «Notch: avviso schermo»", perche: "", inverso: ["x"], chat: "c-fatta-0", genere: "fermo" }],
  [alle(14, 12), "friday", "decisione", { cosa: "Consentita la migrazione 0042 su dev", perche: "", effetto_annullo: "Friday ha consentito la migrazione 0042 su dev. Annullarla lancia la migrazione inversa e rimette la sessione in attesa di te.", inverso: ["x"], chat: "c-backend", genere: "permesso" }],
];
const regole = [
  [giorno(23, 10), "friday", "regola", { testo: "Parla poco e chiaro: una cosa alla volta, parole semplici.", perche: "", dove: "claude-config", togli: false }],
  [giorno(18, 10), "friday", "regola", { testo: "Main si cambia solo con la promozione da dev.", perche: "", dove: "claude-config", togli: false }],
  [giorno(21, 10), "friday", "regola", { testo: "Ogni interfaccia passa prima da Figma.", perche: "", dove: "/Users/privato/Documents/Repos/clotch", togli: false }],
];
const viva = [[fa(0.5), "friday", "battito", { stato: "lavora" }]];
const spenta = [[alle(14, 2), "friday", "friday", { evento: "avvio" }], [alle(14, 2), "friday", "battito", { stato: "lavora" }]];
const quiete = (fino) => [[fa(30), "friday", "non_disturbare", { acceso: true, fino, tenuti: 3 }]];
const clotch = [[fa(1), "clotch", "clotch", { voce: "accesa", parla: false, ascolta: false }]];
const proposto = chat("m-proposto", "Clotch: barra annidata", "clotch", "", "aspetta", [["obiettivo", { stato: "proposto", testo: "Le sessioni annidate e le PR nella barra laterale, pari al disegno.", versione: 1 }]]);
const annullata = [[fa(1), "friday", "decisione", { cosa: "annullata DECISIONE", perche: "", inverso: null, chat: "", genere: "altro" }]];

const tutto = [...casella, ...decisioni, ...regole];
// id del frame -> [vista, sezione, righe del registro]
const SCENE = {
  "101-35494": ["casella", null, [...tutto, ...viva]],
  // 101-36010 (caricamento) non ha scena: la scena risponde subito, il caricamento non si vede
  "101-35803": ["casella", null, [...decisioni, ...regole, ...viva]],
  "101-36225": ["casella", null, null],
  "101-37696": ["friday", "ferma-conferma", [...tutto, ...viva]],
  "101-37879": ["friday", "ferma-in-corso", [...tutto, ...viva]],
  "101-38124": ["friday", "ferma-fatto", [...tutto, ...viva]],
  "101-38374": ["friday", "ferma-errore:c-lettura", [...tutto, ...viva]],
  "101-38626": ["friday", "quiete-menu", [...tutto, ...viva]],
  "101-50008": ["friday", "quiete-menu", [...tutto, ...viva, ...clotch]],
  "101-50071": ["friday", "quiete-menu", [...tutto, ...viva]],
  "101-38897": ["friday", null, [...tutto, ...viva, ...quiete(alle(18, 0))]],
  "101-39266": ["decisioni", null, [...tutto, ...viva]],
  "101-39512": ["decisioni", "annulla:DECISIONE", [...tutto, ...viva]],
  "101-39767": ["decisioni", "annullata:Decisione annullata. La sessione aspetta te.", [...tutto, ...viva, ...annullata]],
  "101-40016": ["decisioni", "annullo-errore:Migrazione inversa non riuscita: niente è cambiato.", [...tutto, ...viva]],
  "101-40267": ["decisioni", null, [...casella, ...regole, ...viva]],
  "101-40473": ["regole", null, [...tutto, ...viva]],
  "101-40699": ["regole", "modifica:0|Parla poco e chiaro: una cosa alla volta, parole semplici. Niente sigle.", [...tutto, ...viva]],
  "101-40936": ["regole", "salvataggio:claude-config", [...tutto, ...viva]],
  "101-41166": ["regole", "salvata:2402", [...tutto, ...viva]],
  "101-41397": ["regole", "salvataggio-errore:Regola non salvata: la PR non si apre.", [...tutto, ...viva]],
  "101-41628": ["regole", null, [...casella, ...decisioni, ...viva]],
  "101-41834": ["friday", "avvio", [...tutto]],
  "101-42000": ["friday", null, [...tutto, ...spenta]],
  "101-42245": ["friday", "riavvio", [...tutto, ...spenta]],
  "101-47170": ["casella", null, [...tutto, ...viva, ...proposto, ...clotch]],
  "101-47297": ["casella", null, [...tutto, ...viva, ...proposto]],
};

const dir = path.join(radice, "design", "scene");
fs.mkdirSync(dir, { recursive: true });
for (const [id, [vista, sezione, righe]] of Object.entries(SCENE)) {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), "scena-friday-"));
  const reg = path.join(casa, ".claude", "registro");
  fs.mkdirSync(reg, { recursive: true });
  if (righe) {
    const ordinate = [...righe].sort((a, b) => a[0].localeCompare(b[0]));
    const n = new Map();
    const testo = ordinate.map(([t, c, tipo, dati], i) => {
      n.set(c, (n.get(c) ?? 0) + 1);
      return JSON.stringify({ v: 1, id: `r-${String(i).padStart(12, "0")}`, t, n: n.get(c), chat: c, macchina: "mac", hook_v: "scena", tipo, dati });
    }).join("\n") + "\n";
    fs.writeFileSync(path.join(reg, `${new Date(ora).toISOString().slice(0, 7)}.jsonl`), testo);
  } else fs.writeFileSync(path.join(reg, "2026-10.jsonl"), "", { mode: 0 }); // registro non leggibile: il lettore lo mette in `errori`
  let registro = piano(leggiRegistro(casa));
  for (const e of registro.errori) e.percorso = e.percorso.replace(casa, "~"); // niente cartelle temporanee nella scena
  // l'id della decisione da annullare è quello della «Consentita la migrazione» appena scritta
  const sez = sezione?.replace("DECISIONE", registro.decisioni.find((d) => d.cosa.startsWith("Consentita"))?.id ?? "");
  registro = JSON.parse(JSON.stringify(registro).replace(/annullata DECISIONE/, `annullata ${registro.decisioni.find((d) => d.cosa.startsWith("Consentita"))?.id}`));
  const scena = { navigazione: { vista, ...(sez ? { sezione: sez } : {}) }, registro };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(scena, null, 1) + "\n");
  fs.rmSync(casa, { recursive: true });
}
console.log(`scene Friday: ${Object.keys(SCENE).length} in ${dir}`);
