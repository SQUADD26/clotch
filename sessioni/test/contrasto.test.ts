import { strict as assert } from "node:assert";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Gira da dist/test: la radice del pacchetto sta due livelli sopra. WCAG 2.2 AA nei due temi (#1093).
test("contrasto: ogni coppia testo, icona e fuoco su fondo passa la soglia in chiaro e in scuro", () => {
  let uscita: string;
  try { uscita = execFileSync("node", [join(__dirname, "..", "..", "scripts", "contrasto.mjs")], { encoding: "utf8" }); }
  catch (e) { uscita = String((e as { stdout?: string }).stdout ?? e); }
  assert.match(uscita, /^CONTRASTO_OK /m, uscita);
});
