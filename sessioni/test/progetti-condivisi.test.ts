// Più account con `projects` linkata alla stessa cartella (così sul Mac di Roberto: 9 account, una cartella): si legge e si guarda una volta (#474).
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiElenco } from "../src/elenco";
import { Osservatore } from "../src/osserva";

function casa() {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "condivisi-"));
  const p = path.join(h, ".claude", "projects", "-Users-x-app");
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, "aaaaaaaa-0000-4000-8000-000000000001.jsonl"), JSON.stringify({ type: "user", cwd: "/Users/x/app", message: { role: "user", content: "ciao" } }) + "\n");
  for (const a of [".claude-b", ".claude-c"]) { fs.mkdirSync(path.join(h, a)); fs.symlinkSync(path.join(h, ".claude", "projects"), path.join(h, a, "projects")); }
  return h;
}

test("projects linkata da più account: una sessione, del primo account, letta una volta", () => {
  const h = casa(), fsm = require("node:fs"), rd = fsm.readdirSync;
  let letture = 0;
  fsm.readdirSync = (p: any, ...r: any[]) => { if (String(p).endsWith("-Users-x-app")) letture++; return rd(p, ...r); };
  try {
    const e = leggiElenco({ home: h });
    assert.deepEqual(e.sessioni.map((s) => [s.id, s.account]), [["aaaaaaaa-0000-4000-8000-000000000001", ".claude"]]);
  } finally { fsm.readdirSync = rd; }
  assert.equal(letture, 1);
});

test("projects linkata da più account: un solo osservatore per la cartella vera", () => {
  const h = casa(), fsm = require("node:fs"), w = fsm.watch;
  const guardate: string[] = [];
  fsm.watch = (d: any, ...r: any[]) => { guardate.push(String(d)); return w(d, ...r); };
  const o = new Osservatore(h, () => {}, {}, 20);
  try { o.avvia(); } finally { fsm.watch = w; o.ferma(); }
  assert.equal(guardate.filter((d) => d.endsWith("projects")).length, 1);
});
