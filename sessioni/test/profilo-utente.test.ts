// Nome e iniziali dell'utente (#456, A16/G19): dall'account Claude predefinito letto dai file locali, se no dal nome di macOS.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { profiloUtente } from "../src/impostazioni";

/** Una home di prova: ogni chiave è un file `.claude.json` con quell'`oauthAccount` (o il testo grezzo), più `projects/` per ogni cartella. */
const casa = (file: Record<string, unknown>) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "profilo-"));
  for (const [rel, oauthAccount] of Object.entries(file)) {
    const dir = path.dirname(path.join(home, rel));
    fs.mkdirSync(dir, { recursive: true });
    if (dir !== home) fs.mkdirSync(path.join(dir, "projects"), { recursive: true });
    fs.writeFileSync(path.join(home, rel), typeof oauthAccount === "string" ? oauthAccount : JSON.stringify({ oauthAccount }));
  }
  return home;
};
const mac = () => "Maria Rossi";

test("profilo: fullName dell'account predefinito, iniziali dalle prime lettere", () => {
  const home = casa({ ".claude/.claude.json": { fullName: "Anna Verdi", displayName: "Anna" } });
  assert.deepEqual(profiloUtente(home, mac), { nome: "Anna Verdi", iniziali: "AV" });
});

test("profilo: senza fullName vale displayName; il .claude.json della home vale per .claude", () => {
  const home = casa({ ".claude/.claude.json": { emailAddress: "a@b.it" }, ".claude.json": { displayName: "Luca" } });
  assert.deepEqual(profiloUtente(home, mac), { nome: "Luca", iniziali: "L" });
});

test("profilo: file mancante, rotto o senza nome -> il nome di macOS", () => {
  assert.deepEqual(profiloUtente(casa({}), mac), { nome: "Maria Rossi", iniziali: "MR" });
  assert.equal(profiloUtente(casa({ ".claude/.claude.json": "{non json" }), mac).nome, "Maria Rossi");
  assert.equal(profiloUtente(casa({ ".claude/.claude.json": { emailAddress: "a@b.it" } }), mac).nome, "Maria Rossi");
});

test("profilo: il primo account con un nome vince, il predefinito per primo", () => {
  const home = casa({ ".claude-b/.claude.json": { fullName: "Bea Neri" }, ".claude/.claude.json": { fullName: "Anna Verdi" } });
  assert.equal(profiloUtente(home, mac).nome, "Anna Verdi");
  const solo = casa({ ".claude-b/.claude.json": { fullName: "Bea Neri" }, ".claude/.claude.json": {} });
  assert.equal(profiloUtente(solo, mac).nome, "Bea Neri");
});
