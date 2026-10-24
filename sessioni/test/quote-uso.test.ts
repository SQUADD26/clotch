import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { quoteConGiorni, quoteUso, svuotaCache } from "../src/quote-uso";
import { trovaRadici } from "../src/radici";import { contoAllaRovescia, fa, quoteDalFeed, riparteTra } from "../src/uso-testi";

const ORA = Date.UTC(2026, 9, 23, 12, 0, 0), S = ORA / 1000, H = 3600, G = 86_400;
const riga = (email: string, ts: number, cinque: [number | null, number | null], sette: [number | null, number | null]) =>
  ({ email, ts, five_used: cinque[0], five_resets: cinque[1], seven_used: sette[0], seven_resets: sette[1] });

test("riparteTra: i testi dei frame 101:48825", () => {
  assert.equal(riparteTra(S + 6 * G + 22 * H + 600, S), "Riparte tra 6 giorni e 22 ore");
  assert.equal(riparteTra(S + 6 * G + H + 5, S), "Riparte tra 6 giorni e 1 ora");
  assert.equal(riparteTra(S + 3 * G + 4 * H, S), "Riparte tra 3 giorni e 4 ore");
});

test("fa: il tempo vero dall'ultimo dato", () => {
  assert.equal(fa(ORA - 5_000, ORA), "1 min fa");
  assert.equal(fa(ORA - 7 * 60_000, ORA), "7 min fa");
  assert.equal(fa(ORA - 3 * 3600_000, ORA), "3 h fa");
  assert.equal(fa(undefined, ORA), "1 min fa");
});

test("quoteDalFeed: una riga per account, 7 giorni; 5 ore piene = limite raggiunto; dati vecchi o ripartiti", () => {
  const feed = { rows: [
    riga("accountmanager@x.it", S - 60, [10, S + H], [38, S + 6 * G + 22 * H + 60]),
    riga("clotch-ai@x.it", S - 60, [100, S + 3 * H], [50, S + G]),
    riga("vecchio@x.it", S - 2 * G, [1, S + H], [1, S + G]),
    riga("senza@x.it", S - 60, [null, null], [null, null]),
    riga("ripartito@x.it", S - 60, [5, S + H], [90, S - 10]),
  ] };
  const q = quoteDalFeed(feed, ORA)!;
  const per = (n: string) => q.find((x) => x.account === n)!;
  assert.deepEqual(q.map((x) => x.account).sort(), ["accountmanager", "clotch-ai", "ripartito"]);
  assert.equal(per("accountmanager").usato, 38);
  assert.equal(per("accountmanager").ripartenza, "Riparte tra 6 giorni e 22 ore");
  assert.equal(per("accountmanager").letto, ORA - 60_000);
  assert.equal(per("clotch-ai").usato, 100);
  assert.match(per("clotch-ai").ripartenza, /^Limite raggiunto · riparte alle \d\d:\d\d$/);
  assert.deepEqual([per("ripartito").usato, per("ripartito").ripartenza], [0, ""]);
});

test("quoteDalFeed: la lettura diretta vince finché non ha 10 minuti; feed illeggibile = null", () => {
  const feed = { real: [riga("a@x", S - 60, [1, S + H], [20, S + G])], rows: [riga("a@x", S - 10, [1, S + H], [99, S + G])] };
  assert.equal(quoteDalFeed(feed, ORA)![0].usato, 20);
  assert.equal(quoteDalFeed({ real: [riga("a@x", S - 700, [1, S + H], [20, S + G])], rows: feed.rows }, ORA)![0].usato, 99);
  assert.equal(quoteDalFeed({ pippo: 1 }, ORA), null);
  assert.equal(quoteDalFeed(null, ORA), null);
});

