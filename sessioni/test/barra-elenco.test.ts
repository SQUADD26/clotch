// Barra laterale (#348): gruppi, filtri, fissate e testi della barra, puri.
import test from "node:test";
import assert from "node:assert/strict";
import type { Sessione } from "../src/tipi";
import { componi, dettaglioProfilo, giorno, opzioni, pillola, type Vista } from "../src/ui/barra/elenco";

const ORA = new Date(2026, 9, 22, 15, 0).getTime();
const s = (id: string, titolo: string, progetto: string, stato: Sessione["stato"], minuti: number, sorgente: Sessione["sorgente"] = "claude-code", account = "a"): Sessione => ({
  id, sorgente, account, email: null, idApp: null, titolo, progetto, cartella: "", ramo: null, modello: null, stato, perche: null,
  ultimaAttivita: ORA - minuti * 60_000, obiettivo: null, situazione: null, file: "",
});
const elenco = [
  s("1", "Clotch: sessioni", "clotch", "lavora", 1), s("2", "Backend: auth", "squadd-v2", "aspetta", 5, "codex", "b"),
  s("3", "Voce: parole", "clotch", "ferma", 10), s("4", "Vecchia", "dentalspace", "finita", 60 * 24 * 10, "cursor", "c"),
];
const vista: Vista = { filtri: [], raggruppa: "cartella", ordina: "attivita" };

test("cartelle in ordine di ultima attività, titolo «Progetti»", () => {
  const b = componi(elenco, vista, {}, ORA);
  assert.equal(b.titolo, "Progetti");
  assert.deepEqual(b.gruppi.map((g) => [g.titolo, g.sessioni.map((x) => x.id)]), [["clotch", ["1", "3"]], ["squadd-v2", ["2"]], ["dentalspace", ["4"]]]);
});

test("filtri attivi: «N sessioni» e solo le sessioni che passano", () => {
  const b = componi(elenco, { ...vista, filtri: [{ proprieta: "stato", valori: ["aspetta", "ferma"] }, { proprieta: "sorgente", valori: [] }] }, {}, ORA);
  assert.equal(b.titolo, "2 sessioni");
  assert.deepEqual(b.gruppi.flatMap((g) => g.sessioni.map((x) => x.id)), ["2", "3"]);
});

test("fissate in cima e anche nella loro cartella (101:21065)", () => {
  const b = componi(elenco, vista, { "3": { fissa: true } }, ORA);
  assert.deepEqual(b.fissate.map((x) => x.id), ["3"]);
  assert.ok(b.gruppi[0].sessioni.some((x) => x.id === "3"));
});

test("raggruppa per data e per sorgente, ordina per nome", () => {
  assert.deepEqual(componi(elenco, { ...vista, raggruppa: "data" }, {}, ORA).gruppi.map((g) => g.titolo), ["Oggi", "12 ott"]);
  assert.deepEqual(componi(elenco, { ...vista, raggruppa: "sorgente", ordina: "nome" }, {}, ORA).gruppi.map((g) => g.titolo), ["Codex", "Claude Code", "Cursor"]); // i gruppi seguono la prima sessione in ordine di nome
});

test("testi: pillola, giorni, opzioni, piede", () => {
  assert.deepEqual(pillola({ proprieta: "stato", valori: ["aspetta"] }), { proprieta: "Stato:", valore: "In attesa" });
  assert.equal(giorno(ORA - 24 * 3600_000, ORA), "Ieri");
  assert.deepEqual(opzioni(elenco, "progetto", ORA).map((o) => o.voce), ["clotch", "dentalspace", "squadd-v2"]);
  assert.equal(opzioni(elenco, "stato", ORA).length, 5);
  assert.equal(dettaglioProfilo(elenco), "3 account · 3 sorgenti");
  assert.equal(dettaglioProfilo([]), "Nessuna sessione");
});
