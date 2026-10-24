// Protocollo cronologia v1 sui tre lettori (Claude, Codex, Cursor): fixture sintetiche, nessun dato vero.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Cronologia } from "../src/cronologia";
import type { DeltaCronologia } from "../src/cronologia-tipi";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "regressioni-443-"));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
const emit = (rows: unknown[]) => rows.map((x) => JSON.stringify(x) + "\n").join("");
const claude = {
  source: "claude-code" as const, user: (text: string) => ({ type: "user", message: { content: text } }),
  call: (id: string) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Bash", input: { command: "pwd" } }] } }),
  result: (id: string) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } }),
};
const codex = {
  source: "codex" as const, user: (text: string) => ({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } }),
  call: (id: string) => ({ type: "response_item", payload: { type: "function_call", call_id: id, name: "Bash", arguments: "{}" } }),
  result: (id: string) => ({ type: "response_item", payload: { type: "function_call_output", call_id: id, output: "ok" } }),
};
const cursor = { source: "cursor" as const, user: (text: string) => ({ role: "user", message: { content: [{ type: "text", text }] } }) };

let serie = 0;
function nuovo(sorgente: "claude-code" | "codex" | "cursor", righe: unknown[] | string, limiti = {}, ora?: () => number) {
  const id = `s${++serie}`, file = path.join(dir, `${id}.jsonl`);
  fs.writeFileSync(file, typeof righe === "string" ? righe : emit(righe));
  const c = new Cronologia(limiti, ora), eventi: DeltaCronologia[] = [];
  c.collega((d) => eventi.push(d));
  return { c, eventi, s: { id, file, sorgente }, accoda: (r: unknown[] | string) => fs.appendFileSync(file, typeof r === "string" ? r : emit(r)) };
}
type X = ReturnType<typeof nuovo>;
const pagina = (x: X, n = 0, cursore?: string) => x.c.pagina(x.s, n, { v: 1, ...(cursore ? { cursore } : {}) });
const testi = (righe: { messaggio: any }[]) => righe.map((r) => r.messaggio.testo);

for (const a of [claude, codex, cursor]) {
  test(`${a.source}: 123 messaggi in 3 pagine all'indietro, senza buchi né doppi, anche con append a metà`, () => {
    const x = nuovo(a.source, Array.from({ length: 123 }, (_, i) => a.user("m" + i)));
    const prima = pagina(x), tutte = [...prima.cronologia!.righe];
    x.accoda([a.user("uguale"), a.user("uguale")]);
    x.c.aggiorna(x.s);
    let p = prima, n = 1;
    while (p.cronologia!.cursorePrima) {
      p = pagina(x, n++, p.cronologia!.cursorePrima!);
      assert.equal(p.errore, null);
      assert.equal(p.totale, 123, "il totale della snapshot non si muove");
      assert.equal(p.cronologia!.watermark, prima.cronologia!.watermark);
      tutte.unshift(...p.cronologia!.righe);
    }
    assert.equal(n, 3);
    assert.equal(p.haAltre, false);
    assert.deepEqual(testi(tutte), Array.from({ length: 123 }, (_, i) => "m" + i));
    assert.deepEqual(tutte.map((r) => r.ordine), Array.from({ length: 123 }, (_, i) => i));
    assert.equal(new Set(tutte.map((r) => r.chiave)).size, 123);
    const live = x.eventi.filter((d) => d.tipo === "upsert").flatMap((d: any) => d.righe);
    assert.deepEqual(testi(live), ["uguale", "uguale"], "due testi identici restano due righe");
    assert.equal(new Set(live.map((r: any) => r.chiave)).size, 2);
    assert.equal(pagina(x).totale, 125);
  });
}

for (const a of [claude, codex]) {
  test(`${a.source}: l'esito di uno strumento fuori dalla pagina caricata arriva come aggiornamento, la snapshot resta immutabile`, () => {
    const x = nuovo(a.source, [a.call("vecchio"), ...Array.from({ length: 55 }, () => a.user("identico"))]);
    const p0 = pagina(x), congelata = JSON.stringify(p0);
    x.accoda([a.result("vecchio")]);
    x.c.aggiorna(x.s);
    const up = x.eventi.filter((d) => d.tipo === "upsert") as Extract<DeltaCronologia, { tipo: "upsert" }>[];
    assert.equal(up.length, 1);
    assert.equal(up[0].righe.length, 1);
    assert.equal(up[0].righe[0].ordine, 0);
    assert.deepEqual((up[0].righe[0].messaggio as any).esito, { testo: "ok", errore: false });
    assert.ok(up[0].righe[0].revisione > p0.cronologia!.watermark);
    assert.equal(up[0].totale, 56, "l'aggiornamento non crea una riga nuova");
    const vecchia = pagina(x, 1, p0.cronologia!.cursorePrima!);
    assert.equal((vecchia.cronologia!.righe[0].messaggio as any).esito, null, "la snapshot storica non cambia");
    assert.equal(JSON.stringify(p0), congelata);
    assert.equal(pagina(x).cronologia!.righe.length, 50);
  });
}

