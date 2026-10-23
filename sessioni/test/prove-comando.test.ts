import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const prova = (cmd: string) => spawnSync("node", [path.join(__dirname, "..", "src", "prove-collegamento.js"), "claude"],
  { encoding: "utf8", env: { ...process.env, PROVE_CLAUDE: cmd } }).stdout;

test("prove: PROVE_CLAUDE sceglie il comando delle sessioni vere", { skip: process.platform === "darwin" }, () => {
  assert.match(prova("comando-che-non-esiste-xyz"), /comando comando-che-non-esiste-xyz non trovato/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "falso-"));
  const falso = path.join(dir, "falso");
  fs.writeFileSync(falso, '#!/bin/sh\necho \'{"session_id":"nessuna-sessione"}\'\n', { mode: 0o755 });
  try { assert.match(prova(falso), /sessione nessuna-sessione non trovata dal lettore/); } finally { fs.rmSync(dir, { recursive: true }); }
});
