// Dettatura dell'app (#470) nel main: l'eseguibile nativo qui è uno script finto, nessun microfono e nessuna voce.
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import assert from "node:assert/strict";
import { avviaDettatura, fermaDettatura, type EventoDettatura } from "../src/dettatura-app";

process.env.CLOTCH_TEST_SILENT = "1";
const cartella = fs.mkdtempSync(path.join(os.tmpdir(), "dettatura-"));
const finto = (corpo: string) => {
  const f = path.join(cartella, `finto-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(f, `#!/bin/sh\n${corpo}\n`, { mode: 0o755 });
  process.env.CLOTCH_DETTATURA_BIN = f;
};
const attendi = (eventi: EventoDettatura[], n: number) => new Promise<void>((ok) => { const t = setInterval(() => eventi.length >= n && (clearInterval(t), ok()), 10); });

test("dettatura app: parte l'eseguibile, ogni riga è il testo capito finora, fermarlo non manda altri eventi", async () => {
  const partito = path.join(cartella, "partito");
  finto(`touch "${partito}"; echo "ciao"; echo "ciao mondo"; exec sleep 30`);
  const eventi: EventoDettatura[] = [];
  avviaDettatura((e) => eventi.push(e));
  await attendi(eventi, 2);
  assert.ok(fs.existsSync(partito), "l'eseguibile è stato lanciato");
  assert.deepEqual(eventi, [{ testo: "ciao" }, { testo: "ciao mondo" }]);
  avviaDettatura(() => assert.fail("già in corso: non ne parte un secondo"));
  fermaDettatura();
  await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(eventi.length, 2, "dopo «ferma» il renderer non riceve altro");
});

test("dettatura app: se l'eseguibile esce con errore, il testo di stderr arriva a Roberto", async () => {
  finto(`echo "Microfono non consentito" >&2; exit 1`);
  const eventi: EventoDettatura[] = [];
  avviaDettatura((e) => eventi.push(e));
  await attendi(eventi, 1);
  assert.deepEqual(eventi, [{ fine: true, errore: "Microfono non consentito" }]);
});

test("dettatura app: uscita pulita = fine senza errore (il testo c'è già); eseguibile mancante = errore", async () => {
  finto(`echo "tutto"`);
  const eventi: EventoDettatura[] = [];
  avviaDettatura((e) => eventi.push(e));
  await attendi(eventi, 2);
  assert.deepEqual(eventi, [{ testo: "tutto" }, { fine: true }]);
  process.env.CLOTCH_DETTATURA_BIN = path.join(cartella, "non-esiste");
  const manca: EventoDettatura[] = [];
  avviaDettatura((e) => manca.push(e));
  await attendi(manca, 1);
  assert.deepEqual(manca, [{ fine: true, errore: "Dettatura non disponibile" }]);
});

test("dettatura app: in prova silenziosa, senza eseguibile finto, il microfono vero non si apre", () => {
  delete process.env.CLOTCH_DETTATURA_BIN;
  const eventi: EventoDettatura[] = [];
  avviaDettatura((e) => eventi.push(e));
  assert.deepEqual(eventi, [{ fine: true, errore: "Dettatura non disponibile" }]);
});
