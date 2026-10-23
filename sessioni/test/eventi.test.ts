// Righe del filo che non sono messaggi (101:28652): ramo creato, cambio di giorno.
import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { Messaggio } from "../src/tipi";
import { giorniDelFilo, ramoCreato } from "../src/ui/chat/eventi";
import { voci } from "../src/ui/chat/modello";

const ORA = new Date(2026, 9, 23, 15, 0).getTime(), ORE = 3_600_000, GIORNO = 24 * ORE;
const bash = (id: string, command: string, esito: string, errore = false, t = 1): Messaggio =>
  ({ tipo: "strumento", id, nome: "Bash", ingresso: { command }, esito: { testo: esito, errore }, t });

test("ramo creato: checkout -b, switch -c e worktree add -b; il resto no", () => {
  assert.equal(ramoCreato("git checkout -b design/332-sessioni-figma"), "design/332-sessioni-figma");
  assert.equal(ramoCreato("cd x && git -C /tmp/r switch -c feat/1-a && ls"), "feat/1-a");
  assert.equal(ramoCreato("git worktree add ../wt -b fix/2-b origin/dev"), "fix/2-b");
  assert.equal(ramoCreato("git checkout main"), null);
  assert.equal(ramoCreato("git branch -D vecchio"), null);
});

test("un ramo creato chiude il turno: la riga evento prende il posto del comando", () => {
  const v = voci([
    { tipo: "utente", testo: "Parti", t: 0 }, { tipo: "assistente", testo: "Ok", modello: null, t: 1 },
    bash("b1", "git checkout -b feat/1-x", "Switched to a new branch 'feat/1-x'", false, 2),
    { tipo: "assistente", testo: "Fatto", modello: null, t: 3 },
  ], false);
  assert.deepEqual(v.map((x) => x.tipo), ["roberto", "turno", "evento", "turno"]);
  assert.equal(v[2].tipo === "evento" && v[2].testo, "Ramo creato: feat/1-x");
});

test("un comando di ramo non riuscito resta una riga normale", () => {
  const v = voci([{ tipo: "utente", testo: "Parti", t: 0 }, bash("b1", "git checkout -b feat/1-x", "fatal: a branch named 'feat/1-x' already exists", true)], false);
  assert.deepEqual(v.map((x) => x.tipo), ["roberto", "turno"]);
});

test("giorni del filo: «Ieri» in cima se non è oggi, «Oggi» dove il giorno cambia, niente dentro lo stesso giorno", () => {
  const u = (t: number) => ({ tipo: "roberto" as const, chiave: String(t), testo: "x", t });
  assert.deepEqual(giorniDelFilo([u(ORA - GIORNO), u(ORA - GIORNO + ORE), u(ORA - ORE)], ORA), ["Ieri", null, "Oggi"]);
  assert.deepEqual(giorniDelFilo([u(ORA - ORE), u(ORA - 1000)], ORA), [null, null]);
  assert.deepEqual(giorniDelFilo([{ tipo: "riassunto", chiave: "r" }, u(ORA - ORE)], ORA), [null, null]);
});
