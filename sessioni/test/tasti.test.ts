import { test } from "node:test";
import * as assert from "node:assert/strict";
import { azioneDi, tastiDi } from "../src/ui/impostazioni/tasti";

const salvate = { cerca: "⌘K", clotchAi: "⌘⇧F", nega: "⌘⌫", inviaInterrompi: "↵", coda: "⌘↵", barra: null };
const premi = (key: string, code: string, m: { metaKey?: boolean; shiftKey?: boolean } = {}) =>
  azioneDi(tastiDi({ key, code, metaKey: false, shiftKey: false, altKey: false, ctrlKey: false, ...m }), salvate);

test("tasto premuto -> azione salvata, anche con ⇧ (vale il tasto fisico)", () => {
  assert.equal(premi("k", "KeyK", { metaKey: true }), "cerca");
  assert.equal(premi("F", "KeyF", { metaKey: true, shiftKey: true }), "clotchAi");
  assert.equal(premi("Backspace", "Backspace", { metaKey: true }), "nega");
  assert.equal(premi("Enter", "Enter"), "inviaInterrompi");
  assert.equal(premi("Enter", "Enter", { metaKey: true }), "coda");
});

test("tasto senza scorciatoia, solo modificatore o scorciatoia tolta: nessuna azione", () => {
  assert.equal(premi("k", "KeyK"), null);
  assert.equal(premi("Meta", "MetaLeft", { metaKey: true }), null);
  assert.equal(premi("Enter", "Enter", { shiftKey: true }), null);
  assert.equal(azioneDi("⌘\\", salvate), null); // «barra» è null: non risponde a niente
  assert.equal(azioneDi(null, salvate), null);
});

test("stessa scorciatoia su due azioni: nessuna delle due scatta", () => {
  assert.equal(azioneDi("⌘K", { ...salvate, ferma: "⌘K" }), null);
});
