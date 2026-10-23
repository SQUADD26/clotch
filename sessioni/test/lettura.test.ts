import test from "node:test";
import assert from "node:assert/strict";
import { FIXTURES, istantanea } from "./aiuti";
import { leggiElenco } from "../src/elenco";
import { leggiPagina } from "../src/messaggi";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const ORA = Date.parse("2026-10-22T00:00:00Z");

test("più radici ~/.claude-*: compaiono tutte con l'account giusto", () => {
  const e = leggiElenco({ home: FIXTURES, env: {}, ora: ORA });
  assert.deepEqual(e.errori, []);
  const a = e.sessioni.find((s) => s.id === A)!;
  const b = e.sessioni.find((s) => s.id === B)!;
  assert.equal(a.account, ".claude");
  assert.equal(b.account, ".claude-roberto");
  assert.equal(b.email, "roberto@example.test");
});

test("sessione Claude Code: titolo, cartella, ramo, modello, obiettivo con prove, stato dal registro", () => {
  const a = leggiElenco({ home: FIXTURES, env: {}, ora: ORA }).sessioni.find((s) => s.id === A)!;
  assert.equal(a.sorgente, "claude-code");
  assert.equal(a.titolo, "Prova uno");
  assert.equal(a.progetto, "app");
  assert.equal(a.cartella, "/Users/x/app");
  assert.equal(a.ramo, "feat/uno");
  assert.equal(a.modello, "claude-opus-5");
  assert.equal(a.stato, "aspetta");
  assert.equal(a.perche, "Chiede quale ramo usare");
  assert.equal(a.obiettivo?.testo, "Chiudere la prova");
  assert.deepEqual(a.obiettivo?.prove.map((p) => p.fatta), [true, false]);
});

test("app Claude desktop: la sessione prende titolo e id app; archiviata = finita; senza trascrizione compare lo stesso", () => {
  const e = leggiElenco({ home: FIXTURES, env: {}, ora: ORA });
  const b = e.sessioni.find((s) => s.id === B)!;
  assert.equal(b.sorgente, "claude-desktop");
  assert.equal(b.idApp, "local_22222222-bbbb");
  assert.equal(b.titolo, "Titolo dall'app");
  assert.equal(b.stato, "finita");
  const solo = e.sessioni.find((s) => s.idApp === "local_33333333-cccc")!;
  assert.equal(solo.stato, "lavora");
  assert.equal(leggiPagina(solo, 0).errore, "trascrizione non trovata sul disco");
});

test("Codex e Cursor; il sottoagente Cursor è piegato nel padre", () => {
  const e = leggiElenco({ home: FIXTURES, env: {}, ora: ORA });
  const c = e.sessioni.find((s) => s.sorgente === "codex")!;
  assert.deepEqual([c.cartella, c.ramo, c.modello, c.titolo], ["/Users/x/codexproj", "dev", "gpt-5-codex", "Ripara il test"]);
  const cur = e.sessioni.filter((s) => s.sorgente === "cursor");
  assert.equal(cur.length, 1);
  assert.equal(cur[0].titolo, "Cambia il colore");
});

test("messaggi Claude: utente, pensiero, testo, chiamata con esito di errore; riga rotta saltata", () => {
  const s = leggiElenco({ home: FIXTURES, env: {}, ora: ORA }).sessioni.find((x) => x.id === A)!;
  const p = leggiPagina(s, 0);
  assert.deepEqual(p.messaggi.map((m) => m.tipo), ["utente", "pensiero", "assistente", "strumento", "assistente"]);
  const st = p.messaggi[3] as any;
  assert.deepEqual([st.nome, st.esito], ["Read", { testo: "nessun file", errore: true }]);
  assert.equal(p.haAltre, false);
});

test("messaggi Codex e Cursor", () => {
  const e = leggiElenco({ home: FIXTURES, env: {}, ora: ORA });
  const cx = leggiPagina(e.sessioni.find((s) => s.sorgente === "codex")!, 0).messaggi;
  assert.deepEqual(cx.map((m) => m.tipo), ["utente", "strumento", "assistente"]);
  assert.equal((cx[1] as any).esito.testo, "a.txt");
  const cu = leggiPagina(e.sessioni.find((s) => s.sorgente === "cursor")!, 0).messaggi;
  assert.deepEqual(cu.map((m) => m.tipo), ["utente", "assistente", "strumento"]);
  assert.equal((cu[0] as any).testo, "Cambia il colore");
});

test("sola lettura: leggere non cambia nessun file", () => {
  const prima = istantanea(FIXTURES);
  const e = leggiElenco({ home: FIXTURES, env: {}, ora: ORA });
  e.sessioni.forEach((s) => leggiPagina(s, 0));
  assert.deepEqual(istantanea(FIXTURES), prima);
});
