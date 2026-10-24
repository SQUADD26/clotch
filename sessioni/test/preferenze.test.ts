import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { impostaImpostazioni, impostaPreferenze, leggiImpostazioni, leggiPreferenze } from "../src/preferenze";

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

test("preferenze: la forma vecchia (mappa piatta degli id) si legge come sessioni e non si perde", () => {
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ a: { fissa: true } }));
  assert.deepEqual(leggiPreferenze(f), { a: { fissa: true } });
  assert.deepEqual(leggiImpostazioni(f), {});
  impostaImpostazioni(f, { tema: "scuro" });
  assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")), { sessioni: { a: { fissa: true } }, app: { tema: "scuro" } });
  impostaPreferenze(f, "b", { colore: "blu" });
  assert.deepEqual(leggiPreferenze(f), { a: { fissa: true }, b: { colore: "blu" } });
  assert.deepEqual(leggiImpostazioni(f), { tema: "scuro" });
});

test("impostazioni: imposta unisce, null toglie; file rotto non viene sovrascritto", () => {
  const f = file();
  impostaImpostazioni(f, { tema: "scuro", lingua: "it" });
  assert.deepEqual(impostaImpostazioni(f, { lingua: null, voce: true }), { tema: "scuro", voce: true });
  assert.deepEqual(leggiImpostazioni(f), { tema: "scuro", voce: true });
  assert.deepEqual(leggiPreferenze(f), {});
  fs.writeFileSync(f, "{rotto");
  assert.throws(() => impostaImpostazioni(f, { tema: "chiaro" }));
  assert.equal(fs.readFileSync(f, "utf8"), "{rotto");
});

test("preferenze (#437): la scorciatoia salvata sotto `friday` si legge col nome nuovo e il file viene riscritto", () => {
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ sessioni: {}, app: { scorciatoie: { cerca: "⌘K", friday: "⌘⇧L" } } })); // chiave vecchia delle scorciatoie salvate
  assert.deepEqual(leggiImpostazioni(f), { scorciatoie: { cerca: "⌘K", clotchAi: "⌘⇧L" } });
  assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")).app.scorciatoie, { cerca: "⌘K", clotchAi: "⌘⇧L" });
  fs.writeFileSync(f, JSON.stringify({ sessioni: {}, app: { scorciatoie: { friday: "⌘1", clotchAi: "⌘2" } } })); // chiave vecchia delle scorciatoie salvate
  assert.deepEqual(leggiImpostazioni(f), { scorciatoie: { clotchAi: "⌘2" } });
});
