// Stati di clotch AI (101-36642, 36832, 37055, 37278, 37492): solo dati finti del registro, mai microfono o voce veri.
import test from "node:test";
import assert from "node:assert/strict";
import { leggiRegistro, type ChatClotchAi, type Registro } from "../src/clotch-ai";
import { fermaVoce, leggi, staParlando, suVoce } from "../src/voce-app";
import { statoVoce } from "../src/ui/clotch-ai/statoVoce";
import { suggerimenti } from "../src/ui/clotch-ai/vista";
import childProcess = require("node:child_process");

const ORA = Date.parse("2026-10-23T14:00:00.000Z");
const vuoto = (): Registro => leggiRegistro("/non/esiste", { FRIDAY_REGISTRO: "/non/esiste" }); // nome del protocollo del motore
const chat = (id: string, progetto: string, stato: string, extra: Partial<ChatClotchAi> = {}): ChatClotchAi => ({
  chat: id, titolo: id, madre: null, progetto, account: null, sorgente: null, daHandoff: null, stato, dettaglio: null, aspetto: null, domanda: null, limite: null,
  richieste: [], battito: ORA, aiutanti: new Map(), compattazioni: 0, interrotta: null, coda: [], obiettivo: null, passi: [], visto: ORA, fine: null, fineT: null,
  chatNuova: null, fermata: false, quarantena: null, errore: null, rifiuto: null, persi: 0, ...extra,
});
const conClotch = (ascolta: boolean, parla: boolean, t = ORA): Registro => ({ ...vuoto(), clotch: { voce: "accesa", ascolta, parla, t } });

test("stato voce: ti ascolta e sta parlando vengono da Clotch acceso, ascolta prima di parla", () => {
  assert.equal(statoVoce(conClotch(true, false), ORA), "ascolta");
  assert.equal(statoVoce(conClotch(false, true), ORA), "parla");
  assert.equal(statoVoce(conClotch(true, true), ORA), "ascolta");
  assert.equal(statoVoce(conClotch(false, false), ORA), null);
});

test("stato voce: un evento di Clotch vecchio di più di 10 minuti o a voce spenta non conta", () => {
  assert.equal(statoVoce(conClotch(true, false, ORA - 601_000), ORA), null);
  assert.equal(statoVoce(conClotch(true, false, ORA - 599_000), ORA), "ascolta");
  assert.equal(statoVoce({ ...vuoto(), clotch: { voce: "spenta", ascolta: true, parla: false, t: ORA } }, ORA), null);
});

test("stato voce: la voce dell'app dice «sta parlando»; il microfono manca solo con l'elenco dei microfoni vuoto", () => {
  assert.equal(statoVoce(vuoto(), ORA, true), "parla");
  assert.equal(statoVoce(vuoto(), ORA), null);
  assert.equal(statoVoce({ ...vuoto(), impostazioni: { microfoni_disponibili: [] } }, ORA), "mic-no");
  assert.equal(statoVoce({ ...vuoto(), impostazioni: { microfoni_disponibili: ["MacBook Pro"] } }, ORA), null);
  assert.equal(statoVoce({ ...vuoto(), impostazioni: { attiva: true } }, ORA), null, "elenco non scritto: non si sa, niente avviso");
  assert.equal(statoVoce({ ...conClotch(true, false), impostazioni: { microfoni_disponibili: [] } }, ORA), "ascolta");
});

test("prima apertura: le domande nominano i progetti veri del registro", () => {
  const r = vuoto();
  assert.deepEqual(suggerimenti(r, ORA), ["Cosa aspetta me?"], "senza progetti solo la domanda che vale sempre");
  r.chat.set("a", chat("a", "clotch", "lavora"));
  r.chat.set("b", chat("b", "clotch", "lavora"));
  r.chat.set("c", chat("c", "squadd-v2", "serve_roberto"));
  assert.deepEqual(suggerimenti(r, ORA), ["Cosa aspetta me?", "Ferma le sessioni di clotch", "Com’è messo squadd-v2?"]);
  const uno = vuoto();
  uno.chat.set("a", chat("a", "clotch", "finito"));
  assert.deepEqual(suggerimenti(uno, ORA), ["Cosa aspetta me?", "Ferma le sessioni di clotch"], "un solo progetto: niente seconda domanda sullo stesso");
});

test("voce dell'app: sta parlando finché say gira, Interrompi lo ferma e chi ascolta lo sa", { skip: process.platform !== "darwin" }, (t) => {
  const prima = process.env.CLOTCH_TEST_SILENT;
  t.after(() => { if (prima === undefined) delete process.env.CLOTCH_TEST_SILENT; else process.env.CLOTCH_TEST_SILENT = prima; });
  delete process.env.CLOTCH_TEST_SILENT; // la prova silenziosa non lancia say: qui say è finto, nessun suono
  const fine: Array<() => void> = [];
  const killed: number[] = [];
  t.mock.method(childProcess, "execFile", (_cmd: string, _args: string[], cb: () => void) => {
    const i = fine.length;
    fine.push(cb);
    return { kill: () => { killed.push(i); cb(); } };
  });
  const visti: boolean[] = [];
  const smetti = suVoce((p) => visti.push(p));
  assert.equal(staParlando(), false);
  leggi("Serve il tuo sì");
  assert.equal(staParlando(), true);
  leggi("Un secondo avviso");
  fine[0]();
  assert.equal(staParlando(), true, "la seconda frase gira ancora");
  fermaVoce();
  assert.deepEqual(killed, [1], "Interrompi ferma solo ciò che gira");
  assert.equal(staParlando(), false);
  assert.deepEqual(visti, [true, true, true, false]);
  smetti();
  leggi("Dopo");
  assert.equal(visti.length, 4, "chi ha smesso di ascoltare non riceve più niente");
  console.log("VOCE_APP_STATO_OK parla=false dopo interrompi");
});
