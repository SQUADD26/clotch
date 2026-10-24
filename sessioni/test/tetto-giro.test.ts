// Tetti di tempo (#474): il lag non deve tornare. Con 2000 trascrizioni in 3 account (due con `projects` linkata, come sul Mac di Roberto)
// un giro dal vivo con un file toccato e una lettura del registro dopo una riga nuova restano sotto il tetto, misurati come mediana.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Osservatore } from "../src/osserva";
import { lettoreRegistro } from "../src/clotch-ai";

const TETTO_GIRO_MS = 30, TETTO_REGISTRO_MS = 5;
const mediana = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1];
const tempo = (f: () => void) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6; };

test(`giro dal vivo con 2000 sessioni e un file toccato: sotto ${TETTO_GIRO_MS} ms`, (t) => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "tetto-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  const proj = path.join(h, ".claude", "projects");
  for (let c = 0; c < 100; c++) {
    const d = path.join(proj, `-Users-x-p${c}`);
    fs.mkdirSync(d, { recursive: true });
    for (let i = 0; i < 20; i++) {
      const id = `aaaaaaaa-0000-4000-8000-${String(c * 20 + i).padStart(12, "0")}`;
      fs.writeFileSync(path.join(d, `${id}.jsonl`), JSON.stringify({ type: "user", sessionId: id, cwd: `/Users/x/p${c}`, message: { role: "user", content: `ciao ${i}` } }) + "\n");
    }
  }
  for (const a of [".claude-b", ".claude-c"]) { fs.mkdirSync(path.join(h, a)); fs.symlinkSync(proj, path.join(h, a, "projects")); }
  const o = new Osservatore(h, () => {}, {}, 20);
  assert.equal(o.elenco.sessioni.length, 2000);
  const file = o.elenco.sessioni[0].file, giri: number[] = [];
  o.giro(); // il primo giro fa anche il controllo di tutti i file
  for (let i = 0; i < 9; i++) {
    fs.appendFileSync(file, JSON.stringify({ type: "user", cwd: "/Users/x/p0", message: { role: "user", content: `ancora ${i}` } }) + "\n");
    o.tocca(file);
    giri.push(tempo(() => o.giro()));
  }
  o.ferma();
  console.log(`giro dal vivo: mediana ${mediana(giri).toFixed(1)} ms`);
  assert.ok(mediana(giri) < TETTO_GIRO_MS, `mediana ${mediana(giri).toFixed(1)} ms`);
});

test(`registro da 20 MB, una riga nuova: lettura sotto ${TETTO_REGISTRO_MS} ms`, (t) => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "tetto-reg-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  const dir = path.join(h, ".claude", "registro"), file = path.join(dir, "2026-10.jsonl");
  fs.mkdirSync(dir, { recursive: true });
  const riga = (n: number) => JSON.stringify({ v: 1, id: `r-${n.toString(16).padStart(12, "0")}`, t: "2026-10-24T08:00:00Z", n, chat: `c${n % 700}`, tipo: "battito", dati: { stato: "lavora" } }) + "\n";
  const righe: string[] = [];
  for (let n = 1, b = 0; b < 20e6; n++) { const r = riga(n); righe.push(r); b += r.length; }
  fs.writeFileSync(file, righe.join(""));
  const leggi = lettoreRegistro(h), tempi: number[] = [];
  leggi();
  for (let i = 0; i < 9; i++) { fs.appendFileSync(file, riga(righe.length + 1 + i)); tempi.push(tempo(() => leggi())); }
  console.log(`registro: mediana ${mediana(tempi).toFixed(2)} ms`);
  assert.ok(mediana(tempi) < TETTO_REGISTRO_MS, `mediana ${mediana(tempi).toFixed(2)} ms`);
});
