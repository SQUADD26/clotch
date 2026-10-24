// Renderer (#474): l'elenco si corregge con le sole sessioni cambiate e il registro tiene gli oggetti delle chat uguali.
import test from "node:test";
import assert from "node:assert/strict";
import { applicaElenco } from "../src/ui/base/elenco";
import { daPiano } from "../src/ui/clotch-ai/registro";

const s = (id: string, t: number, titolo = id) => ({ id, ultimaAttivita: t, titolo }) as any;
const vale = () => true;

test("elenco: uguale = stesso oggetto; cambiata, nuova e tolta = corrette e in ordine", () => {
  const e = { sessioni: [s("a", 3), s("b", 2), s("c", 1)], errori: [] };
  assert.equal(applicaElenco(e, { cambiate: [s("b", 2)], tolte: [] }, vale), e);
  const n = applicaElenco(e, { cambiate: [s("c", 9, "nuovo"), s("d", 0)], tolte: ["a"] }, vale)!;
  assert.deepEqual(n.sessioni.map((x) => x.id), ["c", "b", "d"]);
  assert.equal(n.sessioni[1], e.sessioni[1]); // b non è cambiata: stesso oggetto
  assert.equal(applicaElenco(e, undefined, vale), null); // niente correzione: si rilegge
});

test("registro: una chat non cambiata resta lo stesso oggetto", () => {
  const p = { chat: { a: { titolo: "x", aiutanti: {} }, b: { titolo: "y", aiutanti: { z: { tipo: "t" } } } }, esiti: {} };
  const r1 = daPiano(p), r2 = daPiano({ ...p, chat: { ...p.chat, b: { ...p.chat.b, titolo: "w" } } });
  assert.equal(r2.chat.get("a"), r1.chat.get("a"));
  assert.notEqual(r2.chat.get("b"), r1.chat.get("b"));
  assert.equal(r2.chat.get("b")!.aiutanti.get("z").tipo, "t");
});
