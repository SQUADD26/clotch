// Situazioni che arrivano dal registro di Friday (contratto v1). Righe del catalogo: test/situazioni.md, colonna «Friday».
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { leggiRegistro, mandaComando } from "../src/friday";

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
test("avviso di Friday", () => assert.deepEqual(reg.avvisi.map((a) => [a.livello, a.motivo]), [["alto", "blocco"]]));

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

// Righe del catalogo che il contratto v1 non copre ancora: lacune mandate a «⚙︎ Friday: costruzione del motore».
for (const s of [
  "non risponde (soglia del battito non scritta nel contratto)",
  "permesso da dare: evento richiesta e comando rispondi_permesso",
  "domanda a metà turno: comando rispondi_domanda",
  "piano da approvare: comando piano",
  "messaggi in coda e manda subito/coda",
  "interrotta (comando interrompi, evento)",
  "aiutanti: inizio e fine sottoagente",
  "compattazione",
  "handoff di una chat",
  "limite d'uso: account e ora di ripartenza",
  "più account: campo account in inizio",
  "bloccata da un hook qualsiasi (PreToolUse)",
  "Clotch acceso o assente: voce, dettatura, avvisi",
]) test(`attende formato Friday: ${s}`, { todo: true }, () => {});
