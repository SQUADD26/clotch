import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { creaAggiornamenti, firmaApp, nuovaVersione } from "../src/aggiornamento";

const cartella = () => fs.mkdtempSync(path.join(os.tmpdir(), "clotch-agg-"));
const scrivi = (dir: string, versione: string, t: number) => {
  const f = path.join(dir, "package.json");
  fs.writeFileSync(f, JSON.stringify({ version: versione }));
  fs.utimesSync(f, t, t);
};

test("aggiornamento: nuova versione solo se package.json cambia dopo l'avvio", async () => {
  const dir = cartella();
  scrivi(dir, "0.1.0", 1000);
  let riaperta = 0;
  const f = creaAggiornamenti({ dir, riapri: () => riaperta++, silenzioso: false });
  assert.equal(await f(true), false, "niente di nuovo sul disco");
  scrivi(dir, "0.2.0", 2000);
  assert.equal(await f(true), true, "versione cambiata");
  assert.equal(await f(false), false, "nessun controllo offerto");
  assert.equal(riaperta, 0, "controllare non riapre");
  assert.equal(await f("installa"), true);
  assert.equal(riaperta, 1);
});

test("aggiornamento: nella prova silenziosa «installa» non riapre l'app", async () => {
  const dir = cartella();
  scrivi(dir, "0.1.0", 1000);
  let riaperta = 0;
  const f = creaAggiornamenti({ dir, riapri: () => riaperta++, silenzioso: true });
  assert.equal(await f("installa"), false);
  assert.equal(riaperta, 0);
});

test("aggiornamento: file mancante o rotto non dice «nuova versione»", () => {
  const dir = cartella();
  assert.equal(firmaApp(dir), null);
  fs.writeFileSync(path.join(dir, "package.json"), "{rotto");
  assert.equal(firmaApp(dir), null);
  assert.equal(nuovaVersione("0.1.0@1", null), false);
  assert.equal(nuovaVersione(null, "0.1.0@1"), false);
});
