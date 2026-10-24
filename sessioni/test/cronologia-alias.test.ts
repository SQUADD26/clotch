// #482: lo stesso file raggiunto da radici diverse (account con `projects` in link simbolico) non è una rotazione.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cronologia } from "../src/cronologia";
import type { DeltaCronologia } from "../src/cronologia-tipi";

const riga = (i: number) => JSON.stringify({ type: i % 2 ? "assistant" : "user", message: { content: `m${i}` } }) + "\n";

test("append visto da due percorsi dello stesso file: nessun reset, stessa epoca", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cronologia-alias-")), deltas: DeltaCronologia[] = [], c = new Cronologia();
  try {
    fs.mkdirSync(path.join(dir, "vera"));
    fs.symlinkSync(path.join(dir, "vera"), path.join(dir, "alias"));
    const file = path.join(dir, "vera", "a.jsonl");
    fs.writeFileSync(file, riga(0) + riga(1));
    c.collega((d) => deltas.push(d));
    const vie = [file, path.join(dir, "alias", "a.jsonl")].map((f) => ({ id: "s", file: f, sorgente: "claude-code" as const }));
    const epoca = c.pagina(vie[0], 0, { v: 1 }).cronologia!.epoca;
    for (let i = 2; i < 8; i++) {
      fs.appendFileSync(file, riga(i));
      const r = c.aggiorna(vie[i % 2]);
      assert.ok(!("codice" in r), JSON.stringify(r));
      assert.equal(r.epoca, epoca);
    }
    assert.deepEqual(deltas.map((d) => d.tipo), Array(6).fill("upsert"));
    assert.equal(c.pagina(vie[1], 0, { v: 1 }).totale, 8);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
