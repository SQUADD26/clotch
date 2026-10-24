// Lettore incrementale del registro (#474) e ricevute: il motore scrive la ricevuta dopo la riga della decisione (friday_annulla.decidi),
// quindi una lettura può vedere la riga prima della ricevuta. La lettura dopo deve offrire l'annulla, come una lettura da capo.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro, lettoreRegistro } from "../src/clotch-ai";

const fixture = path.join(__dirname, "../../test/fixtures/clotch-ai-ricevuta");

test("ricevuta scritta dopo la riga: la lettura dopo offre l'annulla", (t) => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "registro-ricevuta-"));
  t.after(() => fs.rmSync(h, { recursive: true, force: true }));
  fs.cpSync(fixture, h, { recursive: true });
  const ricevute = path.join(h, ".claude/friday/eventi-locali"), via = path.join(h, "via"); // nome del protocollo del motore
  fs.renameSync(ricevute, via);
  const leggi = lettoreRegistro(h);
  assert.deepEqual(leggi().decisioni.map((d) => d.annullabile), [false, false]);
  fs.renameSync(via, ricevute); // ora le ricevute ci sono
  assert.deepEqual(leggiRegistro(h).decisioni.map((d) => d.annullabile), [true, true]);
  assert.deepEqual(leggi().decisioni.map((d) => d.annullabile), [true, true]);
});
