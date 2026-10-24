// Uso al giorno letto a pezzi (#474): due conteggi sovrapposti (barra e impostazioni chiedono insieme) non avanzano il punto di ripresa due volte.
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { svuotaCache, usoAlGiorno } from "../src/quote-uso";

const ORA = Date.UTC(2026, 9, 23, 12, 0, 0);
const riga = (id: string, input: number, pad = "") =>
  JSON.stringify({ type: "assistant", requestId: `q-${id}`, timestamp: "2026-10-23T10:00:00.000Z", pad, message: { id, usage: { input_tokens: input, output_tokens: 0 } } }) + "\n";

test("due conteggi sovrapposti, poi una riga nuova: la riga nuova si conta", async (t) => {
  svuotaCache();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "uso-conc-"));
  t.after(() => { fs.rmSync(home, { recursive: true, force: true }); svuotaCache(); });
  const r = { path: path.join(home, ".claude"), account: ".claude", email: "roberto@x.it" };
  const file = path.join(r.path, "projects", "p", "s.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, riga("m1", 100));
  await Promise.all([usoAlGiorno([r], ORA), usoAlGiorno([r], ORA)]);
  fs.appendFileSync(file, riga("m2", 7, "x".repeat(400))); // più lunga della prima: il file supera il doppio
  const g = await usoAlGiorno([r], ORA);
  assert.equal(g.get("roberto")!.at(-1)!.v, 107);
});
