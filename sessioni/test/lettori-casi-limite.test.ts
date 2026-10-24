// Lettori Claude / Codex / Cursor davanti a formati inattesi e dati parziali. Fixture sintetiche, nessun dato vero.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiElenco } from "../src/elenco";
import { leggiPagina } from "../src/messaggi";
import { Sessioni } from "../src/api";
import { Convertitore } from "../src/messaggi-claude";
import { ConvertitoreCodex, ConvertitoreCursor } from "../src/messaggi-altri";

const J = (o: unknown) => JSON.stringify(o) + "\n";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "lettori-"));
const UUID = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-${String(n).repeat(12)}`;
/** Una home con un solo file Claude in `<radice>/projects/-x-a/<id>.jsonl`. */
function claudeHome(righe: string, id = "sess", radice = ".claude") {
  const home = tmp(), d = path.join(home, radice, "projects", "-x-a");
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, id + ".jsonl"), righe);
  return { home, file: path.join(d, id + ".jsonl") };
}
const elenco = (home: string) => leggiElenco({ home, env: {} });
const sorgenti = {
  "claude-code": (t: string) => J({ type: "user", message: { content: t } }),
  codex: (t: string) => J({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: t }] } }),
  cursor: (t: string) => J({ role: "user", message: { content: [{ type: "text", text: t }] } }),
};
const testi = (file: string, sorgente: keyof typeof sorgenti, pagina = 0, dim?: number) =>
  leggiPagina({ file, sorgente }, pagina, dim).messaggi.map((m: any) => m.testo);

for (const [sorgente, riga] of Object.entries(sorgenti) as [keyof typeof sorgenti, (t: string) => string][]) {
  test(`${sorgente}: tre messaggi con testo identico restano tre, e le pagine non perdono né ripetono righe`, () => {
    const file = path.join(tmp(), "s.jsonl");
    fs.writeFileSync(file, Array.from({ length: 103 }, (_, i) => riga(i >= 100 ? "uguale" : "m" + i)).join(""));
    assert.deepEqual(testi(file, sorgente, 0).slice(-3), ["uguale", "uguale", "uguale"]);
    const tutte = [...testi(file, sorgente, 2), ...testi(file, sorgente, 1), ...testi(file, sorgente, 0)];
    assert.deepEqual(tutte, [...Array.from({ length: 100 }, (_, i) => "m" + i), "uguale", "uguale", "uguale"]);
  });

  test(`${sorgente}: BOM, CRLF, righe vuote, JSON rotto e valori non oggetto non fermano la lettura`, () => {
    const file = path.join(tmp(), "s.jsonl");
    fs.writeFileSync(file, "﻿" + riga("a").trimEnd() + "\r\n\r\n{\"type\":\"user\",\"mess\nnull\n42\n[]\n\"x\"\n" + riga("b").trimEnd() + "\r\n" + riga("c"));
    assert.deepEqual(testi(file, sorgente), ["a", "b", "c"]);
  });

  test(`${sorgente}: UTF-8 tagliato a fine file, la riga intera arriva dopo`, () => {
    const file = path.join(tmp(), "s.jsonl"), buf = Buffer.from(riga("perché"));
    fs.writeFileSync(file, riga("uno"));
    fs.appendFileSync(file, buf.subarray(0, buf.indexOf(0xc3) + 1));
    assert.deepEqual(testi(file, sorgente), ["uno"]);
    fs.writeFileSync(file, riga("uno") + buf);
    assert.deepEqual(testi(file, sorgente), ["uno", "perché"]);
  });
}

test("riga da 3 MB in mezzo al file: si legge intera, le righe attorno non si perdono", () => {
  const file = path.join(tmp(), "s.jsonl");
  fs.writeFileSync(file, sorgenti["claude-code"]("prima") + sorgenti["claude-code"]("g".repeat(3 << 20)) + sorgenti["claude-code"]("dopo"));
  const t = testi(file, "claude-code");
  assert.deepEqual([t[0], t[2], t.length], ["prima", "dopo", 3]);
  assert.equal(t[1].length, 3 << 20);
});

test("UTF-8 a cavallo del blocco da 1 MB: il testo resta identico", () => {
  for (const prefisso of ["", "a"]) {
    const file = path.join(tmp(), "s.jsonl");
    fs.writeFileSync(file, sorgenti["claude-code"](prefisso + "è".repeat(600000)) + sorgenti["claude-code"]("fine"));
    const t = testi(file, "claude-code");
    assert.equal(t[0], prefisso + "è".repeat(600000));
  }
});

test("Claude: la prima riga da 100 KB (testo incollato) non fa sparire la sessione dall'elenco", () => {
  const { home } = claudeHome(J({ type: "user", cwd: "/x/a", message: { content: "p".repeat(100000) } }) + J({ type: "assistant", cwd: "/x/a", message: { content: "ok" } }));
  const s = elenco(home).sessioni.find((x) => x.id === "sess");
  assert.equal(s?.cartella, "/x/a");
});

test("Claude: campi di tipo sbagliato nella testata non sporcano la sessione", () => {
  const { home } = claudeHome(J({ type: "user", cwd: 5, gitBranch: 42, message: { content: [{ type: "text", text: "ciao" }] } }) +
    J({ type: "assistant", cwd: "/x/b", gitBranch: 7, timestamp: 12345, message: { model: { a: 1 }, content: "r" } }) +
    J({ type: "ai-title", aiTitle: { x: 1 } }) + J({ type: "last-prompt", lastPrompt: 9 }));
  const s = elenco(home).sessioni.find((x) => x.id === "sess")!;
  assert.deepEqual([s.cartella, s.ramo, s.modello], ["/x/b", null, null]);
  assert.equal(s.titolo, "ciao", "il titolo ripiega sul primo messaggio, anche se il contenuto è un elenco di blocchi");
  assert.ok(Number.isFinite(s.ultimaAttivita));
});

test("Claude: cambio di cartella nel corso della sessione = vale l'ultima; stesso id in due account = una sola sessione", () => {
  const { home, file } = claudeHome(J({ type: "user", cwd: "/x/prima", message: { content: "uno" } }) + J({ type: "assistant", cwd: "/x/dopo", message: { content: "due" } }));
  const copia = path.join(home, ".claude-altro", "projects", "-x-b");
  fs.mkdirSync(copia, { recursive: true });
  fs.copyFileSync(file, path.join(copia, "sess.jsonl"));
  const tutte = elenco(home).sessioni.filter((x) => x.id === "sess");
  assert.equal(tutte.length, 1);
  assert.equal(tutte[0].cartella, "/x/dopo");
  assert.equal(tutte[0].progetto, "dopo");
});

test("Claude: file sostituito con uno più corto dopo l'elenco, poi riletto: l'elenco segue il file nuovo", () => {
  const { home, file } = claudeHome(J({ type: "user", cwd: "/x/a", message: { content: "vecchio titolo lungo" } }) + J({ type: "assistant", cwd: "/x/a", message: { content: "x".repeat(500) } }));
  assert.equal(elenco(home).sessioni[0].titolo, "vecchio titolo lungo");
  fs.writeFileSync(file + ".n", J({ type: "user", cwd: "/x/a", message: { content: "nuovo" } }));
  fs.renameSync(file + ".n", file);
  assert.equal(elenco(home).sessioni[0].titolo, "nuovo");
  assert.deepEqual(testi(file, "claude-code"), ["nuovo"]);
});

test("Convertitore Claude: id o nome mancanti, contenuti di tipo strano: nessun 'undefined', nessun esito sulla chiamata sbagliata", () => {
  const c = new Convertitore();
  const [m] = c.riga({ type: "assistant", message: { content: [{ type: "tool_use", input: {} }] } }).nuovi as any[];
  assert.notEqual(m.nome, "undefined");
  assert.notEqual(m.id, "undefined");
  assert.deepEqual(c.riga({ type: "user", message: { content: [{ type: "tool_result", content: "x" }] } }).aggiornati, [], "un risultato senza id non si attacca a niente");
  for (const o of [{ type: "user", message: { content: 5 } }, { type: "user", message: "str" }, { type: "assistant", message: null }, { type: "system", level: "error" }, { type: "user", message: { content: [null, 3, "x", {}] } }])
    assert.doesNotThrow(() => c.riga(o));
});

test("Convertitore Codex: uscita assente o strutturata, id e nome mancanti, contenuto non testuale", () => {
  const c = new ConvertitoreCodex();
  c.riga({ type: "response_item", payload: { type: "function_call", call_id: "k", name: "Bash", arguments: "{" } });
  const [u] = c.riga({ type: "response_item", payload: { type: "function_call_output", call_id: "k" } }).aggiornati;
  assert.equal(typeof u.esito?.testo, "string", "uscita assente = testo vuoto, mai undefined");
  const [m] = c.riga({ type: "response_item", payload: { type: "function_call", arguments: "{}" } }).nuovi as any[];
  assert.notEqual(m.nome, "undefined");
  assert.deepEqual(c.riga({ type: "response_item", payload: { type: "function_call_output" } }).aggiornati, [], "uscita senza id: nessun aggancio");
  assert.deepEqual(c.riga({ type: "response_item", payload: { type: "message", role: "user", content: { a: 1 } } }).nuovi, []);
  for (const o of [{ type: "event_msg", payload: { type: "item_completed" } }, { type: "response_item", payload: { type: "reasoning", summary: "x" } }, { type: "event_msg", payload: { type: "item_completed", item: { type: "FileChange", changes: "abc" } } }])
    assert.doesNotThrow(() => c.riga(o));
});

test("Convertitore Cursor: contenuto non testuale e strumento senza nome", () => {
  const c = new ConvertitoreCursor();
  assert.deepEqual(c.riga({ role: "user", message: { content: { a: 1 } } }).nuovi, []);
  const [m] = c.riga({ role: "assistant", message: { content: [{ type: "tool_use" }] } }).nuovi as any[];
  assert.notEqual(m.nome, "undefined");
  assert.deepEqual(c.riga({ role: "assistant", message: { content: "solo testo" } }).nuovi.map((x: any) => x.testo), ["solo testo"]);
  assert.deepEqual(c.riga({ role: "user", message: { content: "<user_query>\nciao\n</user_query>" } }).nuovi.map((x: any) => x.testo), ["ciao"]);
});

test("Cursor: il sottoagente non è una sessione e i suoi messaggi non entrano in quelli del padre", () => {
  const home = tmp(), padre = UUID(4), figlio = UUID(5);
  const base = path.join(home, ".cursor", "projects", "Users-x-cur", "agent-transcripts", padre);
  fs.mkdirSync(path.join(base, "subagents"), { recursive: true });
  fs.writeFileSync(path.join(base, padre + ".jsonl"), sorgenti.cursor("domanda del padre"));
  fs.writeFileSync(path.join(base, "subagents", figlio + ".jsonl"), sorgenti.cursor("compito del figlio"));
  const e = elenco(home).sessioni.filter((s) => s.sorgente === "cursor");
  assert.deepEqual(e.map((s) => s.id), [padre]);
  assert.deepEqual(testi(e[0].file, "cursor"), ["domanda del padre"]);
});

test("app Claude desktop senza trascrizione: compare, e chiedere i messaggi (anche col protocollo v1) dà un errore chiaro", () => {
  const home = tmp(), d = path.join(home, "Library", "Application Support", "Claude", "claude-code-sessions", "u", "p");
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "local_aaaa.json"), JSON.stringify({ sessionId: "local_aaaa", cliSessionId: "senza-file", cwd: "/x/a", title: "Solo app", createdAt: 1, lastActivityAt: 2 }));
  const api = new Sessioni(home), s = api.elencoSessioni().sessioni.find((x) => x.idApp === "local_aaaa")!;
  assert.equal(s.titolo, "Solo app");
  const legacy = api.messaggi(s.id, 0), v1 = api.messaggi(s.id, 0, { v: 1 });
  assert.deepEqual([legacy.messaggi, legacy.errore], [[], "trascrizione non trovata sul disco"]);
  assert.deepEqual([v1.messaggi, v1.erroreCronologia?.codice], [[], "non_letta"]);
});

// Cache del backend (#456): non rileggere ciò che non è cambiato, rileggere ciò che è cambiato anche a parità di mtime:size.
const scrivi = (file: string, o: unknown) => fs.writeFileSync(file, JSON.stringify(o));
/** Quante volte `f` legge un `.json` dei registri (obiettivi, stati). */
function lettureJson(t: any, f: () => void) {
  const spia = t.mock.method(require("node:fs"), "readFileSync");
  try {
    f();
    return spia.mock.calls.filter((c: any) => /(obiettivi|sessioni-stato)\/[^/]+\.json$/.test(String(c.arguments[0]))).length;
  } finally {
    spia.mock.restore();
  }
}
/** Home con la sessione `sess` e le cartelle dei registri. */
function conRegistri() {
  const { home } = claudeHome(J({ type: "user", cwd: "/x/a", message: { content: "ciao" } }));
  const ob = path.join(home, ".claude", "obiettivi"), st = path.join(home, ".claude", "sessioni-stato");
  fs.mkdirSync(ob);
  fs.mkdirSync(st);
  return { home, ob, st, testo: () => leggiElenco({ home, env: {} }).sessioni.find((x) => x.id === "sess")?.obiettivo?.testo };
}

test("registri: obiettivi e stati invariati non si rileggono; cambiati o nuovi sì; sparito esce dall'elenco", (t) => {
  const { home, ob, st, testo } = conRegistri();
  scrivi(path.join(ob, "sess.json"), { cli: "sess", obiettivo: "uno", stato: "in corso" });
  scrivi(path.join(ob, "altro.json"), { cli: "altro", obiettivo: "due", stato: "in corso" });
  scrivi(path.join(st, "sess.json"), { cli: "sess", stato: "lavora" });
  const giro = () => leggiElenco({ home, env: {} });
  assert.equal(lettureJson(t, giro), 3, "il primo giro legge i tre file");
  assert.equal(lettureJson(t, giro), 0, "giro invariato: nessuna lettura di JSON");
  scrivi(path.join(ob, "sess.json"), { cli: "sess", obiettivo: "tre", stato: "in corso" });
  scrivi(path.join(ob, "nuovo.json"), { cli: "nuovo", obiettivo: "x", stato: "in corso" });
  fs.unlinkSync(path.join(ob, "altro.json"));
  assert.equal(lettureJson(t, giro), 2, "solo il file cambiato e quello nuovo");
  assert.equal(testo(), "tre");
});

test("registri: stesso mtime e stessa misura ma contenuto diverso (file riscritto) = riletto", () => {
  const { ob, testo } = conRegistri(), f = path.join(ob, "sess.json");
  scrivi(f, { cli: "sess", obiettivo: "AAAA", stato: "in corso" });
  assert.equal(testo(), "AAAA");
  const m = fs.statSync(f).mtime;
  scrivi(f, { cli: "sess", obiettivo: "BBBB", stato: "in corso" });
  fs.utimesSync(f, m, m);
  assert.equal(testo(), "BBBB");
});

test("Claude: file riscritto con stessa misura e stesso mtime = riletto; file sparito = via dall'elenco", () => {
  const una = (cwd: string) => J({ type: "user", cwd, message: { content: "ciao" } });
  const { home, file } = claudeHome(una("/x/aaaa"));
  assert.equal(elenco(home).sessioni[0].cartella, "/x/aaaa");
  const m = fs.statSync(file).mtime;
  fs.writeFileSync(file, una("/x/bbbb"));
  fs.utimesSync(file, m, m);
  assert.equal(elenco(home).sessioni[0].cartella, "/x/bbbb");
  fs.unlinkSync(file);
  assert.deepEqual(elenco(home).sessioni, []);
  fs.writeFileSync(file, una("/x/cccc"));
  fs.utimesSync(file, m, m);
  assert.equal(elenco(home).sessioni[0].cartella, "/x/cccc");
});
