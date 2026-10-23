// Scene di prova dei dialoghi (#437): la scena della sessione aperta (101-8036, scritta da scene-chat.mjs) con il dialogo aperto sopra.
// `node scripts/scene-dialoghi.mjs` scrive design/scene/101-22137.json, 101-22186.json e 101-22044.json (rinomina: il valore sta dopo i due punti); lanciarlo dopo scene-chat.mjs.
import { readFileSync, writeFileSync } from "node:fs";

const scena = (id) => new URL(`../design/scene/101-${id}.json`, import.meta.url);
const base = JSON.parse(readFileSync(scena("8036"), "utf8"));
for (const [id, sezione] of [["22137", "dialogo-aggiornamento"], ["22186", "dialogo-scorciatoie"], ["22044", "dialogo-rinomina:Sessioni: app Electron"]])
  writeFileSync(scena(id), JSON.stringify({ ...base, navigazione: { ...base.navigazione, sezione } }, null, 1) + "\n");
