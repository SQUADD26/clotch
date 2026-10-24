// #1146: l'account del piede è uno, stabile, quello delle sessioni nuove; l'uso si abbina per email intera. Dati finti di 9 account.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { QuotaUso } from "../src/tipi";
import { quoteDalFeed } from "../src/uso-testi";
import { accountNuove, disponibili, trova } from "../src/ui/barra/account-dati";

const ORA = Date.UTC(2026, 9, 24, 20, 0, 0), S = ORA / 1000, H = 3600, G = 86_400;
const riga = (email: string, cinque: number, sette: number, ts = S - 60) =>
  ({ email, host: "mac", ts, five_used: cinque, five_resets: S + 3 * H, seven_used: sette, seven_resets: S + 4 * G });
// nove account come quelli di Roberto, due con lo stesso nome corto «info» e uno senza lettura da due giorni
const FEED = { rows: [
  riga("r.bondici@squaddcrm.com", 0, 99), riga("info@squaddcrm.com", 4, 37), riga("info@dentalspace.ai", 60, 80),
  riga("accountmanager@squaddcrm.com", 10, 20), riga("amministrazione@squaddcrm.com", 30, 40), riga("developer@squaddcrm.com", 5, 5),
  riga("b@squaddcrm.com", 1, 2), riga("claude-2@squaddcrm.com", 50, 50), riga("vecchio@squaddcrm.com", 0, 0, S - 2 * G),
] };
const CARTELLE: Record<string, string[]> = {
  "r.bondici@squaddcrm.com": [".claude", ".claude-terminal-r-bondici"], "info@squaddcrm.com": [".claude-terminal-info"],
  "info@dentalspace.ai": [".claude-terminal-dentalspace"], "accountmanager@squaddcrm.com": [".claude-terminal-accountmanager"],
  "amministrazione@squaddcrm.com": [".claude-terminal-amministrazione"], "developer@squaddcrm.com": [".claude-terminal-developer"],
  "b@squaddcrm.com": [".claude-terminal-b"], // claude-2 non ha cartella su questo Mac
};
const quote = (ora = ORA, feed: unknown = FEED): QuotaUso[] =>
  quoteDalFeed(feed, ora, "mac")!.map((q) => ({ ...q, cartelle: CARTELLE[q.email!] ?? [] }));

test("#1146 feed: 8 account vivi in ordine di email; i due «info» hanno nomi distinti", () => {
  const q = quote();
  assert.deepEqual(q.map((x) => x.email), [...q.map((x) => x.email!)].sort());
  assert.equal(q.length, 8, "il vecchio (letto due giorni fa) non c'è");
  assert.deepEqual(q.filter((x) => x.email!.startsWith("info@")).map((x) => x.account), ["info@dentalspace.ai", "info@squaddcrm.com"]);
  assert.equal(q.find((x) => x.email === "developer@squaddcrm.com")!.account, "developer");
});

test("#1146 ordine fisso: l'uso che cambia non sposta gli account", () => {
  const prima = quote().map((x) => x.email);
  const dopo = quote(ORA, { rows: FEED.rows.map((r) => ({ ...r, seven_used: 100 - r.seven_used })) }).map((x) => x.email);
  assert.deepEqual(dopo, prima);
});

test("#1146 abbinamento: email intera; il nome corto doppio non indovina; la cartella trova il suo account", () => {
  const q = quote();
  assert.equal(trova(q, "info@dentalspace.ai")!.sette, 80);
  assert.equal(trova(q, "INFO@dentalspace.ai")!.sette, 80);
  assert.equal(trova(q, "info")!.email, "info@squaddcrm.com", "«info» è la cartella .claude-terminal-info, non dentalspace");
  assert.equal(trova(q.map((x) => ({ ...x, cartelle: [] })), "info"), undefined, "due «info» senza cartella: nessuna quota di un altro account");
  assert.equal(trova(q, ".claude-terminal-dentalspace")!.email, "info@dentalspace.ai");
  assert.equal(trova(q, "terminal-dentalspace")!.email, "info@dentalspace.ai");
  assert.equal(trova(q, "developer")!.email, "developer@squaddcrm.com");
});

test("#1146 disponibili per Nuova sessione: dati veri e cartella su questo Mac, con nome, email e uso 5 ore e 7 giorni", () => {
  const l = disponibili(quote());
  assert.equal(l.length, 7, "senza claude-2 (nessuna cartella) e senza il vecchio");
  const d = l.find((x) => x.email === "info@dentalspace.ai")!;
  assert.deepEqual([d.account, d.cinque, d.sette, d.cinqueFine, d.setteFine], ["info@dentalspace.ai", 60, 80, (S + 3 * H) * 1000, (S + 4 * G) * 1000]);
});

test("#1146 account delle sessioni nuove: scelto e ricordato; se no ~/.claude; mai deciso dall'uso", () => {
  const q = quote();
  assert.equal(accountNuove(q, null).email, "r.bondici@squaddcrm.com", "senza scelta: la cartella ~/.claude");
  assert.equal(accountNuove(quote(ORA, { rows: FEED.rows.map((r) => ({ ...r, seven_used: 100 - r.seven_used })) }), null).email, "r.bondici@squaddcrm.com");
  assert.equal(accountNuove(q, "info@dentalspace.ai").q!.sette, 80);
  const senzaDati = accountNuove(q, "claude-2@altro.it");
  assert.deepEqual([senzaDati.email, senzaDati.q], ["claude-2@altro.it", undefined], "lo scelto resta anche se il feed non lo legge");
  const senzaClaude = q.map((x) => ({ ...x, cartelle: x.cartelle!.filter((c) => c !== ".claude") }));
  assert.equal(accountNuove(senzaClaude, null).email, "accountmanager@squaddcrm.com", "senza ~/.claude: il primo per email");
});
