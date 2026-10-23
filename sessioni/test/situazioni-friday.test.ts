// Situazioni che arrivano dal registro di Friday (contratto v1). Righe del catalogo: test/situazioni.md, colonna «Friday».
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { clotchAcceso, leggeLApp, leggiRegistro, mandaComando, nonRisponde } from "../src/friday";

const DIR = path.join(__dirname, "..", "..", "test", "fixtures", "situazioni", "friday", "registro");
const reg = leggiRegistro("/non/esiste", { FRIDAY_REGISTRO: DIR });
const chat = (prefisso: string) => [...reg.chat.values()].find((c) => c.chat.startsWith(prefisso))!;

test("registro: righe rotte e di un'altra versione saltate, nessun errore", () => {
  assert.deepEqual(reg.errori, []);
  assert.equal(chat("ffffffff"), undefined);
});

for (const [p, stato] of [
  ["11111111", "lavora"], ["33333333", "aspetta"], ["44444444", "finito"], ["55555555", "serve_roberto"],
  ["66666666", "serve_madre"], ["77777777", "bloccato"], ["88888888", "ferma_limite"],
] as const) {
  test(`stato dichiarato «${stato}»`, () => assert.equal(chat(p).stato, stato));
}

test("aspetta: dice cosa aspetta; serve_roberto: porta la domanda", () => {
  assert.equal(chat("33333333").aspetto, "figlia 22222222-0000-4000-8000-000000000002");
  assert.match(chat("55555555").domanda!, /Consiglio/);
});

test("sessione figlia: inizio con la madre", () => assert.equal(chat("22222222").madre, "11111111-0000-4000-8000-000000000001"));
test("errore di un hook", () => assert.equal(chat("99999999").errore, "python3: file non trovato"));
test("chat chiusa", () => assert.equal(chat("aaaaaaaa").fine, "clear"));
test("chat fermata da sola", () => assert.equal(chat("bbbbbbbb").fermata, true));
test("chat in quarantena", () => assert.equal(chat("cccccccc").quarantena, "Due rifiuti uguali di fila"));
test("bloccata da una regola di stato", () => assert.equal(chat("dddddddd").rifiuto, "Manca la riga STATO"));
test("eventi persi: buco nella numerazione", () => assert.equal(chat("eeeeeeee").persi, 2));
test("ferma tutto acceso", () => assert.equal(reg.fermoTutto, true));
test("avviso di Friday", () => assert.deepEqual(reg.avvisi.map((a) => [a.livello, a.motivo]), [["alto", "blocco"], ["normale", "domanda"]]));

test("decisioni: annullabile, già annullata, senza inverso", () => {
  assert.deepEqual(reg.decisioni.map((d) => d.annullabile), [true, false, false]);
});

test("esito dei comandi: ok e rifiutato", () => {
  assert.equal(reg.esiti.get("c-000000000001")?.esito, "ok");
  assert.equal(reg.esiti.get("c-000000000002")?.esito, "rifiutato");
});

test("casella: un file per comando, nessun .tmp lasciato, nome sconosciuto rifiutato", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "casella-"));
  const id = mandaComando(home, "ferma_chat", { chat: "11111111-0000-4000-8000-000000000001" }, Date.parse("2026-10-23T10:00:00Z"));
  const dir = path.join(home, ".claude", "casella", "comandi");
  const file = fs.readdirSync(dir);
  assert.deepEqual(file, [`1792749600000-${id}.json`]);
  const c = JSON.parse(fs.readFileSync(path.join(dir, file[0]), "utf8"));
  assert.deepEqual([c.v, c.da, c.cmd, c.t], [1, "app", "ferma_chat", "2026-10-23T10:00:00.000Z"]);
  assert.match(c.id, /^c-[0-9a-f]{12}$/);
  assert.throws(() => mandaComando(home, "vola" as any));
});

const ORA = Date.parse("2026-10-23T10:10:00Z");

test("non risponde: lavora e nessun battito da 180 s", () => {
  assert.equal(nonRisponde(chat("14141414"), ORA), true);
  assert.equal(nonRisponde(chat("15151515"), ORA), false);
});

test("permesso, domanda e piano aperti; la domanda chiusa da Clotch sparisce", () => {
  const r = chat("16161616").richieste;
  assert.deepEqual(r.map((x) => [x.genere, x.rid]), [["permesso", "p1"], ["piano", "k1"]]);
  assert.equal(r[0].strumento, "Bash");
});

test("aiutanti: uno al lavoro, uno finito con l'esito", () => {
  const a = chat("17171717").aiutanti;
  assert.deepEqual([...a.values()].map((x) => [x.tipo, x.finito, x.esito]), [["Explore", false, null], ["worker", true, "Nessun errore"]]);
});

test("compattazione automatica e manuale", () => assert.equal(chat("18181818").compattazioni, 2));
test("interrotta da Roberto", () => assert.equal(chat("19191919").interrotta, "roberto"));
test("messaggi in coda", () => assert.deepEqual(chat("1a1a1a1a").coda, [{ voce: "v1", testo: "Controlla anche i titoli lunghi" }]));
test("obiettivo raggiunto", () => assert.deepEqual(chat("1b1b1b1b").obiettivo, { stato: "raggiunto", testo: "Chiudere la prova" }));
test("bloccata da un hook (push sul ramo sigillato)", () => assert.match(chat("1c1c1c1c").rifiuto!, /non è permesso/));

test("limite d'uso: account e ora di ripartenza", () => {
  assert.deepEqual(chat("88888888").limite, { account: ".claude-roberto", ripartenza: Date.parse("2026-10-23T16:00:00Z") });
});

test("handoff: la vecchia chiusa con la nuova, la nuova sa da dove viene; più account", () => {
  assert.deepEqual([chat("13131313").fine, chat("13131313").chatNuova], ["handoff", "12121212-0000-4000-8000-000000000012"]);
  const n = chat("12121212");
  assert.deepEqual([n.daHandoff, n.account, n.sorgente], ["13131313-0000-4000-8000-000000000013", ".claude-roberto", "app"]);
});

test("Clotch acceso: avviso detto da Clotch, l'app lo mostra e non lo legge", () => {
  assert.equal(clotchAcceso(reg, ORA), true);
  assert.equal(leggeLApp(reg.avvisi.find((x) => x.dettoDa === "clotch")!), false);
});

test("Clotch assente o fermo da più di 10 min: l'app legge gli avvisi", () => {
  assert.equal(clotchAcceso(reg, Date.parse("2026-10-23T10:16:00Z")), false);
  assert.equal(clotchAcceso(leggiRegistro("/non/esiste", { FRIDAY_REGISTRO: "/non/esiste" }), ORA), false);
  assert.equal(leggeLApp(reg.avvisi.find((x) => x.motivo === "blocco")!), true);
});

test("casella: i comandi dell'app per permesso, domanda, piano, coda, interrompi", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "casella-"));
  mandaComando(home, "rispondi_permesso", { chat: "c", rid: "p1", scelta: "consenti" });
  mandaComando(home, "rispondi_domanda", { chat: "c", rid: "q1", risposte: [] });
  mandaComando(home, "piano", { chat: "c", rid: "k1", esito: "approva" });
  mandaComando(home, "manda", { chat: "c", testo: "ciao", modo: "coda" });
  mandaComando(home, "interrompi", { chat: "c" });
  assert.equal(fs.readdirSync(path.join(home, ".claude", "casella", "comandi")).length, 5);
});

// Fuori dalla v1 del contratto (sezione 5): Codex e Cursor non scrivono nel registro.
test("attende formato Friday: Codex e Cursor nel registro (v2)", { todo: true }, () => {});
