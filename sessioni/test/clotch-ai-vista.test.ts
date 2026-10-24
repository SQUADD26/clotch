import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro } from "../src/clotch-ai";
import { piano } from "../src/clotch-ai-ipc";
import { daPiano } from "../src/ui/clotch-ai/registro";
import { casella, decisioniPerGiorno, regolePerDove, sessioniAlLavoro, statoClotchAi } from "../src/ui/clotch-ai/vista";

const MOTORE = "friday"; // nome del protocollo del motore
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
  assert.deepEqual(cl.obiettivo, { testo: "App Sessioni pari al disegno", fatti: 1, passi: [{ testo: "Disegno", stato: "completed" }, { testo: "Barra", stato: "in_progress" }], lavora: true });
  assert.deepEqual(cl.aspettano.map((a) => [a.titolo, a.genere]), [["Sessioni: disegno", "Permesso"], ["Figma: schermate", "Domanda"]]);
  assert.deepEqual([cl.alLavoro, cl.fattoOggi, c.aspettano, c.alLavoro], [1, 1, 2, 1]);
  assert.deepEqual(c.proposti, [{ chat: "s1", progetto: "squadd-v2", testo: "Policy RLS" }]);
  assert.equal(sessioniAlLavoro(r), 1);
});

test("vista: clotch AI attiva, spenta, in pausa con Non disturbare e avvisi tenuti", () => {
  assert.equal(statoClotchAi(registro([[1, MOTORE, "battito", { stato: "lavora" }]]), ORA).stato, "attiva");
  assert.deepEqual(statoClotchAi(registro([[10, MOTORE, MOTORE, { evento: "stop" }]]), ORA), { stato: "spenta", da: ORA - 600_000 });
  assert.equal(statoClotchAi(registro([]), ORA).stato, "spenta");
  const r = registro([
    [30, MOTORE, "non_disturbare", { acceso: true, fino: min(-30), tenuti: 2 }],
    [1, MOTORE, "battito", { stato: "lavora" }],
  ]);
  assert.deepEqual(statoClotchAi(r, ORA), { stato: "pausa", da: ORA + 30 * 60_000 });
  assert.equal(r.nonDisturbare?.tenuti, 2);
  assert.equal(statoClotchAi(r, ORA + 31 * 60_000).stato, "spenta"); // nessun battito da 31 minuti
  const sempre = registro([[5, MOTORE, "non_disturbare", { acceso: true, fino: null, tenuti: 0 }], [1, MOTORE, "battito", { stato: "lavora" }]]);
  assert.deepEqual(statoClotchAi(sempre, ORA), { stato: "pausa", da: null });
  const tolto = registro([[5, MOTORE, "non_disturbare", { acceso: true, fino: null, tenuti: 0 }], [2, MOTORE, "non_disturbare", { acceso: false, fino: null, tenuti: 0 }], [1, MOTORE, "battito", { stato: "lavora" }]]);
  assert.equal(statoClotchAi(tolto, ORA).stato, "attiva");
});

test("vista: decisioni per giorno, annullate e non annullabili; regole per dove con togli", () => {
  const r = registro([
    [26 * 60, MOTORE, "decisione", { cosa: "Archiviate 4 sessioni", perche: "", inverso: ["friday", "x"] }], // nome del protocollo del motore
    [60, MOTORE, "decisione", { cosa: "Promosso dev a main", perche: "", inverso: null, chat: "m1", genere: "promozione", non_annullabile: "Già su main" }],
    [30, MOTORE, "decisione", { cosa: "Consentita la migrazione", perche: "", inverso: ["a"] }],
    [10, MOTORE, "decisione", { cosa: "annullata r-000000000002", perche: "", inverso: null }],
    [50, MOTORE, "regola", { testo: "Parla chiaro", perche: "", dove: "claude-config", togli: false }],
    [40, MOTORE, "regola", { testo: "Via", perche: "", dove: "claude-config", togli: false }],
    [35, MOTORE, "regola", { testo: "Figma prima", perche: "", dove: "/r/clotch", togli: false }],
    [30, MOTORE, "regola", { testo: "Più nuova", perche: "", dove: "claude-config", togli: false }],
    [20, MOTORE, "regola", { testo: "Via", perche: "", dove: "claude-config", togli: true }],
  ]);
  const g = decisioniPerGiorno(r, ORA);
  assert.deepEqual(g[0].voci[1].chat, "m1");
  assert.deepEqual([g[0].voci[1].genere, g[0].voci[1].nonAnnullabile, g[1].voci[0].genere], ["promozione", "Già su main", "altro"]);
  assert.deepEqual(g.map((x) => [x.titolo, x.voci.map((v) => [v.cosa, v.annullabile])]), [
    ["Oggi", [["Consentita la migrazione", false], ["Promosso dev a main", false]]],
    ["Ieri", [["Archiviate 4 sessioni", false]]],
  ]);
  assert.deepEqual(regolePerDove(r).map((x) => [x.dove, x.regole.map((y) => y.testo)]), [["claude-config", ["Più nuova", "Parla chiaro"]], ["/r/clotch", ["Figma prima"]]]);
});

test("vista: il registro passa il ponte del preload senza Map e torna uguale", () => {
  const r = registro([
    [5, "m1", "inizio", { titolo: "T", madre: "", progetto: "clotch" }],
    [4, "m1", "aiutante", { agente: "a1", fase: "inizio", tipo: "worker", modello: "x", testo: "t", esito: "" }],
    [3, MOTORE, "comando_fatto", { comando: "c-1", esito: "ok", testo: "" }],
  ]);
  const passato = structuredClone(piano(r)); // come il ponte: niente Map, niente classi
  assert.deepEqual(daPiano(passato), r);
});

test("registro: l'ultimo evento impostazioni resta in Registro.impostazioni", () => {
  const r = registro([
    [5, MOTORE, "impostazioni", { attiva: true, voce: "Alice", microfoni_disponibili: ["AirPods"] }],
    [2, MOTORE, "impostazioni", { attiva: true, voce: "Luca", microfoni_disponibili: ["AirPods", "Mac"] }],
  ]);
  assert.deepEqual(r.impostazioni, { attiva: true, voce: "Luca", microfoni_disponibili: ["AirPods", "Mac"] });
  assert.deepEqual(daPiano(structuredClone(piano(r))).impostazioni, r.impostazioni);
});
