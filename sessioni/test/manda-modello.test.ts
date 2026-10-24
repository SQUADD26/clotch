// #457: `manda` porta l'id CLI del modello scelto; il rifiuto del motore si legge nella chat.
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { inviaComando } from "../src/comandi";
import { argsManda, erroreComando, idModello, MODELLI } from "../src/ui/chat/testi";

const RIFIUTO = "Il modello non cambia nei messaggi in coda. Invia subito o attendi la fine del turno.";

test("manda: con un modello scelto il comando scritto ha l'id CLI, mai l'etichetta", async () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "manda-modello-"));
  const dir = path.join(h, ".claude", "casella", "comandi");
  const registro = path.join(h, ".claude", "registro", `${new Date().toISOString().slice(0, 7)}.jsonl`);
  const p = inviaComando(h, "manda", argsManda("chat-1", "ciao", "subito", "Sonnet 5.5", null), { ogniMs: 10, scadenzaMs: 3000 });
  let c: any;
  while (!c) { // clotch AI finta: legge il comando e risponde «rifiutato» come il motore in coda con modello
    const f = fs.existsSync(dir) ? fs.readdirSync(dir).find((n) => n.endsWith(".json")) : null;
    if (f) c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); else await new Promise((ok) => setTimeout(ok, 5));
  }
  fs.mkdirSync(path.dirname(registro), { recursive: true });
  fs.appendFileSync(registro, JSON.stringify({ v: 1, id: "r-000000000000", t: new Date().toISOString(), n: 1, chat: "friday", macchina: "mac", hook_v: "x", tipo: "comando_fatto", dati: { comando: c.id, esito: "rifiutato", testo: RIFIUTO } }) + "\n"); // nome del protocollo del motore
  assert.deepEqual(c.args, { chat: "chat-1", testo: "ciao", modo: "subito", modello: "claude-sonnet-5-5" });
  const e = await p;
  assert.equal(e.esito, "rifiutato");
  assert.equal(erroreComando(e), RIFIUTO); // il testo del motore, non «Sessione non raggiunta»
});

test("manda: il modello va solo se diverso da quello della sessione, mai in coda; ogni etichetta ha un id ammesso", () => {
  const base = { chat: "c", testo: "t", modo: "subito" };
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", "claude-sonnet-5-5"), { ...base, modello: "claude-opus-5-5" }); // sessione su sonnet, preferenza Opus
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", "claude-opus-5-5"), base); // già su opus: niente campo
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", "claude-opus-5-5-20260101"), base); // suffisso di data della trascrizione
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", null), { ...base, modello: "claude-opus-5-5" }); // modello della sessione sconosciuto
  assert.deepEqual(argsManda("c", "t", "coda", "Haiku 5.5", null), { ...base, modo: "coda" }); // coda: il motore lo rifiuterebbe
  assert.deepEqual(argsManda("c", "t", "subito", "Sconosciuto", null), base);
  // impegno e modalità veloce (#467): partono solo se scelti e solo «subito»; il livello base non è mai una scelta
  const scelte = { sforzo: "xhigh", rapida: true };
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", "claude-opus-5-5", scelte), { ...base, sforzo: "xhigh", rapida: true });
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", "claude-sonnet-5-5", scelte), { ...base, modello: "claude-opus-5-5", sforzo: "xhigh", rapida: true });
  assert.deepEqual(argsManda("c", "t", "coda", "Opus 5.5", null, scelte), { ...base, modo: "coda" });
  assert.deepEqual(argsManda("c", "t", "subito", "Opus 5.5", "claude-opus-5-5", { sforzo: undefined, rapida: false }), base);
  const ammessi = ["haiku", "sonnet", "opus", "fable", "claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"];
  for (const [et, m] of Object.entries(MODELLI)) { assert.ok(ammessi.includes(m.id), m.id); assert.equal(idModello(et), m.id); }
  assert.equal(idModello("Sconosciuto"), undefined);
  assert.equal(erroreComando(null), "Sessione non raggiunta");
  assert.equal(erroreComando({ id: "c", esito: "errore", testo: "boh" }), "Sessione non raggiunta");
});
