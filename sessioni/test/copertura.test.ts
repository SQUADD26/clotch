import { strict as assert } from "node:assert";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Gira da dist/test: la radice del pacchetto sta due livelli sopra.
test("copertura: ogni id della matrice una volta sola e ogni prova file:riga esiste", () => {
  const uscita = execFileSync("node", [join(__dirname, "..", "..", "scripts", "copertura.mjs")], { encoding: "utf8" });
  assert.match(uscita, /^COPERTURA_OK /);
});
