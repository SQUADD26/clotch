import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { inviaComando } from "../src/comandi";

const casa = () => fs.mkdtempSync(path.join(os.tmpdir(), "comandi-"));
const casella = (h: string) => path.join(h, ".claude", "casella", "comandi");
const mese = (h: string) => path.join(h, ".claude", "registro", `${new Date().toISOString().slice(0, 7)}.jsonl`);
const riga = (tipo: string, dati: object) => JSON.stringify({ v: 1, id: "r-000000000000", t: new Date().toISOString(), n: 1, chat: "friday", macchina: "mac", hook_v: "x", tipo, dati }) + "\n"; // nome del protocollo del motore

/** Una clotch AI finta: prende il primo comando dalla casella, lo sposta in fatti/ e (se `esito`) scrive comando_fatto a pezzi. */
function clotchAiFinta(h: string, esito: string | null, aPezzi = false) {
  const t = setInterval(() => {
    let nomi: string[] = [];
    try { nomi = fs.readdirSync(casella(h)).filter((n) => n.endsWith(".json")); } catch {}
    if (!nomi.length) return;
    clearInterval(t);
    const c = JSON.parse(fs.readFileSync(path.join(casella(h), nomi[0]), "utf8"));
    fs.mkdirSync(path.join(casella(h), "fatti"), { recursive: true });
    fs.renameSync(path.join(casella(h), nomi[0]), path.join(casella(h), "fatti", nomi[0]));
    fs.mkdirSync(path.dirname(mese(h)), { recursive: true });
    fs.appendFileSync(mese(h), riga("comando", c));
    if (!esito) return;
    const r = riga("comando_fatto", { comando: c.id, esito, testo: "fatto così", pr: 2402, non_fermate: ["chat-1"], sessione: "abcd1234", macchina: "mac" });
    if (!aPezzi) return fs.appendFileSync(mese(h), r);
    fs.appendFileSync(mese(h), r.slice(0, 20)); // riga a metà: non va letta finché non è chiusa
    setTimeout(() => fs.appendFileSync(mese(h), r.slice(20)), 60);
  }, 10);
}

test("comandi: scrive .tmp poi rename nella forma del contratto e legge il suo comando_fatto", async () => {
  const h = casa();
  fs.mkdirSync(path.dirname(mese(h)), { recursive: true });
  fs.writeFileSync(mese(h), riga("comando_fatto", { comando: "c-vecchio", esito: "ok", testo: "" })); // righe di prima: ignorate
  clotchAiFinta(h, "ok", true);
  const e = await inviaComando(h, "non_disturbare", { acceso: true, minuti: 60 }, { ogniMs: 20, scadenzaMs: 3000 });
  assert.deepEqual(e, { id: e.id, esito: "ok", testo: "fatto così", pr: 2402, nonFermate: ["chat-1"], sessione: "abcd1234", macchina: "mac" });
  const [nome] = fs.readdirSync(path.join(casella(h), "fatti"));
  assert.match(nome, new RegExp(`^\\d+-${e.id}\\.json$`));
  const c = JSON.parse(fs.readFileSync(path.join(casella(h), "fatti", nome), "utf8"));
  assert.deepEqual(Object.keys(c), ["v", "id", "t", "da", "cmd", "args"]);
  assert.deepEqual({ v: c.v, da: c.da, cmd: c.cmd, args: c.args }, { v: 1, da: "app", cmd: "non_disturbare", args: { acceso: true, minuti: 60 } });
  assert.match(c.id, /^c-[0-9a-f]{12}$/);
  assert.equal(fs.readdirSync(casella(h)).filter((n) => n.endsWith(".tmp")).length, 0);
});

test("comandi: rifiutato ed esito sconosciuto arrivano come rifiutato ed errore", async () => {
  for (const [scritto, atteso] of [["rifiutato", "rifiutato"], ["strano", "errore"]]) {
    const h = casa();
    clotchAiFinta(h, scritto);
    const e = await inviaComando(h, "ferma_tutto", {}, { ogniMs: 20, scadenzaMs: 3000 });
    assert.equal(e.esito, atteso);
  }
});

test("comandi: clotch AI spenta, alla scadenza il comando è ritirato dalla casella", async () => {
  const h = casa();
  const e = await inviaComando(h, "ferma_tutto", {}, { ogniMs: 20, scadenzaMs: 100 });
  assert.deepEqual({ esito: e.esito, preso: e.esito === "scaduto" && e.preso }, { esito: "scaduto", preso: false });
  assert.deepEqual(fs.readdirSync(casella(h)), []);
});

test("comandi: preso ma senza risposta, alla scadenza dice preso", async () => {
  const h = casa();
  clotchAiFinta(h, null);
  const e = await inviaComando(h, "ferma_tutto", {}, { ogniMs: 20, scadenzaMs: 300 });
  assert.equal(e.esito === "scaduto" && e.preso, true);
});

test("comandi: casella non scrivibile = non_scritto, senza eccezioni", async () => {
  const h = casa();
  fs.mkdirSync(path.join(h, ".claude", "casella"), { recursive: true });
  fs.writeFileSync(casella(h), "non una cartella");
  const e = await inviaComando(h, "ferma_tutto", {}, { scadenzaMs: 100 });
  assert.equal(e.esito, "non_scritto");
  assert.equal(e.id, null);
});
