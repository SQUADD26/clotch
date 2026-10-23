import test from "node:test";
import assert from "node:assert/strict";
import { creaCronologiaScena } from "../src/scena-cronologia";
import { rispostaScena, type Scena } from "../src/scena";
import type { Messaggio, PaginaMessaggi } from "../src/tipi";
import type { OpzioniCronologia } from "../src/cronologia-tipi";

const messaggi = (n: number): Messaggio[] => Array.from({ length: n }, () => ({ tipo: "utente", testo: "uguale", t: null }));
const v1: OpzioniCronologia = { v: 1 };

test("fixture v1: pagine dalla coda, totale stabile, chiavi fisiche distinte anche per testi uguali", () => {
  const f = creaCronologiaScena(() => messaggi(123));
  let p = f.pagina("a", 0, v1);
  const primo = p.cronologia!, righe = [...primo.righe];
  assert.equal(righe.length, 50);
  assert.equal(righe[0].ordine, 73);
  for (let n = 1; p.cronologia!.cursorePrima; n++) {
    p = f.pagina("a", n, { v: 1, cursore: p.cronologia!.cursorePrima! });
    assert.equal(p.cronologia!.snapshot, primo.snapshot);
    assert.equal(p.cronologia!.watermark, primo.watermark);
    righe.unshift(...p.cronologia!.righe);
  }
  assert.equal(righe.length, 123);
  assert.equal(new Set(righe.map((r) => r.chiave)).size, 123);
  assert.deepEqual(righe.map((r) => r.ordine), Array.from({ length: 123 }, (_, i) => i));
  assert.ok(righe.every((r) => r.revisione === 1));
  assert.equal(p.haAltre, false);
  assert.equal(p.totale, 123);
});

test("snapshot fixture: mutazioni della sorgente e della risposta non cambiano le pagine congelate", () => {
  const source = messaggi(6), f = creaCronologiaScena(() => source, 2);
  const p = f.pagina("a", 0, v1), cursor = p.cronologia!.cursorePrima!;
  (source[0] as { testo: string }).testo = "cambiato";
  source.push(...messaggi(3));
  const older = f.pagina("a", 1, { v: 1, cursore: cursor });
  (older.cronologia!.righe[0].messaggio as { testo: string }).testo = "mutazione envelope";
  (older.messaggi[1] as { testo: string }).testo = "mutazione proiezione";
  const retry = f.pagina("a", 1, { v: 1, cursore: cursor });
  assert.equal(retry.totale, 6);
  assert.deepEqual(retry.messaggi, messaggi(2));
  const first = f.pagina("a", 2, { v: 1, cursore: retry.cronologia!.cursorePrima! });
  assert.deepEqual(first.messaggi, messaggi(2));
  const next = f.pagina("a", 0, v1);
  assert.equal(next.totale, 9);
  assert.notEqual(next.cronologia!.snapshot, p.cronologia!.snapshot);
});

test("cursore vincolato alla sessione e all'istanza della fixture", () => {
  const a = creaCronologiaScena(() => messaggi(3), 1), b = creaCronologiaScena(() => messaggi(3), 1);
  const cursor = a.pagina("a", 0, v1).cronologia!.cursorePrima!;
  for (const bad of [a.pagina("b", 1, { v: 1, cursore: cursor }), b.pagina("a", 1, { v: 1, cursore: cursor }), a.pagina("a", 1, { v: 1, cursore: "inventato" })]) {
    assert.equal(bad.erroreCronologia?.codice, "cursore_invalido");
    assert.equal(bad.cronologia, undefined);
    assert.deepEqual(bad.messaggi, []);
  }
});

test("v1 pagina zero valida, negativi/frazionari e pagine senza cursore rifiutati", () => {
  const f = creaCronologiaScena(() => messaggi(2));
  assert.ok(f.pagina("a", 0, v1).cronologia);
  for (const p of [-1, -2, 0.5, NaN, Infinity, 1]) assert.ok(f.pagina("a", p, v1).erroreCronologia);
  assert.ok(f.pagina("a", 0, { v: 2 } as unknown as OpzioniCronologia).erroreCronologia);
  assert.ok(f.pagina("a", 1, { v: 1, cursore: "" }).erroreCronologia);
  assert.throws(() => creaCronologiaScena(() => [], 0));
});

test("legacy soltanto senza opzioni; fixture vuota v1 ha envelope esplicito", () => {
  const f = creaCronologiaScena(() => messaggi(60));
  const legacy = f.pagina("a", 1);
  assert.equal(legacy.messaggi.length, 10);
  assert.equal(legacy.cronologia, undefined);
  assert.ok(f.pagina("a", 0, v1).cronologia);
  const empty = creaCronologiaScena(() => []).pagina("vuota", 0, v1);
  assert.equal(empty.cronologia!.cursorePrima, null);
  assert.equal(empty.cronologia!.totaleSnapshot, 0);
  assert.deepEqual(empty.cronologia!.righe, []);
});

test("scena IPC inoltra v1 e riusa il cursore della stessa scena", () => {
  const s: Scena = { messaggi: { a: messaggi(60) } };
  const p = rispostaScena(s, "sessioni:messaggi", ["a", 0, v1]) as PaginaMessaggi;
  s.messaggi!.a.push(...messaggi(10));
  const older = rispostaScena(s, "sessioni:messaggi", ["a", 1, { v: 1, cursore: p.cronologia!.cursorePrima }]) as PaginaMessaggi;
  assert.equal(older.totale, 60);
  assert.equal(older.messaggi.length, 10);
  assert.equal(older.cronologia!.snapshot, p.cronologia!.snapshot);
  const legacy = rispostaScena(s, "sessioni:messaggi", ["a", 0]) as PaginaMessaggi;
  assert.equal(legacy.cronologia, undefined);
  assert.equal(legacy.totale, 70);
  console.log("SCENE_CHRONOLOGY_V1_OK");
});
