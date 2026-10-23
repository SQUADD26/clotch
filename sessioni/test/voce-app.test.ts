import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import assert from "node:assert/strict";
import { leggiRegistro, type Registro } from "../src/friday";
import { daLeggere, leggi } from "../src/voce-app";
import childProcess = require("node:child_process");

const vuoto = () => leggiRegistro("/non/esiste", { FRIDAY_REGISTRO: "/non/esiste" });
const avviso = (id: string, testo: string, dettoDa: string | null) => ({ id, t: 0, testo, livello: "normale", motivo: "", dettoDa, sessioni: [] });

test("Clotch assente: l'app legge solo gli avvisi nuovi dati a lei, mai lo storico né quelli di Clotch", () => {
  const r: Registro = { ...vuoto(), avvisi: [avviso("1", "vecchio", "app")] };
  const prima = daLeggere(r, null);
  assert.deepEqual(prima.testi, []); // all'avvio lo storico non si legge
  r.avvisi.push(avviso("2", "Serve il tuo sì", "app"), avviso("3", "lo dice il notch", "clotch"), avviso("4", "senza detto_da", null));
  const dopo = daLeggere(r, prima.visti);
  assert.deepEqual(dopo.testi, ["Serve il tuo sì", "senza detto_da"]);
  assert.deepEqual(daLeggere(r, dopo.visti).testi, []); // una volta sola
});

test("Non disturbare acceso: l'app non legge niente, e gli avvisi non tornano dopo", () => {
  const r: Registro = { ...vuoto(), avvisi: [], nonDisturbare: { fino: null, tenuti: 0 } };
  const v = daLeggere(r, null).visti;
  r.avvisi.push(avviso("1", "zitto", "app"));
  assert.deepEqual(daLeggere(r, v).testi, []);
});

test("evento clotch: la versione passa se c'è (#344), null se manca", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "registro-"));
  const riga = (id: string, dati: object) => JSON.stringify({ v: 1, id, t: "2026-10-23T10:05:00.000Z", chat: "friday", tipo: "clotch", dati });
  fs.writeFileSync(path.join(d, "2026-10.jsonl"), riga("a", { voce: "accesa", versione: "2.4.1" }) + "\n");
  assert.equal(leggiRegistro(d, { FRIDAY_REGISTRO: d }).clotch?.versione, "2.4.1");
  fs.writeFileSync(path.join(d, "2026-10.jsonl"), riga("b", { voce: "accesa" }) + "\n");
  assert.equal(leggiRegistro(d, { FRIDAY_REGISTRO: d }).clotch?.versione, null);
});


test("prova silenziosa: un avviso pronto non avvia say", (t) => {
  const prima = process.env.CLOTCH_TEST_SILENT;
  t.after(() => {
    if (prima === undefined) delete process.env.CLOTCH_TEST_SILENT;
    else process.env.CLOTCH_TEST_SILENT = prima;
  });
  const spy = t.mock.method(childProcess, "execFile", () => {
    throw new Error("Audio di sistema vietato durante la prova");
  });
  process.env.CLOTCH_TEST_SILENT = "1";
  const r: Registro = { ...vuoto(), avvisi: [avviso("silent", "Sentinella della prova", "app")] };
  const pronti = daLeggere(r, new Set());
  assert.deepEqual(pronti.testi, ["Sentinella della prova"]);
  pronti.testi.forEach(leggi);
  leggi("Anche la chiamata diretta resta muta");
  assert.equal(spy.mock.callCount(), 0);
  console.log("SILENT_AUDIO_NO_SPAWN_OK calls=0");
});

test("voce normale: say riceve il testo, con esecutore sempre sostituito", { skip: process.platform !== "darwin" }, (t) => {
  const prima = process.env.CLOTCH_TEST_SILENT;
  t.after(() => {
    if (prima === undefined) delete process.env.CLOTCH_TEST_SILENT;
    else process.env.CLOTCH_TEST_SILENT = prima;
  });
  const spy = t.mock.method(childProcess, "execFile", () => ({} as ReturnType<typeof childProcess.execFile>));
  delete process.env.CLOTCH_TEST_SILENT;
  ["Controllo positivo senza audio"].forEach(leggi);
  assert.equal(spy.mock.callCount(), 1);
  assert.equal(spy.mock.calls[0].arguments[0], "say");
  assert.deepEqual(spy.mock.calls[0].arguments[1], ["Controllo positivo senza audio"]);
  assert.equal(typeof spy.mock.calls[0].arguments[2], "function");
  console.log("NORMAL_AUDIO_STUB_POSITIVE_OK calls=1");
});
