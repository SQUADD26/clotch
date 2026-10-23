import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import assert from "node:assert/strict";
import { leggiRegistro, type Registro } from "../src/friday";
import { daLeggere } from "../src/voce-app";

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
