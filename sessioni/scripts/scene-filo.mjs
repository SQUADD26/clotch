// Scene del filo (#437): `node scripts/scene-filo.mjs` scrive design/scene/101-<id>.json per «Trova nella sessione» (23475),
// «Testo selezionato» (28471), «Eventi, date e nuovi messaggi» (28652), «Suggerimento con scorciatoia» (24069) e il foglio «Varianti della chat» (19480).
// Parte dalla scena 101-8036 (scene-chat.mjs la scrive prima): stessa sessione, stessa barra, cambia la sezione o i messaggi.
// I giorni sono relativi a oggi («Ieri», «Oggi»): si rifà prima di `npm run parita`.
import { readFileSync, writeFileSync } from "node:fs";

const file = (id) => new URL(`../design/scene/101-${id}.json`, import.meta.url);
const base = JSON.parse(readFileSync(file("8036"), "utf8"));
const scena = (id, sezione, messaggi) => writeFileSync(file(id), JSON.stringify({
  ...base, navigazione: { ...base.navigazione, sezione }, ...(messaggi ? { messaggi: { s1: messaggi } } : {}) }, null, 1) + "\n");

const inizioOggi = new Date().setHours(0, 0, 0, 0), MIN = 60_000;
const u = (testo, t) => ({ tipo: "utente", testo, t });
const a = (testo, t) => ({ tipo: "assistente", testo, modello: "claude-opus-5-5", t });
const bash = (id, command, esito, t) => ({ tipo: "strumento", id, nome: "Bash", ingresso: { command }, esito: { testo: esito, errore: false }, t });

scena("23475", "trova:controllo");
scena("24069", "suggerimento-barra");

// 28471: due messaggi, l'ultima risposta scelta e il menu aperto nel punto del clic
scena("28471", "selezione:565,793", [
  u("Cosa succede con una cartella che non si legge?", inizioOggi + 10 * MIN),
  a("Il lettore salta le cartelle senza permesso e lo scrive nel registro.", inizioOggi + 11 * MIN),
]);

// 28652: ieri una domanda, oggi un ramo creato e una domanda con 84 righe di uscita; «3 nuovi messaggi» sopra la casella.
// L'ultima chiamata è rifiutata: non si vede, ma dà la durata (41 s) all'uscita che la precede.
const ieri = inizioOggi - 3 * 60 * MIN;
const uscita = ["PASS sessioni/lettore.test.ts (11 test)", "PASS sessioni/cartelle.test.ts (6 test)", "PASS sessioni/filtri.test.ts (9 test)",
  ...Array.from({ length: 81 }, (_, i) => `ok ${i + 1} - caso ${i + 1}`)].join("\n");
scena("28652", "nuovi:3|aperti:strumento", [
  u("Leggi le sessioni dal disco.", ieri),
  a("Fatto: 6 cartelle e 312 sessioni.", ieri + 5_000),
  bash("t1", "git checkout -b design/332-sessioni-figma", "Switched to a new branch 'design/332-sessioni-figma'", inizioOggi + MIN),
  u("Lancia tutte le prove.", inizioOggi + 2 * MIN),
  bash("t2", "npm test", uscita, inizioOggi + 2 * MIN + 1_000),
  { tipo: "strumento", id: "t3", nome: "Bash", ingresso: { command: "x" }, esito: { testo: "The user doesn't want to proceed with this tool use.", errore: true }, t: inizioOggi + 2 * MIN + 42_000 },
]);

// 19480: il foglio delle varianti si disegna da solo coi pezzi veri (chat/varianti.tsx); la scena serve solo ai canali, vuoti
writeFileSync(file("19480"), JSON.stringify({ navigazione: { vista: "sessione" } }, null, 1) + "\n");