test("cursore: firma alterata, sessione sbagliata e scadenza sono rifiutati", () => {
  let ora = 0;
  const x = nuovo("claude-code", Array.from({ length: 60 }, (_, i) => claude.user("m" + i)), { ttlMs: 5 }, () => ora);
  const cur = pagina(x).cronologia!.cursorePrima!;
  const rotto = cur.slice(0, -1) + (cur.endsWith("a") ? "b" : "a");
  assert.equal(pagina(x, 1, rotto).erroreCronologia?.codice, "cursore_invalido");
  assert.equal(x.c.pagina({ ...x.s, id: "altra" }, 1, { v: 1, cursore: cur }).erroreCronologia?.codice, "cursore_invalido");
  assert.equal(pagina(x, 1, "a.b").erroreCronologia?.codice, "cursore_invalido");
  assert.equal(x.c.pagina(x.s, -1, { v: 1 }).erroreCronologia?.codice, "cursore_invalido");
  ora = 6;
  assert.equal(pagina(x, 1, cur).erroreCronologia?.codice, "snapshot_scaduta");
});

test("append mentre il file viene letto: la snapshot è coerente e il risultato nato prima non si perde", () => {
  const x = nuovo("claude-code", [claude.call("t"), ...Array.from({ length: 55 }, () => claude.user("same"))]);
  const reale = require("node:fs") as typeof fs, letturaVera = reale.readSync;
  let iniettato = false, letture = 0;
  (reale as any).readSync = (...args: any[]) => {
    const n = (letturaVera as any)(...args);
    letture++;
    if (!iniettato) { iniettato = true; x.accoda([claude.result("t")]); }
    return n;
  };
  let p;
  try { p = pagina(x); } finally { (reale as any).readSync = letturaVera; }
  assert.ok(letture >= 2, "la lettura instabile viene rifatta");
  const vecchia = pagina(x, 1, p.cronologia!.cursorePrima!);
  assert.deepEqual((vecchia.cronologia!.righe[0].messaggio as any).esito, { testo: "ok", errore: false });
  assert.equal(p.totale, 56);
});

test("file sostituito, accorciato, riscritto o spostato: la cronologia riparte con un reset e il vecchio cursore non vale più", () => {
  const base = Array.from({ length: 60 }, (_, i) => claude.user("m" + i));
  const resetDi = (x: X) => (x.eventi.filter((d) => d.tipo === "reset") as any[]).map((d) => d.motivo);
  const parte = () => { const x = nuovo("claude-code", base); const p = pagina(x); return { x, cur: p.cronologia!.cursorePrima!, epoca: p.cronologia!.epoca }; };

  let { x, cur, epoca } = parte();
  fs.renameSync((fs.writeFileSync(x.s.file + ".nuovo", emit([...base, claude.user("in piu")])), x.s.file + ".nuovo"), x.s.file);
  assert.equal(pagina(x, 1, cur).erroreCronologia?.codice, "epoca_cambiata");
  assert.deepEqual(resetDi(x), ["replace"]);
  assert.equal(pagina(x).totale, 61);
  assert.notEqual(pagina(x).cronologia!.epoca, epoca);

  ({ x, cur } = parte());
  fs.truncateSync(x.s.file, 100);
  x.c.aggiorna(x.s);
  assert.deepEqual(resetDi(x), ["truncate"]);
  assert.equal(pagina(x, 1, cur).erroreCronologia?.codice, "epoca_cambiata");

  ({ x } = parte());
  const dati = fs.readFileSync(x.s.file, "utf8");
  fs.writeFileSync(x.s.file, dati.replace("m0", "zz")); // stessa lunghezza, stesso inode
  x.c.aggiorna(x.s);
  assert.deepEqual(resetDi(x), ["riscrittura"]);

  ({ x } = parte());
  const altro = path.join(dir, "spostato.jsonl");
  fs.copyFileSync(x.s.file, altro);
  x.c.aggiorna({ ...x.s, file: altro });
  assert.deepEqual(resetDi(x), ["percorso"]);
});

