import { test } from "node:test";
import * as assert from "node:assert/strict";
import type { Messaggio } from "../src/tipi";
import { voci } from "../src/ui/chat/modello";
import { provaDi } from "../src/ui/chat/testi";

const st = (id: string, nome: string, ingresso: unknown, esito: string | null, errore = false, t = 1): Messaggio =>
  ({ tipo: "strumento", id, nome, ingresso, esito: esito == null ? null : { testo: esito, errore }, t });
const turno = (v: ReturnType<typeof voci>[number]) => (v.tipo === "turno" ? v.blocchi : []);

test("bloccato da una regola: la riga resta normale, l'avviso senza il nome dell'hook (101:15790)", () => {
  const v = voci([{ tipo: "utente", testo: "Spedisci", t: 0 }, st("t1", "Bash", { command: "git push origin main" }, "PreToolUse:Bash hook error: git push su main non è permesso.", true)], true);
  const b = turno(v[1]);
  assert.equal(b[0].tipo === "strumento" && b[0].etichetta, "Comando");
  assert.deepEqual(b[1], { tipo: "bloccato", id: "t1", testo: "git push su main non è permesso." });
});

test("turno finito: le modifiche diventano «File toccati» prima della risposta", () => {
  const ed = (id: string, f: string) => st(id, "Edit", { file_path: f, old_string: "a", new_string: "b\nc" }, "ok");
  const v = voci([{ tipo: "utente", testo: "x", t: 0 }, ed("e1", "a.ts"), ed("e2", "a.ts"), ed("e3", "b.ts"), { tipo: "assistente", testo: "fatto", modello: null, t: 2 }], false);
  const b = turno(v[1]);
  assert.deepEqual(b.map((x) => x.tipo), ["file-toccati", "risposta"]);
  assert.deepEqual(b[0].tipo === "file-toccati" && b[0].file, [{ file: "a.ts", aggiunte: 4, tolte: 2 }, { file: "b.ts", aggiunte: 2, tolte: 1 }]);
});

test("stato di prova: chiavi con e senza valore", () => {
  assert.equal(provaDi("scritta:Ciao: tu|aperti:pensiero", "scritta"), "Ciao: tu");
  assert.equal(provaDi("modifica", "modifica"), "");
  assert.equal(provaDi("modificata", "modifica"), null);
  assert.equal(provaDi(null, "aperti"), null);
});

const fisiche = (messaggi: Messaggio[], chiavi: string[], prima: ReturnType<typeof voci> = [], sessione = "A", vivo = true) =>
  voci(messaggi, vivo, "", chiavi.map((chiave) => ({ chiave })), prima, sessione);
const primoTurno = (v: ReturnType<typeof voci>) => {
  const t = v.find((x) => x.tipo === "turno");
  if (!t || t.tipo !== "turno") throw new Error("Turno mancante");
  return t;
};

test("turno parziale: prepend dentro lo stesso turno mantiene turno e blocco già montati", () => {
  const tool = st("riutilizzato", "Bash", { command: "pwd" }, null);
  const prima = fisiche([tool], ["ep:100:0"]);
  const dopo = fisiche([{ tipo: "pensiero", testo: "prima", t: null }, tool], ["ep:0:0", "ep:100:0"], prima);
  assert.equal(primoTurno(dopo).chiave, primoTurno(prima).chiave);
  assert.equal(primoTurno(dopo).blocchi[1].chiave, primoTurno(prima).blocchi[0].chiave);
  assert.notEqual(primoTurno(dopo).blocchi[0].chiave, primoTurno(dopo).blocchi[1].chiave);
  console.log("PARTIAL_TURN_KEY_STABLE_OK");
});

test("append e risposta streaming non usano ultimo messaggio come chiave del turno", () => {
  const tool = st("t", "Bash", { command: "pwd" }, null);
  const risposta: Messaggio = { tipo: "assistente", testo: "Inizio", modello: null, t: null };
  const prima = fisiche([tool], ["e:0"]);
  const secondo = fisiche([tool, risposta], ["e:0", "e:1"], prima);
  const completo = fisiche([st("t", "Bash", { command: "pwd" }, "ok"), { ...risposta, testo: "Inizio e fine" }], ["e:0", "e:1"], secondo);
  assert.equal(primoTurno(completo).chiave, primoTurno(prima).chiave);
  assert.deepEqual(primoTurno(completo).blocchi.map((b) => b.chiave), primoTurno(secondo).blocchi.map((b) => b.chiave));
});

