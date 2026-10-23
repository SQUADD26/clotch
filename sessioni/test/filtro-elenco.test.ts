import test from "node:test";
import assert from "node:assert/strict";
import { FIXTURES } from "./aiuti";
import { leggiElenco } from "../src/elenco";
import { filtraElenco } from "../src/filtro-elenco";
import { Osservatore } from "../src/osserva";
import { percorsiAccount } from "../src/account-percorsi";
import type { Elenco, Sessione } from "../src/tipi";

const HOME = "/Users/x";
const ORA = Date.parse("2026-10-22T00:00:00Z");
const GIORNO = 86_400_000;
const s = (id: string, o: Partial<Sessione>): Sessione => ({
  id, sorgente: "claude-code", account: ".claude", email: null, idApp: null, titolo: id, progetto: "", cartella: "/Users/x/app", ramo: null, modello: null,
  stato: "ferma", perche: null, ultimaAttivita: ORA, obiettivo: null, situazione: null, file: "", ...o,
});
const elenco = (...sessioni: Sessione[]): Elenco => ({ sessioni, errori: [] });
const ids = (e: Elenco) => e.sessioni.map((x) => x.id);

test("sorgenti: una spenta non compare; Cursor parte spento, gli altri accesi", () => {
  const e = elenco(s("cc", {}), s("app", { sorgente: "claude-desktop" }), s("cx", { sorgente: "codex" }), s("cu", { sorgente: "cursor" }));
  assert.deepEqual(ids(filtraElenco(e, {}, ORA, HOME)), ["cc", "app", "cx"]);
  assert.deepEqual(ids(filtraElenco(e, { sorgenteCursor: true, sorgenteCodex: false, sorgenteClaude: false }, ORA, HOME)), ["cc", "cu"]);
  assert.deepEqual(ids(filtraElenco(e, { sorgenteClaudeCode: false }, ORA, HOME)), ["app", "cx"]);
});

test("cartelle escluse: dentro la cartella (anche con ~) non compare; una cartella con lo stesso prefisso nel nome sì", () => {
  const e = elenco(s("a", { cartella: "/Users/x/app" }), s("b", { cartella: "/Users/x/app/sotto" }), s("c", { cartella: "/Users/x/app2" }), s("d", { cartella: "" }));
  assert.deepEqual(ids(filtraElenco(e, { cartelleEscluse: ["~/app"] }, ORA, HOME)), ["c", "d"]);
  assert.deepEqual(ids(filtraElenco(e, { cartelleEscluse: ["/Users/x/app/"] }, ORA, HOME)), ["c", "d"]);
});

test("cronologia: le finite più vecchie spariscono, quelle in corso o in attesa restano, «Per sempre» tiene tutto", () => {
  const vecchia = ORA - 40 * GIORNO;
  const e = elenco(s("nuova", { ultimaAttivita: ORA - 2 * GIORNO }), s("ferma", { ultimaAttivita: vecchia }), s("finita", { stato: "finita", ultimaAttivita: vecchia }),
    s("lavora", { stato: "lavora", ultimaAttivita: vecchia }), s("aspetta", { stato: "aspetta", ultimaAttivita: vecchia }));
  assert.deepEqual(ids(filtraElenco(e, {}, ORA, HOME)), ["nuova", "lavora", "aspetta"]); // partenza: 30 giorni
  assert.deepEqual(ids(filtraElenco(e, { cronologia: "7 giorni" }, ORA, HOME)), ["nuova", "lavora", "aspetta"]);
  assert.deepEqual(ids(filtraElenco(elenco(s("x", { ultimaAttivita: ORA - 10 * GIORNO })), { cronologia: "7 giorni" }, ORA, HOME)), []);
  assert.deepEqual(ids(filtraElenco(e, { cronologia: "90 giorni" }, ORA, HOME)), ids(e));
  assert.deepEqual(ids(filtraElenco(e, { cronologia: "Per sempre" }, ORA, HOME)), ids(e));
});

test("account: trovate + aggiunte - tolte, una sola volta", () => {
  assert.deepEqual(percorsiAccount(["~/.claude", "~/.claude-a"], ["~/.claude-a", "~/.claude-b"], ["~/.claude"]), ["~/.claude-a", "~/.claude-b"]);
});

test("leggiElenco con le impostazioni: account tolto, sorgente spenta e cartella esclusa spariscono; senza impostazioni resta tutto", () => {
  const tutto = leggiElenco({ home: FIXTURES, env: {}, ora: ORA });
  assert.equal(tutto.sessioni.length, 5);
  const imp = (i: Record<string, unknown>) => ids(leggiElenco({ home: FIXTURES, env: {}, ora: ORA, impostazioni: { cronologia: "Per sempre", ...i } }));
  assert.ok(!imp({ accountTolti: ["~/.claude"] }).includes("aaaaaaaa-0000-4000-8000-000000000001"));
  assert.ok(imp({ accountTolti: ["~/.claude-roberto"] }).includes("aaaaaaaa-0000-4000-8000-000000000001"));
  assert.ok(!imp({ sorgenteCodex: false }).includes("cccccccc-0000-4000-8000-000000000003"));
  assert.ok(imp({}).length === 4 && !imp({}).some((x) => x.startsWith("dddddddd"))); // Cursor parte spento
  assert.equal(imp({ sorgenteCursor: true }).length, 5);
  assert.ok(!imp({ cartelleEscluse: ["/Users/x/app"] }).includes("aaaaaaaa-0000-4000-8000-000000000001"));
});

test("dal vivo: cambiando le impostazioni l'osservatore rifà l'elenco e avvisa anche delle sessioni sparite", () => {
  let imp: Record<string, unknown> = { cronologia: "Per sempre", sorgenteCursor: true };
  const arrivi: string[][] = [];
  const o = new Osservatore(FIXTURES, (a) => arrivi.push(a.sessioni), {}, 20, () => imp);
  assert.equal(o.elenco.sessioni.length, 5);
  imp = { ...imp, sorgenteCodex: false, sorgenteCursor: false };
  o.giro();
  assert.equal(o.elenco.sessioni.length, 3);
  assert.ok(arrivi[0].includes("cccccccc-0000-4000-8000-000000000003") && arrivi[0].includes("dddddddd-0000-4000-8000-000000000004"));
  o.ferma();
});
