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
