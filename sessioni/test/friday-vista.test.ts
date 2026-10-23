import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro } from "../src/friday";
import { piano } from "../src/friday-ipc";
import { daPiano } from "../src/ui/friday/registro";
import { casella, decisioniPerGiorno, regolePerDove, sessioniAlLavoro, statoFriday } from "../src/ui/friday/vista";

const ORA = Date.parse("2026-10-23T14:00:00.000Z");
const min = (m: number) => new Date(ORA - m * 60_000).toISOString();

/** Scrive un registro nella forma del contratto v1 e lo legge col lettore vero. */
function registro(righe: [number, string, string, object][]) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "vista-"));
  const dir = path.join(h, ".claude", "registro");
  fs.mkdirSync(dir, { recursive: true });
  const n = new Map<string, number>();
  fs.writeFileSync(path.join(dir, "2026-10.jsonl"), righe.map(([m, chat, tipo, dati], i) => {
    n.set(chat, (n.get(chat) ?? 0) + 1);
    return JSON.stringify({ v: 1, id: `r-${String(i).padStart(12, "0")}`, t: min(m), n: n.get(chat), chat, macchina: "mac", hook_v: "x", tipo, dati });
  }).join("\n") + "\n");
  return leggiRegistro(h);
}

test("vista: casella per progetto con obiettivo, passi, chi aspetta, al lavoro, fatto oggi e obiettivo proposto", () => {
  const r = registro([
    [30, "m1", "inizio", { titolo: "Clotch: sessioni", madre: "", progetto: "clotch" }],
    [29, "m1", "obiettivo", { stato: "aperto", testo: "App Sessioni pari al disegno", versione: 1 }],
    [28, "m1", "passi", { agente: "", passi: [{ testo: "Disegno", stato: "completed" }, { testo: "Barra", stato: "in_progress" }, { testo: "Via", stato: "pending", tolto: true }] }],
    [28, "m1", "battito", { stato: "lavora" }],
    [20, "f1", "inizio", { titolo: "Sessioni: disegno", madre: "m1", progetto: "clotch" }],
    [19, "f1", "richiesta", { genere: "permesso", rid: "q1", strumento: "Bash", ingresso: {}, domande: [] }],
    [18, "f2", "inizio", { titolo: "Figma: schermate", madre: "m1", progetto: "clotch" }],
    [17, "f2", "stato", { stato: "serve_roberto", domanda: "dove?" }],
    [16, "f3", "inizio", { titolo: "Notch", madre: "m1", progetto: "clotch" }],
    [15, "f3", "stato", { stato: "finito", prova: "abc" }],
    [14, "s1", "inizio", { titolo: "Backend", madre: "", progetto: "squadd-v2" }],
    [13, "s1", "obiettivo", { stato: "proposto", testo: "Policy RLS", versione: 1 }],
  ]);
  const c = casella(r, ORA);
  assert.deepEqual(c.progetti.map((p) => p.nome), ["clotch", "squadd-v2"]);
  const [cl] = c.progetti;
  assert.deepEqual(cl.obiettivo, { testo: "App Sessioni pari al disegno", fatti: 1, passi: [{ testo: "Disegno", stato: "completed" }, { testo: "Barra", stato: "in_progress" }] });
  assert.deepEqual(cl.aspettano.map((a) => [a.titolo, a.genere]), [["Sessioni: disegno", "Permesso"], ["Figma: schermate", "Domanda"]]);
  assert.deepEqual([cl.alLavoro, cl.fattoOggi, c.aspettano, c.alLavoro], [1, 1, 2, 1]);
  assert.deepEqual(c.proposti, [{ chat: "s1", progetto: "squadd-v2", testo: "Policy RLS" }]);
  assert.equal(sessioniAlLavoro(r), 1);
});

