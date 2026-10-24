// Lettura incrementale del registro (#474): dopo la prima lettura si leggono solo i byte nuovi, e il risultato è quello di una lettura da capo.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro, lettoreRegistro } from "../src/clotch-ai";
import { piano } from "../src/clotch-ai-ipc";

let seq = 0;
const riga = (chat: string, tipo: string, dati: object = {}) =>
  JSON.stringify({ v: 1, id: `r-${String(++seq).padStart(12, "0")}`, t: new Date(Date.UTC(2026, 9, 24, 8, 0, seq % 60)).toISOString(), n: seq, chat, tipo, dati }) + "\n";
function casa(t: test.TestContext) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "registro-inc-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  fs.mkdirSync(path.join(h, ".claude", "registro"), { recursive: true });
  return { h, file: path.join(h, ".claude", "registro", "2026-10.jsonl") };
}
/** Byte letti dal disco mentre gira `f`. */
function byteLetti(f: () => void): number {
  const fsm = require("node:fs"), rs = fsm.readSync, rf = fsm.readFileSync; // il modulo vero: lo spazio dei nomi importato ha solo getter
  let n = 0;
  fsm.readSync = (...a: any[]) => { const x = rs(...a); n += x; return x; };
  fsm.readFileSync = (...a: any[]) => { const x = rf(...a); n += Buffer.byteLength(x); return x; };
  try { f(); } finally { fsm.readSync = rs; fsm.readFileSync = rf; }
  return n;
}
const uguale = (a: ReturnType<typeof leggiRegistro>, b: ReturnType<typeof leggiRegistro>) => assert.equal(JSON.stringify(piano(a)), JSON.stringify(piano(b)));

test("una riga nuova su un registro da 2 MB: si leggono solo i suoi byte", (t) => {
  const { h, file } = casa(t);
  let testo = "";
  for (let i = 0; testo.length < 2_000_000; i++) testo += riga(`c${i % 700}`, "battito", { stato: "lavora" });
  fs.writeFileSync(file, testo);
  const leggi = lettoreRegistro(h);
  leggi();
  const nuova = riga("c1", "stato", { stato: "aspetta", domanda: "vai?" });
  fs.appendFileSync(file, nuova);
  const letti = byteLetti(() => leggi());
  assert.ok(letti <= nuova.length, `letti ${letti} byte, la riga nuova ne ha ${nuova.length}`);
  assert.equal(leggi().chat.get("c1")!.stato, "aspetta");
  uguale(leggi(), leggiRegistro(h));
});

test("riga a metà scrittura: si applica quando è finita, mai due volte", (t) => {
  const { h, file } = casa(t);
  fs.writeFileSync(file, riga("a", "inizio", { titolo: "uno" }));
  const leggi = lettoreRegistro(h);
  leggi();
  const r = riga("a", "compattazione");
  fs.appendFileSync(file, r.slice(0, 20));
  assert.equal(leggi().chat.get("a")!.compattazioni, 0);
  fs.appendFileSync(file, r.slice(20));
  assert.equal(leggi().chat.get("a")!.compattazioni, 1);
  assert.equal(leggi().chat.get("a")!.compattazioni, 1);
  uguale(leggi(), leggiRegistro(h));
});

test("mese accorciato, sostituito o tolto: si rilegge da capo", (t) => {
  const { h, file } = casa(t);
  fs.writeFileSync(file, riga("a", "inizio", { titolo: "uno" }) + riga("a", "compattazione"));
  const leggi = lettoreRegistro(h);
  assert.equal(leggi().chat.get("a")!.compattazioni, 1);
  fs.writeFileSync(file, riga("a", "inizio", { titolo: "due" })); // accorciato
  assert.equal(leggi().chat.get("a")!.titolo, "due");
  assert.equal(leggi().chat.get("a")!.compattazioni, 0);
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, riga("b", "inizio", { titolo: "tre" }) + riga("b", "compattazione") + riga("b", "compattazione"));
  fs.renameSync(tmp, file); // sostituito (altro inode), più lungo
  assert.deepEqual([...leggi().chat.keys()], ["b"]);
  fs.writeFileSync(path.join(h, ".claude", "registro", "2026-11.jsonl"), riga("c", "inizio"));
  assert.deepEqual([...leggi().chat.keys()].sort(), ["b", "c"]);
  fs.unlinkSync(file); // tolto
  assert.deepEqual([...leggi().chat.keys()], ["c"]);
  uguale(leggi(), leggiRegistro(h));
});
