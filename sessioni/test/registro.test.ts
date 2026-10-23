import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { inAttesa } from "../src/elenco";
import { rigaRegistro, scriviRegistro } from "../src/registro";
import type { Elenco, Sessione } from "../src/tipi";

test("registro: la riga è data-ora + messaggio su una riga sola", () => {
  assert.equal(rigaRegistro(new Date(2026, 9, 3, 4, 5, 6), "errore\n  su due righe"), "2026-10-03 04:05:06 errore su due righe\n");
});

test("registro: crea la cartella, un file al giorno, in append", () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "registro-")), "a", "b");
  scriviRegistro(dir, "uno", new Date(2026, 9, 3, 10, 0, 0));
  scriviRegistro(dir, "due", new Date(2026, 9, 3, 10, 0, 1));
  scriviRegistro(dir, "tre", new Date(2026, 9, 4, 0, 0, 0));
  assert.deepEqual(fs.readdirSync(dir).sort(), ["2026-10-03.log", "2026-10-04.log"]);
  assert.equal(fs.readFileSync(path.join(dir, "2026-10-03.log"), "utf8"), "2026-10-03 10:00:00 uno\n2026-10-03 10:00:01 due\n");
});

test("registro: cartella impossibile = niente eccezione", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "registro-")), "file");
  fs.writeFileSync(file, "");
  assert.doesNotThrow(() => scriviRegistro(path.join(file, "dentro"), "x"));
});

test("barra dei menu: conta solo le sessioni che aspettano te", () => {
  const e: Elenco = { sessioni: (["aspetta", "lavora", "aspetta", "ferma", "finita"] as const).map((stato) => ({ stato }) as Sessione), errori: [] };
  assert.equal(inAttesa(e), 2);
});
