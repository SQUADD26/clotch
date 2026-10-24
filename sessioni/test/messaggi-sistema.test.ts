import { test } from "node:test";
import * as assert from "node:assert/strict";
import { Convertitore } from "../src/messaggi-claude";
import { voci } from "../src/ui/chat/modello";

const utente = (content: unknown) => new Convertitore().riga({ type: "user", message: { content } }).nuovi;
const notifica = (stato: string, sommario: string) =>
  `<task-notification>\n<task-id>b1</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<output-file>/tmp/x</output-file>\n<status>${stato}</status>\n<summary>${sommario}</summary>\n</task-notification>`;

test("#484 system-reminder da solo: nascosto, in stringa e in blocco", () => {
  const r = "<system-reminder>\nSessionStart hook\n</system-reminder>";
  assert.deepEqual(utente(r), []);
  assert.deepEqual(utente([{ type: "text", text: r }]), []);
  assert.deepEqual(utente("<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>"), []);
  assert.deepEqual(utente("<local-command-stdout>ok</local-command-stdout>"), []);
});

test("#484 testo vero più reminder: resta solo il testo vero", () => {
  const r = "<system-reminder>\nnota\n</system-reminder>";
  assert.deepEqual(utente(`Fai il commit\n${r}`), [{ tipo: "utente", testo: "Fai il commit", t: null }]);
  assert.deepEqual(utente([{ type: "text", text: "Fai il commit" }, { type: "text", text: r }]), [{ tipo: "utente", testo: "Fai il commit", t: null }]);
});

test("#484 un messaggio vero che inizia con «<» resta una bolla identica", () => {
  assert.deepEqual(utente("<div> non va"), [{ tipo: "utente", testo: "<div> non va", t: null }]);
  const v = voci([{ tipo: "utente", testo: "<div> non va", t: 1 }], false);
  assert.deepEqual(v.map((x) => x.tipo), ["roberto"]);
});

test("#484 task-notification: una riga evento breve, mai una bolla di Roberto", () => {
  const dove = (sommario: string, stato = "completed") => voci([{ tipo: "utente", testo: notifica(stato, sommario), t: 5 }], false);
  assert.deepEqual(dove('Background command "sleep 5 && echo \\"x\\"" completed (exit code 0)'), [{ tipo: "evento", chiave: dove("a")[0].chiave, testo: "Comando in background finito", t: 5 }]);
  const testi = (s: string, st?: string) => dove(s, st).map((x) => x.tipo === "evento" ? x.testo : x.tipo);
  assert.deepEqual(testi('Agent "Cerca il bug" finished'), ['Agente "Cerca il bug" finito']);
  assert.deepEqual(testi('Background command "make" failed with exit code 2', "failed"), ["Comando in background non riuscito"]);
  assert.deepEqual(testi('Agent "Cerca il bug" was stopped by Claude', "killed"), ['Agente "Cerca il bug" fermato']);
  assert.deepEqual(testi('Monitor "log" stream ended'), ['Monitor "log" finito']);
  assert.deepEqual(testi("qualcosa di nuovo"), ["Comando in background finito"]);
});

test("#484 side-sessions-event e un tag mai visto: nascosti dalla regola, senza elenco", () => {
  const r = "<system-reminder>\nLinked sessions now\n</system-reminder>\n\n<side-sessions-event>None of the sessions is working now.</side-sessions-event>";
  assert.deepEqual(utente(r), []);
  assert.deepEqual(utente("<nuovo-evento-x>qualcosa\ndi nuovo</nuovo-evento-x>"), []);
  assert.deepEqual(utente('<altro_evento k="1">a</altro_evento>\n<nuovo-evento-x>b</nuovo-evento-x>'), []);
  assert.deepEqual(utente([{ type: "text", text: "<nuovo-evento-x>b</nuovo-evento-x>" }]), []);
  assert.deepEqual(utente('<wake reason="mention" current-time="x">\n  <project id="p"/>\n</wake>'), []);
});

test("#484 testo vero con un tag mai visto in coda o in testa: resta il testo vero", () => {
  const vero = [{ tipo: "utente", testo: "Fai il commit", t: null }];
  assert.deepEqual(utente("Fai il commit\n<nuovo-evento-x>b</nuovo-evento-x>"), vero);
  assert.deepEqual(utente("<nuovo-evento-x>b</nuovo-evento-x>\nFai il commit"), vero);
});

