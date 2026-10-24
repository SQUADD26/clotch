// Parità dei frame-pezzo (#437): barra laterale, menu, tooltip, popover. Non hanno una scena propria (la finestra disegnata a misura del pezzo
// non li mostra), quindi il pezzo si ritaglia dal frame che lo contiene (design/pezzi.json): la posizione si cerca nel PNG di Figma
// del genitore, lo stesso rettangolo si ritaglia dal disegno dell'app (`npm run parita -- <genitore>` prima). Uso: node scripts/parita-pezzi.mjs [id...]
// Una riga per pezzo; esce 1 se un pezzo ha errori gravi (soglia 8% come le schermate).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const { png, immagine } = await import(join(homedir(), ".claude/skills/figma-ui-design/parita.mjs"));
const D = new URL("../design/", import.meta.url).pathname;
const leggi = (f) => png(readFileSync(f));
// Un pezzo esportato da Figma ha lo sfondo trasparente e solo alcuni livelli: conta ciò che disegna (pixel opachi), il resto è del genitore (#541).
const opaco = (p, i) => p.px[i * 4 + 3] >= 128;
const canale = (p, i, k) => p.px[i * 4 + k] * p.px[i * 4 + 3] / 255 + 255 * (1 - p.px[i * 4 + 3] / 255);

/** Dove sta `p` dentro `g`: scarto su un reticolo di punti di `p` per scegliere i candidati, poi su ogni pixel per sceglierne uno. */
function trova(g, p) {
  const punti = [];
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const a = [Math.floor((i + 0.5) * p.w / 12), Math.floor((j + 0.5) * p.h / 12)]; if (opaco(p, a[1] * p.w + a[0])) punti.push(a); }
  const candidati = [];
  let minimo = Infinity;
  for (let y = 0; y <= g.h - p.h; y++) for (let x = 0; x <= g.w - p.w; x++) {
    let s = 0;
    for (const [i, j] of punti) { const a = (y + j) * g.w + x + i, b = j * p.w + i; for (let k = 0; k < 3; k++) s += Math.abs(canale(g, a, k) - canale(p, b, k)); if (s > minimo + 200) break; }
    if (s > minimo + 200) continue;
    minimo = Math.min(minimo, s);
    candidati.push({ s, x, y });
  }
  let migliore = { s: Infinity, x: 0, y: 0 }, n = 0;
  for (let j = 0; j < p.h; j += 2) for (let i = 0; i < p.w; i += 2) if (opaco(p, j * p.w + i)) n++;
  for (const c of candidati.filter((c) => c.s <= minimo + 200)) {
    let s = 0;
    for (let j = 0; j < p.h; j += 2) for (let i = 0; i < p.w; i += 2) if (opaco(p, j * p.w + i)) for (let k = 0; k < 3; k++) s += Math.abs(canale(g, (c.y + j) * g.w + c.x + i, k) - canale(p, j * p.w + i, k));
    if (s < migliore.s) migliore = { s, x: c.x, y: c.y };
  }
  return { ...migliore, medio: migliore.s / (Math.max(1, n) * 3) };
}
function ritaglia(g, { x, y, w, h }) {
  const px = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) g.px.copy(px, j * w * 4, ((y + j) * g.w + x) * 4, ((y + j) * g.w + x + w) * 4);
  return { w, h, px };
}

const PEZZI = JSON.parse(readFileSync(`${D}pezzi.json`, "utf8")); // id -> genitore; fuori da figma/<id>.json perché il ri-esporto lo riscrive (#541)
/** Il pezzo sopra il ritaglio dell'app: dove il pezzo è trasparente vale l'app, quindi non pesa nel confronto. */
const sopra = (p, sotto) => { const px = Buffer.from(sotto.px); for (let i = 0; i < p.w * p.h; i++) if (opaco(p, i)) p.px.copy(px, i * 4, i * 4, i * 4 + 3), px[i * 4 + 3] = 255; return { w: p.w, h: p.h, px }; };
const vuota = (id) => { const f = `${D}scene/${id}.json`; return !existsSync(f) || Object.keys(JSON.parse(readFileSync(f, "utf8"))).length === 0; };
const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(`${D}figma`).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
let gravi = 0;
for (const id of ids) {
  const dentro = PEZZI[id];
  if (!dentro || !vuota(id) || !existsSync(`${D}figma/${id}.png`)) continue;
  if (!existsSync(`${D}figma/${dentro}.png`) || !existsSync(`${D}app/${dentro}.png`)) { console.log(`${id}\tdentro ${dentro}\tNON CONFRONTABILE: manca il PNG del genitore o il suo disegno`); gravi++; continue; }
  const pezzo = leggi(`${D}figma/${id}.png`), padre = leggi(`${D}figma/${dentro}.png`), app = leggi(`${D}app/${dentro}.png`);
  let t = trova(padre, pezzo), vero = pezzo, via = "";
  if (t.medio > 8) {
    // l'export del pezzo è trasparente e a livelli (#528): lo si cerca col suo nodo nel JSON del genitore e si ritaglia il disegno del genitore
    const nome = JSON.parse(readFileSync(`${D}figma/${id}.json`, "utf8")).frame.nome;
    const n = JSON.parse(readFileSync(`${D}figma/${dentro}.json`, "utf8")).nodi.find((m) => m.nome === nome && m.box.w === pezzo.w && m.box.h === pezzo.h);
    if (!n) { console.log(`${id}\tdentro ${dentro}\tNON CONFRONTABILE: il pezzo non si ritrova nel genitore (scarto ${t.medio.toFixed(1)}) e il genitore non ha un nodo «${nome}»`); gravi++; continue; }
    t = { x: Math.round(n.box.x), y: Math.round(n.box.y) }; vero = ritaglia(padre, { ...t, w: pezzo.w, h: pezzo.h }); via = " (dal nodo del genitore)";
  }
  const dietro = ritaglia(app, { x: t.x, y: t.y, w: pezzo.w, h: pezzo.h });
  const r = immagine(via ? vero : sopra(pezzo, dietro), dietro, 0.08);
  gravi += r.gravi.length;
  console.log(`${id}\tdentro ${dentro}\tx ${t.x} y ${t.y}${via}\t${r.nota ?? r.gravi[0]}\terrori gravi: ${r.gravi.length}`);
}
process.exit(gravi ? 1 : 0);
