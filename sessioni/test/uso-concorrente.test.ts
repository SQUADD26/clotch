// Uso al giorno nel worker dei lavori (#474): due richieste insieme (la pagina Uso riaperta mentre la prima legge) non devono rovinare la memoria dei byte già letti.
import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { svuotaCache, usoAlGiorno } from "../src/quote-uso";

const ORA = Date.UTC(2026, 9, 23, 12, 0, 0);
const riga = (i: number, giorno = "2026-10-23") =>
  JSON.stringify({ type: "assistant", requestId: `r${i}`, timestamp: `${giorno}T10:00:00.000Z`, message: { id: `m${i}`, usage: { input_tokens: 10, output_tokens: 0 } } }) + "\n";
const totale = (g: Map<string, { v: number }[]>) => g.get("roberto")!.reduce((s, x) => s + x.v, 0);

test("usoAlGiorno: due richieste insieme poi la trascrizione cresce: nessuna riga persa", async (t) => {
  svuotaCache();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "uso-conc-"));
  t.after(() => { svuotaCache(); fs.rmSync(home, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(home, "projects", "p"), { recursive: true });
  const f = path.join(home, "projects", "p", "s.jsonl");
  fs.writeFileSync(f, [1, 2, 3].map((i) => riga(i)).join(""));
  const radici = [{ path: home, account: ".claude", email: "roberto@x.it" }];
  await Promise.all([usoAlGiorno(radici, ORA), usoAlGiorno(radici, ORA)]);
  fs.appendFileSync(f, [4, 5, 6, 7, 8, 9, 10].map((i) => riga(i)).join(""));
  assert.equal(totale(await usoAlGiorno(radici, ORA)), 100);
});
