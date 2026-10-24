// Lettore incrementale del registro (#474): un mese che non si legge una volta (EMFILE, EIO) non deve far applicare le sue righe
// dopo quelle dei mesi successivi quando torna leggibile. Il risultato resta quello di una lettura da capo.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro, lettoreRegistro } from "../src/clotch-ai";

const riga = (n: number, mese: string, stato: string) =>
  JSON.stringify({ v: 1, id: `r-${String(n).padStart(12, "0")}`, t: `2026-${mese}-24T08:00:00.000Z`, n, chat: "a", tipo: "stato", dati: { stato } }) + "\n";

test("errore passeggero su un mese vecchio: al recupero lo stato è quello del mese nuovo", (t) => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "registro-errore-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  const dir = path.join(h, ".claude", "registro"), ottobre = path.join(dir, "2026-10.jsonl");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ottobre, riga(1, "10", "lavora"));
  fs.writeFileSync(path.join(dir, "2026-11.jsonl"), riga(2, "11", "finito"));
  const fsm = require("node:fs"), apri = fsm.openSync; // il modulo vero: lo spazio dei nomi importato ha solo getter
  fsm.openSync = (p: string, ...a: any[]) => {
    if (p === ottobre) throw Object.assign(new Error("EMFILE: too many open files"), { code: "EMFILE" });
    return apri(p, ...a);
  };
  const leggi = lettoreRegistro(h);
  try { assert.equal(leggi().errori.length, 1); } finally { fsm.openSync = apri; }
  assert.equal(leggi().chat.get("a")!.stato, leggiRegistro(h).chat.get("a")!.stato);
  assert.equal(leggi().chat.get("a")!.stato, "finito");
});
