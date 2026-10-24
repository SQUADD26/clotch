// Indice con il worker dei lavori (#474): la trascrizione cambiata la rilegge il worker, il main non ne legge un byte.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Indice } from "../src/indice";
import { fermaLavori, lavoro } from "../src/lavori";

test("indice: la rilettura della trascrizione avviene nel worker", async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "indice-fuori-"));
  t.after(() => { fermaLavori(); fs.rmSync(d, { recursive: true, force: true }); });
  const f = path.join(d, "a.jsonl");
  const riga = (testo: string) => JSON.stringify({ type: "user", timestamp: "2026-10-24T08:00:00Z", message: { role: "user", content: testo } }) + "\n";
  fs.writeFileSync(f, riga("gatto nero") + riga("cane"));
  const i = new Indice(path.join(d, "userData"), 2000, false);
  i.lavoraFuori((s, v) => lavoro({ tipo: "voce", s, v }));
  const fsm = require("node:fs"), rs = fsm.readSync, rf = fsm.readFileSync;
  let letti = 0;
  fsm.readSync = (fd: number, ...a: any[]) => { letti++; return rs(fd, ...a); };
  fsm.readFileSync = (p: any, ...a: any[]) => { if (String(p) === f) letti++; return rf(p, ...a); };
  try {
    await i.metti([{ id: "a", file: f, sorgente: "claude-code", titolo: "A" }], true);
    fs.appendFileSync(f, riga("gatto bianco"));
    await i.metti([{ id: "a", file: f, sorgente: "claude-code", titolo: "A" }]);
  } finally { fsm.readSync = rs; fsm.readFileSync = rf; }
  assert.equal(letti, 0);
  assert.equal(i.totale("a"), 3);
  assert.equal(i.cerca("bianco")[0]?.id, "a");
});
