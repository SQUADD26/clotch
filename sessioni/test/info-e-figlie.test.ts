// Info sessione e figlie (#437): contesto e file toccati dalla trascrizione, dati dell'app (madre, PR, connettori), madri e figlie nella barra.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { datiApp } from "../src/desktop";
import { infoSessione } from "../src/info-sessione";
import type { Sessione } from "../src/tipi";
import { conFiglie } from "../src/ui/barra/figlie";
import { percento, testoPr, token } from "../src/ui/pannello/info";

const sessione = (id: string, file = "", extra: Partial<Sessione> = {}): Sessione => ({
  id, sorgente: "claude-desktop", account: ".claude", email: null, idApp: null, titolo: id, progetto: "p", cartella: "", ramo: null, modello: null,
  stato: "ferma", perche: null, ultimaAttivita: 0, obiettivo: null, situazione: null, file, ...extra,
});
const riga = (o: unknown) => JSON.stringify(o) + "\n";
const risposta = (usage: object | undefined, content: object[] = [], extra: object = {}) =>
  riga({ type: "assistant", message: { model: "claude-opus-5-5", usage, content }, ...extra });
const uso = (input: number, lettura = 0, scrittura = 0, uscita = 0) => ({ input_tokens: input, cache_read_input_tokens: lettura, cache_creation_input_tokens: scrittura, output_tokens: uscita });

test("info: contesto dell'ultima risposta e file toccati, solo righe nuove al secondo giro", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "info-"));
  const file = path.join(dir, "s.jsonl");
  fs.writeFileSync(file,
    riga({ type: "user", message: { content: "ciao" } }) +
    risposta(uso(2, 1000, 500, 8), [
      { type: "tool_use", name: "Edit", input: { file_path: "/a.ts", old_string: "x\ny", new_string: "x\nz\nw" } }, // +2 −1
      { type: "tool_use", name: "Write", input: { file_path: "/b.ts", content: "uno\ndue\ntre\n" } },                 // +3
      { type: "tool_use", name: "Read", input: { file_path: "/c.ts" } },                                              // non conta
    ]) +
    risposta(uso(1, 9999, 1, 1), [{ type: "tool_use", name: "Edit", input: { file_path: "/z.ts", old_string: "a", new_string: "b" } }], { isSidechain: true }) +
    "riga a metà non json\n");
  const s = sessione("a", file);
  assert.deepEqual(infoSessione(s), { contesto: 1510, file: { quanti: 2, aggiunte: 5, tolte: 1, nomi: ["/a.ts", "/b.ts"] } });

  fs.appendFileSync(file, risposta(uso(3, 2000, 0, 7), [
    { type: "tool_use", name: "MultiEdit", input: { file_path: "/a.ts", edits: [{ old_string: "p", new_string: "q" }, { old_string: "", new_string: "r\ns" }] } }, // +1 −1, +2
  ]));
  assert.deepEqual(infoSessione(s), { contesto: 2010, file: { quanti: 2, aggiunte: 8, tolte: 2, nomi: ["/a.ts", "/b.ts"] } });

  fs.writeFileSync(file, risposta(uso(5)));
  assert.deepEqual(infoSessione(s), { contesto: 5, file: { quanti: 0, aggiunte: 0, tolte: 0, nomi: [] } }, "file accorciato: si riparte da capo");
});

test("info: sorgenti senza trascrizione Claude e file sparito danno numeri vuoti, non finti", () => {
  const vuota = { contesto: null, file: { quanti: 0, aggiunte: 0, tolte: 0 } };
  assert.deepEqual(infoSessione(undefined), vuota);
  assert.deepEqual(infoSessione(sessione("x", "/non/esiste.jsonl")), vuota);
  assert.deepEqual(infoSessione(sessione("y", "/tmp/x.jsonl", { sorgente: "codex" })), vuota);
  assert.deepEqual(infoSessione(sessione("z", "/tmp/local_1.json")), vuota);
});

