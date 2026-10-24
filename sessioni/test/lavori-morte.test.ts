// Worker dei lavori che muore (#474): le richieste in attesa falliscono (non restano appese con la loro memoria) e il lavoro dopo ne avvia uno nuovo.
import test from "node:test";
import assert from "node:assert/strict";
import { fermaLavori, lavoro } from "../src/lavori";

const uso = () => lavoro<Map<string, unknown>>({ tipo: "uso", radici: [], ora: Date.UTC(2026, 9, 24) });

test("lavori: se il worker esce, la richiesta in attesa fallisce", { timeout: 8000 }, async (t) => {
  t.after(fermaLavori);
  const p = uso();
  fermaLavori(); // il worker esce senza un evento «error»
  await assert.rejects(p, /worker dei lavori uscito/);
});

test("lavori: dopo la morte del worker il lavoro successivo riparte", { timeout: 8000 }, async (t) => {
  t.after(fermaLavori);
  const morta = uso();
  fermaLavori();
  await morta.catch(() => {});
  assert.ok((await uso()) instanceof Map);
});
