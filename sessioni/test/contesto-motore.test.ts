// #475: la finestra di contesto viene da `contesto_max` del registro, mai da una costante.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro } from "../src/clotch-ai";
import { percentoContesto } from "../src/ui/chat/scelte";

function chatDa(eventi: [string, object][]) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "contesto-"));
  const dir = path.join(h, ".claude", "registro");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "2026-10.jsonl"), eventi.map(([tipo, dati], i) =>
    JSON.stringify({ v: 1, id: `r-${i}`, t: "2026-10-24T10:00:00.000Z", n: i + 1, chat: "c1", macchina: "mac", hook_v: "x", tipo, dati })).join("\n") + "\n");
  return leggiRegistro(h).chat.get("c1")!;
}

test("contesto_max: 400000 con 100000 usati = 25 %", () => {
  const c = chatDa([["inizio", { titolo: "t", contesto_max: 400_000 }]]);
  assert.equal(c.contestoMax, 400_000);
  assert.equal(percentoContesto(100_000, c.contestoMax), 25);
});

test("contesto_max assente: nessuna finestra e nessuna percentuale", () => {
  const c = chatDa([["inizio", { titolo: "t" }], ["battito", { stato: "lavora" }]]);
  assert.equal(c.contestoMax, null);
  assert.equal(percentoContesto(100_000, c.contestoMax), null);
});

test("contesto_max: vale l'ultimo evento che ha il campo; un battito senza non lo azzera; valori non validi si ignorano", () => {
  const c = chatDa([
    ["inizio", { titolo: "t", contesto_max: 200_000 }],
    ["battito", { stato: "lavora", contesto_max: 1_000_000 }],
    ["battito", { stato: "lavora" }],
    ["battito", { stato: "lavora", contesto_max: "boh" }],
    ["battito", { stato: "lavora", contesto_max: 0 }],
  ]);
  assert.equal(c.contestoMax, 1_000_000);
});