test("#484 di Roberto restano: pasted_content, bash-input, tag in mezzo al discorso, tag non chiuso", () => {
  for (const t of ['<pasted_content id="1">\nlog lungo\n</pasted_content>', "<bash-input>ls</bash-input>", "<div>x</div>", "Il componente <mio-tag>x</mio-tag> non va", "<mio-tag>aperto e mai chiuso"])
    assert.deepEqual(utente(t), [{ tipo: "utente", testo: t, t: null }]);
  const m = utente("<system-reminder>n</system-reminder>\n<pasted_content>log</pasted_content>");
  assert.deepEqual(m.map((x) => (x as any).testo), ["<pasted_content>log</pasted_content>"]);
});

const riga = (extra: object, content: unknown) => new Convertitore().riga({ type: "user", message: { content }, ...extra }).nuovi;
const eventi = (testo: string) => voci(riga({ turnOrigin: "peer" }, testo) as any, false).map((x) => (x.tipo === "evento" ? x.testo : x.tipo));

test("#484 turnOrigin: system, scheduled, auto_continuation, valori mai visti e origin plugin/coordinator si nascondono; human e sdk no", () => {
  for (const turnOrigin of ["system", "scheduled", "auto_continuation", "nuovo_valore"]) assert.deepEqual(riga({ turnOrigin }, "Testo dell'harness"), [], turnOrigin);
  for (const kind of ["plugin", "coordinator", "auto-continuation"]) assert.deepEqual(riga({ origin: { kind } }, [{ type: "text", text: "Nota" }]), [], kind);
  for (const turnOrigin of ["human", "sdk"]) assert.equal(riga({ turnOrigin }, "Ciao").length, 1, turnOrigin);
  assert.equal(riga({}, "Ciao").length, 1);
});

test("#484 turnOrigin nascosto non perde l'esito di uno strumento nella stessa riga", () => {
  const c = new Convertitore();
  c.riga({ type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] } });
  const r = c.riga({ type: "user", turnOrigin: "system", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] } });
  assert.equal(r.aggiornati.length, 1);
});

test("#484 messaggio da un'altra sessione: riga evento «Messaggio da <nome>», mai una bolla", () => {
  const msg = (attr: string) => `Another Claude session sent a message:\n<cross-session-message ${attr}>\nCiao dal fratello\n</cross-session-message>`;
  assert.deepEqual(eventi(msg('from="uds:/tmp/x.sock" from-name="H-331 - Orchestratore" from-mode="bypass"')), ["Messaggio da H-331 - Orchestratore"]);
  assert.deepEqual(eventi(msg('from="local_4caf" name="★ MENU BAR" encoded="1"')), ["Messaggio da ★ MENU BAR"]);
  assert.deepEqual(eventi(msg('from="uds:/tmp/x.sock"')), ["Messaggio da un’altra sessione"]);
  assert.deepEqual(eventi('<relay from="coordinator" session="s1">\n  nota\n</relay>'), ["Messaggio da un’altra sessione"]);
  // un reminder fra due messaggi: solo gli eventi, nessuna bolla
  const due = `${msg('name="A"')}\n<system-reminder>\nnota\n</system-reminder>\n${msg('name="B"')}`;
  assert.deepEqual(eventi(due), ["Messaggio da A", "Messaggio da B"]);
});

test("#484 notifica più testo vero: evento e bolla, nell'ordine", () => {
  const v = voci([{ tipo: "utente", testo: `${notifica("completed", 'Agent "A" finished')}\n\nOra il test`, t: 1 }], false);
  assert.deepEqual(v.map((x) => x.tipo === "evento" ? x.testo : x.tipo === "roberto" ? `roberto:${x.testo}` : x.tipo), ['Agente "A" finito', "roberto:Ora il test"]);
});

test("stati del turno: api_error diventa «Riprovo», limite e «No response requested» non fanno avvisi grezzi", () => {
  const c = new Convertitore();
  const riprova = c.riga({ type: "system", subtype: "api_error", level: "error", retryAttempt: 1, maxRetries: 10 }).nuovi;
  assert.deepEqual(riprova, [{ tipo: "errore", testo: "", t: null, riprova: { n: 1, di: 10 } }]);
  const grezzi = [...riprova, { tipo: "errore" as const, testo: "You've hit your session limit · resets 5pm", t: null }, { tipo: "errore" as const, testo: "No response requested.", t: null }];
  const v = voci([{ tipo: "utente", testo: "x", t: 0 }, ...grezzi], false);
  const b = v[1].tipo === "turno" ? v[1].blocchi : [];
  assert.deepEqual(b.map((x) => x.tipo), ["errore"]);
  assert.deepEqual(b[0].tipo === "errore" && b[0].riprova, { n: 1, di: 10 });
});
