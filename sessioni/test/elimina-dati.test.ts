import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { eliminaDati } from "../src/impostazioni";
import { Indice } from "../src/indice";
import { impostaImpostazioni, impostaPreferenze, leggiImpostazioni, leggiPreferenze } from "../src/preferenze";

test("elimina dati: toglie indice, cache e impostazioni dell'app; sessioni originali e preferenze per sessione restano", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "elimina-"));
  const trascrizione = path.join(d, "a.jsonl");
  fs.writeFileSync(trascrizione, JSON.stringify({ type: "user", message: { content: "ciao" } }) + "\n");
  const dir = path.join(d, "userData");
  const indice = new Indice(dir);
  await indice.metti([{ id: "a", file: trascrizione, sorgente: "claude-code", titolo: "A" }], true);
  indice.scrivi();
  fs.mkdirSync(path.join(dir, "cache", "messaggi"), { recursive: true });
  const prefs = path.join(dir, "preferenze.json");
  impostaPreferenze(prefs, "a", { fissa: true });
  impostaImpostazioni(prefs, { cronologia: "7 giorni", lingua: "English" });

  eliminaDati(indice, prefs);

  assert.ok(!fs.existsSync(path.join(dir, "indice.json")) && !fs.existsSync(path.join(dir, "cache", "messaggi")));
  assert.deepEqual(leggiImpostazioni(prefs), {});
  assert.deepEqual(leggiPreferenze(prefs), { a: { fissa: true } });
  assert.ok(fs.existsSync(trascrizione));
});
