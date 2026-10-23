// Rifà design/app/<id>.png di tutti i frame con una scena (un'app Electron nascosta per frame, in serie). Uso: node scripts/parita-tutti.mjs [id...]
// I frame-pezzo (scena `{}`) si confrontano ritagliati dal genitore: scripts/parita-pezzi.mjs. Esce 1 se un frame non esce con PARITA_HIDDEN_OK.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
const D = new URL("../design/", import.meta.url).pathname;
// Un pezzo con `frame.dentro` non ha un disegno suo: lo ritaglia dal genitore parita-pezzi.mjs (un .png a misura sua sarebbe una finestra stirata).
const SENZA_VISTA = new Set(["120-58483"]); // tabella segno -> icona (SEGNI in Righe.tsx): è un elenco, nell'app non ha una vista da disegnare
const esiste = (id) => existsSync(`${D}scene/${id}.json`) && !SENZA_VISTA.has(id) &&!JSON.parse(readFileSync(`${D}figma/${id}.json`, "utf8")).frame?.dentro;
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(`${D}figma`).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter(esiste);
const rotti = [];
for (const id of ids) {
  const r = spawnSync("electron", ["--force-device-scale-factor=1", "--force-color-profile=srgb", ".", "--parita", id], { encoding: "utf8" });
  const ok = r.status === 0 && r.stdout.includes("PARITA_HIDDEN_OK: visible=false focused=false show=0 focus=0");
  console.log(`${id}\t${ok ? "PARITA_HIDDEN_OK" : `ROTTO (exit ${r.status}) ${r.stderr.trim().split("\n").pop()}`}`);
  if (!ok) rotti.push(id);
}
console.log(`parità: ${ids.length - rotti.length}/${ids.length} frame ok${rotti.length ? `, rotti: ${rotti.join(" ")}` : ""}`);
process.exit(rotti.length ? 1 : 0);
