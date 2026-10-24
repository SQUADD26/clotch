// PR di ogni sessione e prove dell'obiettivo (#456, R2 CL12 C7): le PR della trascrizione di Claude Code, tutte; la prova «fallita» dal registro obiettivi.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { infoSessione } from "../src/info-sessione";
import { leggiObiettivi } from "../src/registri";
import type { Sessione } from "../src/tipi";

const riga = (o: unknown) => JSON.stringify(o) + "\n";
const link = (n: number, repo = "o/r") => riga({ type: "pr-link", sessionId: "x", prNumber: n, prUrl: `https://github.com/${repo}/pull/${n}`, prRepository: repo });
const sessione = (file: string, extra: Partial<Sessione> = {}): Sessione => ({
  id: "x", sorgente: "claude-code", account: ".claude", email: null, idApp: null, titolo: "x", progetto: "p", cartella: "", ramo: null, modello: null,
  stato: "ferma", perche: null, ultimaAttivita: 0, obiettivo: null, situazione: null, file, ...extra,
});
const nuovoFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pr-")), "s.jsonl");

test("PR: tutte quelle della trascrizione Claude Code, ognuna una volta, senza stato inventato; le righe nuove si aggiungono", () => {
  const file = nuovoFile();
  fs.writeFileSync(file, link(7) + link(9) + link(7) + riga({ type: "pr-link", prNumber: "x" }));
  const s = sessione(file);
  assert.deepEqual(infoSessione(s).prs, [
    { numero: 7, url: "https://github.com/o/r/pull/7", stato: null, verso: null },
    { numero: 9, url: "https://github.com/o/r/pull/9", stato: null, verso: null },
  ]);
  fs.appendFileSync(file, link(11));
  assert.deepEqual(infoSessione(s).prs?.map((p) => p.numero), [7, 9, 11]);
});

test("PR: quelle del file dell'app tengono il loro stato e la trascrizione non le raddoppia", () => {
  const file = nuovoFile();
  fs.writeFileSync(file, link(7) + link(9));
  const app = { padre: null, prs: [{ numero: 7, stato: "unita" as const, verso: "dev", url: "https://github.com/o/r/pull/7" }], connettori: [], strumentiMcp: 0, cli: null, ospite: null, remoto: false };
  assert.deepEqual(infoSessione(sessione(file, { sorgente: "claude-desktop", app })).prs?.map((p) => [p.numero, p.stato]), [[7, "unita"], [9, null]]);
});

test("PR: nessuna PR = nessun campo, come prima", () => {
  const file = nuovoFile();
  fs.writeFileSync(file, riga({ type: "user", message: { content: "ciao" } }));
  assert.equal("prs" in infoSessione(sessione(file)), false);
});

test("prove dell'obiettivo: fallita = non fatta e il registro ha scritto la nota dell'ultimo tentativo rosso", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ob-"));
  fs.mkdirSync(path.join(home, "obiettivi"));
  fs.writeFileSync(path.join(home, "obiettivi", "a.json"), JSON.stringify({ cli: "a", obiettivo: "x", stato: "aperto", prove: [
    { testo: "verde", fatta: true, nota: "vecchia" }, { testo: "rossa", fatta: false, nota: "esce 1: boom" }, { testo: "mai provata", fatta: false }, { testo: "senza nota", fatta: false, nota: "" },
  ] }));
  assert.deepEqual(leggiObiettivi(home, []).get("a")?.prove.map((p) => [p.testo, p.fatta, !!p.fallita]),
    [["verde", true, false], ["rossa", false, true], ["mai provata", false, false], ["senza nota", false, false]]);
});
