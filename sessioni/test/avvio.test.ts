import { test } from "node:test";
import * as assert from "node:assert/strict";
import { primoElenco } from "../src/ui/base/dati";

// F7 (#472): la schermata di avvio e la barra condividono la prima lettura dell'elenco, il disco si legge una volta sola.
test("avvio: la prima lettura dell'elenco è una sola, condivisa", async () => {
  let letture = 0;
  const vuoto = { sessioni: [], errori: [] };
  (globalThis as unknown as { window: unknown }).window = { sessioni: { elencoSessioni: async () => (letture++, vuoto) } };
  const [a, b] = [primoElenco(), primoElenco()];
  assert.equal(a, b);
  assert.deepEqual(await a, vuoto);
  assert.equal(letture, 1);
});