test("ID nativo riutilizzato e payload uguali mantengono chiavi fisiche distinte", () => {
  const t = st("stesso", "Bash", { command: "pwd" }, null);
  const v = fisiche([t, t, { tipo: "assistente", testo: "uguale", modello: null, t: null }, { tipo: "assistente", testo: "uguale", modello: null, t: null }], ["e:0", "e:1", "e:2", "e:3"]);
  const chiavi = primoTurno(v).blocchi.map((b) => b.chiave);
  assert.ok(chiavi.every(Boolean));
  assert.equal(new Set(chiavi).size, 4);
});

test("gruppi aiutanti e attività preservano identità quando arriva storia precedente", () => {
  for (const nome of ["Agent", "TodoWrite"]) {
    const ingresso = nome === "Agent" ? { description: "Controllo" } : { todos: [{ content: "Controllo", status: "in_progress" }] };
    const t = st("stesso", nome, ingresso, null);
    const prima = fisiche([t], ["e:100"]);
    const dopo = fisiche([t, t], ["e:0", "e:100"], prima);
    assert.equal(primoTurno(dopo).chiave, primoTurno(prima).chiave);
    assert.equal(primoTurno(dopo).blocchi[0].chiave, primoTurno(prima).blocchi[0].chiave);
    assert.equal(primoTurno(dopo).blocchi[0].origini?.length, 2);
    const b = primoTurno(dopo).blocchi[0];
    if (b.tipo === "aiutanti") assert.equal(new Set(b.aiutanti.map((a) => a.id)).size, 2);
  }
});

test("file aggregati: prepend e append non cambiano chiave del gruppo già montato", () => {
  const edit = st("e", "Edit", { file_path: "a.ts", old_string: "a", new_string: "b" }, "ok");
  const prima = fisiche([edit], ["ep:100"], [], "A", false);
  const dopo = fisiche([edit, edit, edit], ["ep:0", "ep:100", "ep:200"], prima, "A", false);
  assert.equal(primoTurno(dopo).blocchi[0].tipo, "file-toccati");
  assert.equal(primoTurno(dopo).blocchi[0].chiave, primoTurno(prima).blocchi[0].chiave);
});

test("chat diverse e nuova epoca non ereditano identità dei componenti", () => {
  const t = st("stesso", "Bash", { command: "pwd" }, null);
  const prima = fisiche([t], ["ep:0"]);
  for (const dopo of [fisiche([t], ["ep:0"], prima, "B"), fisiche([t], ["nuova:0"], prima)]) {
    assert.notEqual(primoTurno(dopo).chiave, primoTurno(prima).chiave);
    assert.notEqual(primoTurno(dopo).blocchi[0].chiave, primoTurno(prima).blocchi[0].chiave);
  }
});

test("riconciliazione conserva tutti i turni già presenti senza duplicare le chiavi", () => {
  const u: Messaggio = { tipo: "utente", testo: "uguale", t: null }, t = st("stesso", "Bash", { command: "pwd" }, null);
  const prima = fisiche([t, u, t], ["ep:100", "ep:101", "ep:102"]);
  const dopo = fisiche([u, t, t, u, t], ["ep:0", "ep:1", "ep:100", "ep:101", "ep:102"], prima);
  const a = prima.filter((v) => v.tipo === "turno"), b = dopo.filter((v) => v.tipo === "turno");
  assert.deepEqual(b.map((v) => v.chiave), a.map((v) => v.chiave));
  assert.equal(new Set(dopo.map((v) => v.chiave)).size, dopo.length);
  console.log("PHYSICAL_BLOCK_AND_SESSION_KEYS_OK");
});


test("riconciliazione non muta il modello precedente e conserva blocchi diversi durante inserimento", () => {
  const tool = st("t", "Bash", { command: "pwd" }, null);
  const prima = fisiche([tool], ["e:100"]), congelato = structuredClone(prima);
  const dopo = fisiche([{ tipo: "errore", testo: "prima", t: null }, tool], ["e:0", "e:100"], prima);
  assert.deepEqual(prima, congelato);
  assert.equal(primoTurno(dopo).blocchi[1].chiave, primoTurno(prima).blocchi[0].chiave);
});

test("domanda: multiSelect, header e descrizione delle opzioni arrivano al filo", () => {
  const q = { question: "Quali schermate?", header: "Schermate", multiSelect: true, options: [{ label: "Barra", description: "La barra laterale" }, { label: "Chat" }] };
  const b = turno(voci([{ tipo: "utente", testo: "x", t: 0 }, st("q1", "AskUserQuestion", { questions: [q] }, null)], true)[1]);
  assert.deepEqual(b[0].tipo === "domanda" && b[0].domande, [{ domanda: "Quali schermate?", opzioni: ["Barra", "Chat"], descrizioni: ["La barra laterale", ""], header: "Schermate", multi: true }]);
});
