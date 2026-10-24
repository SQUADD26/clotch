import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { quoteConGiorni, quoteUso, sogliePassate, svuotaCache, usoAlGiorno } from "../src/quote-uso";

const ORA = Date.UTC(2026, 9, 23, 12, 0, 0), S = ORA / 1000;
const riga = (id: string, req: string, giorno: string, input: number, output: number) =>
  JSON.stringify({ type: "assistant", requestId: req, timestamp: `${giorno}T10:00:00.000Z`, message: { id, usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 5000 } } });

/** Una HOME temporanea con due account e le loro trascrizioni (mai la ~/.claude vera). */
function casa() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "andamento-"));
  const radice = (nome: string, email: string, righe: string[]) => {
    const r = path.join(home, nome);
    fs.mkdirSync(path.join(r, "projects", "p"), { recursive: true });
    fs.writeFileSync(path.join(r, ".claude.json"), JSON.stringify({ oauthAccount: { emailAddress: email } }));
    fs.writeFileSync(path.join(r, "projects", "p", "s.jsonl"), righe.join("\n") + "\n");
    return { path: r, account: nome, email };
  };
  const a = radice(".claude", "roberto@x.it", [
    riga("m1", "r1", "2026-10-23", 100, 50),
    riga("m1", "r1", "2026-10-23", 100, 50), // stessa risposta scritta due volte: conta una volta
    riga("m2", "r2", "2026-10-22", 10, 5),
    riga("m3", "r3", "2026-09-01", 999, 999), // fuori dai 14 giorni
    "non è json con \"usage\"",
  ]);
  const b = radice(".claude-lavoro", "lavoro@x.it", []);
  return { home, radici: [a, b] };
}

test("usoAlGiorno: token per account e giorno, 14 giorni fino a oggi, messaggi doppi una volta", async () => {
  const { radici } = casa();
  const g = await usoAlGiorno(radici, ORA);
  const roberto = g.get("roberto")!;
  assert.equal(roberto.length, 14);
  assert.deepEqual([roberto[0].giorno, roberto[13].giorno], ["2026-10-10", "2026-10-23"]);
  assert.equal(roberto[13].v, 150);
  assert.equal(roberto[12].v, 15);
  assert.equal(roberto.reduce((s, x) => s + x.v, 0), 165);
  assert.equal(g.get("lavoro")!.reduce((s, x) => s + x.v, 0), 0);
});

test("quoteConGiorni: ogni account ha la serie (zeri se vuota); senza alcun uso la scheda resta vuota", async () => {
  svuotaCache();
  const feed = { rows: [
    { email: "roberto@x.it", ts: S - 60, five_used: 10, five_resets: S + 3600, seven_used: 38, seven_resets: S + 86_400 },
    { email: "lavoro@x.it", ts: S - 60, five_used: 1, five_resets: S + 3600, seven_used: 5, seven_resets: S + 86_400 },
  ] };
  await quoteUso(ORA, async () => feed);
  const q = await quoteConGiorni(casa().radici, ORA);
  assert.deepEqual(q.map((x) => [x.account, x.giorni?.length, x.giorni?.at(-1)?.v]).sort(), [["lavoro", 14, 0], ["roberto", 14, 150]]);
  svuotaCache();
  await quoteUso(ORA, async () => feed);
  const vuote = await quoteConGiorni([], ORA);
  assert.equal(vuote.every((x) => x.giorni === undefined), true);
  svuotaCache();
});

test("sogliePassate: 80% e 90% una volta ciascuna per finestra; prima lettura = partenza; 100% è del limite", () => {
  const viste = new Map<string, number>();
  const passo = (usato: number) => sogliePassate([{ account: "a", usato }], viste).map((x) => x.soglia);
  assert.deepEqual(passo(85), [], "prima lettura sopra l'80%: niente avviso");
  assert.deepEqual(passo(86), []);
  assert.deepEqual(passo(91), [90]);
  assert.deepEqual(passo(95), []);
  assert.deepEqual(passo(100), [], "100% = limite raggiunto, ha il suo avviso");
  assert.deepEqual(passo(20), [], "la finestra riparte");
  assert.deepEqual(passo(81), [80]);
  assert.deepEqual(passo(92), [90]);
  const v2 = new Map<string, number>();
  const a = (u: number) => sogliePassate([{ account: "b", usato: u }], v2).map((x) => x.soglia);
  assert.deepEqual([a(10), a(79), a(80), a(89), a(90)], [[], [], [80], [], [90]]);
  assert.deepEqual(sogliePassate([{ account: "b", usato: 95 }, { account: "c", usato: 10 }], v2), [], "un altro account ha le sue soglie");
});
