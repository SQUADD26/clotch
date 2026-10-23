import { test } from "node:test";
import * as assert from "node:assert/strict";
import { prossimaInAttesa } from "../src/ui/base/prossima";

const el = (...s: string[]) => s.map((stato, i) => ({ id: `s${i}`, stato }));

test("prossima in attesa dopo quella aperta, poi ricomincia dall'inizio", () => {
  const e = el("aspetta", "lavora", "aspetta", "finita", "aspetta");
  assert.equal(prossimaInAttesa(e, "s0"), "s2");
  assert.equal(prossimaInAttesa(e, "s2"), "s4");
  assert.equal(prossimaInAttesa(e, "s4"), "s0");
  assert.equal(prossimaInAttesa(e, "s1"), "s2");
  assert.equal(prossimaInAttesa(e, null), "s0");
});

test("nessuna in attesa, o solo quella aperta: niente", () => {
  assert.equal(prossimaInAttesa(el("lavora", "finita"), "s0"), null);
  assert.equal(prossimaInAttesa(el("lavora", "aspetta"), "s1"), null);
  assert.equal(prossimaInAttesa([], null), null);
});
