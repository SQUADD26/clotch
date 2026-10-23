import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { copiaHome } from "./aiuti";
import { leggiElenco } from "../src/elenco";
import { leggiPagina } from "../src/messaggi";

const riga = (i: number) =>
  JSON.stringify({ type: i % 2 ? "assistant" : "user", sessionId: "big", cwd: "/Users/x/big", timestamp: "2026-10-20T10:00:00.000Z",
    message: { role: i % 2 ? "assistant" : "user", content: [{ type: "text", text: `messaggio ${i} ` + "x".repeat(1000) }] } }) + "\n";

test("trascrizione di decine di MB: lista veloce, pagine dalla coda, memoria contenuta", () => {
  const home = copiaHome();
  const dir = path.join(home, ".claude", "projects", "-Users-x-big");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "big.jsonl");
  const fd = fs.openSync(file, "w");
  for (let i = 0; i < 40000; i++) fs.writeSync(fd, riga(i)); // ~42 MB
  fs.closeSync(fd);
  assert.ok(fs.statSync(file).size > 40e6);

  const rss0 = process.memoryUsage().rss;
  let t = Date.now();
  const e = leggiElenco({ home, env: {} });
  assert.ok(Date.now() - t < 1500, "la lista deve restare veloce");
  const s = e.sessioni.find((x) => x.id === "big")!;
  assert.equal(s.progetto, "big");

  t = Date.now();
  const p0 = leggiPagina(s, 0);
  assert.ok(Date.now() - t < 1500);
  assert.equal(p0.messaggi.length, 50);
  assert.match((p0.messaggi[49] as any).testo, /^messaggio 39999 /);
  const p1 = leggiPagina(s, 1);
  assert.match((p1.messaggi[49] as any).testo, /^messaggio 39949 /);
  assert.ok(p1.haAltre);
  assert.ok(process.memoryUsage().rss - rss0 < 200e6, "non deve caricare tutto il file");
});

test("riga rotta in mezzo al file: si salta la riga, non la sessione", () => {
  const home = copiaHome();
  const f = path.join(home, ".claude", "projects", "-Users-x-app", "aaaaaaaa-0000-4000-8000-000000000001.jsonl");
  fs.appendFileSync(f, '{"type":"user","message":{"cont\n');
  const e = leggiElenco({ home, env: {} });
  const s = e.sessioni.find((x) => x.id === "aaaaaaaa-0000-4000-8000-000000000001")!;
  assert.equal(leggiPagina(s, 0).messaggi.length, 5);
});

test("cartelle mancanti: nessun errore, nessuna sessione", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vuota-"));
  assert.deepEqual(leggiElenco({ home, env: {} }), { sessioni: [], errori: [] });
});

test("cartella senza permesso: errore chiaro nella risposta, il resto si legge", { skip: process.getuid?.() === 0 }, () => {
  const home = copiaHome();
  const chiusa = path.join(home, ".claude-roberto", "projects", "-Users-x-altro");
  fs.chmodSync(chiusa, 0o000);
  try {
    const e = leggiElenco({ home, env: {} });
    assert.ok(e.errori.some((x) => x.percorso === chiusa && x.messaggio === "permesso negato"), JSON.stringify(e.errori));
    assert.ok(e.sessioni.some((x) => x.id === "aaaaaaaa-0000-4000-8000-000000000001"));
  } finally {
    fs.chmodSync(chiusa, 0o755);
  }
});

test("due nomi per la stessa radice (link simbolico): la sessione compare una volta", () => {
  const home = copiaHome();
  fs.symlinkSync(path.join(home, ".claude"), path.join(home, ".claude-alias"));
  const n = leggiElenco({ home, env: {} }).sessioni.filter((x) => x.id === "aaaaaaaa-0000-4000-8000-000000000001").length;
  assert.equal(n, 1);
});

test("file sparito dopo l'elenco: errore chiaro, nessuna eccezione", () => {
  const p = leggiPagina({ file: "/non/esiste.jsonl", sorgente: "claude-code" }, 0);
  assert.equal(p.errore, "file sparito");
});
