import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { aggiornaVoce, cerca, Indice, type DatiIndice } from "../src/indice";

const riga = (type: "user" | "assistant", content: unknown, ora: string) => JSON.stringify({ type, message: { content }, timestamp: `2026-10-${ora}Z` }) + "\n";
const LUNGO = "x".repeat(200) + " il Gatto nero " + "y".repeat(200);

function casa() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "indice-"));
  const a = path.join(d, "a.jsonl"), b = path.join(d, "b.jsonl");
  fs.writeFileSync(a, riga("user", "cerca il gatto", "01T10:00:00") + riga("assistant", [
    { type: "thinking", thinking: "pensiero segreto" }, { type: "text", text: LUNGO }, { type: "tool_use", id: "t1", name: "Strumentone", input: {} },
  ], "01T10:01:00") + "{rotta\n");
  fs.writeFileSync(b, riga("user", "niente di speciale", "02T10:00:00"));
  return { d, a, b, sessioni: [
    { id: "a", file: a, sorgente: "claude-code" as const, titolo: "Prima" },
    { id: "b", file: b, sorgente: "claude-code" as const, titolo: "Il GATTO nel titolo" },
  ] };
}

test("indice: rilegge solo il file cambiato; conta tutti i messaggi, tiene solo utente e assistente", () => {
  const { b, sessioni } = casa();
  const d: DatiIndice = {};
  assert.deepEqual(sessioni.map((s) => aggiornaVoce(d, s)), [true, true]);
  assert.equal(d.a.conteggio, 4); // utente, pensiero, assistente, strumento
  assert.deepEqual(d.a.testi.map((x) => x.testo), ["cerca il gatto", LUNGO]);
  assert.deepEqual(sessioni.map((s) => aggiornaVoce(d, s)), [false, false]);
  const primaA = d.a;
  fs.appendFileSync(b, riga("assistant", "ora sì", "03T10:00:00"));
  assert.deepEqual(sessioni.map((s) => aggiornaVoce(d, s)), [false, true]);
  assert.equal(d.a, primaA);
  assert.equal(d.b.conteggio, 2);
  fs.rmSync(b);
  assert.equal(aggiornaVoce(d, sessioni[1]), true);
  assert.equal(d.b, undefined);
});

test("cerca: senza maiuscole, prima il titolo, poi i più recenti; frammento intorno al punto; mai strumenti né pensieri", () => {
  const { sessioni } = casa();
  const d: DatiIndice = {};
  for (const s of sessioni) aggiornaVoce(d, s);
  d.c = { ...d.a, titolo: "Terza", testi: [{ testo: "un GATTO dopo", t: Date.parse("2026-10-05T00:00:00Z") }] };
  const r = cerca(d, "  gatto ");
  assert.deepEqual(r.map((x) => [x.id, x.nelTitolo]), [["b", true], ["c", false], ["a", false]]);
  assert.equal(r[0].frammento, "Il GATTO nel titolo");
  assert.equal(r[0].t, null);
  assert.ok(r[2].frammento.startsWith("…") && r[2].frammento.endsWith("…") && r[2].frammento.includes("il Gatto nero"));
  assert.equal(r[2].t, Date.parse("2026-10-01T10:01:00Z"));
  assert.deepEqual(cerca(d, "strumentone"), []);
  assert.deepEqual(cerca(d, "segreto"), []);
  assert.deepEqual(cerca(d, "   "), []);
  for (let i = 0; i < 60; i++) d[`z${i}`] = { ...d.c, titolo: "gatto" };
  assert.equal(cerca(d, "gatto").length, 50);
});

test("Indice: coda in background, totale, spazio, svuota toglie indice e cache solo nella sua cartella", async () => {
  const { d, a, sessioni } = casa();
  const dir = path.join(d, "userData");
  const i = new Indice(dir);
  await i.metti(sessioni, true);
  assert.equal(i.totale("a"), 4);
  assert.equal(i.cerca("GATTO")[0].id, "b");
  i.scrivi();
  fs.mkdirSync(path.join(dir, "cache", "messaggi", "x"), { recursive: true });
  fs.writeFileSync(path.join(dir, "cache", "messaggi", "x", "m"), "12345");
  const sp = i.spazio();
  assert.ok(sp.indice > 0);
  assert.deepEqual([sp.messaggi, sp.immagini], [5, 0]);
  assert.equal(Object.keys(new Indice(dir).dati).length, 2); // riletto dal disco
  fs.appendFileSync(a, riga("user", "ancora", "04T00:00:00"));
  assert.equal(i.totale("a"), null); // file cambiato: il conto vecchio non vale
  await i.metti(sessioni.slice(1), true); // «a» non è più tra le sessioni: esce dall'indice
  assert.equal(i.dati.a, undefined);
  i.svuota();
  assert.deepEqual(i.spazio(), { indice: 0, messaggi: 0, immagini: 0 });
  assert.ok(!fs.existsSync(path.join(dir, "indice.json")) && !fs.existsSync(path.join(dir, "cache", "messaggi")));
  assert.ok(fs.existsSync(a)); // le trascrizioni non si toccano
  assert.deepEqual(i.cerca("gatto"), []);
  await i.ricostruisci(sessioni);
  assert.equal(i.totale("a"), 5);
});