test("vista: Friday attiva, spenta, in pausa con Non disturbare e avvisi tenuti", () => {
  assert.equal(statoFriday(registro([[1, "friday", "battito", { stato: "lavora" }]]), ORA).stato, "attiva");
  assert.deepEqual(statoFriday(registro([[10, "friday", "friday", { evento: "stop" }]]), ORA), { stato: "spenta", da: ORA - 600_000 });
  assert.equal(statoFriday(registro([]), ORA).stato, "spenta");
  const r = registro([
    [30, "friday", "non_disturbare", { acceso: true, fino: min(-30), tenuti: 2 }],
    [1, "friday", "battito", { stato: "lavora" }],
  ]);
  assert.deepEqual(statoFriday(r, ORA), { stato: "pausa", da: ORA + 30 * 60_000 });
  assert.equal(r.nonDisturbare?.tenuti, 2);
  assert.equal(statoFriday(r, ORA + 31 * 60_000).stato, "spenta"); // nessun battito da 31 minuti
  const sempre = registro([[5, "friday", "non_disturbare", { acceso: true, fino: null, tenuti: 0 }], [1, "friday", "battito", { stato: "lavora" }]]);
  assert.deepEqual(statoFriday(sempre, ORA), { stato: "pausa", da: null });
  const tolto = registro([[5, "friday", "non_disturbare", { acceso: true, fino: null, tenuti: 0 }], [2, "friday", "non_disturbare", { acceso: false, fino: null, tenuti: 0 }], [1, "friday", "battito", { stato: "lavora" }]]);
  assert.equal(statoFriday(tolto, ORA).stato, "attiva");
});

test("vista: decisioni per giorno, annullate e non annullabili; regole per dove con togli", () => {
  const r = registro([
    [26 * 60, "friday", "decisione", { cosa: "Archiviate 4 sessioni", perche: "", inverso: ["friday", "x"] }],
    [60, "friday", "decisione", { cosa: "Promosso dev a main", perche: "", inverso: null, chat: "m1", genere: "promozione", non_annullabile: "Già su main" }],
    [30, "friday", "decisione", { cosa: "Consentita la migrazione", perche: "", inverso: ["a"] }],
    [10, "friday", "decisione", { cosa: "annullata r-000000000002", perche: "", inverso: null }],
    [50, "friday", "regola", { testo: "Parla chiaro", perche: "", dove: "claude-config", togli: false }],
    [40, "friday", "regola", { testo: "Via", perche: "", dove: "claude-config", togli: false }],
    [35, "friday", "regola", { testo: "Figma prima", perche: "", dove: "/r/clotch", togli: false }],
    [20, "friday", "regola", { testo: "Via", perche: "", dove: "claude-config", togli: true }],
  ]);
  const g = decisioniPerGiorno(r, ORA);
  assert.deepEqual(g[0].voci[1].chat, "m1");
  assert.deepEqual([g[0].voci[1].genere, g[0].voci[1].nonAnnullabile, g[1].voci[0].genere], ["promozione", "Già su main", "altro"]);
  assert.deepEqual(g.map((x) => [x.titolo, x.voci.map((v) => [v.cosa, v.annullabile])]), [
    ["Oggi", [["Consentita la migrazione", false], ["Promosso dev a main", false]]],
    ["Ieri", [["Archiviate 4 sessioni", true]]],
  ]);
  assert.deepEqual(regolePerDove(r).map((x) => [x.dove, x.regole.map((y) => y.testo)]), [["claude-config", ["Parla chiaro"]], ["/r/clotch", ["Figma prima"]]]);
});

test("vista: il registro passa il ponte del preload senza Map e torna uguale", () => {
  const r = registro([
    [5, "m1", "inizio", { titolo: "T", madre: "", progetto: "clotch" }],
    [4, "m1", "aiutante", { agente: "a1", fase: "inizio", tipo: "worker", modello: "x", testo: "t", esito: "" }],
    [3, "friday", "comando_fatto", { comando: "c-1", esito: "ok", testo: "" }],
  ]);
  const passato = structuredClone(piano(r)); // come il ponte: niente Map, niente classi
  assert.deepEqual(daPiano(passato), r);
});
