import { strict as assert } from "node:assert";
import { test } from "node:test";
import { filtra, GRUPPI } from "../src/ui/dialoghi/elenco";
import { vicina } from "../src/ui/dialoghi/vicina";
import { PARTENZA } from "../src/partenza";

const el = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("dialoghi: sessione prima e dopo, con giro", () => {
  assert.equal(vicina(el, "a", 1), "b");
  assert.equal(vicina(el, "c", 1), "a");
  assert.equal(vicina(el, "a", -1), "c");
  assert.equal(vicina(el, null, 1), "a");
  assert.equal(vicina(el, "zzz", -1), "c");
  assert.equal(vicina([{ id: "a" }], "a", 1), null);
  assert.equal(vicina([], "a", 1), null);
});

test("scorciatoie: i tasti delle voci delle impostazioni sono quelli salvati, i fissi quelli del disegno", () => {
  const tutte = filtra({ ...PARTENZA.scorciatoie, ferma: "⌘9", nega: null }, "").flatMap((g) => g.righe);
  const tasti = (e: string) => tutte.find((r) => r.etichetta === e)?.tasti;
  assert.equal(tasti("Ferma la sessione"), "⌘9");
  assert.equal(tasti("Nega"), null, "tolta: «Non assegnata»");
  assert.equal(tasti("Cerca sessioni"), "⌘K");
  assert.equal(tasti("Scrivi a clotch AI"), "⌘⇧F");
  assert.equal(tasti("Archivia"), "⇧⌘A");
  assert.equal(tasti("Mostra scorciatoie"), "⌘/");
  assert.equal(tutte.length, GRUPPI.flatMap((g) => g.righe).length);
});

test("scorciatoie: la ricerca guarda nome e tasti, e toglie i gruppi vuoti", () => {
  const nomi = (q: string) => filtra(PARTENZA.scorciatoie, q).flatMap((g) => g.righe.map((r) => r.etichetta));
  assert.deepEqual(nomi("coda"), ["Metti in coda"]);
  assert.deepEqual(filtra(PARTENZA.scorciatoie, "coda").map((g) => g.titolo), ["Casella"]);
  assert.ok(nomi("⌘y").includes("Consenti"));
  assert.deepEqual(nomi("kubernetes"), []);
});
