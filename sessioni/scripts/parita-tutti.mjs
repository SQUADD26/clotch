// Rifà design/app/<id>.png di tutti i frame con una scena (un'app Electron nascosta per frame, in serie). Uso: node scripts/parita-tutti.mjs [id...]
// I frame-pezzo (design/pezzi.json) si confrontano ritagliati dal genitore: scripts/parita-pezzi.mjs. Esce 1 se un frame non esce con PARITA_HIDDEN_OK.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const { png, immagine } = await import(join(homedir(), ".claude/skills/figma-ui-design/parita.mjs"));
const D = new URL("../design/", import.meta.url).pathname;
// Un pezzo (design/pezzi.json: id -> frame che lo contiene) non ha un disegno suo: lo ritaglia dal genitore parita-pezzi.mjs (un .png a misura sua sarebbe una finestra stirata).
// pezzi.json sta fuori da design/figma/<id>.json perché il ri-esporto di Figma riscrive quei file (#541: l'export di #528 aveva perso `dentro` da 37 pezzi, rimasti senza prova).
const PEZZI = JSON.parse(readFileSync(`${D}pezzi.json`, "utf8"));
// frame che nell'app non hanno una vista da disegnare, con la ragione
const SENZA_VISTA = {
  "120-58483": "tabella segno -> icona (SEGNI in Righe.tsx): è un elenco",
  "113-51111-testi": "elenco dei testi di un frame, letto da pannello/scene.tsx",
  "101-12461": "tavola «Varianti»: raccoglie gli altri frame uno accanto all'altro",
  "101-19480": "tavola «Varianti della chat»: raccoglie gli altri frame uno accanto all'altro",
  "101-25542": "Casella: chip degli allegati, sostituito da 148-47483 (scene-allegati.mjs)",
  "101-27294": "Casella: zona di rilascio, sostituita da 148-45727 (scene-allegati.mjs)",
  // filo compatto (#876): i gemelli chiari; l'app è solo scura (#642, nativeTheme.themeSource = "dark"), la prova la fanno i gemelli scuri
  ...Object.fromEntries(["163-87559", "163-88171", "163-89035", "163-89702", "163-90360", "163-90982"].map((id) => [id, "gemello chiaro: l'app è solo scura (#642)"])),
};
const tutti = readdirSync(`${D}figma`).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
// «senza prova»: né scena né genitore da cui ritagliarlo né ragione scritta (una scena `{}` vale: la finestra di base, ma l'immagine si controlla qui sotto)
const senzaProva = tutti.filter((id) => !SENZA_VISTA[id] && !PEZZI[id] && !existsSync(`${D}scene/${id}.json`));
const esiste = (id) => existsSync(`${D}scene/${id}.json`) && !SENZA_VISTA[id] && !PEZZI[id];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : tutti.filter(esiste);
const rotti = [];
for (const id of ids) {
  const r = spawnSync("electron", ["--force-device-scale-factor=1", "--force-color-profile=srgb", ".", "--parita", id], { encoding: "utf8" });
  const ok = r.status === 0 && r.stdout.includes("PARITA_HIDDEN_OK: visible=false focused=false show=0 focus=0");
  // l'immagine dell'app contro il disegno, a soglia 8%: una scena vuota o sbagliata non passa più in silenzio (#541)
  const grave = ok && existsSync(`${D}figma/${id}.png`) ? immagine(png(readFileSync(`${D}figma/${id}.png`)), png(readFileSync(`${D}app/${id}.png`)), 0.08).gravi[0] : null;
  if (grave) { console.log(`${id}\tROTTO ${grave}`); rotti.push(id); continue; }
  console.log(`${id}\t${ok ? "PARITA_HIDDEN_OK" : `ROTTO (exit ${r.status}) ${r.stderr.trim().split("\n").pop()}`}`);
  if (!ok) rotti.push(id);
}
console.log(`frame senza prova: ${senzaProva.length}${senzaProva.length ? ` (${senzaProva.join(" ")})` : ""}`);
console.log(`parità: ${ids.length - rotti.length}/${ids.length} frame ok${rotti.length ? `, rotti: ${rotti.join(" ")}` : ""}`);
process.exit(rotti.length || senzaProva.length ? 1 : 0);
