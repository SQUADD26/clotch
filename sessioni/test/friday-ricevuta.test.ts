import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro } from "../src/friday";
import { ricevutaLocale } from "../src/friday-ricevuta";

// File scritti da decidi e verificati da friday_fiducia.locale, non ricevute create dal client.
const fixture = path.join(__dirname, "../../test/fixtures/friday-ricevuta");
function casa(t: test.TestContext) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "ricevuta-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  fs.cpSync(fixture, h, { recursive: true });
  return h;
}
function eventi(h: string) {
  const dir = path.join(h, ".claude/registro");
  const file = path.join(dir, fs.readdirSync(dir).find(n => n.endsWith(".jsonl"))!);
  return { file, righe: fs.readFileSync(file, "utf8").trim().split("\n").map(l => JSON.parse(l)) };
}

test("ricevute Python reali: Unicode, escape, payload annidato e chiavi ordinate", t => {
  const h = casa(t);
  assert.deepEqual(leggiRegistro(h).decisioni.map(d => d.annullabile), [true, true]);
  const spostata = path.join(h, "stato-friday");
  fs.renameSync(path.join(h, ".claude/friday"), spostata);
  assert.deepEqual(leggiRegistro(h, { FRIDAY_DIR: spostata }).decisioni.map(d => d.annullabile), [true, true]);
});

test("nessuna ricevuta o digest non esatto: decisione visibile ma non annullabile", t => {
  const h = casa(t), { righe } = eventi(h);
  const dir = path.join(h, ".claude/friday/eventi-locali/decisione");
  fs.unlinkSync(path.join(dir, righe[0].id));
  fs.appendFileSync(path.join(dir, righe[1].id), "\n");
  assert.deepEqual(leggiRegistro(h).decisioni.map(d => d.annullabile), [false, false]);
});

test("evento alterato, remoto, altro autore/tipo o ID invalido: nessuna autorità locale", t => {
  const h = casa(t), { righe } = eventi(h), originale = righe[0];
  for (const modifica of [{ origine_remota: "app" }, { chat: "altra" }, { id: "../x" }, { tipo: "produzione" }, { dati: { ...originale.dati, cosa: "alterata" } }]) {
    assert.equal(ricevutaLocale({ ...originale, ...modifica }, h, {}), false);
  }
  for (const n of [1.5, Number.MAX_SAFE_INTEGER + 1, -0]) assert.equal(ricevutaLocale({ ...originale, n }, h, {}), false);
});

test("dopo l'esito di annulla il reader mantiene annullata e non annullabile", t => {
  const h = casa(t), { file, righe } = eventi(h), id = righe[0].id;
  const evento = (tipo: string, dati: object, n: number) => JSON.stringify({ v: 1, id: `r-esito-${n}`, chat: "friday", tipo, dati, n });
  fs.appendFileSync(file, evento("comando", { id: "c-1", cmd: "annulla", args: { decisione: id } }, 3) + "\n" + evento("comando_fatto", { comando: "c-1", esito: "ok" }, 4) + "\n");
  const d = leggiRegistro(h).decisioni[0];
  assert.equal(d.annullata, true); assert.equal(d.annullabile, false);
});
