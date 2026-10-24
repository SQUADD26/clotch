import { strict as assert } from "node:assert";
import { test } from "node:test";
import { rispostaScena, type Scena } from "../src/scena";
import type { Messaggio } from "../src/tipi";

test("scena: elenco vuoto di base, messaggi a pagine dalla fine, canali che scrivono non fanno niente", () => {
  const messaggi: Messaggio[] = Array.from({ length: 60 }, (_, i) => ({ tipo: "utente", testo: `m${i}`, t: null }));
  const s: Scena = { messaggi: { a: messaggi } };
  assert.deepEqual(rispostaScena(s, "sessioni:elenco", []), { sessioni: [], errori: [] });
  const p0 = rispostaScena(s, "sessioni:messaggi", ["a", 0]) as { messaggi: Messaggio[]; haAltre: boolean };
  assert.equal(p0.messaggi.length, 50);
  assert.equal((p0.messaggi[0] as { testo: string }).testo, "m10");
  assert.equal(p0.haAltre, true);
  assert.equal((p0 as { totale?: number }).totale, 60);
  const p1 = rispostaScena(s, "sessioni:messaggi", ["a", 1]) as { messaggi: Messaggio[]; haAltre: boolean };
  assert.deepEqual(p1.messaggi.map((m) => (m as { testo: string }).testo), Array.from({ length: 10 }, (_, i) => `m${i}`));
  assert.equal(p1.haAltre, false);
  assert.equal(rispostaScena(s, "sessioni:azione", ["a", "copia-id"]), undefined);
  assert.ok(rispostaScena(s, "clotch-ai:registro", []));
  // «Casella: caricamento» (101:36010): il registro non arriva mai, la promessa resta in sospeso
  assert.ok(rispostaScena({ ...s, registroLento: true }, "clotch-ai:registro", []) instanceof Promise);
  assert.deepEqual([rispostaScena(s, "sessioni:cerca", ["x"]), rispostaScena(s, "sessioni:spazio", []), rispostaScena(s, "sessioni:impostazioni", [])],
    [[], { indice: 0, messaggi: 0, immagini: 0, altro: 0 }, {}]);
  assert.equal(rispostaScena(s, "sessioni:svuota", []), undefined);
});

test("scena (#581): i canali di clotch AI rispondono sempre con un esito, come il main, mai undefined", () => {
  assert.deepEqual(rispostaScena({}, "clotch-ai:avvia", []), { ok: true, testo: "" });
  for (const cmd of ["ferma_tutto", "obiettivo", "regola", "annulla"]) assert.equal((rispostaScena({}, "clotch-ai:comando", [cmd, {}]) as { esito: string }).esito, "ok");
});
