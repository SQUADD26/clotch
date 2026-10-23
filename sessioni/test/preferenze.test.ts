import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { impostaPreferenze, leggiPreferenze } from "../src/preferenze";

const file = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pref-")), "cartella", "preferenze.json");

test("preferenze: file mancante = vuoto; imposta unisce, null toglie, sessione vuota sparisce", () => {
  const f = file();
  assert.deepEqual(leggiPreferenze(f), {});
  impostaPreferenze(f, "a", { icona: "stella", fissa: true });
  impostaPreferenze(f, "a", { colore: "blu", fissa: null });
  assert.deepEqual(leggiPreferenze(f), { a: { icona: "stella", colore: "blu" } });
  impostaPreferenze(f, "a", { icona: null, colore: null });
  assert.deepEqual(leggiPreferenze(f), {});
  assert.ok(!fs.existsSync(`${f}.tmp`));
});

test("preferenze: file rotto non viene sovrascritto", () => {
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, "{rotto");
  assert.throws(() => impostaPreferenze(f, "a", { fissa: true }));
  assert.equal(fs.readFileSync(f, "utf8"), "{rotto");
});