test("riga senza newline finale e UTF-8 spezzato a fine file: niente di mezzo, poi un solo messaggio intero", () => {
  const x = nuovo("claude-code", emit([claude.user("uno")]) + JSON.stringify(claude.user("due")));
  assert.deepEqual(testi(pagina(x).cronologia!.righe), ["uno"], "la riga non chiusa aspetta il suo newline");
  x.accoda("\n");
  x.c.aggiorna(x.s);
  const buf = Buffer.from(JSON.stringify(claude.user("perché")) + "\n"), taglio = buf.indexOf(0xc3) + 1; // a metà di «é»
  fs.appendFileSync(x.s.file, buf.subarray(0, taglio));
  assert.deepEqual(testi(pagina(x).cronologia!.righe), ["uno", "due"]);
  fs.appendFileSync(x.s.file, buf.subarray(taglio));
  x.c.aggiorna(x.s);
  assert.deepEqual(testi(pagina(x).cronologia!.righe), ["uno", "due", "perché"]);
  const ins = x.eventi.filter((d) => d.tipo === "upsert").flatMap((d: any) => d.righe);
  assert.deepEqual(testi(ins), ["due", "perché"], "ogni messaggio pubblicato una volta sola");
  assert.equal(x.eventi.filter((d) => d.tipo === "errore").length, 0);
});

test("BOM, CRLF, righe vuote, JSON rotto, valori non oggetto e riga da 3 MB: restano solo i messaggi veri, nell'ordine", () => {
  const grande = JSON.stringify(claude.user("g".repeat(3 * 1024 * 1024)));
  const testo = "﻿" + JSON.stringify(claude.user("a")) + "\r\n\r\n" + '{"type":"user","message":{"cont\n' + "null\n42\n[]\n\"x\"\n" +
    JSON.stringify(claude.user("b")) + "\r\n" + grande + "\n" + JSON.stringify(claude.user("c")) + "\n";
  const x = nuovo("claude-code", testo);
  const t = testi(pagina(x).cronologia!.righe);
  assert.deepEqual([t[0], t[1], t[3]], ["a", "b", "c"]);
  assert.equal(t[2].length, 3 * 1024 * 1024);
  assert.equal(t.length, 4);
});

test("risultato senza chiamata, o con id doppio: errore visibile e una sola riga, mai un esito sulla chiamata sbagliata", () => {
  const x = nuovo("claude-code", [claude.result("mai-visto"), claude.call("d"), claude.call("d"), claude.result("d")]);
  const m = pagina(x).cronologia!.righe.map((r) => r.messaggio as any);
  assert.equal(m.filter((v) => v.tipo === "errore").length, 2);
  assert.ok(m.filter((v) => v.tipo === "strumento").every((v) => v.esito === null));
});

test("Codex: spawn_agent e SubAgentActivity sono una riga sola, aggiornata con l'esito", () => {
  const item = (kind: string) => ({ type: "event_msg", payload: { type: "item_completed", item: { type: "SubAgentActivity", id: "call_9", kind, agent_thread_id: "T", agent_path: "/root/lavoro" } } });
  const x = nuovo("codex", [{ type: "response_item", payload: { type: "function_call", name: "spawn_agent", call_id: "call_9", arguments: "{}" } }, item("started")]);
  const p0 = pagina(x);
  assert.equal(p0.cronologia!.righe.length, 1);
  x.accoda([item("completed")]);
  x.c.aggiorna(x.s);
  const up = x.eventi.filter((d) => d.tipo === "upsert").flatMap((d: any) => d.righe);
  assert.equal(up.length, 1);
  assert.equal(up[0].ordine, 0);
  assert.deepEqual([up[0].messaggio.nome, up[0].messaggio.esito.testo], ["Agent", "Completato"]);
});

test("file sparito mentre la sessione è aperta: errore chiaro, nessuna eccezione, e riparte se torna", () => {
  const x = nuovo("claude-code", [claude.user("uno")]);
  const dati = fs.readFileSync(x.s.file);
  fs.unlinkSync(x.s.file);
  assert.equal(pagina(x).erroreCronologia?.codice, "sorgente_assente");
  fs.writeFileSync(x.s.file, dati);
  assert.deepEqual(testi(pagina(x).cronologia!.righe), ["uno"]);
});
