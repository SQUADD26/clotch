// Misura la cronologia a freddo, con un append e senza cambi: ms, byte letti da readSync, chiamate.
// Uso: tsc && node scripts/misura-cronologia.mjs [cartella-dist]   (default: ./dist). Stesso comando su due commit = prima/dopo.
// Dati: 42.000 messaggi sintetici e una COPIA (in temp, cancellata) della trascrizione reale più grande in ~/.claude*/projects.
// Non stampa mai contenuto né percorsi della trascrizione reale. Nessuna rete, nessuna scrittura fuori da temp.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const dist = path.resolve(process.argv[2] ?? "dist");
const { Cronologia } = createRequire(import.meta.url)(path.join(dist, "src/cronologia.js"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "misura-cronologia-"));
const nuova = (i) => JSON.stringify({ type: i % 2 ? "assistant" : "user", message: { content: `messaggio ${i} ` + "x".repeat(1000) } }) + "\n";

let byte = 0, chiamate = 0;
const orig = fs.readSync;
fs.readSync = function (...a) { const n = orig.apply(fs, a); byte += n; chiamate++; return n; };
function misura(f) {
  byte = 0; chiamate = 0;
  const t = performance.now(), r = f();
  return { ms: +(performance.now() - t).toFixed(2), byte, chiamate, r };
}
const mediana = (v) => v.sort((a, b) => a - b)[v.length >> 1];
const riga = (nome, m) => console.log(`${nome} ms=${m.ms} readBytes=${m.byte} readCalls=${m.chiamate}`);

function scenario(etichetta, file) {
  const dim = fs.statSync(file).size, c = new Cronologia({ fileByte: 1 << 30, statoByte: 1 << 30, snapshotByte: 1 << 30 });
  const s = { id: etichetta, file, sorgente: "claude-code" };
  if (dim && fs.readFileSync(file).at(-1) !== 10) fs.appendFileSync(file, "\n"); // una riga finale a metà non si pubblica
  const freddo = misura(() => c.pagina(s, 0, { v: 1 }));
  if (freddo.r.errore) return console.log(`${etichetta} ERRORE ${freddo.r.errore}`);
  console.log(`${etichetta} sourceBytes=${dim} messaggi=${freddo.r.totale}`);
  riga(`${etichetta} FREDDO`, freddo);
  const ms = [], bytes = [], chiamateAppend = [];
  for (let i = 0; i < 7; i++) {
    fs.appendFileSync(file, nuova(i));
    const m = misura(() => c.aggiorna(s));
    if ("codice" in m.r) return console.log(`${etichetta} ERRORE append ${m.r.codice}`);
    ms.push(m.ms); bytes.push(m.byte); chiamateAppend.push(m.chiamate);
  }
  riga(`${etichetta} APPEND (mediana di 7, 1 messaggio da ~1 KB)`, { ms: mediana(ms), byte: mediana(bytes), chiamate: mediana(chiamateAppend) });
  const nessuno = misura(() => { c.aggiorna(s); return c.pagina(s, 1, { v: 1, cursore: freddo.r.cronologia.cursorePrima }); });
  riga(`${etichetta} NESSUN_CAMBIO (aggiorna + pagina vecchia)`, nessuno);
}

function piuGrande() {
  let best = null;
  const visita = (d, prof) => {
    let voci; try { voci = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const v of voci) {
      const p = path.join(d, v.name);
      if (v.isDirectory() && prof < 4) visita(p, prof + 1);
      else if (v.isFile() && v.name.endsWith(".jsonl")) { const z = fs.statSync(p).size; if (!best || z > best.z) best = { p, z }; }
    }
  };
  for (const v of fs.readdirSync(os.homedir())) if (v.startsWith(".claude")) visita(path.join(os.homedir(), v, "projects"), 0);
  return best;
}

try {
  const sint = path.join(tmp, "sintetico.jsonl"), fd = fs.openSync(sint, "w");
  for (let i = 0; i < 42000; i++) fs.writeSync(fd, nuova(i));
  fs.closeSync(fd);
  scenario("SINTETICO42000", sint);
  const reale = piuGrande();
  if (!reale) console.log("REALE nessuna trascrizione trovata");
  else { const copia = path.join(tmp, "reale.jsonl"); fs.copyFileSync(reale.p, copia); scenario("REALE", copia); }
} finally {
  fs.readSync = orig;
  fs.rmSync(tmp, { recursive: true, force: true });
}