test("quoteUso: cache di 60 s nel main; errore del feed lancia", async () => {
  svuotaCache();
  let n = 0;
  const adesso = () => Date.now() / 1000;
  const leggi = async () => { n++; return { rows: [riga("a@x", adesso() - 5, [1, adesso() + H], [20, adesso() + G])] }; };
  const a = await quoteUso(Date.now(), leggi);
  await quoteUso(Date.now() + 59_000, leggi);
  assert.equal(n, 1);
  assert.equal(a[0].usato, 20);
  await quoteUso(Date.now() + 61_000, leggi);
  assert.equal(n, 2);
  svuotaCache();
  await assert.rejects(quoteUso(Date.now(), async () => { throw new Error("rete"); }), /rete/);
});

test("contoAllaRovescia: «2 h 14 m 08 s» e «3 g 05 h 12 m 40 s» (frame 148:62191)", () => {
  assert.equal(contoAllaRovescia((2 * 3600 + 14 * 60 + 8) * 1000), "2 h 14 m 08 s");
  assert.equal(contoAllaRovescia((3 * G + 5 * H + 12 * 60 + 40) * 1000), "3 g 05 h 12 m 40 s");
  assert.equal(contoAllaRovescia(47 * 60_000 + 30_000), "0 h 47 m 30 s");
});

test("quoteDalFeed: per finestra percentuale e fine (#478); finestra ripartita = 0 % senza fine", () => {
  const feed = { rows: [
    riga("accountmanager@x.it", S - 60, [90, S + 21 * 60], [61, S + 3 * G]),
    riga("ripartito@x.it", S - 60, [40, S - 10], [20, S + G]),
  ] };
  const per = (n: string) => quoteDalFeed(feed, ORA)!.find((x) => x.account === n)!;
  const a = per("accountmanager");
  assert.deepEqual([a.email, a.cinque, a.cinqueFine, a.sette, a.setteFine], ["accountmanager@x.it", 90, (S + 21 * 60) * 1000, 61, (S + 3 * G) * 1000]);
  assert.deepEqual([per("ripartito").cinque, per("ripartito").cinqueFine], [0, null]);
});

test("#993: cartella -> email da .claude.json; due righe stessa email, vince l'host di questo Mac; senza riga = niente", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "clotch-993-"));
  try {
    for (const [cartella, email] of [[".claude-terminal-dentalspace", "dental@x.it"], [".claude-terminal-solo", "senza-riga@x.it"]]) {
      mkdirSync(path.join(home, cartella, "projects"), { recursive: true });
      writeFileSync(path.join(home, cartella, ".claude.json"), JSON.stringify({ oauthAccount: { emailAddress: email } }));
    }
    const radici = trovaRadici(home), mio = os.hostname();
    assert.deepEqual(radici.map((r) => [r.account, r.email]), [[".claude-terminal-dentalspace", "dental@x.it"], [".claude-terminal-solo", "senza-riga@x.it"]]);
    const adesso = Date.now() / 1000, r = (host: string, ts: number, sette: number) => ({ ...riga("dental@x.it", ts, [1, adesso + H], [sette, adesso + G]), host });
    // l'altra macchina è più recente, ma la riga di questo Mac è fresca: vince questa
    svuotaCache();
    await quoteUso(Date.now(), async () => ({ rows: [r("altro-mac", adesso - 5, 90), r(mio, adesso - 60, 30)] }));
    const q = await quoteConGiorni(radici, Date.now(), async () => new Map());
    const dental = q.find((x) => x.email === "dental@x.it")!;
    assert.equal(dental.sette, 30);
    assert.deepEqual(dental.cartelle, [".claude-terminal-dentalspace"]);
    assert.equal(q.some((x) => x.cartelle?.includes(".claude-terminal-solo")), false, "account senza riga nel feed: niente quota");
    // la riga di questo Mac è vecchia: vince la più recente
    svuotaCache();
    await quoteUso(Date.now(), async () => ({ rows: [r("altro-mac", adesso - 5, 90), r(mio, adesso - 2 * G, 30)] }));
    assert.equal((await quoteConGiorni(radici, Date.now(), async () => new Map())).find((x) => x.email === "dental@x.it")!.sette, 90);
  } finally { svuotaCache(); rmSync(home, { recursive: true, force: true }); }
});
