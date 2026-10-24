import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MAX_AVVISI, taglia, uguale, type AvvisoPila } from "../src/ui/base/avvisiPila";

const a = (tipo: AvvisoPila["tipo"], messaggio: string): AvvisoPila => ({ tipo, messaggio });

test("pila avvisi: oltre il tetto esce prima il più vecchio info o successo, poi il più vecchio errore, il caricamento resta (#1068)", () => {
  const dodici = Array.from({ length: 12 }, (_, i) => a("errore", `e${i}`));
  assert.deepEqual(taglia(dodici).map((x) => x.messaggio), ["e7", "e8", "e9", "e10", "e11"]);
  const mista = [a("errore", "e0"), a("caricamento", "c"), a("info", "i"), a("successo", "s"), a("errore", "e1"), a("errore", "e2")];
  assert.deepEqual(taglia(mista).map((x) => x.messaggio), ["e0", "c", "s", "e1", "e2"]);
  assert.equal(taglia(mista.slice(0, MAX_AVVISI)).length, MAX_AVVISI);
  const caricamenti = Array.from({ length: 7 }, (_, i) => a("caricamento", `c${i}`));
  assert.equal(taglia(caricamenti).length, MAX_AVVISI);
});

test("pila avvisi: stesso tipo e stesso messaggio sono lo stesso avviso", () => {
  assert.ok(uguale(a("errore", "x"), a("errore", "x")));
  assert.ok(!uguale(a("errore", "x"), a("info", "x")) && !uguale(a("errore", "x"), a("errore", "y")));
});