test("dati dell'app: madre, PR (senza quelle tolte), connettori, strumenti MCP, versione, macchina e ponte", () => {
  const a = datiApp({
    spawnedFrom: { sessionId: "local_madre" },
    prs: [
      { prNumber: 1, url: "https://github.com/o/r/pull/1", state: "MERGED", baseRef: "dev" },
      { prNumber: 2, url: "https://github.com/o/r/pull/2", state: "OPEN", baseRef: null },
      { prNumber: 3, url: "https://github.com/o/r/pull/3", state: "CLOSED", dismissed: true },
      { prNumber: 4, url: "https://github.com/o/r/pull/4", state: "DRAFT?" },
    ],
    remoteMcpServersConfig: [{ name: "Linear", tools: [{ name: "x" }] }, { name: "Notion" }, {}],
    enabledMcpTools: { "u:a": true, "u:b": false, "u:c": true },
    toolSurfaceSnapshot: { cliVersion: "2.1.299" }, sshConfig: { sshHost: "sandbox@1.2.3.4" }, bridgeSessionIds: ["session_x"],
  });
  assert.equal(a.padre, "local_madre");
  assert.deepEqual(a.prs.map((p) => [p.numero, p.stato, p.verso]), [[1, "unita", "dev"], [2, "aperta", null]]);
  assert.deepEqual(a.connettori, ["Linear", "Notion"]);
  assert.equal(a.strumentiMcp, 2);
  assert.deepEqual([a.cli, a.ospite, a.remoto], ["2.1.299", "sandbox@1.2.3.4", true]);
  const vuoto = datiApp({});
  assert.deepEqual([vuoto.padre, vuoto.prs, vuoto.connettori, vuoto.strumentiMcp, vuoto.cli, vuoto.ospite, vuoto.remoto], [null, [], [], 0, null, null, false]);
});

test("barra: le figlie stanno sotto la madre, chiudere la madre le nasconde, senza madre nella lista restano al loro posto", () => {
  const app = (padre: string | null) => ({ padre, prs: [], connettori: [], strumentiMcp: 0, cli: null, ospite: null, remoto: false });
  const m = sessione("M", "", { idApp: "local_M", app: app(null) }), f1 = sessione("F1", "", { idApp: "local_F1", app: app("local_M") });
  const f2 = sessione("F2", "", { app: app("local_M") }), n = sessione("N"), orfana = sessione("O", "", { app: app("local_assente") });
  const ordine = (l: Sessione[], chiuse: string[] = []) => conFiglie(l, new Set(chiuse)).map((v) => `${v.s.id}${v.figlia ? "<" : ""}${v.figlie || ""}`);
  assert.deepEqual(ordine([f1, n, m, f2, orfana]), ["N", "M2", "F1<", "F2<", "O"]);
  assert.deepEqual(ordine([f1, n, m, f2, orfana], ["M"]), ["N", "M2", "O"]);
  const nipote = sessione("P", "", { app: app("local_F1") });
  assert.deepEqual(ordine([m, f1, nipote]), ["M1", "F1<1", "P<"], "figlia della figlia: sotto la sua madre");
  const a = sessione("A", "", { idApp: "local_A", app: app("local_B") }), b = sessione("B", "", { idApp: "local_B", app: app("local_A") });
  assert.deepEqual(ordine([a, b]), ["A", "B"], "un giro madre-figlia non fa sparire righe");
});

test("pannello: testi dei numeri e delle PR come nel disegno", () => {
  assert.equal(token(258_000), "258k");
  assert.equal(token(345_500), "345,5k");
  assert.equal(token(1_000_000), "1M");
  assert.equal(token(950), "950");
  assert.equal(percento(0.346), "34,6%");
  assert.equal(percento(0.346, 0), "35%");
  const pr = (stato: "aperta" | "unita" | "chiusa", verso: string | null) => testoPr({ numero: 336, stato, verso, url: "u" });
  assert.equal(pr("aperta", "dev"), "PR #336 · aperta verso dev");
  assert.equal(pr("unita", "dev"), "PR #336 · unita in dev");
  assert.equal(pr("chiusa", null), "PR #336 · chiusa senza unire");
});
