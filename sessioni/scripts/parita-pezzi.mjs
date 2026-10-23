// Parità dei frame-pezzo (#437): barra laterale, menu, tooltip, popover. Non hanno una scena propria (la finestra disegnata a misura del pezzo
// non li mostra), quindi il pezzo si ritaglia dal frame che lo contiene (`frame.dentro` nel suo JSON): la posizione si cerca nel PNG di Figma
// del genitore, lo stesso rettangolo si ritaglia dal disegno dell'app (`npm run parita -- <genitore>` prima). Uso: node scripts/parita-pezzi.mjs [id...]
// Una riga per pezzo; esce 1 se un pezzo ha errori gravi (soglia 8% come le schermate).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const { png, immagine } = await import(join(homedir(), ".claude/skills/figma-ui-design/parita.mjs"));
const D = new URL("../design/", import.meta.url).pathname;
const leggi = (f) => png(readFileSync(f));
const canale = (p, i, k) => p.px[i * 4 + k] * p.px[i * 4 + 3] / 255 + 255 * (1 - p.px[i * 4 + 3] / 255);

/** Dove sta `p` dentro `g`: scarto su un reticolo di punti di `p` per scegliere i candidati, poi su ogni pixel per sceglierne uno. */
function trova(g, p) {
  const punti = [];
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) punti.push([Math.floor((i + 0.5) * p.w / 12), Math.floor((j + 0.5) * p.h / 12)]);
  const candidati = [];
  let minimo = Infinity;
  for (let y = 0; y <= g.h - p.h; y++) for (let x = 0; x <= g.w - p.w; x++) {
    let s = 0;
    for (const [i, j] of punti) { const a = (y + j) * g.w + x + i, b = j * p.w + i; for (let k = 0; k < 3; k++) s += Math.abs(canale(g, a, k) - canale(p, b, k)); if (s > minimo + 200) break; }
    if (s > minimo + 200) continue;
    minimo = Math.min(minimo, s);
    candidati.push({ s, x, y });
  }
  let migliore = { s: Infinity, x: 0, y: 0 };
  for (const c of candidati.filter((c) => c.s <= minimo + 200)) {
    let s = 0;
    for (let j = 0; j < p.h; j += 2) for (let i = 0; i < p.w; i += 2) for (let k = 0; k < 3; k++) s += Math.abs(canale(g, (c.y + j) * g.w + c.x + i, k) - canale(p, j * p.w + i, k));
    if (s < migliore.s) migliore = { s, x: c.x, y: c.y };
  }
  return { ...migliore, medio: migliore.s / (Math.ceil(p.w / 2) * Math.ceil(p.h / 2) * 3) };
}
function ritaglia(g, { x, y, w, h }) {
  const px = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) g.px.copy(px, j * w * 4, ((y + j) * g.w + x) * 4, ((y + j) * g.w + x + w) * 4);
  return { w, h, px };
}

const vuota = (id) => { const f = `${D}scene/${id}.json`; return !existsSync(f) || Object.keys(JSON.parse(readFileSync(f, "utf8"))).length === 0; };
const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(`${D}figma`).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
let gravi = 0;
for (const id of ids) {
  const j = JSON.parse(readFileSync(`${D}figma/${id}.json`, "utf8"));
  const dentro = j.frame?.dentro?.replace(":", "-");
  if (!dentro || !vuota(id) || !existsSync(`${D}figma/${id}.png`)) continue;
  if (!existsSync(`${D}figma/${dentro}.png`) || !existsSync(`${D}app/${dentro}.png`)) { console.log(`${id}\tdentro ${dentro}\tNON CONFRONTABILE: manca il PNG del genitore o il suo disegno`); gravi++; continue; }
  const pezzo = leggi(`${D}figma/${id}.png`), padre = leggi(`${D}figma/${dentro}.png`), app = leggi(`${D}app/${dentro}.png`);
  const t = trova(padre, pezzo);
  if (t.medio > 8) { console.log(`${id}\tdentro ${dentro}\tNON CONFRONTABILE: il pezzo non si ritrova nel genitore (scarto ${t.medio.toFixed(1)})`); gravi++; continue; }
  const r = immagine(pezzo, ritaglia(app, { x: t.x, y: t.y, w: pezzo.w, h: pezzo.h }), 0.08);
  gravi += r.gravi.length;
  console.log(`${id}\tdentro ${dentro}\tx ${t.x} y ${t.y}\t${r.nota ?? r.gravi[0]}\terrori gravi: ${r.gravi.length}`);
}
process.exit(gravi ? 1 : 0);
