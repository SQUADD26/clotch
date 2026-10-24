// Controlla copertura.jsonl contro matrice.jsonl: ogni id una volta sola e ogni prova file:riga esistente.
// Uso: node scripts/copertura.mjs  ->  COPERTURA_OK {conteggi}  oppure l'elenco degli errori (exit 1).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const radice = join(dirname(fileURLToPath(import.meta.url)), ".."); // .../sessioni
const dir = join(radice, "design", "requisiti");
const campi = {
  disegnato: ["sì", "no", "non verificabile"],
  implementato: ["sì", "parziale", "no"],
  collegato: ["sì", "no", "non serve"],
  provato: ["sì", "parziale", "no"],
};
const righe = (f) =>
  readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`${f}:${i + 1} JSON non valido`); }
  });

const tutti = (d, o = []) => {
  for (const n of readdirSync(d)) {
    if (n === "node_modules" || n === "dist") continue;
    const p = join(d, n);
    statSync(p).isDirectory() ? tutti(p, o) : o.push(p);
  }
  return o;
};
const file = [...tutti(join(radice, "src")), ...tutti(join(radice, "test")), ...tutti(join(radice, "scripts")), join(radice, "package.json")];
const lunghezze = new Map();
const nRighe = (p) => {
  if (!lunghezze.has(p)) lunghezze.set(p, readFileSync(p, "utf8").split("\n").length);
  return lunghezze.get(p);
};

// Il file è citato col percorso (src/…, test/…) o col solo nome (Righe.tsx): basta un candidato che abbia la riga.
function candidati(rif) {
  const dirette = [join(radice, rif), join(radice, "..", rif)].filter(existsSync);
  if (dirette.length) return dirette;
  return file.filter((p) => p.endsWith("/" + rif));
}
function controllaProva(testo) {
  const errori = [];
  for (const m of testo.matchAll(/((?:[\w.-]+\/)*[\w.-]+\.(?:tsx?|cjs|mjs|css|md|json)):(\d+)(?:-(\d+))?/g)) {
    const [, rif, a, b] = m;
    const c = candidati(rif);
    if (!c.length) errori.push(`${m[0]}: file inesistente`);
    else if (!c.some((p) => nRighe(p) >= Number(b ?? a) && Number(a) >= 1)) errori.push(`${m[0]}: riga oltre la fine del file`);
  }
  return errori;
}

const errori = [];
const matrice = righe("matrice.jsonl");
const cop = righe("copertura.jsonl");
const visti = new Map();
for (const r of cop) visti.set(r.id, (visti.get(r.id) ?? 0) + 1);
for (const { id } of matrice) {
  const n = visti.get(id) ?? 0;
  if (n !== 1) errori.push(`${id}: ${n} righe in copertura.jsonl (ne serve 1)`);
}
const ids = new Set(matrice.map((r) => r.id));
for (const id of visti.keys()) if (!ids.has(id)) errori.push(`${id}: non è nella matrice`);

const conteggi = { disegnato: {}, implementato: {}, collegato: {}, provato: {} };
for (const r of cop) {
  for (const [k, ok] of Object.entries(campi)) {
    if (!ok.includes(r[k])) errori.push(`${r.id}: ${k}="${r[k]}" non ammesso`);
    else conteggi[k][r[k]] = (conteggi[k][r[k]] ?? 0) + 1;
    for (const e of controllaProva(r[k + "_prova"] ?? "")) errori.push(`${r.id}.${k}_prova ${e}`);
  }
}
if (errori.length) {
  console.error(errori.join("\n"));
  process.exit(1);
}
console.log("COPERTURA_OK", JSON.stringify({ requisiti: cop.length, ...conteggi }));
